/** Converts between on-device rows (camelCase) and database rows (snake_case). Pure; tested. */
import type { Track } from "../core/drums";
import { VERSION_PARTS, type LibraryEntry, type Playlist, type PlaylistItem, type Song, type Version, type VersionPart, type VersionProgress } from "../core/model";

type Row = Record<string, unknown>;
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export function songToRow(s: Song, uid: string): Row {
  return {
    id: s.id,
    created_by: uid,
    title: s.title,
    artist: s.artist,
    album: s.album ?? null,
    release_year: s.releaseYear ?? null,
    genre: s.genre ?? null,
    tags: s.tags,
    original_key: s.originalKey ?? null,
    original_bpm: s.originalBpm ?? null,
    time_signature: s.timeSignature,
    duration_sec: s.durationSec ?? null,
    youtube_url: s.youtubeUrl ?? null,
    spotify_url: s.spotifyUrl ?? null,
    musicbrainz_id: s.musicbrainzId ?? null,
    visibility: s.visibility,
  };
}

export function rowToSong(r: Row): Song {
  return {
    id: r.id as string,
    createdBy: (r.created_by as string | null) ?? null,
    title: r.title as string,
    artist: r.artist as string,
    album: opt(r.album as string | null),
    releaseYear: opt(r.release_year as number | null),
    genre: opt(r.genre as string | null),
    tags: (r.tags as string[] | null) ?? [],
    originalKey: opt(r.original_key as string | null),
    originalBpm: opt(r.original_bpm as number | null),
    timeSignature: (r.time_signature as string) ?? "4/4",
    durationSec: opt(r.duration_sec as number | null),
    youtubeUrl: opt(r.youtube_url as string | null),
    spotifyUrl: opt(r.spotify_url as string | null),
    musicbrainzId: opt(r.musicbrainz_id as string | null),
    visibility: r.visibility as Song["visibility"],
    ratingSum: (r.rating_sum as number) ?? 0,
    ratingCount: (r.rating_count as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Status dates are left to the database trigger, so they're not sent. */
export function entryToRow(e: LibraryEntry, uid: string): Row {
  return {
    user_id: uid,
    song_id: e.songId,
    status: e.status,
    statuses: e.statuses ?? (e.status ? [e.status] : []),
    can_play: e.canPlay,
    can_sing: e.canSing,
    preferred_version_id: e.preferredVersionId ?? null,
  };
}

export function rowToEntry(r: Row, local?: LibraryEntry): LibraryEntry {
  return {
    songId: r.song_id as string,
    status: (r.status as LibraryEntry["status"]) ?? null,
    statuses: (r.statuses as LibraryEntry["statuses"]) ?? undefined,
    canPlay: (r.can_play as LibraryEntry["canPlay"]) ?? [],
    canSing: Boolean(r.can_sing),
    preferredVersionId: opt(r.preferred_version_id as string | null),
    startedLearningAt: opt(r.started_learning_at as string | null),
    startedPerformingAt: opt(r.started_performing_at as string | null),
    pinnedAt: local?.pinnedAt, // device-only
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function playlistToRow(p: Playlist, uid: string): Row {
  return { id: p.id, owner_id: uid, name: p.name, description: p.description ?? null, visibility: p.visibility };
}

export function rowToPlaylist(r: Row, local?: Playlist): Playlist {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    description: opt(r.description as string | null),
    visibility: r.visibility as Playlist["visibility"],
    pinnedAt: local?.pinnedAt,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function itemToRow(i: PlaylistItem, uid: string): Row {
  return {
    id: i.id,
    playlist_id: i.playlistId,
    song_id: i.songId,
    version_id: i.versionId ?? null,
    position: i.position,
    note: i.note ?? null,
    added_by: uid,
  };
}

export function rowToItem(r: Row): PlaylistItem {
  return {
    id: r.id as string,
    playlistId: r.playlist_id as string,
    songId: r.song_id as string,
    versionId: opt(r.version_id as string | null),
    position: r.position as number,
    note: opt(r.note as string | null),
  };
}

/** Characters that would break a PostgREST or() filter. */
export function safeSearchTerm(q: string): string {
  return q.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function versionToRow(v: Version, uid: string): Row {
  return {
    id: v.id,
    song_id: v.songId,
    author_id: uid,
    based_on: v.basedOn ?? null,
    instrument_id: v.instrumentId,
    tuning: v.tuning,
    capo: v.capo,
    key_played: v.keyPlayed ?? null,
    bpm: v.bpm ?? null,
    time_signature: v.timeSignature ?? null,
    techniques: v.techniques,
    label: v.label ?? null,
    part: v.part,
    youtube_url: v.youtubeUrl ?? null,
    tags: v.tags,
    content: v.content,
    content_hash: v.contentHash ?? null,
    difficulty_score: v.difficultyScore ?? null,
    difficulty_level: v.difficultyLevel ?? null,
    visibility: v.visibility,
  };
}

export function partOf(v: unknown): VersionPart {
  return VERSION_PARTS.includes(v as VersionPart) ? (v as VersionPart) : "rhythm";
}

export function progressToRow(p: VersionProgress, uid: string): Row {
  return { user_id: uid, version_id: p.versionId, song_id: p.songId, status: p.status };
}

export function rowToProgress(r: Row): VersionProgress {
  return {
    versionId: r.version_id as string,
    songId: r.song_id as string,
    status: r.status as VersionProgress["status"],
    startedLearningAt: opt(r.started_learning_at as string | null),
    startedPerformingAt: opt(r.started_performing_at as string | null),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToVersion(r: Row): Version {
  return {
    id: r.id as string,
    songId: r.song_id as string,
    authorId: (r.author_id as string | null) ?? null,
    basedOn: opt(r.based_on as string | null),
    instrumentId: (r.instrument_id as Version["instrumentId"]) ?? "guitar",
    tuning: r.tuning as number[],
    capo: (r.capo as number) ?? 0,
    keyPlayed: opt(r.key_played as string | null),
    bpm: opt(r.bpm as number | null),
    timeSignature: opt(r.time_signature as string | null),
    techniques: (r.techniques as string[]) ?? [],
    label: opt(r.label as string | null),
    part: partOf(r.part),
    youtubeUrl: opt(r.youtube_url as string | null),
    ratingSum: (r.rating_sum as number) ?? 0,
    ratingCount: (r.rating_count as number) ?? 0,
    tags: (r.tags as Version["tags"]) ?? [],
    content: r.content as Version["content"],
    contentHash: opt(r.content_hash as string | null),
    difficultyScore: opt(r.difficulty_score as number | null),
    difficultyLevel: opt(r.difficulty_level as Version["difficultyLevel"] | null),
    visibility: r.visibility as Version["visibility"],
    votes: (r.vote_count as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function trackToRow(t: Track, uid: string): Row {
  return {
    id: t.id,
    owner_id: uid,
    song_id: t.songId ?? null,
    name: t.name,
    bpm: t.bpm,
    time_signature: t.timeSignature,
    swing: t.swing,
    content: t.content,
    visibility: t.visibility,
  };
}

export function rowToTrack(r: Row): Track {
  return {
    id: r.id as string,
    ownerId: (r.owner_id as string | null) ?? null,
    songId: opt(r.song_id as string | null),
    name: r.name as string,
    bpm: r.bpm as number,
    timeSignature: (r.time_signature as string) ?? "4/4",
    swing: (r.swing as number) ?? 0,
    content: r.content as Track["content"],
    visibility: r.visibility as Track["visibility"],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
