import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import type { Song } from "../../core/model";
import { db } from "../../data/local-db";
import { recentPublicSongs } from "../../data/remote";
import { Empty, Mark } from "../../ui/bits";
import { Art } from "../../ui/Art";
import { LiveArt } from "../../ui/LiveArt";
import { warmthFor } from "../../ui/artwork";
import { IconArrow } from "../../ui/icons";
import { HeatMark } from "../../ui/HeatMark";
import { greeting, useLibrarySongs } from "../hooks";
import { useNav } from "../nav";
import { SongList } from "../rows";
import { ScreenHead } from "../Shell";

export function Home() {
  const nav = useNav();
  const lib = useLibrarySongs();
  const recents = useLiveQuery(async () => {
    const r = await db.recents.orderBy("openedAt").reverse().limit(8).toArray();
    const out: { key: string; seed: string; warmth?: number; title: string; kind: "song" | "playlist" | "artist"; go: () => void }[] = [];
    for (const x of r) {
      if (x.kind === "song") {
        const s = await db.songs.get(x.refId);
        if (s) out.push({ key: x.key, seed: s.id, warmth: warmthFor((await db.library.get(s.id))?.status), title: s.title, kind: "song", go: () => nav.push({ name: "song", id: s.id }) });
      } else if (x.kind === "playlist") {
        const p = await db.playlists.get(x.refId);
        if (p) out.push({ key: x.key, seed: p.id, title: p.name, kind: "playlist", go: () => nav.goTo("library", { name: "playlist", id: p.id }) });
      } else {
        out.push({ key: x.key, seed: x.refId, title: x.refId, kind: "artist", go: () => nav.push({ name: "artist", artist: x.refId }) });
      }
    }
    return out;
  }, [nav]);
  const [fresh, setFresh] = useState<Song[]>([]);
  useEffect(() => {
    recentPublicSongs(8).then(setFresh, () => setFresh([]));
  }, []);

  const learning = (lib ?? []).filter((x) => x.entry.status === "learning").map((x) => x.song);
  const planning = (lib ?? []).filter((x) => x.entry.status === "planning").map((x) => x.song);
  const libIds = new Set((lib ?? []).map((x) => x.song.id));
  const newInGitara = fresh.filter((s) => !libIds.has(s.id));

  if (lib && !lib.length) {
    return (
      <>
        <LiveArt seed={`home-${new Date().toISOString().slice(0, 10)}`} style="arc" warmth={0.95} className="ambient" />
        <ScreenHead title={greeting()} />
        <Empty title="Start your songbook" text="Like songs you play or want to learn. They'll show up here and in your Library.">
          <div className="stack">
            <button className="btn btn--primary" onClick={() => nav.switchTab("search")}>
              Find songs
            </button>
            <button className="btn btn--secondary" onClick={() => nav.push({ name: "addSong" })}>
              Add a song
            </button>
          </div>
        </Empty>
        {newInGitara.length > 0 && (
          <section className="block">
            <h2 className="h2">New in Gitara</h2>
            <SongList songs={newInGitara} />
          </section>
        )}
      </>
    );
  }

  const last = recents?.find((r) => r.kind === "song");
  const dayKey = new Date().toISOString().slice(0, 10);

  return (
    <>
      <LiveArt seed={`home-${dayKey}`} style="arc" warmth={0.95} className="ambient" />
      <ScreenHead title={greeting()} />
      {last && (
        <button className="glass glass--card continue" onClick={last.go}>
          <Art seed={last.seed} warmth={last.warmth} className="continue__art" />
          <span className="continue__text">
            <span className="continue__label">Continue</span>
            <span className="continue__title">{last.title}</span>
          </span>
          <span className="ringbtn" aria-hidden="true">
            <IconArrow />
          </span>
        </button>
      )}
      {recents && recents.length > 1 && (
        <div className="quick">
          {recents.filter((r) => r !== last).slice(0, 6).map((r) => (
            <button key={r.key} className="quick__item" onClick={r.go}>
              <Mark kind={r.kind} seed={r.seed} warmth={r.warmth} />
              <span className="quick__title">{r.title}</span>
            </button>
          ))}
        </div>
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
          <SongList songs={learning.slice(0, 5)} />
        </section>
      )}
      {planning.length > 0 && (
        <section className="block">
          <h2 className="h2">
            <HeatMark heat="planning" /> Planning to learn
          </h2>
          <SongList songs={planning.slice(0, 5)} />
        </section>
      )}
      {newInGitara.length > 0 && (
        <section className="block">
          <h2 className="h2">New in Gitara</h2>
          <SongList songs={newInGitara.slice(0, 6)} />
        </section>
      )}
    </>
  );
}
