/**
 * Navigation like Spotify: each tab keeps its own back history, tapping the current tab scrolls to
 * the top and then returns to the tab's start, and scroll position comes back when you go back.
 * Kept in sessionStorage so a reload doesn't lose your place.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { VersionPart } from "../core/model";

export type Tab = "home" | "search" | "library";

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "library" }
  | { name: "song"; id: string }
  | { name: "artist"; artist: string }
  | { name: "playlist"; id: string }
  | { name: "collection"; kind: "liked" | "learning" | "canplay" }
  | { name: "version"; id: string; play?: boolean; fromQueue?: boolean }
  | { name: "tuner" }
  | { name: "chords" }
  | { name: "listen" }
  | { name: "user"; id: string }
  | { name: "profile" }
  | { name: "admin" }
  | { name: "legal"; page: "terms" | "privacy" | "copyright" | "credits" }
  | { name: "track"; id?: string; songId?: string }
  | { name: "metronome" }
  | { name: "jam"; code?: string }
  | { name: "jamRoom"; id: string }
  | { name: "editVersion"; songId: string; id?: string; part?: VersionPart }
  | { name: "browse"; genre: string }
  | { name: "addSong"; title?: string; artist?: string; editId?: string };

type Stacks = Record<Tab, Route[]>;
const ROOTS: Stacks = { home: [{ name: "home" }], search: [{ name: "search" }], library: [{ name: "library" }] };
const KEY = "gitara.nav.v1";

function load(): { tab: Tab; stacks: Stacks } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as { tab: Tab; stacks: Stacks };
      // a saved place from an older version (e.g. the removed Practice tab) starts fresh
      if (s.tab in ROOTS && Object.keys(ROOTS).every((k) => Array.isArray(s.stacks?.[k as Tab]))) return s;
    }
  } catch {
    /* private mode or bad data: start fresh */
  }
  return { tab: "home", stacks: ROOTS };
}

interface Nav {
  tab: Tab;
  route: Route;
  depth: number;
  push: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  switchTab: (t: Tab) => void;
  /** Push onto a different tab (e.g. from the Create sheet). */
  goTo: (t: Tab, r: Route) => void;
}

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState(load);
  const scroll = useRef(new Map<string, number>());
  const pendingRestore = useRef<number | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  const stack = s.stacks[s.tab];
  const route = stack[stack.length - 1]!;
  const posKey = (tab: Tab, depth: number) => `${tab}:${depth}`;

  useEffect(() => {
    const y = pendingRestore.current;
    pendingRestore.current = null;
    window.scrollTo(0, y ?? 0);
  }, [route, s.tab]);

  const save = useCallback(() => scroll.current.set(posKey(s.tab, stack.length - 1), window.scrollY), [s.tab, stack.length]);

  const push = useCallback(
    (r: Route) => {
      save();
      setS((p) => ({ ...p, stacks: { ...p.stacks, [p.tab]: [...p.stacks[p.tab], r] } }));
    },
    [save],
  );
  const replace = useCallback((r: Route) => {
    setS((p) => ({ ...p, stacks: { ...p.stacks, [p.tab]: [...p.stacks[p.tab].slice(0, -1), r] } }));
  }, []);
  const back = useCallback(() => {
    setS((p) => {
      const st = p.stacks[p.tab];
      if (st.length <= 1) return p;
      pendingRestore.current = scroll.current.get(posKey(p.tab, st.length - 2)) ?? 0;
      return { ...p, stacks: { ...p.stacks, [p.tab]: st.slice(0, -1) } };
    });
  }, []);
  const switchTab = useCallback(
    (t: Tab) => {
      if (t === s.tab) {
        // Second tap: scroll to top; if already at top, go back to the tab's start.
        if (window.scrollY > 4) window.scrollTo({ top: 0, behavior: "smooth" });
        else setS((p) => ({ ...p, stacks: { ...p.stacks, [t]: ROOTS[t] } }));
        return;
      }
      save();
      const target = s.stacks[t];
      pendingRestore.current = scroll.current.get(posKey(t, target.length - 1)) ?? 0;
      setS((p) => ({ ...p, tab: t }));
    },
    [s.tab, s.stacks, save],
  );
  const goTo = useCallback(
    (t: Tab, r: Route) => {
      save();
      setS((p) => ({ tab: t, stacks: { ...p.stacks, [t]: [...p.stacks[t], r] } }));
    },
    [save],
  );

  const value = useMemo(
    () => ({ tab: s.tab, route, depth: stack.length - 1, push, replace, back, switchTab, goTo }),
    [s.tab, route, stack.length, push, replace, back, switchTab, goTo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): Nav {
  const n = useContext(Ctx);
  if (!n) throw new Error("useNav outside NavProvider");
  return n;
}
