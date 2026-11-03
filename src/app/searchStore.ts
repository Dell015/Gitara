/** The search text, shared by the Search screen and the desktop top bar's search field. */
import { useSyncExternalStore } from "react";

let q = "";
const listeners = new Set<() => void>();

export function setSearch(v: string) {
  q = v;
  listeners.forEach((l) => l());
}

export function useSearch(): [string, (v: string) => void] {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => q,
  );
  return [v, setSearch];
}
