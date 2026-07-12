"use client";

import { useEffect, useState } from "react";
import { useUploadFlow } from "@/hooks/useUploadFlow";
import { UploadDropzone } from "@/components/UploadDropzone";
import { PreviewTable } from "@/components/PreviewTable";
import { PreviewActionBar } from "@/components/PreviewActionBar";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ImportResultsTable } from "@/components/ImportResultsTable";
import { StepIndicator } from "@/components/StepIndicator";
import styles from "./page.module.css";

export default function HomePage() {
  const {
    step,
    preview,
    result,
    error,
    isDragActive,
    selectFile,
    confirmImport,
    cancelPreview,
    reset,
    setDragActive,
  } = useUploadFlow();

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = !darkMode;

    setDarkMode(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme);
    localStorage.setItem("theme", nextTheme ? "dark" : "light");
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "1rem",
            }}
          >
            <button
              onClick={toggleTheme}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </div>

          <div className={styles.brandRow}>
            <div className={styles.logoMark}>G</div>
            <span className={styles.brandName}>GrowEasy Import</span>
          </div>

          <h1 className={styles.heading}>
            Bring any lead sheet into your CRM
          </h1>

          <p className={styles.subheading}>
            Upload a CSV from Facebook, Google Ads, or a spreadsheet —
            we&rsquo;ll map it to your CRM schema automatically.
          </p>
        </header>

        <div className={styles.stepIndicatorRow}>
          <StepIndicator currentStep={step} />
        </div>

        <section className={styles.stepContent}>
          {step === "upload" && (
            <UploadDropzone
              isDragActive={isDragActive}
              error={error}
              onFileSelected={selectFile}
              onDragActiveChange={setDragActive}
            />
          )}

          {step === "preview" && preview && (
            <div className={styles.stack}>
              <PreviewActionBar
                preview={preview}
                onConfirm={confirmImport}
                onCancel={cancelPreview}
              />

              {error && (
                <div className={styles.inlineError} role="alert">
                  {error}
                </div>
              )}

              <PreviewTable preview={preview} />
            </div>
          )}

          {step === "processing" && preview && (
            <ProgressIndicator totalRows={preview.totalRows} />
          )}

          {step === "results" && result && (
            <ImportResultsTable
              result={result}
              onStartOver={reset}
            />
          )}
        </section>
      </div>
    </main>
  );
}