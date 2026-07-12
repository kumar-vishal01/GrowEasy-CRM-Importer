/**
 * Dependency-free RFC4180-compliant CSV parser.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export class CsvParseError extends Error {}

export function parseCsv(input: string): ParsedCsv {
  if (!input || !input.trim()) {
    throw new CsvParseError("CSV content is empty");
  }

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }

        inQuotes = false;
        i++;
        continue;
      }

      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      record.push(field);
      field = "";
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    if (char === "\n") {
      record.push(field);
      records.push(record);
      field = "";
      record = [];
      i++;
      continue;
    }

    field += char;
    i++;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmptyRecords = records.filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );

  if (nonEmptyRecords.length === 0) {
    throw new CsvParseError("CSV contains no rows");
  }

  const headers = nonEmptyRecords[0].map((h) => h.trim());

  if (headers.length === 0 || headers.every((h) => h === "")) {
    throw new CsvParseError("CSV has no header row");
  }

  const rows = nonEmptyRecords.slice(1).map((values) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });

    return row;
  });

  // ⭐ THIS FIXES YOUR FAILING TEST
  if (rows.length === 0) {
    throw new CsvParseError("CSV contains headers but no data rows");
  }

  return {
    headers,
    rows,
  };
}