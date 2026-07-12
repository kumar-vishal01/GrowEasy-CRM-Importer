"use client";

import { useCallback, useState } from "react";
import { parseCsvFile, validateFile, CsvValidationError } from "@/lib/csvParser";
import { submitImport, ApiError } from "@/services/api";
import { ImportResponse, ParsedCsvPreview } from "@/types/schema";

export type FlowStep = "upload" | "preview" | "processing" | "results";

export interface UploadFlowState {
  step: FlowStep;
  preview: ParsedCsvPreview | null;
  result: ImportResponse | null;
  error: string | null;
  isDragActive: boolean;
}

const initialState: UploadFlowState = {
  step: "upload",
  preview: null,
  result: null,
  error: null,
  isDragActive: false,
};

export function useUploadFlow() {
  const [state, setState] = useState<UploadFlowState>(initialState);

  const setDragActive = useCallback((active: boolean) => {
    setState((prev) => ({ ...prev, isDragActive: active }));
  }, []);

  const selectFile = useCallback(async (file: File) => {
    setState((prev) => ({ ...prev, error: null, isDragActive: false }));

    try {
      validateFile(file);
      const preview = await parseCsvFile(file);
      setState((prev) => ({ ...prev, step: "preview", preview, error: null }));
    } catch (err) {
      const message =
        err instanceof CsvValidationError
          ? err.message
          : "Couldn't read this file. Please try another CSV.";
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (!state.preview) return;
    const preview = state.preview;

    setState((prev) => ({ ...prev, step: "processing", error: null }));

    try {
      const result = await submitImport(preview);
      setState((prev) => ({ ...prev, step: "results", result, error: null }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong while processing your import.";
      setState((prev) => ({ ...prev, step: "preview", error: message }));
    }
  }, [state.preview]);

  const cancelPreview = useCallback(() => {
    setState(initialState);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    selectFile,
    confirmImport,
    cancelPreview,
    reset,
    setDragActive,
  };
}
