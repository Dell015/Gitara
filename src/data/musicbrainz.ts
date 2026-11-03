/**
 * Name autocomplete from MusicBrainz (§5.1): spelling only, never auto-tagging.
 * MusicBrainz allows about one request per second, so requests are spaced, debounced by the caller,
 * and cached for the session.
 */
export interface MbSuggestion {
  id: string; // recording id
  title: string;
  artist: string;
  album?: string;
  year?: number;
  durationSec?: number;
}

const cache = new Map<string, MbSuggestion[]>();
let lastRequest = 0;

export function parseRecordings(json: unknown): MbSuggestion[] {
  const recs = (json as { recordings?: unknown[] })?.recordings ?? [];
  const out: MbSuggestion[] = [];
  const seen = new Set<string>();
  for (const r of recs as Record<string, unknown>[]) {
    const credit = (r["artist-credit"] as { name: string; joinphrase?: string }[] | undefined) ?? [];
    const artist = credit.map((c) => c.name + (c.joinphrase ?? "")).join("").trim();
    const title = String(r.title ?? "").trim();
    if (!title || !artist) continue;
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const releases = (r.releases as { title?: string; date?: string }[] | undefined) ?? [];
    const rel = releases.find((x) => x.date) ?? releases[0];
    const year = rel?.date ? Number(rel.date.slice(0, 4)) : undefined;
    const length = typeof r.length === "number" ? Math.round(r.length / 1000) : undefined;
    out.push({ id: String(r.id), title, artist, album: rel?.title, year: Number.isFinite(year) ? year : undefined, durationSec: length });
  }
  return out;
}

function lucene(s: string) {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

export async function searchRecordings(title: string, artist: string, signal?: AbortSignal): Promise<MbSuggestion[]> {
  const t = title.trim();
  const a = artist.trim();
  if (t.length < 2 && a.length < 2) return [];
  const key = `${t.toLowerCase()}|${a.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const parts = [];
  if (t) parts.push(`recording:(${lucene(t)}*)`);
  if (a) parts.push(`artist:(${lucene(a)})`);
  const url = `https://musicbrainz.org/ws/2/recording?fmt=json&limit=10&query=${encodeURIComponent(parts.join(" AND "))}`;

  const wait = Math.max(0, lastRequest + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (signal?.aborted) return [];
  lastRequest = Date.now();

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
  const list = parseRecordings(await res.json()).slice(0, 6);
  cache.set(key, list);
  return list;
}
