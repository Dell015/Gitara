import { useLiveQuery } from "dexie-react-hooks";
import { audio } from "../../audio/guitar";
import { db } from "../../data/local-db";
import { Art } from "../../ui/Art";
import { warmthFor } from "../../ui/artwork";
import { Empty } from "../../ui/bits";
import { IconArrow, IconClose, IconPlay, IconPractice, IconTuner } from "../../ui/icons";
import { useNav } from "../nav";
import { queue, useQueue } from "../queue";
import { ScreenHead } from "../Shell";

/** Practice tab (F1): back to what you were playing, what's up next, and the tools. */
export function Practice() {
  const nav = useNav();
  const items = useQueue();
  const rows = useLiveQuery(async () => {
    const songs = await db.songs.bulkGet(items.map((i) => i.songId));
    const entries = await db.library.bulkGet(items.map((i) => i.songId));
    return items.map((i, k) => ({ item: i, song: songs[k], status: entries[k]?.status }));
  }, [items]);
  const resume = useLiveQuery(async () => {
    const recent = (await db.recents.orderBy("openedAt").reverse().toArray()).find((r) => r.kind === "song");
    if (!recent) return null;
    const song = await db.songs.get(recent.refId);
    if (!song) return null;
    const entry = await db.library.get(song.id);
    const versions = await db.versions.where("songId").equals(song.id).toArray();
    const v = versions.find((x) => x.id === entry?.preferredVersionId) ?? versions[0];
    return { song, version: v, status: entry?.status };
  });

  const playQueue = async () => {
    const first = queue.get()[0];
    if (!first) return;
    const versions = await db.versions.where("songId").equals(first.songId).toArray();
    const entry = await db.library.get(first.songId);
    const v = versions.find((x) => x.id === (first.versionId ?? entry?.preferredVersionId)) ?? versions[0];
    if (!v) {
      nav.push({ name: "song", id: first.songId });
      return;
    }
    queue.remove(first.key);
    audio();
    nav.push({ name: "version", id: v.id, play: true, fromQueue: true });
  };

  return (
    <>
      <ScreenHead title="Practice" tracked />

      {resume && (
        <button
          className="glass glass--card continue continue--flat"
          onClick={() => {
            if (resume.version) {
              audio();
              nav.push({ name: "version", id: resume.version.id });
            } else nav.push({ name: "song", id: resume.song.id });
          }}
        >
          <Art seed={resume.song.id} warmth={warmthFor(resume.status)} className="continue__art" />
          <span className="continue__text">
            <span className="continue__label">Pick up where you left off</span>
            <span className="continue__title">{resume.song.title}</span>
          </span>
          <span className="ringbtn" aria-hidden="true">
            <IconArrow />
          </span>
        </button>
      )}

      <div className="tooltiles">
        <button className="tooltile" onClick={() => nav.push({ name: "tuner" })}>
          <IconTuner />
          <span className="tooltile__title">Tuner</span>
          <span className="tooltile__sub">Listens to your guitar</span>
        </button>
        <button className="tooltile" onClick={() => nav.push({ name: "metronome" })}>
          <IconPractice />
          <span className="tooltile__title">Metronome</span>
          <span className="tooltile__sub">Tap tempo, accents, trainer</span>
        </button>
      </div>

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
              {(rows ?? []).map(({ item, song, status }, i) => (
                <li key={item.key} className="qrow">
                  <span className="qrow__n num">{i + 1}</span>
                  {song && <Art seed={song.id} warmth={warmthFor(status)} className="srow__art" />}
                  <span className="irow__main">
                    <span className="irow__title">{song?.title ?? "Song"}</span>
                    <span className="irow__sub">{song?.artist}</span>
                  </span>
                  <button className="iconbtn iconbtn--plain" aria-label="Move up" onClick={() => queue.move(item.key, -1)} disabled={i === 0}>
                    <svg viewBox="0 0 24 24" width="20" height="20" className="icon" aria-hidden="true">
                      <path d="M6 14.5l6-6 6 6" />
                    </svg>
                  </button>
                  <button className="iconbtn iconbtn--plain" aria-label="Remove from queue" onClick={() => queue.remove(item.key)}>
                    <IconClose />
                  </button>
                </li>
              ))}
            </ol>
            <button className="btn btn--primary btn--big" onClick={() => void playQueue()}>
              <IconPlay /> Play the queue
            </button>
          </>
        ) : (
          <Empty title="Nothing up next" text="Swipe right on any song, or use its menu, to add it here. Then play them one after another." />
        )}
      </section>
    </>
  );
}
