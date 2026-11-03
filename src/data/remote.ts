/** Reading public things from the cloud (search, duplicate checks, artist pages). */
import type { Song, Version } from "../core/model";
import { normalize } from "../core/text";
import { db } from "./local-db";
import { rowToSong, rowToVersion, safeSearchTerm } from "./mappers";
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
