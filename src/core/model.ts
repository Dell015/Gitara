/**
 * Domain model: the shapes of Gitara's data. Mirrors supabase/migrations/0001_init.sql.
 * Source of truth for what each thing means: docs/aboutproject.md §9.
 *
 * Phase 0 covers what Phases 1–2 need (songs, versions, chord charts, library, playlists).
 * Tracks, jams, votes, ratings and reports come with their own phases.
 */
import type { InstrumentId } from "./instrument";

export type Id = string; // uuid
export type IsoDate = string; // ISO 8601 timestamp

/** Songs can only be private or public; versions and playlists may also be "unlisted" (anyone with the link). */
export type Visibility = "private" | "unlisted" | "public";

/** Where a song sits in your learning: Planning to learn -> Learning -> Performing. Moves freely in any direction. */
export type LearnStatus = "planning" | "learning" | "performing";

/** The parts of a song a player can play (Jam mode uses these). */
export type PlayablePart = "chords" | "lead" | "solo";

// ---------------------------------------------------------------- songs

export interface Song {
  id: Id;
  /** null = the author deleted their account ("deleted user"). */
  createdBy: Id | null;
  title: string;
  artist: string;
  album?: string;
  releaseYear?: number;
  /** One entry from the fixed genre list; extra descriptive tags go in `tags`. */
  genre?: string;
  tags: string[];
  originalKey?: string; // e.g. "G", "F#m"
  originalBpm?: number;
  timeSignature: string; // "4/4"
  durationSec?: number;
  youtubeUrl?: string;
  spotifyUrl?: string;
  /** MusicBrainz recording id, if the title/artist were picked from autocomplete. */
  musicbrainzId?: string;
  visibility: Extract<Visibility, "private" | "public">;
  /** Star ratings from others, kept by the database (Phase 6). */
  ratingSum?: number;
  ratingCount?: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

// ------------------------------------------------------- chord shapes

/** A finger: 1–4, or 5 for thumb. 0 / null = no finger (open or muted). */
export type Finger = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * One way to play a chord ("voicing"). Arrays have one entry per string, lowest string first.
 * `frets`: -1 = muted, 0 = open, n = fret n (counted from the nut, even when `baseFret` > 1).
 */
export interface Shape {
  id: Id;
  instrumentId: InstrumentId;
  /** null = built-in */
  createdBy: Id | null;
  /** Chord name derived from the notes, e.g. "Cadd9". Null when the user hasn't named a custom shape. */
  name: string | null;
  frets: number[];
  fingers: Finger[];
  /** Lowest fret shown in the diagram window (1 = open position). */
  baseFret: number;
  visibility: Extract<Visibility, "private" | "public">;
}

// ------------------------------------------------------- chord chart

export type SectionKind =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "solo"
  | "interlude"
  | "outro"
  | "custom";

/** One chord inside a bar, lasting `beats` beats. Most bars have exactly one chord of a full bar. */
export interface BarChord {
  /** Chord name as played, e.g. "Em7", "C/G". */
  name: string;
  beats: number;
  /** Which fingering to show. Falls back to the default shape for the name. */
  shapeId?: Id;
}

export interface Bar {
  chords: BarChord[];
}

/** Strum direction per step: D = down, U = up, "-" = rest, "x" = muted/percussive hit. */
export type StrumStep = "D" | "U" | "-" | "x";

export interface StrumPattern {
  /** Steps per bar, e.g. 8 eighth-notes. */
  steps: StrumStep[];
}

export interface Section {
  id: string; // local to the version
  kind: SectionKind;
  label?: string; // "Verse 2", "Guitar solo"
  bars: Bar[];
  strum?: StrumPattern;
  /** Short cue, e.g. "after the drum fill". Not lyrics. */
  note?: string;
}

/** A sections order, e.g. Verse x2, Chorus, Verse, Chorus. Sections are defined once and reused. */
export interface ArrangementItem {
  sectionId: string;
  repeat: number;
}

/** The chart itself. Stored as one JSON document on the version. */
export interface VersionContent {
  sections: Section[];
  arrangement: ArrangementItem[];
  /** Which shape to show for a chord name in this version (otherwise the default shape). */
  voicings?: Record<string, { frets: number[]; fingers: number[]; baseFret: number }>;
}

export const VERSION_TAGS = ["cover", "live", "acoustic", "original", "simplified"] as const;
export type VersionTag = (typeof VERSION_TAGS)[number];

/** What a version is for: every version belongs to one of these, and a song page groups them that way. */
export const VERSION_PARTS = ["rhythm", "lead", "solo", "fingerstyle"] as const;
export type VersionPart = (typeof VERSION_PARTS)[number];
export const PART_LABEL: Record<VersionPart, string> = { rhythm: "Rhythm", lead: "Lead", solo: "Solo", fingerstyle: "Fingerstyle" };
export const PART_HINT: Record<VersionPart, string> = {
  rhythm: "Chords and strumming",
  lead: "Riffs, fills and melody lines",
  solo: "The guitar solo",
  fingerstyle: "Picked arrangements, played alone",
};

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

/** One person's way of playing a song. Tuning and capo belong here, not on the song. */
export interface Version {
  id: Id;
  songId: Id;
  /** null = author deleted their account. */
  authorId: Id | null;
  /** The version this was copied from; keeps the credit ("based on Ana's version"). */
  basedOn?: Id;
  instrumentId: InstrumentId;
  /** MIDI note per string, lowest first. */
  tuning: number[];
  capo: number;
  keyPlayed?: string;
  bpm?: number;
  timeSignature?: string;
  techniques: string[];
  /** Rhythm, Lead, Solo or Fingerstyle. */
  part: VersionPart;
  /** Star ratings from others, kept by the database. */
  ratingSum?: number;
  ratingCount?: number;
  /** A video to listen to while playing this version (falls back to the song's). */
  youtubeUrl?: string;
  /** Old up-votes, no longer shown. */
  votes?: number;
  /** Short name for this take, e.g. "Easy version". */
  label?: string;
  tags: VersionTag[];
  content: VersionContent;
  /** Hash of the canonical content + tuning + capo. Used to refuse an exact duplicate of a public version. */
  contentHash?: string;
  /** Computed by the system from the chart (Q21); never typed in. */
  difficultyScore?: number;
  difficultyLevel?: DifficultyLevel;
  visibility: Visibility;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

// ------------------------------------------------- library & playlists

/** A song in your library, with where you are with it. Keyed by (user, song). */
export interface LibraryEntry {
  songId: Id;
  /** The furthest status of any of the song's versions (cache), or null = liked without a status. */
  status: LearnStatus | null;
  /** Every status a version of this song has (cache): a song shows under each. Each version keeps its own in `VersionProgress`. */
  statuses?: LearnStatus[];
  canPlay: PlayablePart[];
  canSing: boolean;
  preferredVersionId?: Id;
  startedLearningAt?: IsoDate;
  startedPerformingAt?: IsoDate;
  /** Pinned to the top of Library. Device-only for now (not synced). */
  pinnedAt?: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** How well you know one version: Planning, Learning or Performing. A song's status follows its versions. */
export interface VersionProgress {
  versionId: Id;
  songId: Id;
  status: LearnStatus;
  startedLearningAt?: IsoDate;
  startedPerformingAt?: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Playlist {
  id: Id;
  /** "local" until the guest account exists; replaced by the account id when synced. */
  ownerId: Id;
  name: string;
  description?: string;
  visibility: Visibility;
  /** Pinned to the top of Library. Device-only for now (not synced). */
  pinnedAt?: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface PlaylistItem {
  id: Id;
  playlistId: Id;
  songId: Id;
  /** Optional: pin a specific version ("my capo 2 version"). */
  versionId?: Id;
  position: number;
  note?: string;
}

// ---------------------------------------------------------- profiles

/** What the owner has chosen to show publicly. Everything is private by default. */
export interface PublicSections {
  planning: boolean;
  learning: boolean;
  performing: boolean;
  rating: boolean;
}

export const PRIVATE_BY_DEFAULT: PublicSections = {
  planning: false,
  learning: false,
  performing: false,
  rating: false,
};

/** Every status a song has through its versions (falls back to the song's own for songs without versions). */
export function entryStatuses(e: Pick<LibraryEntry, "status" | "statuses">): LearnStatus[] {
  return e.statuses?.length ? e.statuses : e.status ? [e.status] : [];
}
