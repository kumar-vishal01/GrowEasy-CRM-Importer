import { CrmRecord, CRM_FIELD_NAMES } from "../../types/schema";
import { LLMProvider, LLMProviderError, RawRow, fetchWithTimeout } from "./LLMProvider";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { logger } from "../../utils/logger";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Groq Provider (groq.com — fast LLM inference platform)
 *
 * Groq is OpenAI API compatible.
 * Only the endpoint, API key and model differ.
 */
export class GroqProvider implements LLMProvider {
    public readonly name = "groq";

    private readonly apiKey: string;
    private readonly model: string;

    constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
        if (!apiKey) {
            throw new Error("GROQ_API_KEY is required to construct GroqProvider");
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

            response = await fetchWithTimeout(GROQ_API_URL, {

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
                            content:
                                `Here is the batch to map. Respond ONLY with a valid JSON object of the form {"results":[...]}. Do not include markdown or explanations.\n\n${userPrompt}`,
                        },
                    ],

                    response_format: {
                        type: "json_object",
                    },
                }),
            });

        } catch (err) {

            if (err instanceof LLMProviderError) throw err;

            throw new LLMProviderError(
                `Network error calling Groq: ${(err as Error).message}`,
                true
            );

        }

        if (response.status === 429) {

            const retryAfterHeader = response.headers.get("retry-after");

            const retryAfterMs = retryAfterHeader
                ? Number(retryAfterHeader) * 1000
                : undefined;

            throw new LLMProviderError(
                "Groq rate limit exceeded",
                true,
                retryAfterMs
            );
        }

        if (response.status >= 500) {

            throw new LLMProviderError(
                `Groq server error: ${response.status}`,
                true
            );

        }

        if (!response.ok) {

            const body = await response.text().catch(() => "");

            throw new LLMProviderError(
                `Groq request failed (${response.status}): ${body.slice(0, 300)}`,
                false
            );

        }

        const data: any = await response.json();

        const content: string | undefined =
            data?.choices?.[0]?.message?.content;

        if (!content) {

            throw new LLMProviderError(
                "Groq response missing message content",
                true
            );

        }

        return parseAndValidateShape(content, rows.length);
    }
}

/**
 * Parses and validates the Groq response.
 */
function parseAndValidateShape(
    raw: string,
    expectedLength: number
): Partial<CrmRecord>[] {

    let parsed: unknown;

    try {

        const cleaned = raw
            .replace(/^```json\s*|```$/g, "")
            .trim();

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
        Array.isArray((parsed as any).results)
    ) {

        arr = (parsed as any).results;

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