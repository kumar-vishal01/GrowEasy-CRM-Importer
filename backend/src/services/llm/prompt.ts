import { CRM_FIELD_NAMES, CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "../../types/schema";
import { RawRow } from "./LLMProvider";

/**
 * System prompt: fixed schema + rules, sent once per batch call (not once
 * per row) so the "how to map" instructions are amortized across the batch.
 */
export function buildSystemPrompt(): string {
  return `You are a strict data-mapping engine for a real-estate CRM called GrowEasy.

You will receive a JSON array of raw CSV rows (each row is an object of arbitrary column-name -> string value pairs, e.g. from Facebook Lead Ads, Google Ads exports, or manual spreadsheets). Column names are inconsistent and unpredictable across different files.

Your ONLY job is to map each raw row onto this exact target schema (use these exact key names):
${CRM_FIELD_NAMES.map((f) => `- ${f}`).join("\n")}

FIELD RULES:
- "created_at": produce a date string parseable by JavaScript's \`new Date()\` (prefer ISO-8601). If no date-like value exists in the row, leave it as an empty string "" — do not invent a date.
- "email": if the source cell contains multiple emails separated by commas/semicolons/slashes/newlines, put only the FIRST valid-looking email here. Put every additional email into "crm_note" as readable text (e.g. "Additional email: foo@bar.com").
- "mobile_without_country_code": the phone number WITHOUT its country code (strip a leading + and country code like 91, 1, 44 if clearly present). Recognize columns like "Phone", "Contact No.", "Mobile Number", "Mobile", "Cell", "WhatsApp Number", etc. as candidates for this field even if the header doesn't say "mobile". If multiple phone numbers exist in one cell, keep only the first valid one here and put the rest into "crm_note" (e.g. "Additional phone: 9876543210").
- "country_code": the phone country code if identifiable (e.g. "+91"), else "".
- "crm_status": MUST be exactly one of: ${CRM_STATUS_VALUES.join(", ")}. If nothing in the row indicates a status, leave it as "" — never invent one.
- "data_source": MUST be exactly one of: ${DATA_SOURCE_VALUES.join(", ")}, OR an empty string "". Only output one of these values if the row contains an EXPLICIT, unambiguous textual reference to that exact project/campaign name (e.g. a column literally naming the project, or a campaign-name value that matches). Do NOT infer this from loose context, area names, or guesses. If you are not fully confident, output "".
- Any information in the row that does not clearly belong to one of the other 14 fields (extra columns, notes, ad-campaign metadata, comments, etc.) should be appended to "crm_note" as readable "Label: value" text, not discarded.
- "possession_time" and "description" are free text — fill from clearly relevant source columns if present, else "".
- All 15 fields must be present in every output object. Use "" for any field you cannot confidently fill. Never use null, never omit a key.

OUTPUT CONTRACT (critical):
- Respond with ONLY a raw JSON array, no prose, no markdown code fences, no explanation before or after.
- The array must have EXACTLY the same number of elements as the input array, in the SAME order — element i of your output corresponds to element i of the input.
- Each element is a flat JSON object containing exactly these 15 keys: ${CRM_FIELD_NAMES.join(", ")}.`;
}

export function buildUserPrompt(rows: RawRow[], headers: string[]): string {
  return JSON.stringify(
    {
      sourceHeaders: headers,
      rows,
    },
    null,
    0
  );
}
