import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { audio } from "../../audio/guitar";
import { GUITAR } from "../../core/instrument";
import type { Song } from "../../core/model";
import { db } from "../../data/local-db";
import { popularSongs, recentPublicSongs } from "../../data/remote";
import { Art } from "../../ui/Art";
import { warmthFor } from "../../ui/artwork";
import { Empty, Mark } from "../../ui/bits";
import { HeatMark } from "../../ui/HeatMark";
import { IconArrow, IconClose, IconJam, IconPlay, IconPlaylists, IconPractice, IconSongs, IconTuner } from "../../ui/icons";
import { LiveArt } from "../../ui/LiveArt";
import { greeting, plural, useCanPlay, useLibrarySongs, usePlaylists } from "../hooks";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { queue, useQueue } from "../queue";
import { SongList } from "../rows";
import { ScreenHead } from "../Shell";

/**
 * Home: your way back into playing, then your songbook, then the tools, then what's out there.
 * (The Practice tab is folded in here: Continue, Up next and the tools.)
 */
export function Home() {
  const nav = useNav();
  const { open } = useOverlays();
  const lib = useLibrarySongs();
  const playlists = usePlaylists();
  const canPlay = useCanPlay();
  const items = useQueue();
  const dayKey = new Date().toISOString().slice(0, 10);

  // most recent practice: the last song you opened that has chords
  const resume = useLiveQuery(async () => {
    const recents = (await db.recents.orderBy("openedAt").reverse().toArray()).filter((r) => r.kind === "song");
    for (const r of recents) {
      const song = await db.songs.get(r.refId);
      if (!song) continue;
      const entry = await db.library.get(song.id);
      const versions = await db.versions.where("songId").equals(song.id).toArray();
      const v = versions.find((x) => x.id === entry?.preferredVersionId) ?? versions[0];
      return { song, version: v, status: entry?.status, at: r.openedAt };
    }
    return null;
  });
  const recent = useLiveQuery(async () => {
    const r = await db.recents.orderBy("openedAt").reverse().limit(10).toArray();
    const out: { key: string; seed: string; warmth?: number; title: string; kind: "song" | "playlist" | "artist"; go: () => void }[] = [];
    for (const x of r) {
      if (x.kind === "song") {
        const s = await db.songs.get(x.refId);
        if (s) out.push({ key: x.key, seed: s.id, warmth: warmthFor((await db.library.get(s.id))?.status), title: s.title, kind: "song", go: () => nav.push({ name: "song", id: s.id }) });
      } else if (x.kind === "playlist") {
        const p = await db.playlists.get(x.refId);
        if (p) out.push({ key: x.key, seed: p.id, title: p.name, kind: "playlist", go: () => nav.goTo("library", { name: "playlist", id: p.id }) });
      } else out.push({ key: x.key, seed: x.refId, title: x.refId, kind: "artist", go: () => nav.push({ name: "artist", artist: x.refId }) });
    }
    return out;
  }, [nav]);
  const queued = useLiveQuery(async () => (await db.songs.bulkGet(items.slice(0, 4).map((i) => i.songId))).map((s, k) => ({ item: items[k]!, song: s })), [items]);

  const [popular, setPopular] = useState<{ song: Song; saves: number }[]>([]);
  const [fresh, setFresh] = useState<Song[]>([]);
  useEffect(() => {
    popularSongs(8).then(setPopular, () => setPopular([]));
    recentPublicSongs(8).then(setFresh, () => setFresh([]));
  }, []);

  const learning = (lib ?? []).filter((x) => x.entry.status === "learning");
  const libIds = new Set((lib ?? []).map((x) => x.song.id));
  const popularNew = popular.filter((p) => !libIds.has(p.song.id));
  const freshNew = fresh.filter((s) => !libIds.has(s.id) && !popular.some((p) => p.song.id === s.id));

  const playQueue = async () => {
    const first = queue.get()[0];
    if (!first) return;
    const versions = await db.versions.where("songId").equals(first.songId).toArray();
    const entry = await db.library.get(first.songId);
    const v = versions.find((x) => x.id === (first.versionId ?? entry?.preferredVersionId)) ?? versions[0];
    if (!v) return nav.push({ name: "song", id: first.songId });
    queue.remove(first.key);
    audio();
    nav.push({ name: "version", id: v.id, play: true, fromQueue: true });
  };

  const empty = lib !== undefined && !lib.length && !(playlists ?? []).length;

  return (
    <>
      <LiveArt seed={`home-${dayKey}`} style="arc" warmth={0.95} className="ambient" />
      <ScreenHead title={greeting()} />

      <div className="home">
        <div className="home__main">
          {/* 1. back to playing */}
          {resume ? (
            <div className="glass glass--card continue continue--big">
              <Art seed={resume.song.id} warmth={warmthFor(resume.status)} className="continue__art" />
              <button className="continue__text" onClick={() => (resume.version ? nav.push({ name: "version", id: resume.version.id }) : nav.push({ name: "song", id: resume.song.id }))}>
                <span className="continue__label">{resume.version ? "Continue practising" : "Last opened"}</span>
                <span className="continue__title">{resume.song.title}</span>
                <span className="continue__label">{resume.song.artist}</span>
              </button>
              {resume.version ? (
                <button
                  className="btn btn--primary btn--big"
                  onClick={() => {
                    audio();
                    nav.push({ name: "version", id: resume.version!.id, play: true });
                  }}
                >
                  <IconPlay /> Play along
                </button>
              ) : (
                <button className="ringbtn" aria-label="Open song" onClick={() => nav.push({ name: "song", id: resume.song.id })}>
                  <IconArrow />
                </button>
              )}
            </div>
          ) : empty ? (
            <Empty title="Start your songbook" text="Like songs you play or want to learn, or add one. Your practice starts here.">
              <div className="stack">
                <button className="btn btn--primary" onClick={() => nav.switchTab("search")}>
                  Find songs
                </button>
                <button className="btn btn--secondary" onClick={() => nav.push({ name: "addSong" })}>
                  Add a song
                </button>
              </div>
            </Empty>
          ) : null}

          {/* 2. your songbook */}
          {!empty && (
            <section className="block">
              <div className="block__head">
                <h2 className="h2">Your songbook</h2>
                <button className="link" onClick={() => nav.switchTab("library")}>
                  Open Library
                </button>
              </div>
              <div className="shortcuts">
                <button className="shortcut" onClick={() => nav.goTo("library", { name: "collection", kind: "liked" })}>
                  <Mark kind="liked" />
                  <span className="shortcut__title">Liked songs</span>
                  <span className="shortcut__sub num">{plural(lib?.length ?? 0, "song")}</span>
                </button>
                <button className="shortcut" onClick={() => nav.goTo("library", { name: "collection", kind: "learning" })}>
                  <Mark kind="learning" />
                  <span className="shortcut__title">Learning now</span>
                  <span className="shortcut__sub num">{plural(learning.length, "song")}</span>
                </button>
                <button className="shortcut" onClick={() => nav.goTo("library", { name: "collection", kind: "canplay" })}>
                  <Art seed="songs-i-can-play" warmth={1} className="mark" />
                  <span className="shortcut__title">Songs I can play</span>
                  <span className="shortcut__sub num">{plural(canPlay?.size ?? 0, "song")}</span>
                </button>
                <button className="shortcut" onClick={() => nav.switchTab("library")}>
                  <span className="mark mark--icon">
                    <IconPlaylists />
                  </span>
                  <span className="shortcut__title">Playlists</span>
                  <span className="shortcut__sub num">{plural(playlists?.length ?? 0, "playlist")}</span>
                </button>
              </div>
              {recent && recent.filter((r) => r.seed !== resume?.song.id).length > 0 && (
                <div className="quick">
                  {recent
                    .filter((r) => r.seed !== resume?.song.id)
                    .slice(0, 6)
                    .map((r) => (
                      <button key={r.key} className="quick__item" onClick={r.go}>
                        <Mark kind={r.kind} seed={r.seed} warmth={r.warmth} />
                        <span className="quick__title">{r.title}</span>
                      </button>
                    ))}
                </div>
              )}
            </section>
          )}

          {learning.length > 0 && (
            <section className="block">
              <div className="block__head">
                <h2 className="h2">
                  <HeatMark heat="learning" /> Learning now
                </h2>
                <button className="link" onClick={() => nav.goTo("library", { name: "collection", kind: "learning" })}>
                  Show all
                </button>
              </div>
              <SongList songs={learning.slice(0, 4).map((x) => x.song)} />
            </section>
          )}

          {/* 4. what's out there */}
          {popularNew.length > 0 && (
            <section className="block">
              <h2 className="h2">Popular in Gitara</h2>
              <SongList songs={popularNew.slice(0, 6).map((p) => p.song)} />
            </section>
          )}
          {freshNew.length > 0 && (
            <section className="block">
              <h2 className="h2">New in Gitara</h2>
              <SongList songs={freshNew.slice(0, 6)} />
            </section>
          )}
        </div>

        <aside className="home__side">
          {/* 3. tools for musicians */}
          <section className="block">
            <h2 className="h2">Tools</h2>
            <div className="tooltiles">
              <button className="tooltile" onClick={() => nav.push({ name: "tuner" })}>
                <IconTuner />
                <span className="tooltile__title">Tuner</span>
                <span className="tooltile__sub">Listens to your guitar</span>
              </button>
              <button className="tooltile" onClick={() => nav.push({ name: "metronome" })}>
                <IconPractice />
                <span className="tooltile__title">Metronome</span>
                <span className="tooltile__sub">Tap tempo, speed trainer</span>
              </button>
              <button className="tooltile" onClick={() => nav.push({ name: "track" })}>
                <IconJam />
                <span className="tooltile__title">Beat maker</span>
                <span className="tooltile__sub">Drums to play along with</span>
              </button>
              <button
                className="tooltile"
                onClick={() => open({ kind: "fretboard", tuning: GUITAR.standardTuning, capo: 0, onDone: () => undefined })}
              >
                <IconSongs />
                <span className="tooltile__title">Chord finder</span>
                <span className="tooltile__sub">Place fingers, get the name</span>
              </button>
            </div>
          </section>

          <section className="block">
            <div className="block__head">
              <h2 className="h2">Up next</h2>
              {items.length > 0 && (
                <button className="link" onClick={() => queue.clear()}>
                  Clear
                </button>
              )}
            </div>
            {items.length ? (
              <>
                <ol className="list">
                  {(queued ?? []).map(({ item, song }, i) => (
                    <li key={item.key} className="qrow">
                      <span className="qrow__n num">{i + 1}</span>
                      {song && <Art seed={song.id} className="srow__art" />}
                      <span className="irow__main">
                        <span className="irow__title">{song?.title ?? "Song"}</span>
                        <span className="irow__sub">{song?.artist}</span>
                      </span>
                      <button className="iconbtn iconbtn--plain" aria-label="Remove from Up next" onClick={() => queue.remove(item.key)}>
                        <IconClose />
                      </button>
                    </li>
                  ))}
                </ol>
                {items.length > 4 && <p className="muted">and {items.length - 4} more</p>}
                <button className="btn btn--primary" onClick={() => void playQueue()}>
                  <IconPlay /> Play the queue
                </button>
              </>
            ) : (
              <p className="muted">Swipe right on a song (or use its menu) to queue it, then play them back to back.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
