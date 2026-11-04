import { useState } from "react";
import { IconExternal } from "./icons";

export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1]! : null;
}

/** A tidy "listen along" panel: closed until asked, so nothing loads or plays on its own. */
export function VideoPanel({ url, title, startOpen, className }: { url?: string; title: string; startOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(!!startOpen);
  const id = youtubeId(url);
  if (!url) return null;
  if (!id)
    return (
      <a className="btn btn--secondary btn--sm" href={url} target="_blank" rel="noreferrer">
        Listen <IconExternal />
      </a>
    );
  return (
    <div className={`vpanel ${className ?? ""}`} data-open={open}>
      <button className="vpanel__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="vpanel__label">Listen to the original</span>
        <span className="vpanel__act">{open ? "Hide" : "Show video"}</span>
      </button>
      {open && (
        <div className="video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`}
            title={`${title} on YouTube`}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
