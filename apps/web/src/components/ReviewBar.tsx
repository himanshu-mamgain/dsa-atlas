import { motion } from "motion/react";
import type { ReviewResult } from "@dsa-atlas/shared";

const BUTTONS: { result: ReviewResult; label: string; hint: string; tone: string; key: string }[] = [
  { result: "forgot", label: "Forgot", hint: "back tomorrow", tone: "red", key: "1" },
  { result: "ok", label: "Got it", hint: "next step", tone: "yellow", key: "2" },
  { result: "easy", label: "Easy", hint: "skip a step", tone: "green", key: "3" },
];

export function ReviewBar({ onReview, showKeys = false }: { onReview: (r: ReviewResult) => void; showKeys?: boolean }) {
  return (
    <div className="review-actions">
      {BUTTONS.map((b) => (
        <motion.button key={b.result} whileTap={{ scale: 0.92 }} className={`btn review-btn tone-${b.tone}`} onClick={() => onReview(b.result)}>
          <span>
            {b.label}
            {showKeys && <kbd>{b.key}</kbd>}
          </span>
          <span className="review-hint">{b.hint}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const REVIEW_KEYS: Record<string, ReviewResult> = { "1": "forgot", "2": "ok", "3": "easy" };
