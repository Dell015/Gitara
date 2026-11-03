import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import type { Song } from "../../core/model";
import { db } from "../../data/local-db";
import { rowToSong } from "../../data/mappers";
import { cacheSongs } from "../../data/repo";
import { supabase } from "../../data/supabase";
import { Empty, TopBar } from "../../ui/bits";
import { Hero } from "../../ui/Hero";
import { useNav } from "../nav";
import { SongList } from "../rows";

export function Browse({ genre }: { genre: string }) {
  const nav = useNav();
  const local = useLiveQuery(() => db.songs.filter((s) => s.genre === genre).toArray(), [genre]);
  const [remote, setRemote] = useState<Song[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("songs")
      .select("*")
      .eq("visibility", "public")
      .eq("genre", genre)
      .order("title")
      .limit(100)
      .then(async ({ data }) => {
        const songs = (data ?? []).map(rowToSong);
        await cacheSongs(songs);
        setRemote(songs);
      });
  }, [genre]);
  const ids = new Set((local ?? []).map((s) => s.id));
  const songs = [...(local ?? []), ...remote.filter((s) => !ids.has(s.id))].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <>
      <TopBar over onBack={nav.back} />
      <Hero seed={`genre-${genre}`} short>
        <div className="glass glass--card herocard">
          <h1 className="herocard__title">{genre}</h1>
          <p className="herocard__meta">Songs in Gitara</p>
        </div>
      </Hero>
      <SongList songs={songs} empty={<Empty title={`No ${genre} songs yet`} text="Add one and it'll show up here for everyone (if you make it public)." />} />
    </>
  );
}
