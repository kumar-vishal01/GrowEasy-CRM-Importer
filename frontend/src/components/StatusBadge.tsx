import styles from "./StatusBadge.module.css";

type BadgeTone = "success" | "neutral" | "warning" | "danger";

const CRM_STATUS_TONE: Record<string, BadgeTone> = {
  GOOD_LEAD_FOLLOW_UP: "success",
  SALE_DONE: "success",
  DID_NOT_CONNECT: "warning",
  BAD_LEAD: "danger",
};

const SKIP_REASON_LABEL: Record<string, string> = {
  missing_email_and_mobile: "No email or mobile",
  batch_processing_failed: "Processing failed",
  invalid_row_shape: "Invalid row",
};

export function CrmStatusBadge({ value }: { value: string }) {
  if (!value) {
    return <span className={`${styles.badge} ${styles.neutral}`}>—</span>;
  }
  const tone = CRM_STATUS_TONE[value] ?? "neutral";
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function SkipReasonBadge({ reason }: { reason: string }) {
  return (
    <span className={`${styles.badge} ${styles.danger}`}>
      {SKIP_REASON_LABEL[reason] ?? reason}
    </span>
  );
}
