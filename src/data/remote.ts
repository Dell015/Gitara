/** Reading public things from the cloud (search, duplicate checks, artist pages). */
import type { Track } from "../core/drums";
import type { Song, Version } from "../core/model";
import { normalize } from "../core/text";
import { db } from "./local-db";
import { rowToSong, rowToTrack, rowToVersion, safeSearchTerm } from "./mappers";
import { cacheSongs } from "./repo";
import { supabase } from "./supabase";

export async function searchPublicSongs(q: string, limit = 20): Promise<Song[]> {
  const term = safeSearchTerm(q);
  if (!supabase || term.length < 2) return [];
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("visibility", "public")
    .or(`norm_title.ilike.*${term}*,norm_artist.ilike.*${term}*`)
    .order("norm_title")
    .limit(limit);
  if (error) throw error;
  const songs = (data ?? []).map(rowToSong);
  await cacheSongs(songs);
  return songs;
}

export async function publicSongsByArtist(artist: string): Promise<Song[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("songs").select("*").eq("visibility", "public").eq("norm_artist", normalize(artist)).limit(100);
  if (error) throw error;
  const songs = (data ?? []).map(rowToSong);
  await cacheSongs(songs);
  return songs;
}

export async function recentPublicSongs(limit = 12): Promise<Song[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("songs").select("*").eq("visibility", "public").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const songs = (data ?? []).map(rowToSong);
  await cacheSongs(songs);
  return songs;
}

/** Exact public duplicate (the database refuses a second one). */
export async function findPublicDuplicate(title: string, artist: string): Promise<Song | null> {
  if (!supabase || !title.trim() || !artist.trim()) return null;
  const { data } = await supabase
    .from("songs")
    .select("*")
    .eq("visibility", "public")
    .eq("norm_title", normalize(title))
    .eq("norm_artist", normalize(artist))
    .maybeSingle();
  return data ? rowToSong(data) : null;
}

/** Public versions of a song (cached on the device so they open offline later). */
export async function publicVersionsForSong(songId: string): Promise<Version[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("versions").select("*").eq("song_id", songId).eq("visibility", "public").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const vs = (data ?? []).map(rowToVersion);
  const pending = new Set((await db.outbox.where("table").equals("versions").toArray()).map((o) => o.rowId));
  await db.versions.bulkPut(vs.filter((v) => !pending.has(v.id)));
  return vs;
}

/** An exact public duplicate (same song, tuning, capo and chords): publishing it is refused. */
export async function findPublicVersionDuplicate(v: Pick<Version, "id" | "songId" | "contentHash" | "tuning" | "capo">): Promise<Version | null> {
  if (!supabase || !v.contentHash) return null;
  const { data } = await supabase
    .from("versions")
    .select("*")
    .eq("song_id", v.songId)
    .eq("visibility", "public")
    .eq("content_hash", v.contentHash)
    .eq("capo", v.capo)
    .eq("tuning", `{${v.tuning.join(",")}}`)
    .neq("id", v.id)
    .limit(1);
  return data && data[0] ? rowToVersion(data[0]) : null;
}

/** Public backing tracks for a song. */
export async function publicTracksForSong(songId: string): Promise<Track[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tracks").select("*").eq("song_id", songId).eq("visibility", "public").limit(50);
  if (error) throw error;
  const ts = (data ?? []).map(rowToTrack);
  const pending = new Set((await db.outbox.where("table").equals("tracks").toArray()).map((o) => o.rowId));
  await db.tracks.bulkPut(ts.filter((t) => !pending.has(t.id)));
  return ts;
}

/** "Popular in Gitara": public songs most people have saved. */
export async function popularSongs(limit = 10): Promise<{ song: Song; saves: number }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("popular_songs", { lim: limit });
  if (error) throw error;
  const rows = (data ?? []) as { song_id: string; saves: number }[];
  if (!rows.length) return [];
  const { data: songs } = await supabase.from("songs").select("*").in("id", rows.map((r) => r.song_id));
  const byId = new Map((songs ?? []).map((s) => [s.id as string, rowToSong(s)]));
  await cacheSongs([...byId.values()]);
  return rows.flatMap((r) => (byId.get(r.song_id) ? [{ song: byId.get(r.song_id)!, saves: Number(r.saves) }] : []));
}
