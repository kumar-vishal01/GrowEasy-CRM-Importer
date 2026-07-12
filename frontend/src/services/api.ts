import { ApiErrorResponse, ImportResponse, ParsedCsvPreview } from "@/types/schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  public readonly code: string;
  public readonly retryAfterMs?: number;

  constructor(code: string, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Submits the parsed CSV to the backend for AI-assisted field mapping.
 * This is the only network call in the whole flow — invoked exclusively
 * after the user explicitly clicks "Confirm Import".
 */
export async function submitImport(preview: ParsedCsvPreview): Promise<ImportResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: preview.fileName,
        headers: preview.headers,
        rows: preview.rows,
      }),
    });
  } catch (err) {
    throw new ApiError(
      "network_error",
      "Couldn't reach the import server. Check your connection and try again."
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("invalid_response", "The server returned an unreadable response.");
  }

  if (!response.ok) {
    const errBody = body as ApiErrorResponse;
    throw new ApiError(
      errBody.error || "unknown_error",
      errBody.message || "The import failed for an unknown reason.",
      errBody.retryAfterMs
    );
  }

  return body as ImportResponse;
}

export async function checkHealth(): Promise<{ status: string; provider: string }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new ApiError("health_check_failed", "Backend health check failed.");
  }
  return response.json();
}
