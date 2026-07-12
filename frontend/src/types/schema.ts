/**
 * Mirrors backend/src/types/schema.ts. In a monorepo these would live in a
 * shared package; kept as a mirrored file here since frontend/backend are
 * independent apps in this project layout (see README for the trade-off).
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
  created_at: string;
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

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  retryAfterMs?: number;
}

export interface ParsedCsvPreview {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}
