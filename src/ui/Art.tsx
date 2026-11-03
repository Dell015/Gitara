import { useMemo, type CSSProperties, type ReactNode } from "react";
import { renderArt, type ArtStyle } from "./artwork";

/**
 * Generated "heat light" artwork with crisp grain on top. `res` is the render size in pixels; the
 * browser scales it up (soft gradients don't need more). Purely visual: hidden from screen readers.
 */
export function Art({
  seed,
  warmth,
  style,
  res = [48, 48],
  className = "",
  children,
  round,
}: {
  seed: string;
  warmth?: number;
  style?: ArtStyle;
  res?: [number, number];
  className?: string;
  children?: ReactNode;
  round?: boolean;
}) {
  const url = useMemo(() => renderArt(seed, { warmth, style, width: res[0], height: res[1] }), [seed, warmth, style, res[0], res[1]]);
  const css = { backgroundImage: url ? `url(${url})` : undefined } as CSSProperties;
  return (
    <span className={`art ${round ? "art--round" : ""} ${className}`} style={css} aria-hidden={children ? undefined : true}>
      {children}
    </span>
  );
}
