/**
 * GrowEasy CRM schema — the fixed 15-field target every CSV row must be mapped to.
 * This file is the single source of truth for the schema shape and enums.
 * The frontend keeps a mirrored copy at frontend/src/types/schema.ts.
 */

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number] | "";

export interface CrmRecord {
  created_at: string; // must be parseable by `new Date()`
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
}

export const CRM_FIELD_NAMES: (keyof CrmRecord)[] = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

export interface SkippedRecord {
  rowIndex: number;
  reason: "missing_email_and_mobile" | "batch_processing_failed" | "invalid_row_shape";
  rawRow: Record<string, string>;
}

export interface ImportMeta {
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  failedBatches: number;
  processingTimeMs: number;
  provider: string;
}

export interface ImportResponse {
  success: boolean;
  meta: ImportMeta;
  imported: CrmRecord[];
  skipped: SkippedRecord[];
}

export interface ImportRequestBody {
  fileName: string;
  rows: Record<string, string>[];
  headers: string[];
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  retryAfterMs?: number;
}
