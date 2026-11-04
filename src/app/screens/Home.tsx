import { useLiveQuery } from "dexie-react-hooks";
import { audio } from "../../audio/guitar";
import { db } from "../../data/local-db";
import { Art } from "../../ui/Art";
import { warmthFor } from "../../ui/artwork";
import { Empty } from "../../ui/bits";
import { IconArrow, IconClose, IconGroup, IconJam, IconListen, IconPlay, IconPractice, IconSongs, IconTuner } from "../../ui/icons";
import { LiveArt } from "../../ui/LiveArt";
import { greeting, useLibrarySongs, usePlaylists } from "../hooks";
import { useNav } from "../nav";
import { queue, useQueue } from "../queue";
import { ScreenHead } from "../Shell";

/**
 * Home is the tools page: a way back into what you were practising, every tool, and Up next.
 * Songs live in Search (browse) and Library (yours).
 */
export function Home() {
  const nav = useNav();
  const lib = useLibrarySongs();
  const playlists = usePlaylists();
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
  const queued = useLiveQuery(async () => (await db.songs.bulkGet(items.slice(0, 4).map((i) => i.songId))).map((s, k) => ({ item: items[k]!, song: s })), [items]);

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
          {/* every tool, in one place */}
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
              <button className="tooltile" onClick={() => nav.push({ name: "chords" })}>
                <IconSongs />
                <span className="tooltile__title">Chord finder</span>
                <span className="tooltile__sub">Every chord, every key. Or place your fingers</span>
              </button>
              <button className="tooltile" onClick={() => nav.push({ name: "listen" })}>
                <IconListen />
                <span className="tooltile__title">Chord listener</span>
                <span className="tooltile__sub">Play a chord, see its name</span>
              </button>
              <button className="tooltile" onClick={() => nav.push({ name: "jam" })}>
                <IconGroup />
                <span className="tooltile__title">Jam with friends</span>
                <span className="tooltile__sub">One setlist for everyone</span>
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
        </div>
      </div>
    </>
  );
}
