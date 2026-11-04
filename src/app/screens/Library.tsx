import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { entryStatuses, type LearnStatus } from "../../core/model";
import { normalize } from "../../core/text";
import { isMine } from "../../data/auth";
import { othersPlaylistsCached } from "../../data/community";
import { db } from "../../data/local-db";
import { Chips, Empty, ItemRow, Mark, SubChips } from "../../ui/bits";
import { IconGrid, IconList, IconPin, IconPlus, IconSort } from "../../ui/icons";
import { plural, useCanPlay, useLibrarySongs, usePlaylistCounts, usePlaylists } from "../hooks";
import { warmthFor } from "../../ui/artwork";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { ConnectedSongRow } from "../rows";
import { ScreenHead } from "../Shell";

type Top = "songs" | "playlists" | "artists" | "made";
type SongSub = LearnStatus | "liked";
type MadeSub = "songs" | "playlists";
type Sort = "recents" | "added" | "az" | "artist";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recents", label: "Recents" },
  { id: "added", label: "Recently added" },
  { id: "az", label: "Alphabetical" },
  { id: "artist", label: "Artist" },
];

function pref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  let v = fallback;
  try {
    v = (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    /* ignore */
  }
  return [
    v,
    (x: T) => {
      try {
        localStorage.setItem(key, x);
      } catch {
        /* ignore */
      }
    },
  ];
}

interface Item {
  key: string;
  kind: "song" | "playlist" | "artist";
  title: string;
  artist?: string;
  addedAt: string;
  recentAt: number;
  pinned: boolean;
  node: React.ReactNode;
  tile: { sub: string; go: () => void; menu?: () => void };
  seed: string;
  warmth?: number;
}

export function Library() {
  const nav = useNav();
  const { open } = useOverlays();
  const lib = useLibrarySongs();
  const playlists = usePlaylists();
  const counts = usePlaylistCounts();
  const canPlay = useCanPlay();
  const recents = useLiveQuery(async () => new Map((await db.recents.toArray()).map((r) => [r.key, r.openedAt])));

  const [top, setTop] = useState<Top | null>(null);
  const [songSub, setSongSub] = useState<SongSub | null>(null);
  const [madeSub, setMadeSub] = useState<MadeSub | null>(null);
  const [plSub, setPlSub] = useState<"mine" | "shared" | "saved" | null>(null);
  const [initialSort, persistSort] = pref<Sort>("gitara.lib.sort", "recents");
  const [sort, setSortState] = useState<Sort>(initialSort);
  const [initialView, persistView] = pref<"list" | "grid">("gitara.lib.view", "list");
  const [view, setViewState] = useState(initialView);

  const setSort = (s: Sort) => {
    setSortState(s);
    persistSort(s);
  };
  const setView = (v: "list" | "grid") => {
    setViewState(v);
    persistView(v);
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const rec = recents ?? new Map<string, number>();
    // the front page is Liked songs, Learning now and your playlists; every song lives under "Songs" (pinned ones also stay up front)
    const wantSongs = !top || top === "songs" || (top === "made" && madeSub !== "playlists");
    const wantPlaylists = !top || top === "playlists" || (top === "made" && madeSub !== "songs");

    if (wantSongs)
      for (const { song, entry } of lib ?? []) {
        if (!top && !entry.pinnedAt) continue;
        if (top === "made" && !isMine(song.createdBy)) continue;
        if (top === "songs" && songSub) {
          if (songSub === "liked" ? entryStatuses(entry).length > 0 : !entryStatuses(entry).includes(songSub)) continue;
        }
        out.push({
          key: `song:${song.id}`,
          kind: "song",
          title: song.title,
          artist: song.artist,
          addedAt: entry.createdAt,
          recentAt: rec.get(`song:${song.id}`) ?? Date.parse(entry.updatedAt),
          pinned: !!entry.pinnedAt,
          node: <ConnectedSongRow song={song} lead={entry.pinnedAt ? <span className="pin"><IconPin /></span> : undefined} />,
          tile: { sub: song.artist, go: () => nav.push({ name: "song", id: song.id }), menu: () => open({ kind: "songMenu", songId: song.id }) },
          seed: song.id,
          warmth: warmthFor(entry.status),
        });
      }

    if (wantPlaylists)
      for (const p of playlists ?? []) {
        if (top === "made" && !isMine(p.ownerId)) continue;
        if (top === "playlists" && plSub) {
          const o = othersPlaylistsCached();
          if (plSub === "mine" ? !isMine(p.ownerId) : plSub === "shared" ? !o.shared.has(p.id) : !o.saved.has(p.id)) continue;
        }
        const n = counts?.get(p.id) ?? 0;
        const sub = `Playlist · ${plural(n, "song")}${p.visibility === "private" ? "" : ` · ${p.visibility === "public" ? "Public" : "Unlisted"}`}`;
        const go = () => nav.push({ name: "playlist", id: p.id });
        out.push({
          key: `playlist:${p.id}`,
          kind: "playlist",
          title: p.name,
          addedAt: p.createdAt,
          recentAt: rec.get(`playlist:${p.id}`) ?? Date.parse(p.updatedAt),
          pinned: !!p.pinnedAt,
          node: <ItemRow title={p.name} sub={sub} lead={<Mark kind="playlist" seed={p.id} />} trail={p.pinnedAt ? <span className="pin"><IconPin /></span> : undefined} onClick={go} />,
          tile: { sub, go, menu: () => open({ kind: "playlistMenu", id: p.id }) },
          seed: p.id,
        });
      }

    if (top === "artists") {
      const by = new Map<string, { name: string; n: number; added: string }>();
      for (const { song, entry } of lib ?? []) {
        const k = normalize(song.artist);
        const cur = by.get(k);
        by.set(k, { name: cur?.name ?? song.artist, n: (cur?.n ?? 0) + 1, added: cur && cur.added > entry.createdAt ? cur.added : entry.createdAt });
      }
      for (const a of by.values()) {
        const go = () => nav.push({ name: "artist", artist: a.name });
        const sub = `Artist · ${plural(a.n, "song")} liked`;
        out.push({
          key: `artist:${a.name}`,
          kind: "artist",
          title: a.name,
          addedAt: a.added,
          recentAt: rec.get(`artist:${a.name}`) ?? Date.parse(a.added),
          pinned: false,
          node: <ItemRow title={a.name} sub={sub} lead={<Mark kind="artist" seed={a.name} />} onClick={go} />,
          tile: { sub, go },
          seed: a.name,
        });
      }
    }

    const filtered = out;
    const cmp: Record<Sort, (a: Item, b: Item) => number> = {
      recents: (a, b) => b.recentAt - a.recentAt,
      added: (a, b) => b.addedAt.localeCompare(a.addedAt),
      az: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => (a.artist ?? a.title).localeCompare(b.artist ?? b.title) || a.title.localeCompare(b.title),
    };
    return filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp[sort](a, b));
  }, [lib, playlists, counts, recents, top, songSub, madeSub, plSub, sort, nav, open]);

  const likedCount = lib?.length ?? 0;
  const learningCount = (lib ?? []).filter((x) => entryStatuses(x.entry).includes("learning")).length;
  const showCollections = !top && likedCount > 0;
  const loading = lib === undefined || playlists === undefined;
  const nothing = !loading && !likedCount && !(playlists ?? []).length;

  return (
    <>
      <ScreenHead
        title="Library"
        tracked
        right={
          <>
            <button className="iconbtn iconbtn--plain" aria-label="Create" onClick={() => open({ kind: "create" })}>
              <IconPlus />
            </button>
          </>
        }
      />
      {!nothing && (
        <div className="filterbar">
          <div className="filterbar__chips">
            <Chips
              label="Show"
              value={top}
              onChange={(v) => {
                setTop(v);
                setSongSub(null);
                setMadeSub(null);
                setPlSub(null);
              }}
              options={[
                { id: "songs", label: "Songs" },
                { id: "playlists", label: "Playlists" },
                { id: "artists", label: "Artists" },
                { id: "made", label: "Made by you" },
              ]}
            />
            {top === "songs" && (
              <SubChips
                value={songSub}
                onChange={setSongSub}
                options={[
                  { id: "planning", label: "Planning" },
                  { id: "learning", label: "Learning" },
                  { id: "performing", label: "Performing" },
                  { id: "liked", label: "No status" },
                ]}
              />
            )}
            {top === "playlists" && (
              <SubChips
                value={plSub}
                onChange={setPlSub}
                options={[
                  { id: "mine", label: "By you" },
                  { id: "shared", label: "Shared with you" },
                  { id: "saved", label: "Saved" },
                ]}
              />
            )}
            {top === "made" && (
              <SubChips
                value={madeSub}
                onChange={setMadeSub}
                options={[
                  { id: "songs", label: "Songs" },
                  { id: "playlists", label: "Playlists" },
                ]}
              />
            )}
          </div>
          <div className="filterbar__tools">
            <button className="toolbtn" onClick={() => open({ kind: "sort", current: sort, options: SORTS, onPick: (id) => setSort(id as Sort) })}>
              <IconSort />
              <span>{SORTS.find((s) => s.id === sort)!.label}</span>
            </button>
            <button className="iconbtn iconbtn--plain" aria-label={view === "list" ? "Show as grid" : "Show as list"} onClick={() => setView(view === "list" ? "grid" : "list")}>
              {view === "list" ? <IconGrid /> : <IconList />}
            </button>
          </div>
        </div>
      )}

      {showCollections && (
        <div className="list list--tight">
          <ItemRow title="Liked songs" sub={plural(likedCount, "song")} lead={<Mark kind="liked" />} onClick={() => nav.push({ name: "collection", kind: "liked" })} />
          {(canPlay?.size ?? 0) > 0 && (
            <ItemRow title="Songs I can play" sub={plural(canPlay!.size, "song")} lead={<Mark kind="liked" seed="songs-i-can-play" />} onClick={() => nav.push({ name: "collection", kind: "canplay" })} />
          )}
          {learningCount > 0 && (
            <ItemRow title="Learning now" sub={plural(learningCount, "song")} lead={<Mark kind="learning" />} onClick={() => nav.push({ name: "collection", kind: "learning" })} />
          )}
        </div>
      )}

      {nothing ? (
        <Empty title="Your Library is empty" text="Like songs or make a playlist and they'll show up here.">
          <div className="stack">
            <button className="btn btn--primary" onClick={() => nav.switchTab("search")}>
              Find songs
            </button>
            <button className="btn btn--secondary" onClick={() => open({ kind: "newPlaylist" })}>
              New playlist
            </button>
          </div>
        </Empty>
      ) : view === "list" ? (
        <ul className="list">
          {items.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
        </ul>
      ) : (
        <ul className="grid">
          {items.map((i) => (
            <li key={i.key}>
              <button
                className="gtile"
                onClick={i.tile.go}
                onContextMenu={(e) => {
                  if (!i.tile.menu) return;
                  e.preventDefault();
                  i.tile.menu();
                }}
              >
                <Mark kind={i.kind} seed={i.seed} warmth={i.warmth} res={[96, 96]} />
                <span className="gtile__title">{i.title}</span>
                <span className="gtile__sub">{i.tile.sub}</span>
                {i.pinned && (
                  <span className="pin gtile__pin">
                    <IconPin />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!nothing && !loading && !items.length && !showCollections && <p className="muted">Nothing here yet.</p>}
    </>
  );
}
