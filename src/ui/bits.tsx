import type { ReactNode } from "react";
import { Art } from "./Art";
import { IconBack, IconClose } from "./icons";

/** A row of filter chips. Chips are always tappable (pills only when tappable, §5.16). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {value && (
        <button className="chip chip--clear" onClick={() => onChange(null)} aria-label="Clear filter">
          <IconClose />
        </button>
      )}
      {options
        .filter((o) => !value || o.id === value)
        .map((o) => (
          <button key={o.id} className="chip" aria-pressed={o.id === value} onClick={() => onChange(o.id === value ? null : o.id)}>
            {o.label}
          </button>
        ))}
    </div>
  );
}

/** Secondary chips shown inside a picked chip (Spotify's dynamic filters). Several may be on. */
export function SubChips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <>
      {options.map((o) => (
        <button key={o.id} className="chip chip--sub" aria-pressed={o.id === value} onClick={() => onChange(o.id === value ? null : o.id)}>
          {o.label}
        </button>
      ))}
    </>
  );
}

/** Top bar for pushed screens: back on the left, actions on the right. The title shows once scrolled. */
export function TopBar({ onBack, title, right, over }: { onBack?: () => void; title?: string; right?: ReactNode; over?: boolean }) {
  return (
    <div className={over ? "topbar topbar--over" : "topbar"}>
      {onBack ? (
        <button className={over ? "glassbtn" : "iconbtn iconbtn--plain"} onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      ) : (
        <span />
      )}
      {title ? <span className="topbar__title">{title}</span> : <span />}
      <div className="topbar__right">{right}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={o.id === value} className="seg__opt" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {children}
    </div>
  );
}

/** A tappable list row for non-song things (playlists, artists, collections, menu entries). */
export function ItemRow({
  title,
  sub,
  onClick,
  lead,
  trail,
  disabled,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
  lead?: ReactNode;
  trail?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="irow" onClick={onClick} disabled={disabled}>
      {lead && <span className="irow__lead">{lead}</span>}
      <span className="irow__main">
        <span className="irow__title">{title}</span>
        {sub && <span className="irow__sub num">{sub}</span>}
      </span>
      {trail && <span className="irow__trail">{trail}</span>}
    </button>
  );
}

/** Artwork for playlists, artists and collections: generated heat light (there's no cover art). */
export function Mark({ kind, seed, warmth, res }: { kind: "playlist" | "artist" | "liked" | "learning" | "song"; seed?: string; warmth?: number; res?: [number, number] }) {
  const s = seed ?? kind;
  if (kind === "liked") return <Art seed="liked-songs" style="arc" warmth={1} className="mark" res={res} />;
  if (kind === "learning") return <Art seed="learning-now" style="flow" warmth={0.86} className="mark" res={res} />;
  return <Art seed={s} warmth={warmth ?? (kind === "artist" ? 0.7 : 0.8)} className="mark" res={res} round={kind === "artist"} />;
}
