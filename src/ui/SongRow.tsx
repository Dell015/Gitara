import { useRef, type ReactNode } from "react";
import type { LearnStatus, Song } from "../core/model";
import { Art } from "./Art";
import { warmthFor } from "./artwork";
import { HeatMark } from "./HeatMark";
import { IconHeart, IconMore, IconPlaylists } from "./icons";

/**
 * The one song row used everywhere (docs/screens.md, "One song row").
 * Tap opens the song; the heart likes it; "…" or long-press opens the menu; swipe left toggles like.
 */
export function SongRow({
  song,
  liked,
  status,
  onOpen,
  onLike,
  onMenu,
  onQueue,
  lead,
  trail,
}: {
  song: Song;
  liked: boolean;
  status?: LearnStatus | null;
  onOpen: () => void;
  onLike: () => void;
  onMenu: () => void;
  /** Swipe right (Spotify's swipe-to-queue). */
  onQueue?: () => void;
  lead?: ReactNode;
  trail?: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const g = useRef<{ x: number; y: number; dx: number; lock: "x" | "y" | null; t?: number; long: boolean } | null>(null);

  const extra = [song.originalKey, song.originalBpm ? `${song.originalBpm} bpm` : undefined].filter(Boolean).join(" · ");

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    g.current = { x: e.clientX, y: e.clientY, dx: 0, lock: null, long: false };
    g.current.t = window.setTimeout(() => {
      if (g.current && !g.current.lock) {
        g.current.long = true;
        onMenu();
      }
    }, 500);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || e.pointerType === "mouse") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.lock && Math.hypot(dx, dy) > 8) {
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      window.clearTimeout(s.t);
    }
    if (s.lock === "x" && el.current) {
      s.dx = onQueue ? dx : Math.min(0, dx); // left = like, right = queue
      const lim = 72;
      const pull = Math.abs(s.dx) > lim ? Math.sign(s.dx) * (lim + (Math.abs(s.dx) - lim) * 0.3) : s.dx; // resist past the threshold
      el.current.style.transition = "none";
      el.current.style.transform = `translateX(${pull}px)`;
      el.current.dataset.armed = String(Math.abs(s.dx) > lim);
      if (el.current.parentElement) el.current.parentElement.dataset.dir = s.dx > 0 ? "right" : "left";
    }
  };
  const end = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    window.clearTimeout(s.t);
    if (el.current) {
      el.current.style.removeProperty("transition");
      el.current.style.removeProperty("transform");
      delete el.current.dataset.armed;
    }
    if (s.lock === "x" && s.dx < -72) onLike();
    if (s.lock === "x" && s.dx > 72) onQueue?.();
  };

  return (
    <div className="srow-wrap">
      <span className="srow-under" aria-hidden="true">
        <span className="srow-under__queue">
          <IconPlaylists />
        </span>
        <IconHeart filled={!liked} />
      </span>
      <div
        ref={el}
        className="srow"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
      >
        {lead}
        <Art seed={song.id} warmth={warmthFor(status)} className="srow__art" />
        <button
          className="srow__main"
          onClick={() => {
            if (g.current?.long) return;
            onOpen();
          }}
        >
          <span className="srow__title">{song.title}</span>
          <span className="srow__sub num">
            {song.artist}
            {extra && <span className="srow__phonemeta"> · {extra}</span>}
          </span>
        </button>
        <span className="srow__col srow__col--key num">{song.originalKey ?? ""}</span>
        <span className="srow__col srow__col--bpm num">{song.originalBpm ? `${song.originalBpm} bpm` : ""}</span>
        <span className="srow__col srow__col--heat">{status ? <HeatMark heat={status} /> : null}</span>
        {trail}
        <button className="srow__icon" data-on={liked} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} onClick={onLike}>
          <IconHeart filled={liked} />
        </button>
        <button className="srow__icon" aria-label="More" onClick={onMenu}>
          <IconMore />
        </button>
      </div>
    </div>
  );
}
