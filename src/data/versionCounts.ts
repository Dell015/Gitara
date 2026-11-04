/**
 * How many versions (chord charts) each song has, for the song rows. Counts what you can see: public
 * versions plus your own. Asked for in one batch so a long list costs one request, and remembered so
 * scrolling back doesn't ask again.
 */
import { useEffect, useState } from "react";
import { currentUserId } from "./auth";
import { supabase } from "./supabase";

const counts = new Map<string, number>();
const asked = new Set<string>();
const listeners = new Set<() => void>();
let queue: string[] = [];
let timer: number | undefined;

async function flush() {
  timer = undefined;
  const ids = queue;
  queue = [];
  if (!ids.length || !supabase) return;
  try {
    const { data, error } = await supabase.from("versions").select("song_id").in("song_id", ids).limit(5000);
    if (error) throw error;
    const fresh = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const r of data ?? []) fresh.set(r.song_id as string, (fresh.get(r.song_id as string) ?? 0) + 1);
    fresh.forEach((n, id) => counts.set(id, n));
    listeners.forEach((l) => l());
  } catch {
    ids.forEach((id) => asked.delete(id)); // offline: try again next time the row shows
  }
}

function want(id: string) {
  if (asked.has(id) || !supabase || !currentUserId()) return;
  asked.add(id);
  queue.push(id);
  timer ??= window.setTimeout(() => void flush(), 40);
}

/** The cloud's count for a song (public + yours), or undefined until it's known. */
export function useRemoteVersionCount(songId: string): number | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    want(songId);
    return () => void listeners.delete(l);
  }, [songId]);
  return counts.get(songId);
}

/** Keep the number right after you add or delete a version here. */
export function forgetVersionCount(songId: string) {
  counts.delete(songId);
  asked.delete(songId);
}
