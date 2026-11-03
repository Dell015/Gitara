import { useEffect, useRef, useState } from "react";
import { Art } from "./Art";
import type { ArtStyle } from "./artwork";
import { startLiveArt } from "./lightShader";

const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The big moving light. Falls back to the still artwork when WebGL isn't available or Reduce Motion
 * is on. The still is also shown underneath until the first frame is drawn, so nothing flashes.
 */
export function LiveArt({ seed, warmth = 0.8, style, className = "", res = [150, 210] }: { seed: string; warmth?: number; style?: ArtStyle; className?: string; res?: [number, number] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (reduceMotion() || !canvas.current) return;
    const h = startLiveArt(canvas.current, seed, { warmth, style });
    setLive(!!h);
    return () => h?.destroy();
  }, [seed, warmth, style]);
  return (
    <Art seed={seed} warmth={warmth} style={style} res={res} className={`${className} liveart`}>
      <canvas ref={canvas} className="liveart__canvas" data-on={live} aria-hidden="true" />
    </Art>
  );
}
