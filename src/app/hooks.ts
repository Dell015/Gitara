import { useLiveQuery } from "dexie-react-hooks";
import type { LibraryEntry, Playlist, Song } from "../core/model";
import { chordsUsed } from "../core/chart";
import { isMine } from "../data/auth";
import { othersPlaylistsCached } from "../data/community";
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

/** Playlists in your Library: yours, ones shared with you, and ones you saved (not ones you only looked at). */
export function usePlaylists(): Playlist[] | undefined {
  return useLiveQuery(async () => {
    const { shared, saved } = othersPlaylistsCached();
    return (await db.playlists.toArray()).filter((p) => isMine(p.ownerId) || shared.has(p.id) || saved.has(p.id));
  });
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

/**
 * "Songs I can play": the chords you know are the chords in the songs you're Performing (their
 * default version, or your own). A liked song whose default version uses only those chords counts.
 */
export function useCanPlay(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const entries = await db.library.toArray();
    const versions = await db.versions.toArray();
    const pick = (songId: string, pref?: string) => {
      const vs = versions.filter((v) => v.songId === songId);
      return vs.find((v) => v.id === pref) ?? vs[0];
    };
    const known = new Set<string>();
    for (const e of entries) if (e.status === "performing") for (const c of chordsUsed(pick(e.songId, e.preferredVersionId)?.content ?? { sections: [], arrangement: [] })) known.add(c);
    const out = new Set<string>();
    if (!known.size) return out;
    for (const e of entries) {
      const v = pick(e.songId, e.preferredVersionId);
      if (!v) continue;
      const cs = chordsUsed(v.content);
      if (cs.length && cs.every((c) => known.has(c))) out.add(e.songId);
    }
    return out;
  });
}
