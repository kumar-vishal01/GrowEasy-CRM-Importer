"use client";

import { useMemo, useState } from "react";
import { ImportResponse } from "@/types/schema";
import { CrmStatusBadge, SkipReasonBadge } from "./StatusBadge";
import dataTableStyles from "./DataTable.module.css";
import styles from "./ImportResultsTable.module.css";

interface ImportResultsTableProps {
  result: ImportResponse;
  onStartOver: () => void;
}

const PAGE_SIZE = 50;

const IMPORTED_COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "mobile_without_country_code", label: "Mobile" },
  { key: "crm_status", label: "Status" },
  { key: "data_source", label: "Source" },
  { key: "city", label: "City" },
  { key: "lead_owner", label: "Owner" },
  { key: "created_at", label: "Created" },
  { key: "crm_note", label: "Note" },
];

export function ImportResultsTable({ result, onStartOver }: ImportResultsTableProps) {
  const [activeTab, setActiveTab] = useState<"imported" | "skipped">("imported");
  const [page, setPage] = useState(0);

  const rows = activeTab === "imported" ? result.imported : result.skipped;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [rows, page]
  );

  function switchTab(tab: "imported" | "skipped") {
    setActiveTab(tab);
    setPage(0);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.summaryRow}>
        <SummaryStat label="Total rows" value={result.meta.totalRows} tone="neutral" />
        <SummaryStat label="Imported" value={result.meta.totalImported} tone="success" />
        <SummaryStat label="Skipped" value={result.meta.totalSkipped} tone="danger" />
        <SummaryStat
          label="Time"
          value={`${(result.meta.processingTimeMs / 1000).toFixed(1)}s`}
          tone="neutral"
        />
      </div>

      <div className={styles.tabRow}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "imported" ? styles.tabActive : ""}`}
            onClick={() => switchTab("imported")}
          >
            Imported ({result.meta.totalImported})
          </button>
          <button
            className={`${styles.tab} ${activeTab === "skipped" ? styles.tabActive : ""}`}
            onClick={() => switchTab("skipped")}
          >
            Skipped ({result.meta.totalSkipped})
          </button>
        </div>
        <button className={styles.startOverBtn} onClick={onStartOver}>
          Import another file
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <>
          <div className={dataTableStyles.tableCard}>
            <div className={dataTableStyles.tableScroll}>
              {activeTab === "imported" ? (
                <ImportedTable rows={pageRows as ImportResponse["imported"]} startIndex={page * PAGE_SIZE} />
              ) : (
                <SkippedTable rows={pageRows as ImportResponse["skipped"]} />
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImportedTable({
  rows,
  startIndex,
}: {
  rows: ImportResponse["imported"];
  startIndex: number;
}) {
  return (
    <table className={dataTableStyles.table}>
      <thead>
        <tr>
          <th className={dataTableStyles.rowNumHeader}>#</th>
          {IMPORTED_COLUMNS.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((record, idx) => (
          <tr key={startIndex + idx}>
            <td className={dataTableStyles.rowNum}>{startIndex + idx + 1}</td>
            {IMPORTED_COLUMNS.map((col) => {
              const value = record[col.key as keyof typeof record];
              if (col.key === "crm_status") {
                return (
                  <td key={col.key}>
                    <CrmStatusBadge value={value as string} />
                  </td>
                );
              }
              return (
                <td key={col.key} title={String(value)}>
                  {value || <span className={dataTableStyles.emptyCell}>—</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SkippedTable({ rows }: { rows: ImportResponse["skipped"] }) {
  return (
    <table className={dataTableStyles.table}>
      <thead>
        <tr>
          <th className={dataTableStyles.rowNumHeader}>#</th>
          <th>Reason</th>
          <th>Original row (raw)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((skip) => (
          <tr key={skip.rowIndex}>
            <td className={dataTableStyles.rowNum}>{skip.rowIndex + 1}</td>
            <td>
              <SkipReasonBadge reason={skip.reason} />
            </td>
            <td className={styles.rawRowCell} title={JSON.stringify(skip.rawRow)}>
              {Object.entries(skip.rawRow)
                .filter(([, v]) => v)
                .slice(0, 4)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <div className={`${styles.statCard} ${styles[`stat_${tone}`]}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function EmptyState({ tab }: { tab: "imported" | "skipped" }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>
        {tab === "imported" ? "Nothing was imported" : "Nothing was skipped"}
      </p>
      <p className={styles.emptySubtitle}>
        {tab === "imported"
          ? "Every row was skipped — check the Skipped tab for reasons."
          : "Every row had at least an email or mobile number and was imported successfully."}
      </p>
    </div>
  );
}
