/**
 * One place for things that float over the screen: the song "…" menu, the playlist picker,
 * the Create sheet, the account sheet, and toasts with Undo.
 */
import type { Preset } from "../core/drums";
import type { Voicing } from "../core/shapes";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Overlay =
  | { kind: "songMenu"; songId: string; playlistItemId?: string }
  | { kind: "pickPlaylist"; songId: string }
  | { kind: "status"; songId: string }
  | { kind: "create" }
  | { kind: "account" }
  | { kind: "newPlaylist"; addSongId?: string }
  | { kind: "editPlaylist"; id: string }
  | { kind: "playlistMenu"; id: string }
  | { kind: "addToPlaylist"; playlistId: string }
  | { kind: "sort"; current: string; options: { id: string; label: string }[]; onPick: (id: string) => void }
  | { kind: "chord"; name: string; tuning: readonly number[]; capo: number; current?: number[]; onPick?: (v: Voicing) => void }
  | { kind: "fretboard"; tuning: readonly number[]; capo: number; start?: number[]; onDone: (name: string, v: Voicing) => void }
  | { kind: "versionMenu"; id: string }
  | { kind: "grooves"; onPick: (p: Preset) => void }
  | { kind: "trainer"; mode: "playalong" | "metronome"; bpm?: number; onStart?: () => void }
  | { kind: "pickTrack"; songId: string; current?: string; onPick: (id: string | null) => void };

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Overlays {
  overlay: Overlay | null;
  open: (o: Overlay) => void;
  close: () => void;
  toast: Toast | null;
  showToast: (text: string, action?: Toast["action"]) => void;
  hideToast: () => void;
}

const Ctx = createContext<Overlays | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const hideToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((text: string, action?: Toast["action"]) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setToast(null), action ? 5000 : 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = useCallback((o: Overlay) => setOverlay(o), []);
  const close = useCallback(() => setOverlay(null), []);
  const value = useMemo(() => ({ overlay, open, close, toast, showToast, hideToast }), [overlay, open, close, toast, showToast, hideToast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOverlays(): Overlays {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOverlays outside OverlayProvider");
  return v;
}
