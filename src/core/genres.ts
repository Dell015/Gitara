/** The fixed main genre list (§5.2). Anything more specific goes in free tags. */
export const GENRES = [
  "Pop",
  "Rock",
  "Alternative",
  "Indie",
  "Folk",
  "Acoustic",
  "Country",
  "Blues",
  "Jazz",
  "R&B / Soul",
  "Hip-hop",
  "Reggae",
  "Metal",
  "Punk",
  "Worship",
  "OPM",
  "Classical",
  "Latin",
  "Electronic",
  "Other",
] as const;

export const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bbm", "Bm",
] as const;

export const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4", "12/8", "5/4", "7/8"] as const;
