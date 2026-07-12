"use client";

import { useCallback, useRef } from "react";
import styles from "./UploadDropzone.module.css";

interface UploadDropzoneProps {
  isDragActive: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
  onDragActiveChange: (active: boolean) => void;
}

export function UploadDropzone({
  isDragActive,
  error,
  onFileSelected,
  onDragActiveChange,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      onDragActiveChange(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected, onDragActiveChange]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isDragActive) onDragActiveChange(true);
    },
    [isDragActive, onDragActiveChange]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      onDragActiveChange(false);
    },
    [onDragActiveChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = "";
    },
    [onFileSelected]
  );

  return (
    <div className={styles.wrapper}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file"
        className={`${styles.dropzone} ${isDragActive ? styles.active : ""} ${
          error ? styles.errorState : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className={styles.hiddenInput}
          onChange={handleInputChange}
        />

        <div className={styles.iconCircle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v12m0-12 4.5 4.5M12 3 7.5 7.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className={styles.title}>Drop your CSV here, or click to browse</p>
        <p className={styles.subtitle}>
          Works with exports from Facebook Lead Ads, Google Ads, Excel, or any spreadsheet — up to
          10&nbsp;MB.
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.9" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
