import { Request, Response, NextFunction } from "express";

/**
 * Lightweight structural validation before the request reaches the
 * controller. Keeps the controller focused on business logic.
 */
export function validateImportRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as {
    rows?: unknown[];
    headers?: unknown;
    fileName?: unknown;
  };

  // Read MAX_ROWS on every request so tests that modify process.env work.
  const maxBodyRows = (() => {
    const value = Number(process.env.MAX_ROWS);
    return Number.isFinite(value) && value > 0 ? value : 50000;
  })();

  if (!body || typeof body !== "object") {
    res.status(400).json({
      success: false,
      error: "invalid_request",
      message: "Request body must be a JSON object.",
    });
    return;
  }

  if (!Array.isArray(body.rows)) {
    res.status(400).json({
      success: false,
      error: "invalid_csv",
      message: "'rows' must be an array of row objects.",
    });
    return;
  }

  if (body.rows.length === 0) {
    res.status(400).json({
      success: false,
      error: "invalid_csv",
      message: "CSV contains no data rows.",
    });
    return;
  }

  if (body.rows.length > maxBodyRows) {
    res.status(413).json({
      success: false,
      error: "file_too_large",
      message: `CSV has ${body.rows.length} rows, exceeding the ${maxBodyRows}-row limit.`,
    });
    return;
  }

  const malformedRow = body.rows.find(
    (row) =>
      row === null ||
      typeof row !== "object" ||
      Array.isArray(row)
  );

  if (malformedRow !== undefined) {
    res.status(400).json({
      success: false,
      error: "invalid_csv",
      message: "One or more rows are not valid flat objects.",
    });
    return;
  }

  next();
}