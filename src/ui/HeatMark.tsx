export type Heat = "planning" | "learning" | "performing";

const LABEL: Record<Heat, string> = { planning: "Planning", learning: "Learning", performing: "Performing" };

/**
 * Heat = progress, drawn as a string that vibrates more as you learn the song.
 * Planning is a still string, Learning a slow wave, Performing a wide wave with its blur ghost.
 * Amplitude carries the meaning too, so it reads without colour.
 */
export function HeatMark({ heat, showLabel = false }: { heat: Heat; showLabel?: boolean }) {
  return (
    <span className="heat" data-heat={heat}>
      <svg viewBox="0 0 28 16" width="28" height="16" fill="none" strokeLinecap="round" aria-hidden="true">
        {heat === "planning" && <path d="M2 8H26" />}
        {heat === "learning" && <path d="M2 8Q8 3.5 14 8T26 8" />}
        {heat === "performing" && (
          <>
            <path className="heat__ghost" d="M2 8Q6 15 10 8T18 8T26 8" />
            <path d="M2 8Q6 1 10 8T18 8T26 8" />
          </>
        )}
      </svg>
      {showLabel ? <span className="heat__label">{LABEL[heat]}</span> : <span className="sr-only">{LABEL[heat]}</span>}
    </span>
  );
}
