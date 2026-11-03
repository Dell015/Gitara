/**
 * Desktop-only pieces (shown from 900px wide, like Spotify desktop):
 * the top bar (back, search everywhere, account) and the right panel (wide screens).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db } from "../data/local-db";
import { Art } from "../ui/Art";
import { warmthFor } from "../ui/artwork";
import { HeatMark } from "../ui/HeatMark";
import { IconBack, IconClose, IconPerson, IconSearch } from "../ui/icons";
import { useNav } from "./nav";
import { useOverlays } from "./overlays";
import { useSearch } from "./searchStore";

export function DesktopBar() {
  const nav = useNav();
  const { open } = useOverlays();
  const [q, setQ] = useSearch();
  const input = useRef<HTMLInputElement>(null);

  // "/" or Ctrl/Cmd+K jumps to search; Alt+← goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        nav.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  return (
    <div className="dbar">
      <button className="glassbtn" aria-label="Back" onClick={nav.back} disabled={nav.depth === 0}>
        <IconBack />
      </button>
      <label className="dbar__search">
        <IconSearch />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (nav.tab !== "search") nav.switchTab("search");
          }}
          onFocus={() => nav.tab !== "search" && q && nav.switchTab("search")}
          placeholder="What do you want to play?"
          aria-label="Search Gitara"
        />
        {q ? (
          <button className="iconbtn iconbtn--plain" aria-label="Clear search" onClick={() => setQ("")}>
            <IconClose />
          </button>
        ) : (
          <kbd className="dbar__kbd">/</kbd>
        )}
      </label>
      <button className="avatar avatar--bar" aria-label="Account and settings" onClick={() => open({ kind: "account" })}>
        <IconPerson />
      </button>
    </div>
  );
}

/** Right panel on wide screens: what you're working on. Becomes "Now playing" once play-along exists. */
export function RightPanel() {
  const nav = useNav();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("gitara.rightPanel") === "hidden";
    } catch {
      return false;
    }
  });
  const rows = useLiveQuery(async () => {
    const entries = (await db.library.toArray()).filter((e) => e.status === "learning" || e.status === "planning");
    const songs = await db.songs.bulkGet(entries.map((e) => e.songId));
    return entries
      .map((e, i) => ({ e, s: songs[i] }))
      .filter((x) => !!x.s)
      .sort((a, b) => (a.e.status === b.e.status ? b.e.updatedAt.localeCompare(a.e.updatedAt) : a.e.status === "learning" ? -1 : 1))
      .slice(0, 12);
  });
  const toggle = (h: boolean) => {
    setHidden(h);
    try {
      localStorage.setItem("gitara.rightPanel", h ? "hidden" : "shown");
    } catch {
      /* ignore */
    }
  };
  if (hidden)
    return (
      <button className="rpanel-show" onClick={() => toggle(false)}>
        Show practice panel
      </button>
    );
  return (
    <aside className="rpanel" aria-label="Your practice">
      <div className="rpanel__head">
        <h2 className="rpanel__title">Your practice</h2>
        <button className="iconbtn iconbtn--plain" aria-label="Hide panel" onClick={() => toggle(true)}>
          <IconClose />
        </button>
      </div>
      {rows && rows.length > 0 ? (
        <ul className="list">
          {rows.map(({ e, s }) => (
            <li key={s!.id}>
              <button className="irow" onClick={() => nav.push({ name: "song", id: s!.id })}>
                <Art seed={s!.id} warmth={warmthFor(e.status)} className="mark" />
                <span className="irow__main">
                  <span className="irow__title">{s!.title}</span>
                  <span className="irow__sub">{s!.artist}</span>
                </span>
                {e.status && <HeatMark heat={e.status} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Songs you're learning or planning to learn show up here. Set a status from any song's menu.</p>
      )}
      <p className="rpanel__note">When play-along arrives, this panel shows the chord chart following the music.</p>
    </aside>
  );
}
