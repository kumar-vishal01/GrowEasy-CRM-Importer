"use client";

import { useEffect, useState } from "react";
import styles from "./ProgressIndicator.module.css";

interface ProgressIndicatorProps {
  totalRows: number;
  batchSize?: number;
}

/**
 * Since the backend responds once with the full result (synchronous batch
 * model — see architecture notes), the frontend can't get real per-batch
 * completion events. Instead this renders an honest *estimated* progress
 * view: a grid of tiles representing batches, animating through an
 * estimated pace derived from batch count, so the user sees meaningful
 * motion rather than an indeterminate spinner. It settles rather than
 * claims false precision once the response is close to expected duration.
 */
export function ProgressIndicator({ totalRows, batchSize = 25 }: ProgressIndicatorProps) {
  const totalBatches = Math.max(1, Math.ceil(totalRows / batchSize));
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    setResolvedCount(0);
    const estimatedMsPerBatch = 700;
    const interval = setInterval(() => {
      setResolvedCount((prev) => {
        // Cap at totalBatches - 1 so we never falsely claim 100% before
        // the real response arrives.
        if (prev >= totalBatches - 1) return prev;
        return prev + 1;
      });
    }, estimatedMsPerBatch);
    return () => clearInterval(interval);
  }, [totalBatches]);

  const displayTiles = Math.min(totalBatches, 60);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div className={styles.spinner} aria-hidden="true" />
        <div>
          <p className={styles.title}>Mapping your data to the CRM schema…</p>
          <p className={styles.subtitle}>
            🤖 AI is mapping your CSV to the CRM schema...
This usually takes 5–15 seconds depending on file size.
            {totalBatches === 1 ? "" : "es"}
          </p>
        </div>
      </div>

      <div className={styles.tileGrid} role="progressbar" aria-valuenow={resolvedCount} aria-valuemax={totalBatches}>
        {Array.from({ length: displayTiles }).map((_, i) => (
          <span
            key={i}
            className={`${styles.tile} ${i <= resolvedCount ? styles.tileActive : ""}`}
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>

      <p className={styles.hint}>
        Large files are split into batches and processed in parallel, with automatic retries for
        any batch that fails.
      </p>
    </div>
  );
}
