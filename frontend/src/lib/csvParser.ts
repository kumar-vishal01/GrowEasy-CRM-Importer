import Papa from "papaparse";
import { ParsedCsvPreview } from "@/types/schema";

export class CsvValidationError extends Error {}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ROWS = 50000;

// Browsers are inconsistent about the MIME type reported for .csv files —
// Windows/Excel-authored files often show up as "application/vnd.ms-excel",
// some browsers report "text/plain" or "application/csv", and some report
// nothing at all (""). Rejecting on MIME type caused real CSVs to be turned
// away depending on OS/browser, so the extension is treated as authoritative
// and MIME is only used to reject obviously-wrong types (e.g. images, PDFs).
const REJECTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

export function validateFile(file: File): void {
  const nameLower = file.name.toLowerCase();
  const isCsvExtension = nameLower.endsWith(".csv");

  if (!isCsvExtension) {
    throw new CsvValidationError("Only .csv files are supported.");
  }
  if (file.type && REJECTED_MIME_TYPES.has(file.type)) {
    throw new CsvValidationError(
      "This file doesn't look like a CSV file (it looks like a different file type saved with a .csv extension)."
    );
  }
  if (file.size === 0) {
    throw new CsvValidationError("The selected file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CsvValidationError(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is ${
        MAX_FILE_SIZE_BYTES / 1024 / 1024
      }MB.`
    );
  }
}

/**
 * Parses a CSV file entirely client-side using PapaParse, which correctly
 * handles quoted fields with embedded commas/newlines (RFC4180). No AI
 * calls happen here — this is purely for the local preview step.
 */
export function parseCsvFile(file: File): Promise<ParsedCsvPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const critical = results.errors.filter((e) => e.type === "Delimiter" || e.type === "Quotes");
          if (critical.length > 0) {
            reject(new CsvValidationError(`Failed to parse CSV: ${critical[0].message}`));
            return;
          }
        }

        const headers = results.meta.fields ?? [];
        const rows = results.data.filter((row) =>
          Object.values(row).some((v) => v !== undefined && v !== null && String(v).trim() !== "")
        );

        if (headers.length === 0) {
          reject(new CsvValidationError("Couldn't find a header row in this CSV."));
          return;
        }

        // PapaParse's header:true mode uses the header text as the row's
        // object key. Duplicate header names silently overwrite each other
        // in that object — e.g. two "Phone" columns means only one value
        // survives per row, with no error. Surface this before it causes
        // silent data loss downstream.
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        for (const header of headers) {
          if (seen.has(header)) duplicates.add(header);
          seen.add(header);
        }
        if (duplicates.size > 0) {
          reject(
            new CsvValidationError(
              `This CSV has duplicate column names (${Array.from(duplicates).join(
                ", "
              )}). Please rename or remove the duplicates — otherwise data from one of them will be silently lost.`
            )
          );
          return;
        }

        if (rows.length === 0) {
          reject(new CsvValidationError("CSV has headers but no data rows."));
          return;
        }

        if (rows.length > MAX_ROWS) {
          reject(
            new CsvValidationError(
              `CSV has ${rows.length} rows, exceeding the ${MAX_ROWS}-row limit.`
            )
          );
          return;
        }

        resolve({
          fileName: file.name,
          headers,
          rows,
          totalRows: rows.length,
        });
      },
      error: (err) => {
        reject(new CsvValidationError(`Failed to read file: ${err.message}`));
      },
    });
  });
}
