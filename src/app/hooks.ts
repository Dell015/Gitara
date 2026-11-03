import { useLiveQuery } from "dexie-react-hooks";
import type { LibraryEntry, Playlist, Song } from "../core/model";
import { db } from "../data/local-db";

export interface LibrarySong {
  song: Song;
  entry: LibraryEntry;
}

/** Everything in your Library (liked songs, with or without a status). */
export function useLibrarySongs(): LibrarySong[] | undefined {
  return useLiveQuery(async () => {
    const entries = await db.library.toArray();
    const songs = await db.songs.bulkGet(entries.map((e) => e.songId));
    return entries.flatMap((entry, i) => (songs[i] ? [{ song: songs[i]!, entry }] : []));
  });
}

export function usePlaylists(): Playlist[] | undefined {
  return useLiveQuery(() => db.playlists.toArray());
}

export function useEntry(songId: string) {
  return useLiveQuery(() => db.library.get(songId), [songId]);
}

export function useSong(id: string) {
  return useLiveQuery(() => db.songs.get(id), [id]);
}

/** Song counts per playlist, for rows. */
export function usePlaylistCounts(): Map<string, number> | undefined {
  return useLiveQuery(async () => {
    const items = await db.playlistItems.toArray();
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.playlistId, (m.get(i.playlistId) ?? 0) + 1));
    return m;
  });
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Late night jam";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatDuration(sec?: number): string | undefined {
  if (!sec) return undefined;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
