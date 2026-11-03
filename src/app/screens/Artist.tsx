import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import type { Song } from "../../core/model";
import { normalize } from "../../core/text";
import { db } from "../../data/local-db";
import { publicSongsByArtist } from "../../data/remote";
import * as repo from "../../data/repo";
import { Empty, Segmented, TopBar } from "../../ui/bits";
import { plural } from "../hooks";
import { useNav } from "../nav";
import { SongList } from "../rows";

export function ArtistScreen({ artist }: { artist: string }) {
  const nav = useNav();
  const na = normalize(artist);
  const local = useLiveQuery(() => db.songs.filter((s) => normalize(s.artist) === na).toArray(), [na]);
  const liked = useLiveQuery(async () => new Set((await db.library.toArray()).map((e) => e.songId)));
  const [remote, setRemote] = useState<Song[]>([]);
  const [sort, setSort] = useState<"az" | "new">("az");
  useEffect(() => {
    void repo.touchRecent("artist", artist);
    publicSongsByArtist(artist).then(setRemote, () => setRemote([]));
  }, [artist]);

  const ids = new Set((local ?? []).map((s) => s.id));
  const all = [...(local ?? []), ...remote.filter((s) => !ids.has(s.id))].sort((a, b) =>
    sort === "az" ? a.title.localeCompare(b.title) : (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || a.title.localeCompare(b.title),
  );
  const yours = all.filter((s) => liked?.has(s.id));

  return (
    <>
      <TopBar onBack={nav.back} />
      <header className="page-head">
        <h1 className="page-title">{artist}</h1>
        <p className="muted num">
          {plural(all.length, "song")} in Gitara{yours.length ? ` · ${yours.length} in your Library` : ""}
        </p>
      </header>
      {all.length > 1 && (
        <div className="block">
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { id: "az", label: "A–Z" },
              { id: "new", label: "Newest" },
            ]}
          />
        </div>
      )}
      <SongList songs={all} empty={<Empty title="No songs yet" />} />
      <div className="block">
        <button className="btn btn--secondary" onClick={() => nav.push({ name: "addSong", artist })}>
          Add a song by {artist}
        </button>
      </div>
    </>
  );
}
