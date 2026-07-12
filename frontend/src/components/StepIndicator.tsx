import { FlowStep } from "@/hooks/useUploadFlow";
import styles from "./StepIndicator.module.css";

const STEPS: { key: FlowStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "processing", label: "Map" },
  { key: "results", label: "Results" },
];

export function StepIndicator({ currentStep }: { currentStep: FlowStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className={styles.wrapper} aria-label="Import progress">
      {STEPS.map((step, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <div key={step.key} className={styles.stepGroup}>
            <div
              className={`${styles.dot} ${isComplete ? styles.complete : ""} ${
                isCurrent ? styles.current : ""
              }`}
            >
              {isComplete ? "✓" : idx + 1}
            </div>
            <span className={`${styles.label} ${isCurrent ? styles.labelCurrent : ""}`}>
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`${styles.connector} ${isComplete ? styles.connectorDone : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
