import type { ReactNode } from "react";
import { Art } from "./Art";
import { LiveArt } from "./LiveArt";
import type { ArtStyle } from "./artwork";

/**
 * Full-bleed artwork at the top of a page (song, playlist, collection), fading into the ink below.
 * The page's glass card sits on its lower edge: glass is only used where there's light behind it.
 */
export function Hero({ seed, warmth, style, children, short }: { seed: string; warmth?: number; style?: ArtStyle; children?: ReactNode; short?: boolean }) {
  return (
    <div className={short ? "hero hero--short" : "hero"}>
      <LiveArt seed={seed} warmth={warmth} style={style} className="hero__art" />
      <div className="hero__content">
        <Art seed={seed} warmth={warmth} style={style} res={[120, 120]} className="hero__cover" />
        {children}
      </div>
    </div>
  );
}
