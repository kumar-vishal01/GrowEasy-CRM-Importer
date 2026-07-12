import { ParsedCsvPreview } from "@/types/schema";
import styles from "./PreviewActionBar.module.css";

interface PreviewActionBarProps {
  preview: ParsedCsvPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreviewActionBar({ preview, onConfirm, onCancel }: PreviewActionBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.fileInfo}>
        <div className={styles.fileIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className={styles.fileName}>{preview.fileName}</p>
          <p className={styles.fileMeta}>
            {preview.totalRows} rows · {preview.headers.length} columns detected
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>
          Choose a different file
        </button>
        <button className={styles.confirmBtn} onClick={onConfirm}>
          Confirm Import
        </button>
      </div>
    </div>
  );
}
