import { CrmRecord } from "../types/schema";
import { LLMProvider, LLMProviderError, RawRow } from "./llm/LLMProvider";
import { logger } from "../utils/logger";

export interface BatchResult {
  batchIndex: number;
  rowIndices: number[]; // original row indices this batch covers
  records: Partial<CrmRecord>[] | null; // null if the batch ultimately failed
  failed: boolean;
}

export interface BatchProcessorOptions {
  batchSize: number;
  concurrencyLimit: number;
  maxRetries: number;
  baseBackoffMs: number;
}

export const DEFAULT_BATCH_OPTIONS: BatchProcessorOptions = {
  batchSize: 10,
  concurrencyLimit: 1,
  maxRetries: 2,
  baseBackoffMs: 500,
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs one batch through the provider with exponential backoff retry.
 * A single failed batch never throws out of this function — it resolves
 * with `failed: true` so the rest of the import can proceed.
 */
async function processSingleBatch(
  provider: LLMProvider,
  rows: RawRow[],
  headers: string[],
  rowIndices: number[],
  batchIndex: number,
  options: BatchProcessorOptions
): Promise<BatchResult> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= options.maxRetries) {
    try {
      const records = await provider.mapBatch(rows, headers);
      return { batchIndex, rowIndices, records, failed: false };
    } catch (err) {
      lastError = err as Error;
      const isRetryable = err instanceof LLMProviderError ? err.retryable : true;
      const providerRetryAfter =
        err instanceof LLMProviderError ? err.retryAfterMs : undefined;

      if (!isRetryable || attempt === options.maxRetries) {
        logger.error("Batch failed permanently", {
          batchIndex,
          attempt,
          error: lastError.message,
        });
        return { batchIndex, rowIndices, records: null, failed: true };
      }

      const backoff = providerRetryAfter ?? options.baseBackoffMs * Math.pow(2, attempt);
      logger.warn("Batch attempt failed, retrying", {
        batchIndex,
        attempt,
        backoffMs: backoff,
        error: lastError.message,
      });
      await sleep(backoff);
      attempt += 1;
    }
  }

  return { batchIndex, rowIndices, records: null, failed: true };
}

/**
 * Simple concurrency-limited scheduler: runs `tasks` with at most
 * `limit` in flight at once. Avoids a thundering-herd on the provider
 * and keeps memory bounded for very large files.
 */
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function processAllBatches(
  provider: LLMProvider,
  allRows: RawRow[],
  headers: string[],
  options: BatchProcessorOptions = DEFAULT_BATCH_OPTIONS
): Promise<BatchResult[]> {
  const indexedChunks = chunk(
    allRows.map((row, idx) => ({ row, idx })),
    options.batchSize
  );

  const tasks = indexedChunks.map((batch, batchIndex) => {
    const rows = batch.map((b) => b.row);
    const rowIndices = batch.map((b) => b.idx);
    return () => processSingleBatch(provider, rows, headers, rowIndices, batchIndex, options);
  });

  logger.info("Starting batch processing", {
    totalRows: allRows.length,
    totalBatches: tasks.length,
    batchSize: options.batchSize,
    concurrencyLimit: options.concurrencyLimit,
  });

  return runWithConcurrencyLimit(tasks, options.concurrencyLimit);
}
