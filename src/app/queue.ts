/** The practice queue (Spotify's "Up next", for playing): songs to play through, kept on this device. */
import { useSyncExternalStore } from "react";

export interface QueueItem {
  key: string;
  songId: string;
  versionId?: string;
}

const KEY = "gitara.queue.v1";
let items: QueueItem[] = load();
const listeners = new Set<() => void>();

function load(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueueItem[];
  } catch {
    return [];
  }
}
function save(next: QueueItem[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const queue = {
  add(songId: string, versionId?: string) {
    save([...items, { key: Math.random().toString(36).slice(2), songId, versionId }]);
  },
  remove(key: string) {
    save(items.filter((i) => i.key !== key));
  },
  move(key: string, dir: -1 | 1) {
    const i = items.findIndex((x) => x.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    save(next);
  },
  clear() {
    save([]);
  },
  shift(): QueueItem | undefined {
    const [first, ...rest] = items;
    save(rest);
    return first;
  },
  get: () => items,
};

export function useQueue(): QueueItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}
