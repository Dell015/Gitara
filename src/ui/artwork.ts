/**
 * "Heat light" artwork: a grainy fluid gradient generated from a seed (a song id, a playlist id, a
 * genre). It stands in for cover art, so every song has a face of its own, and it carries meaning:
 * the hotter the colours, the better you know the song (heat = progress, §5.15).
 *
 * The same maths runs in two places:
 * - here on the CPU, drawn once into a small still image (rows, tiles, thumbnails: many at once), and
 * - in lightShader.ts as a WebGL shader that moves (the one big light on a screen).
 * Both use the same noise (a sine-free hash, so it behaves the same in JS and on the GPU) and the
 * same per-seed parameters from artParams(), so the moving version is the still one, alive.
 *
 * Technique: domain-warped fractal noise (Inigo Quilez) → ribbons along contour lines or a lit arc →
 * colour ramp ink → teal → amber → ember → blood. Rendered small and scaled up (it's soft anyway).
 * Grain is NOT baked in: a crisp noise tile goes on top at device resolution (ui.css .art::after).
 */

export type ArtStyle = "flow" | "arc";

export interface ArtOptions {
  /** 0.5 (cool, mostly teal) … 1 (hot, reaches red). */
  warmth?: number;
  style?: ArtStyle;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------- noise (mirrored in the shader)

const fract = (x: number) => x - Math.floor(x);

/** Dave Hoskins' "hash without sine": stable in float32 on GPUs, so JS and GLSL agree closely. */
function hash22(x: number, y: number): [number, number] {
  let a = fract(x * 0.1031);
  let b = fract(y * 0.103);
  let c = fract(x * 0.0973);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return [fract((a + a) * c) * 2 - 1, fract((a + b) * b) * 2 - 1];
}

/** Gradient noise, about -0.7…0.7. */
export function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g00 = hash22(ix, iy);
  const g10 = hash22(ix + 1, iy);
  const g01 = hash22(ix, iy + 1);
  const g11 = hash22(ix + 1, iy + 1);
  const n00 = g00[0] * fx + g00[1] * fy;
  const n10 = g10[0] * (fx - 1) + g10[1] * fy;
  const n01 = g01[0] * fx + g01[1] * (fy - 1);
  const n11 = g11[0] * (fx - 1) + g11[1] * (fy - 1);
  const nx0 = n00 + ux * (n10 - n00);
  const nx1 = n01 + ux * (n11 - n01);
  return nx0 + uy * (nx1 - nx0);
}

export function fbm(x: number, y: number): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let o = 0; o < 3; o++) {
    s += a * noise(x * f, y * f);
    f *= 2.03;
    a *= 0.42;
  }
  return s;
}

// ---------------------------------------------------------------- per-seed parameters

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ArtParams {
  style: ArtStyle;
  ox: number;
  oy: number;
  scale: number;
  angle: number;
  hotX: number;
  hotY: number;
  arcCx: number;
  arcCy: number;
  arcR: number;
  level: number;
  level2: number;
  spread: number;
}

/** Everything that makes one seed's artwork its own. `aspect` = width / height of the frame. */
export function artParams(seed: string, aspect: number, style?: ArtStyle): ArtParams {
  const rnd = mulberry32(hashString(seed));
  const pick: ArtStyle = rnd() < 0.62 ? "flow" : "arc";
  const p = {
    style: style ?? pick,
    ox: rnd() * 40,
    oy: rnd() * 40,
    scale: 0.55 + rnd() * 0.35,
    angle: rnd() * Math.PI * 2,
    hotX: 0.25 + rnd() * 0.6,
    hotY: 0.2 + rnd() * 0.6,
    arcCx: rnd() < 0.5 ? -0.25 - rnd() * 0.3 : 1.25 + rnd() * 0.3,
    arcCy: 0.9 + rnd() * 0.6,
    arcR: 0.85 + rnd() * 0.35,
    level: 0,
    level2: 0,
    spread: 1,
  };
  const lvA = 0.3 + rnd() * 0.25; // which part of the field the light follows (percentiles)
  const lvB = lvA + 0.25 + rnd() * 0.15;
  // Put the contour lines where the field actually is in this frame, so every artwork has light.
  const samples: number[] = [];
  for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) samples.push(flowField(p, aspect, (a + 0.5) / 12, (b + 0.5) / 12, 0));
  samples.sort((x, y) => x - y);
  p.level = samples[Math.floor(lvA * samples.length)]!;
  p.level2 = samples[Math.min(samples.length - 1, Math.floor(lvB * samples.length))]!;
  p.spread = Math.max(0.02, samples[samples.length - 1]! - samples[0]!);
  return p;
}

/** The warped field. `t` (seconds × speed) makes it drift; 0 for stills. Mirrored in the shader. */
function flowField(p: Pick<ArtParams, "ox" | "oy" | "scale" | "angle">, aspect: number, u: number, v: number, t: number): number {
  const ca = Math.cos(p.angle);
  const sa = Math.sin(p.angle);
  const px = ((u - 0.5) * aspect * ca - (v - 0.5) * sa) * p.scale + p.ox + t * 0.035;
  const py = ((u - 0.5) * aspect * sa + (v - 0.5) * ca) * p.scale + p.oy + t * 0.02;
  const qx = fbm(px, py + t * 0.03);
  const qy = fbm(px + 5.2 - t * 0.025, py + 1.3);
  return fbm(px + 1.8 * qx + 1.7, py + 1.8 * qy + 9.2);
}

// ---------------------------------------------------------------- colour (mirrored in the shader)

export const RAMP: [number, [number, number, number]][] = [
  [0.0, [11, 16, 20]], // ink
  [0.3, [18, 56, 60]], // teal
  [0.48, [33, 74, 72]], // lit teal
  [0.66, [236, 140, 72]], // amber
  [0.83, [228, 78, 44]], // ember
  [1.0, [128, 24, 30]], // blood
];

function ramp(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    const [p1, c1] = RAMP[i]!;
    if (t <= p1) {
      const [p0, c0] = RAMP[i - 1]!;
      const k = (t - p0) / (p1 - p0);
      const s = k * k * (3 - 2 * k);
      return [c0[0] + (c1[0] - c0[0]) * s, c0[1] + (c1[1] - c0[1]) * s, c0[2] + (c1[2] - c0[2]) * s];
    }
  }
  return RAMP[RAMP.length - 1]![1];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Brightness 0…1 at (u, v). Mirrored in the shader. */
function intensity(p: ArtParams, aspect: number, u: number, v: number, t: number): number {
  if (p.style === "flow") {
    const f = flowField(p, aspect, u, v, t);
    // Ribbons of light along two contour lines: a hot core with a soft teal halo.
    const d1 = (f - p.level) / (p.spread * 0.07);
    const d2 = (f - p.level2) / (p.spread * 0.045);
    const core = Math.exp(-d1 * d1) + 0.7 * Math.exp(-d2 * d2);
    const halo = Math.exp(-(d1 * d1) / 7) + 0.5 * Math.exp(-(d2 * d2) / 8);
    // one big lit pool, like the glow in reference 1
    const dh = Math.hypot((u - p.hotX) * aspect, v - p.hotY);
    const pool = Math.exp(-dh * dh * 5) * smooth(p.level, p.level + p.spread * 0.3, f);
    return 0.02 + 0.3 * halo + 0.6 * core + 0.55 * pool;
  }
  // a lit arc: the edge of something big just out of frame (reference 2)
  const n = fbm(u * 2.2 + p.ox + t * 0.04, v * 2.2 + p.oy);
  const d = Math.hypot((u - p.arcCx) * aspect, v - p.arcCy) - p.arcR + n * 0.06;
  const rim = Math.exp(-Math.pow(d / 0.035, 2));
  const inside = d < 0 ? smooth(0, -0.55, d) : 0;
  const haze = Math.exp(-Math.max(0, d) / 0.28);
  return 0.12 + 0.24 * haze + 0.5 * rim + (d < 0 ? 0.62 - 0.4 * inside + 0.12 * n : 0);
}

// ---------------------------------------------------------------- still render

const cache = new Map<string, string>();

export function renderArt(seed: string, opts: ArtOptions = {}): string {
  const w = opts.width ?? 96;
  const h = opts.height ?? 96;
  const warmth = opts.warmth ?? 0.8;
  const key = `${seed}|${w}x${h}|${warmth.toFixed(2)}|${opts.style ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "";

  const aspect = w / h;
  const p = artParams(seed, aspect, opts.style);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = intensity(p, aspect, i / (w - 1), j / (h - 1), 0);
      const [r, g, b] = ramp(t * warmth + (1 - warmth) * 0.12);
      const k = (j * w + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

/** Heat → warmth: how hot a song's artwork burns. */
export function warmthFor(status: "planning" | "learning" | "performing" | null | undefined): number {
  if (status === "performing") return 1;
  if (status === "learning") return 0.86;
  if (status === "planning") return 0.62;
  return 0.74;
}

// ---------------------------------------------------------------- grain

let grainUrl: string | null = null;

/**
 * A 256×256 tile of fine monochrome noise, laid over artwork and glass at 128 CSS px (crisp on
 * 2× screens). Made once at start and exposed as --grain.
 */
export function installGrain(): void {
  if (grainUrl || typeof document === "undefined") return;
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(s, s);
  const rnd = mulberry32(1505);
  for (let i = 0; i < s * s; i++) {
    // two-sample average softens it from salt-and-pepper to film grain
    const v = ((rnd() + rnd()) / 2) * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = c.toDataURL("image/png");
  document.documentElement.style.setProperty("--grain", `url("${grainUrl}")`);
}
