/** Reading public things from the cloud (search, duplicate checks, artist pages). */
import type { Song } from "../core/model";
import { normalize } from "../core/text";
import { rowToSong, safeSearchTerm } from "./mappers";
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
