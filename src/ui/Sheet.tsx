import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bottom sheet. Opens with the drawer curve, follows the finger 1:1 while dragged, and closes on
 * distance or flick velocity. Drag is the only place we use spring-like release (velocity carried).
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 340);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    panel.current?.style.setProperty("transition", "none");
  }, []);
  const onMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    const dy = e.clientY - d.startY;
    // rubber-band upward drags instead of letting the sheet leave its edge
    const y = dy < 0 ? dy * 0.12 : dy;
    d.v = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT);
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    panel.current.style.transform = `translateY(${y}px)`;
  }, []);
  const onUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || !panel.current) return;
      const dy = e.clientY - d.startY;
      panel.current.style.removeProperty("transition");
      panel.current.style.removeProperty("transform");
      if (dy > 120 || d.v > 0.6) onClose();
    },
    [onClose],
  );

  if (!mounted) return null;
  return (
    <div className="sheet-root" data-state={shown ? "open" : "closed"}>
      <div className="sheet-scrim" onClick={onClose} />
      <div ref={panel} className="sheet glass" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="sheet__grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="sheet__handle" />
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
