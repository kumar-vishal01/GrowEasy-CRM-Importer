import {
  CrmRecord,
  CRM_FIELD_NAMES,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  SkippedRecord,
} from "../types/schema";
import { RawRow } from "./llm/LLMProvider";
import { logger } from "../utils/logger";

const CRM_STATUS_SET = new Set<string>(CRM_STATUS_VALUES);
const DATA_SOURCE_SET = new Set<string>(DATA_SOURCE_VALUES);

/** Splits a cell value on common delimiters; returns first + the rest. */
function splitMultiValue(value: string): { first: string; rest: string[] } {
  if (!value) return { first: "", rest: [] };
  const parts = value
    .split(/[,;/\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { first: parts[0] ?? "", rest: parts.slice(1) };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fields that hold free text and could plausibly be re-exported to a
// spreadsheet later (e.g. the CRM's own "export to Excel" feature). A cell
// beginning with =, +, -, or @ can be interpreted as a formula by Excel/
// Sheets, enabling CSV/formula injection against whoever opens that export.
// We defuse it here — at the boundary where untrusted input enters the
// system — rather than assuming every future consumer will remember to.
const FORMULA_INJECTION_PREFIX = /^[=+\-@]/;
const TEXT_FIELDS_TO_SANITIZE: (keyof CrmRecord)[] = [
  "name",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_note",
  "possession_time",
  "description",
];

function sanitizeFormulaInjection(value: string): string {
  if (!value) return value;
  return FORMULA_INJECTION_PREFIX.test(value) ? `'${value}` : value;
}

/**
 * Re-applies multi-value splitting as a secondary pass, in case the LLM
 * left residual delimiters in the email/phone fields. Idempotent if the
 * LLM already split correctly.
 */
function sanitizeMultiValueFields(record: CrmRecord): { record: CrmRecord; extraNotes: string[] } {
  const extraNotes: string[] = [];

  if (record.email) {
    const { first, rest } = splitMultiValue(record.email);
    if (rest.length > 0) {
      record.email = EMAIL_REGEX.test(first) ? first : "";
      rest.forEach((e) => extraNotes.push(`Additional email: ${e}`));
    } else if (first && !EMAIL_REGEX.test(first)) {
      // Looks malformed rather than multi-value — leave as-is but don't
      // silently discard; note it for manual review.
      extraNotes.push(`Unparsed email value: ${first}`);
      record.email = "";
    }
  }

  if (record.mobile_without_country_code) {
    const { first, rest } = splitMultiValue(record.mobile_without_country_code);
    record.mobile_without_country_code = first.replace(/[^\d]/g, "");
    rest.forEach((p) => extraNotes.push(`Additional phone: ${p}`));
  }

  return { record, extraNotes };
}

function validateCrmStatus(value: string): string {
  if (!value) return "";
  if (CRM_STATUS_SET.has(value)) return value;
  logger.debug("Invalid crm_status coerced to blank", { value });
  return "";
}

function validateDataSource(value: string): string {
  if (!value) return "";
  if (DATA_SOURCE_SET.has(value)) return value;
  logger.debug("Invalid data_source coerced to blank", { value });
  return "";
}

function validateCreatedAt(value: string): string {
  if (value) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  // Fall back to ingestion time; never fail the record over this.
  return new Date().toISOString();
}

function ensureAllFieldsPresent(partial: Partial<CrmRecord>): CrmRecord {
  const full = {} as CrmRecord;

  for (const field of CRM_FIELD_NAMES) {
    const value = partial[field];

    Reflect.set(
      full,
      field,
      typeof value === "string" ? value : ""
    );
  }

  return full;
}

export interface ValidationOutcome {
  record: CrmRecord | null;
  skipReason: SkippedRecord["reason"] | null;
}

/**
 * Runs one LLM-mapped row through every business rule. This is the
 * deterministic layer that makes the system trustworthy regardless of
 * LLM output quality — nothing here is optional or "best effort".
 */
export function validateAndSanitizeRecord(
  partial: Partial<CrmRecord>,
  rawRow: RawRow
): ValidationOutcome {
  let record = ensureAllFieldsPresent(partial);

  const { record: sanitized, extraNotes } = sanitizeMultiValueFields(record);
  record = sanitized;

  record.crm_status = validateCrmStatus(record.crm_status) as CrmRecord["crm_status"];
  record.data_source = validateDataSource(record.data_source) as CrmRecord["data_source"];
  record.created_at = validateCreatedAt(record.created_at);

  if (extraNotes.length > 0) {
    record.crm_note = [record.crm_note, ...extraNotes].filter(Boolean).join(" | ");
  }

  for (const field of TEXT_FIELDS_TO_SANITIZE) {
    record[field] = sanitizeFormulaInjection(record[field] as string) as never;
  }

  // Skip rule: enforced here in code, never trusted from the LLM.
  const hasEmail = Boolean(record.email && record.email.trim());
  const hasMobile = Boolean(
    record.mobile_without_country_code && record.mobile_without_country_code.trim()
  );

  if (!hasEmail && !hasMobile) {
    return { record: null, skipReason: "missing_email_and_mobile" };
  }

  return { record, skipReason: null };
}
