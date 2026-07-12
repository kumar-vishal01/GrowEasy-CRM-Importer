import { Request, Response } from "express";
import { ImportRequestBody, ImportResponse, SkippedRecord, CrmRecord } from "../types/schema";
import { getLLMProvider } from "../services/llm/providerFactory";
import { processAllBatches, DEFAULT_BATCH_OPTIONS } from "../services/batchProcessor";
import { validateAndSanitizeRecord } from "../services/validator";
import { logger } from "../utils/logger";

const MAX_ROWS = Number(process.env.MAX_ROWS || 50000);

export async function handleImport(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();
  const body = req.body as ImportRequestBody;

  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    res.status(400).json({
      success: false,
      error: "invalid_csv",
      message: "Request must include a non-empty 'rows' array.",
    });
    return;
  }

  if (!Array.isArray(body.headers) || body.headers.length === 0) {
    res.status(400).json({
      success: false,
      error: "invalid_csv",
      message: "Request must include a non-empty 'headers' array.",
    });
    return;
  }

  if (body.rows.length > MAX_ROWS) {
    res.status(413).json({
      success: false,
      error: "file_too_large",
      message: `CSV has ${body.rows.length} rows, exceeding the ${MAX_ROWS}-row limit.`,
    });
    return;
  }

  const provider = getLLMProvider();

  let batchResults;
  try {
    batchResults = await processAllBatches(provider, body.rows, body.headers, DEFAULT_BATCH_OPTIONS);
  } catch (err) {
    logger.error("Unexpected error during batch processing", {
      error: (err as Error).message,
    });
    res.status(500).json({
      success: false,
      error: "internal_error",
      message: "An unexpected error occurred while processing the import.",
    });
    return;
  }

  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];
  let failedBatches = 0;

  for (const batch of batchResults) {
    if (batch.failed || !batch.records) {
      failedBatches += 1;
      for (const rowIndex of batch.rowIndices) {
        skipped.push({
          rowIndex,
          reason: "batch_processing_failed",
          rawRow: body.rows[rowIndex],
        });
      }
      continue;
    }

    batch.records.forEach((partial, i) => {
      const rowIndex = batch.rowIndices[i];
      const rawRow = body.rows[rowIndex];
      const { record, skipReason } = validateAndSanitizeRecord(partial, rawRow);

      if (!record) {
        skipped.push({
          rowIndex,
          reason: skipReason ?? "invalid_row_shape",
          rawRow,
        });
        return;
      }

      imported.push(record);
    });
  }

  const response: ImportResponse = {
    success: true,
    meta: {
      totalRows: body.rows.length,
      totalImported: imported.length,
      totalSkipped: skipped.length,
      failedBatches,
      processingTimeMs: Date.now() - startedAt,
      provider: provider.name,
    },
    imported,
    skipped,
  };

  logger.info("Import completed", { ...response.meta, fileName: body.fileName });

  res.status(200).json(response);
}

export function handleHealth(_req: Request, res: Response): void {
  const provider = getLLMProvider();
  res.status(200).json({
    status: "ok",
    provider: provider.name,
    timestamp: new Date().toISOString(),
  });
}
