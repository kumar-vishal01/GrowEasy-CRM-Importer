import { CrmRecord } from "../../types/schema";

/**
 * A batch of raw CSV rows (headers + values as plain string maps) sent to
 * the LLM for field mapping. Order MUST be preserved end to end — the
 * caller matches responses back to source rows strictly by array index.
 */
export type RawRow = Record<string, string>;

/**
 * Thrown by providers on any failure. `retryable` tells the batch processor
 * whether backoff-and-retry makes sense (network/5xx/rate-limit) or whether
 * it's a permanent failure (bad API key, malformed request).
 */
export class LLMProviderError extends Error {
  public readonly retryable: boolean;
  public readonly retryAfterMs?: number;

  constructor(message: string, retryable: boolean, retryAfterMs?: number) {
    super(message);
    this.name = "LLMProviderError";
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface LLMProvider {
  /** Human-readable provider name, used in logs and API meta. */
  readonly name: string;

  /**
   * Maps a batch of raw rows onto the CRM schema. Must return exactly
   * `rows.length` objects, in the same order as the input. Providers are
   * responsible only for *mapping* — enum/date/skip-rule enforcement is
   * done afterwards by the validator, never trusted from the LLM alone.
   */
  mapBatch(rows: RawRow[], headers: string[]): Promise<Partial<CrmRecord>[]>;
}

const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS || 30000);

/**
 * fetch() wrapper with a hard timeout. Without this, a single hung
 * provider request can occupy a concurrency-limited worker slot
 * indefinitely, stalling the rest of the import. A timeout is surfaced as
 * a retryable LLMProviderError, same as a network error.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new LLMProviderError(`Request timed out after ${timeoutMs}ms`, true);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
