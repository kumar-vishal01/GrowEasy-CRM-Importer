import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/** Catches JSON body-parser errors, oversized payloads, and anything unhandled. */
export function errorHandler(
  err: Error & { type?: string; status?: number },
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      error: "invalid_json",
      message: "Request body is not valid JSON.",
    });
    return;
  }

  if (err.type === "entity.too.large") {
    res.status(413).json({
      success: false,
      error: "file_too_large",
      message: "Uploaded file exceeds the maximum allowed size.",
    });
    return;
  }

  logger.error("Unhandled error", { message: err.message, stack: err.stack });

  res.status(err.status || 500).json({
    success: false,
    error: "internal_error",
    message: "An unexpected error occurred.",
  });
}

/** 404 fallback for unknown routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "not_found",
    message: "The requested endpoint does not exist.",
  });
}
