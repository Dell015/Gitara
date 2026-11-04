import { useLiveQuery } from "dexie-react-hooks";
import type { LearnStatus } from "../core/model";
import { db } from "../data/local-db";
import * as repo from "../data/repo";
import { IconStar } from "./icons";

const OPTIONS: { id: LearnStatus; label: string }[] = [
  { id: "planning", label: "Plan" },
  { id: "learning", label: "Learning" },
  { id: "performing", label: "Performing" },
];

/** Your status on one version. Tap one to set it, tap it again to clear. */
export function VersionStatus({ versionId, compact }: { versionId: string; compact?: boolean }) {
  const p = useLiveQuery(() => db.progress.get(versionId), [versionId]);
  return (
    <div className="vstatus" data-compact={compact || undefined} role="group" aria-label="How well you know this version">
      {OPTIONS.map((o) => {
        const on = p?.status === o.id;
        return (
          <button key={o.id} className="vstatus__opt" data-status={o.id} aria-pressed={on} onClick={() => void repo.setVersionStatus(versionId, on ? null : o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only average, e.g. "4.5 · 12". */
export function StarAverage({ sum, count }: { sum?: number; count?: number }) {
  if (!count) return <span className="stars-avg stars-avg--none">Not rated</span>;
  return (
    <span className="stars-avg num" aria-label={`${(sum! / count).toFixed(1)} stars from ${count} ratings`}>
      <IconStar filled /> {(sum! / count).toFixed(1)} <span className="stars-avg__n">({count})</span>
    </span>
  );
}

/** Your own 1–5 stars. */
export function StarPicker({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <span className="starpick" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="starpick__star" data-on={(value ?? 0) >= n} onClick={() => onChange(value === n ? null : n)}>
          <IconStar filled={(value ?? 0) >= n} />
        </button>
      ))}
    </span>
  );
}
