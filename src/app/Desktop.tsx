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
import { IconBack, IconClose, IconJam, IconPerson, IconPractice, IconSearch, IconTuner } from "../ui/icons";
import { useNav } from "./nav";
import { useOverlays } from "./overlays";
import { useQueue } from "./queue";
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

/** Right panel on wide screens: tools one click away, what's up next, what you're learning. */
export function RightPanel() {
  const nav = useNav();
  const items = useQueue();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("gitara.rightPanel") === "hidden";
    } catch {
      return false;
    }
  });
  const queued = useLiveQuery(async () => (await db.songs.bulkGet(items.slice(0, 6).map((i) => i.songId))).map((s, k) => ({ item: items[k]!, song: s })), [items]);
  const rows = useLiveQuery(async () => {
    const entries = (await db.library.toArray()).filter((e) => e.status === "learning");
    const songs = await db.songs.bulkGet(entries.map((e) => e.songId));
    return entries.map((e, i) => ({ e, s: songs[i] })).filter((x) => !!x.s).slice(0, 6);
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
    <aside className="rpanel" aria-label="Practice">
      <div className="rpanel__head">
        <h2 className="rpanel__title">Practice</h2>
        <button className="iconbtn iconbtn--plain" aria-label="Hide panel" onClick={() => toggle(true)}>
          <IconClose />
        </button>
      </div>
      <div className="rtools">
        <button className="rtool" onClick={() => nav.push({ name: "tuner" })}>
          <IconTuner />
          <span>Tuner</span>
        </button>
        <button className="rtool" onClick={() => nav.push({ name: "metronome" })}>
          <IconPractice />
          <span>Metronome</span>
        </button>
        <button className="rtool" onClick={() => nav.push({ name: "track" })}>
          <IconJam />
          <span>Beat maker</span>
        </button>
      </div>
      <p className="rpanel__sub">Up next</p>
      {items.length ? (
        <ul className="list">
          {(queued ?? []).map(({ item, song }) => (
            <li key={item.key}>
              <button className="irow" onClick={() => song && nav.push({ name: "song", id: song.id })}>
                {song && <Art seed={song.id} className="mark" />}
                <span className="irow__main">
                  <span className="irow__title">{song?.title ?? "Song"}</span>
                  <span className="irow__sub">{song?.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Swipe right on a song, or use its menu, to queue it.</p>
      )}
      <p className="rpanel__sub">Learning now</p>
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
                <HeatMark heat="learning" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Set a song to Learning and it shows up here.</p>
      )}
    </aside>
  );
}
