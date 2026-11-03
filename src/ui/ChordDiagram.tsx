import type { Voicing } from "../core/shapes";

/**
 * A chord box: strings vertical (thickest on the left, or the right when left-handed), frets down.
 * Open strings are a ring and muted strings a drawn cross, above the nut. Finger numbers sit in the
 * dots, so the diagram reads in black and white (never colour alone, §5.16).
 */
export function ChordDiagram({
  voicing,
  name,
  leftHanded = false,
  size = 96,
  highlight = false,
}: {
  voicing: Pick<Voicing, "frets" | "fingers" | "baseFret" | "barre">;
  name?: string;
  leftHanded?: boolean;
  size?: number;
  highlight?: boolean;
}) {
  const n = voicing.frets.length;
  const rows = 5;
  const W = 100;
  const H = 120;
  const left = 16;
  const right = 92;
  const top = 26;
  const bottom = 112;
  const gx = (right - left) / (n - 1);
  const gy = (bottom - top) / rows;
  const x = (s: number) => left + (leftHanded ? n - 1 - s : s) * gx;
  const base = voicing.baseFret;
  const y = (f: number) => top + (f - base + 0.5) * gy;
  const barre = voicing.barre;
  return (
    <svg className="chordbox" data-on={highlight} viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role="img" aria-label={name ? `${name} chord: ${describe(voicing)}` : describe(voicing)}>
      {/* nut or position number */}
      {base === 1 ? (
        <rect x={left - 1} y={top - 3} width={right - left + 2} height={4} rx={1} className="chordbox__nut" />
      ) : (
        <text x={leftHanded ? right + 3 : 2} y={top + gy * 0.62} className="chordbox__pos">
          {base}
        </text>
      )}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line key={`f${r}`} x1={left} x2={right} y1={top + r * gy} y2={top + r * gy} className="chordbox__fret" />
      ))}
      {Array.from({ length: n }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={bottom} className="chordbox__string" />
      ))}
      {voicing.frets.map((f, s) =>
        f < 0 ? (
          <g key={`m${s}`} className="chordbox__mute">
            <line x1={x(s) - 3.5} y1={top - 14} x2={x(s) + 3.5} y2={top - 7} />
            <line x1={x(s) + 3.5} y1={top - 14} x2={x(s) - 3.5} y2={top - 7} />
          </g>
        ) : f === 0 ? (
          <circle key={`o${s}`} cx={x(s)} cy={top - 10.5} r={3.6} className="chordbox__open" />
        ) : null,
      )}
      {barre && (
        <rect
          x={Math.min(x(barre.from), x(barre.to)) - 5.5}
          y={y(barre.fret) - 5.5}
          width={Math.abs(x(barre.to) - x(barre.from)) + 11}
          height={11}
          rx={5.5}
          className="chordbox__dot"
        />
      )}
      {voicing.frets.map((f, s) => {
        if (f <= 0) return null;
        const onBarre = barre && f === barre.fret && s >= barre.from && s <= barre.to;
        if (onBarre && s !== barre!.from) return null;
        const finger = voicing.fingers[s] ?? 0;
        return (
          <g key={`d${s}`}>
            {!onBarre && <circle cx={x(s)} cy={y(f)} r={6} className="chordbox__dot" />}
            {finger > 0 && (
              <text x={onBarre ? (x(barre!.from) + x(barre!.to)) / 2 : x(s)} y={y(f) + 3.3} className="chordbox__finger">
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function describe(v: Pick<Voicing, "frets">): string {
  return v.frets.map((f) => (f < 0 ? "x" : String(f))).join(" ");
}

/** Strum step drawn, not typed: a down arrow, an up arrow, a rest dash or a muted cross. */
export function StrumGlyph({ step }: { step: "D" | "U" | "-" | "x" }) {
  return (
    <svg className="strumglyph" data-step={step} viewBox="0 0 16 24" width="16" height="24" aria-hidden="true">
      {step === "D" && <path d="M8 3v16M3.5 14.5 8 19.5l4.5-5" />}
      {step === "U" && <path d="M8 21V5M3.5 9.5 8 4.5l4.5 5" />}
      {step === "-" && <path d="M5 12h6" />}
      {step === "x" && <path d="M4.5 8.5l7 7M11.5 8.5l-7 7" />}
    </svg>
  );
}
