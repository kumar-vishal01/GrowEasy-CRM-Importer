import { CrmRecord, CRM_FIELD_NAMES } from "../../types/schema";
import {
  LLMProvider,
  LLMProviderError,
  RawRow,
  fetchWithTimeout,
} from "./LLMProvider";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { logger } from "../../utils/logger";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Type for OpenAI Chat Completion response
 */
interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * OpenAI adapter. Uses the Chat Completions API with a JSON-object response
 * format hint. Any provider swap only requires implementing LLMProvider —
 * nothing outside this file needs to know OpenAI is being used.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = "openai";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to construct OpenAIProvider");
    }

    this.apiKey = apiKey;
    this.model = model;
  }

  async mapBatch(
    rows: RawRow[],
    headers: string[]
  ): Promise<Partial<CrmRecord>[]> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(rows, headers);

    let response: Response;

    try {
      response = await fetchWithTimeout(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: `Here is the batch to map. Respond with a JSON object of shape {"results": [...]} where "results" is the JSON array described in the system prompt.\n\n${userPrompt}`,
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
      });
    } catch (err) {
      if (err instanceof LLMProviderError) {
        throw err;
      }

      throw new LLMProviderError(
        `Network error calling OpenAI: ${(err as Error).message}`,
        true
      );
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");

      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : undefined;

      throw new LLMProviderError(
        "OpenAI rate limit exceeded",
        true,
        retryAfterMs
      );
    }

    if (response.status >= 500) {
      throw new LLMProviderError(
        `OpenAI server error: ${response.status}`,
        true
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      throw new LLMProviderError(
        `OpenAI request failed (${response.status}): ${body.slice(0, 300)}`,
        false
      );
    }

    // ✅ FIXED TYPE ERROR
    const data = (await response.json()) as OpenAIChatResponse;

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new LLMProviderError(
        "OpenAI response missing message content",
        true
      );
    }

    return parseAndValidateShape(content, rows.length);
  }
}

/**
 * Parses the model's JSON output and enforces the structural contract.
 */
function parseAndValidateShape(
  raw: string,
  expectedLength: number
): Partial<CrmRecord>[] {
  let parsed: unknown;

  try {
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new LLMProviderError(
      `LLM output was not valid JSON: ${(err as Error).message}`,
      true
    );
  }

  let arr: unknown;

  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).results)
  ) {
    arr = (parsed as Record<string, unknown>).results;
  } else {
    throw new LLMProviderError(
      "LLM output was valid JSON but not the expected array/results shape",
      true
    );
  }

  const results = arr as unknown[];

  if (results.length !== expectedLength) {
    logger.warn("LLM batch length mismatch", {
      expected: expectedLength,
      received: results.length,
    });

    throw new LLMProviderError(
      `LLM returned ${results.length} records, expected ${expectedLength}`,
      true
    );
  }

  return results.map((item) => {
    if (!item || typeof item !== "object") {
      return {} as Partial<CrmRecord>;
    }

    const record: Partial<CrmRecord> = {};

    for (const field of CRM_FIELD_NAMES) {
      const value = (item as Record<string, unknown>)[field];

      (record as Record<string, unknown>)[field] =
        typeof value === "string" ? value : "";
    }

    return record;
  });
}