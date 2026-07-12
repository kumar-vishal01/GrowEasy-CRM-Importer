import { CrmRecord, CRM_FIELD_NAMES, CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "../../types/schema";
import { LLMProvider, RawRow } from "./LLMProvider";

/**
 * Deterministic, rule-based stand-in for a real LLM. Lets the entire
 * pipeline (batching, retry, validation, skip-rule, UI) be exercised with
 * zero network calls and zero API cost. Uses simple header-name heuristics
 * rather than true language understanding — good enough to prove the
 * pipeline end to end, not a replacement for the real provider's mapping
 * quality.
 */
export class MockProvider implements LLMProvider {
  public readonly name = "mock";

  async mapBatch(rows: RawRow[], _headers: string[]): Promise<Partial<CrmRecord>[]> {
    // Simulate realistic async latency so loading states are visible.
    await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
    return rows.map((row) => mapRowHeuristically(row));
  }
}

const FIELD_ALIASES: Record<keyof CrmRecord, string[]> = {
  created_at: ["created_at", "date", "created date", "created on", "timestamp", "lead date"],
  name: ["name", "full name", "lead name", "contact name", "customer name"],
  email: ["email", "email address", "e-mail"],
  country_code: ["country code", "isd code", "dial code"],
  mobile_without_country_code: [
    "phone",
    "mobile",
    "contact no",
    "contact number",
    "mobile number",
    "cell",
    "whatsapp number",
    "phone number",
  ],
  company: ["company", "organization", "employer", "business name"],
  city: ["city", "town"],
  state: ["state", "province"],
  country: ["country"],
  lead_owner: ["lead owner", "owner", "assigned to", "sales rep", "agent"],
  crm_status: ["status", "crm status", "lead status"],
  crm_note: ["note", "notes", "remarks", "comments"],
  data_source: ["source", "data source", "campaign", "project", "lead source"],
  possession_time: ["possession", "possession time", "possession date"],
  description: ["description", "details", "message", "inquiry"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_.]/g, " ").replace(/\s+/g, " ");
}

function findColumnValue(row: RawRow, field: keyof CrmRecord): string {
  const aliases = FIELD_ALIASES[field];
  for (const [header, value] of Object.entries(row)) {
    const normalized = normalizeHeader(header);
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return (value ?? "").toString().trim();
    }
  }
  return "";
}

function splitMultiValue(value: string): { first: string; rest: string[] } {
  if (!value) return { first: "", rest: [] };
  const parts = value
    .split(/[,;/\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { first: parts[0] ?? "", rest: parts.slice(1) };
}

function extractCountryCode(phone: string): { countryCode: string; localNumber: string } {
  const digitsOnly = phone.replace(/\D/g, "");

  // Only treat leading digits as a country code when there's clear
  // evidence of one — i.e. more digits than a standard 10-digit local
  // number. A bare 10-digit number is assumed to be the full local number
  // even if it happens to start with digits like "91" — otherwise a
  // perfectly valid Indian mobile number starting with 9 gets truncated.
  if (digitsOnly.length > 10) {
    const countryCodeDigits = digitsOnly.slice(0, digitsOnly.length - 10);
    const localNumber = digitsOnly.slice(-10);
    return { countryCode: `+${countryCodeDigits}`, localNumber };
  }

  return { countryCode: "", localNumber: digitsOnly };
}

function mapRowHeuristically(row: RawRow): Partial<CrmRecord> {
  const record: Partial<CrmRecord> = {};
  for (const field of CRM_FIELD_NAMES) {
    record[field] = "" as never;
  }

  const noteParts: string[] = [];

  // Email (with multi-value split)
  const rawEmail = findColumnValue(row, "email");
  const { first: firstEmail, rest: restEmails } = splitMultiValue(rawEmail);
  record.email = firstEmail;
  restEmails.forEach((e) => noteParts.push(`Additional email: ${e}`));

  // Phone (with multi-value split + country code extraction)
  const rawPhone = findColumnValue(row, "mobile_without_country_code");
  const { first: firstPhone, rest: restPhones } = splitMultiValue(rawPhone);
  const { countryCode, localNumber } = extractCountryCode(firstPhone);
  record.mobile_without_country_code = localNumber;
  record.country_code = countryCode || findColumnValue(row, "country_code");
  restPhones.forEach((p) => noteParts.push(`Additional phone: ${p}`));

  // Straightforward direct-mapped fields
  record.name = findColumnValue(row, "name");
  record.company = findColumnValue(row, "company");
  record.city = findColumnValue(row, "city");
  record.state = findColumnValue(row, "state");
  record.country = findColumnValue(row, "country");
  record.lead_owner = findColumnValue(row, "lead_owner");
  record.possession_time = findColumnValue(row, "possession_time");
  record.description = findColumnValue(row, "description");

  // created_at: only accept if it looks date-like; otherwise leave blank
  // (validator will fall back to ingestion time).
  const rawDate = findColumnValue(row, "created_at");
  record.created_at = rawDate && !isNaN(Date.parse(rawDate)) ? rawDate : "";

  // crm_status: only accept exact enum matches (case-insensitive, loose match)
  const rawStatus = findColumnValue(row, "crm_status").toUpperCase().replace(/\s+/g, "_");
  record.crm_status = (CRM_STATUS_VALUES as readonly string[]).includes(rawStatus)
    ? (rawStatus as CrmRecord["crm_status"])
    : "";

  // data_source: only accept exact, confident matches — otherwise blank
  const rawSource = findColumnValue(row, "data_source").toLowerCase().replace(/\s+/g, "_");
  record.data_source = (DATA_SOURCE_VALUES as readonly string[]).includes(rawSource)
    ? (rawSource as CrmRecord["data_source"])
    : "";

  // Any column that wasn't consumed by a known field goes into crm_note
  const consumedHeaders = new Set<string>();
  for (const field of CRM_FIELD_NAMES) {
    for (const [header] of Object.entries(row)) {
      const normalized = normalizeHeader(header);
      if (FIELD_ALIASES[field].some((alias) => normalized === alias || normalized.includes(alias))) {
        consumedHeaders.add(header);
      }
    }
  }
  for (const [header, value] of Object.entries(row)) {
    if (!consumedHeaders.has(header) && value && value.trim()) {
      noteParts.push(`${header}: ${value.trim()}`);
    }
  }

  const existingNote = findColumnValue(row, "crm_note");
  if (existingNote) noteParts.unshift(existingNote);
  record.crm_note = noteParts.join(" | ");

  return record;
}
