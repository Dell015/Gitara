/** Same normalisation as the database's norm_title / norm_artist columns (0001_init.sql). */
export function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Loose key for "this may already exist" warnings: ignores punctuation and a leading "the". */
export function looseKey(s: string): string {
  return normalize(s)
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
