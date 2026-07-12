import { ParsedCsvPreview } from "@/types/schema";
import styles from "./DataTable.module.css";

interface PreviewTableProps {
  preview: ParsedCsvPreview;
  maxPreviewRows?: number;
}

export function PreviewTable({ preview, maxPreviewRows = 50 }: PreviewTableProps) {
  const visibleRows = preview.rows.slice(0, maxPreviewRows);
  const isTruncated = preview.rows.length > maxPreviewRows;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rowNumHeader}>#</th>
              {preview.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => (
              <tr key={idx}>
                <td className={styles.rowNum}>{idx + 1}</td>
                {preview.headers.map((header) => (
                  <td key={header} title={row[header]}>
                    {row[header] || <span className={styles.emptyCell}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isTruncated && (
        <div className={styles.truncateNote}>
          Showing first {maxPreviewRows} of {preview.totalRows} rows — all rows will be processed
          on import.
        </div>
      )}
    </div>
  );
}
