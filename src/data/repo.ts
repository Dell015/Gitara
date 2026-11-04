/**
 * Every change to your data goes through here: it writes to the on-device database and records an
 * outbox entry in the same transaction, so nothing is lost if the app closes before syncing.
 */
import { computeDifficulty, contentHash } from "../core/chart";
import type { Track } from "../core/drums";
import type { LearnStatus, LibraryEntry, PlayablePart, Playlist, PlaylistItem, Song, Version, Visibility } from "../core/model";
import { normalize } from "../core/text";
import { ownerForNewRow } from "./auth";
import { db, type SyncedTable } from "./local-db";
import { scheduleSync } from "./sync";

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

async function queue(table: SyncedTable, op: "upsert" | "delete", rowId: string) {
  await db.outbox.add({ table, op, rowId, createdAt: Date.now() });
}

function done<T>(v: T): T {
  scheduleSync();
  return v;
}

// ---------------------------------------------------------------- songs

export type NewSong = Omit<Song, "id" | "createdBy" | "createdAt" | "updatedAt" | "tags" | "timeSignature"> &
  Partial<Pick<Song, "tags" | "timeSignature">>;

/** Adds a song and likes it (it shows up in your Library straight away). */
export async function addSong(input: NewSong): Promise<Song> {
  const t = now();
  const song: Song = {
    tags: [],
    timeSignature: "4/4",
    ...input,
    title: input.title.trim().replace(/\s+/g, " "),
    artist: input.artist.trim().replace(/\s+/g, " "),
    id: uuid(),
    createdBy: ownerForNewRow(),
    createdAt: t,
    updatedAt: t,
  };
  await db.transaction("rw", db.songs, db.library, db.outbox, async () => {
    await db.songs.add(song);
    await queue("songs", "upsert", song.id);
    await db.library.put(newEntry(song.id, null));
    await queue("library", "upsert", song.id);
  });
  return done(song);
}

export async function updateSong(id: string, patch: Partial<Song>): Promise<void> {
  await db.transaction("rw", db.songs, db.outbox, async () => {
    await db.songs.update(id, { ...patch, updatedAt: now() });
    await queue("songs", "upsert", id);
  });
  done(undefined);
}

/** Songs that came from the cloud (search results, others' public songs). Cached, never queued. */
export async function cacheSongs(songs: Song[]): Promise<void> {
  if (!songs.length) return;
  const pending = new Set((await db.outbox.where("table").equals("songs").toArray()).map((o) => o.rowId));
  await db.songs.bulkPut(songs.filter((s) => !pending.has(s.id)));
}

/** Local songs with the same title and artist (exact, the way the database compares them). */
export async function findLocalDuplicates(title: string, artist: string): Promise<Song[]> {
  const nt = normalize(title);
  const na = normalize(artist);
  if (!nt || !na) return [];
  return db.songs.filter((s) => normalize(s.title) === nt && normalize(s.artist) === na).toArray();
}

// ---------------------------------------------------------------- library

function newEntry(songId: string, status: LearnStatus | null): LibraryEntry {
  const t = now();
  return {
    songId,
    status,
    canPlay: [],
    canSing: false,
    createdAt: t,
    updatedAt: t,
    ...(status === "learning" ? { startedLearningAt: t } : {}),
    ...(status === "performing" ? { startedPerformingAt: t } : {}),
  };
}

export async function like(songId: string): Promise<void> {
  await db.transaction("rw", db.library, db.outbox, async () => {
    if (await db.library.get(songId)) return;
    await db.library.put(newEntry(songId, null));
    await queue("library", "upsert", songId);
  });
  done(undefined);
}

/** Removes the song from your Library (status and parts too). Returns the old entry for undo. */
export async function unlike(songId: string): Promise<LibraryEntry | undefined> {
  let old: LibraryEntry | undefined;
  await db.transaction("rw", db.library, db.outbox, async () => {
    old = await db.library.get(songId);
    if (!old) return;
    await db.library.delete(songId);
    await queue("library", "delete", songId);
  });
  return done(old);
}

export async function restoreEntry(entry: LibraryEntry): Promise<void> {
  await db.transaction("rw", db.library, db.outbox, async () => {
    await db.library.put({ ...entry, updatedAt: now() });
    await queue("library", "upsert", entry.songId);
  });
  done(undefined);
}

/** Sets how well you know a song. Setting a status also likes it. */
export async function setStatus(songId: string, status: LearnStatus | null): Promise<void> {
  await db.transaction("rw", db.library, db.outbox, async () => {
    const e = await db.library.get(songId);
    if (!e) {
      await db.library.put(newEntry(songId, status));
    } else {
      const t = now();
      await db.library.put({
        ...e,
        status,
        updatedAt: t,
        startedLearningAt: e.startedLearningAt ?? (status === "learning" ? t : undefined),
        startedPerformingAt: e.startedPerformingAt ?? (status === "performing" ? t : undefined),
      });
    }
    await queue("library", "upsert", songId);
  });
  done(undefined);
}

export async function setCanPlay(songId: string, parts: PlayablePart[], canSing: boolean): Promise<void> {
  await db.transaction("rw", db.library, db.outbox, async () => {
    const e = (await db.library.get(songId)) ?? newEntry(songId, null);
    await db.library.put({ ...e, canPlay: parts, canSing, updatedAt: now() });
    await queue("library", "upsert", songId);
  });
  done(undefined);
}

/** Up to 4 pinned items, like Spotify. Device-only for now. */
export const MAX_PINS = 4;

export async function pinnedCount(): Promise<number> {
  const a = await db.library.where("pinnedAt").above("").count();
  const b = await db.playlists.where("pinnedAt").above("").count();
  return a + b;
}

export async function togglePinSong(songId: string): Promise<"pinned" | "unpinned" | "full"> {
  const e = await db.library.get(songId);
  if (!e) return "full";
  if (e.pinnedAt) {
    await db.library.update(songId, { pinnedAt: undefined });
    return "unpinned";
  }
  if ((await pinnedCount()) >= MAX_PINS) return "full";
  await db.library.update(songId, { pinnedAt: now() });
  return "pinned";
}

export async function togglePinPlaylist(id: string): Promise<"pinned" | "unpinned" | "full"> {
  const p = await db.playlists.get(id);
  if (!p) return "full";
  if (p.pinnedAt) {
    await db.playlists.update(id, { pinnedAt: undefined });
    return "unpinned";
  }
  if ((await pinnedCount()) >= MAX_PINS) return "full";
  await db.playlists.update(id, { pinnedAt: now() });
  return "pinned";
}

// ---------------------------------------------------------------- playlists

export async function createPlaylist(name: string, visibility: Visibility = "private", description?: string): Promise<Playlist> {
  const t = now();
  const p: Playlist = {
    id: uuid(),
    ownerId: ownerForNewRow(),
    name: name.trim() || "New playlist",
    description: description?.trim() || undefined,
    visibility,
    createdAt: t,
    updatedAt: t,
  };
  await db.transaction("rw", db.playlists, db.outbox, async () => {
    await db.playlists.add(p);
    await queue("playlists", "upsert", p.id);
  });
  return done(p);
}

export async function updatePlaylist(id: string, patch: Partial<Pick<Playlist, "name" | "description" | "visibility">>): Promise<void> {
  await db.transaction("rw", db.playlists, db.outbox, async () => {
    await db.playlists.update(id, { ...patch, updatedAt: now() });
    await queue("playlists", "upsert", id);
  });
  done(undefined);
}

export async function deletePlaylist(id: string): Promise<void> {
  await db.transaction("rw", db.playlists, db.playlistItems, db.outbox, async () => {
    const items = await db.playlistItems.where("playlistId").equals(id).toArray();
    await db.playlistItems.bulkDelete(items.map((i) => i.id));
    await db.playlists.delete(id);
    // The database removes the items with the playlist (on delete cascade).
    await queue("playlists", "delete", id);
  });
  done(undefined);
}

export async function playlistItems(playlistId: string): Promise<PlaylistItem[]> {
  return db.playlistItems.where("[playlistId+position]").between([playlistId, -Infinity], [playlistId, Infinity]).toArray();
}

export async function addToPlaylist(playlistId: string, songId: string, versionId?: string): Promise<PlaylistItem> {
  let item!: PlaylistItem;
  await db.transaction("rw", db.playlists, db.playlistItems, db.outbox, async () => {
    const items = await playlistItems(playlistId);
    item = { id: uuid(), playlistId, songId, versionId, position: items.length };
    await db.playlistItems.add(item);
    await queue("playlistItems", "upsert", item.id);
    await db.playlists.update(playlistId, { updatedAt: now() });
  });
  return done(item);
}

export async function removeFromPlaylist(itemId: string): Promise<PlaylistItem | undefined> {
  let removed: PlaylistItem | undefined;
  await db.transaction("rw", db.playlistItems, db.outbox, async () => {
    removed = await db.playlistItems.get(itemId);
    if (!removed) return;
    await db.playlistItems.delete(itemId);
    await queue("playlistItems", "delete", itemId);
    const rest = (await playlistItems(removed.playlistId)).filter((i) => i.id !== itemId);
    await renumber(rest);
  });
  return done(removed);
}

/** Puts a removed item back where it was (undo). */
export async function restorePlaylistItem(item: PlaylistItem): Promise<void> {
  await db.transaction("rw", db.playlistItems, db.outbox, async () => {
    const items = await playlistItems(item.playlistId);
    items.splice(Math.min(item.position, items.length), 0, item);
    await db.playlistItems.put(item);
    await renumber(items, true);
  });
  done(undefined);
}

export async function reorderPlaylist(playlistId: string, orderedIds: string[]): Promise<void> {
  await db.transaction("rw", db.playlistItems, db.outbox, async () => {
    const items = await playlistItems(playlistId);
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter((i): i is PlaylistItem => !!i);
    await renumber(ordered);
  });
  done(undefined);
}

async function renumber(items: PlaylistItem[], queueAll = false) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.position !== i || queueAll) {
      await db.playlistItems.update(it.id, { position: i });
      await queue("playlistItems", "upsert", it.id);
    }
  }
}

// ---------------------------------------------------------------- recents

export async function touchRecent(kind: "song" | "playlist" | "artist", refId: string): Promise<void> {
  await db.recents.put({ key: `${kind}:${refId}`, kind, refId, openedAt: Date.now() });
  const all = await db.recents.orderBy("openedAt").reverse().toArray();
  if (all.length > 30) await db.recents.bulkDelete(all.slice(30).map((r) => r.key));
}

// ---------------------------------------------------------------- versions

export type VersionDraft = Omit<Version, "id" | "authorId" | "createdAt" | "updatedAt" | "contentHash" | "difficultyScore" | "difficultyLevel"> & { id?: string };

/** Saves a version (new or existing). Difficulty and the duplicate fingerprint are worked out here. */
export async function saveVersion(d: VersionDraft): Promise<Version> {
  const t = now();
  const existing = d.id ? await db.versions.get(d.id) : undefined;
  const diff = computeDifficulty(d.content, d.tuning, d.bpm);
  const v: Version = {
    ...d,
    id: existing?.id ?? d.id ?? uuid(),
    authorId: existing?.authorId ?? ownerForNewRow(),
    contentHash: contentHash(d.content),
    difficultyScore: diff.score,
    difficultyLevel: diff.level,
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };
  await db.transaction("rw", db.versions, db.outbox, async () => {
    await db.versions.put(v);
    await queue("versions", "upsert", v.id);
  });
  return done(v);
}

export async function deleteVersion(id: string): Promise<void> {
  await db.transaction("rw", db.versions, db.library, db.outbox, async () => {
    const v = await db.versions.get(id);
    await db.versions.delete(id);
    await queue("versions", "delete", id);
    if (v) {
      const e = await db.library.get(v.songId);
      if (e?.preferredVersionId === id) {
        await db.library.put({ ...e, preferredVersionId: undefined, updatedAt: now() });
        await queue("library", "upsert", v.songId);
      }
    }
  });
  done(undefined);
}

/** Copies someone's public version into your own (private) versions, keeping the credit. */
export async function copyVersion(from: Version): Promise<Version> {
  const { id: _id, authorId: _a, createdAt: _c, updatedAt: _u, contentHash: _h, difficultyScore: _s, difficultyLevel: _l, ...rest } = from;
  return saveVersion({ ...rest, basedOn: from.id, visibility: "private" });
}

/** The version that opens by default for this song (and plays from playlists). */
export async function setPreferredVersion(songId: string, versionId: string | undefined): Promise<void> {
  await db.transaction("rw", db.library, db.outbox, async () => {
    const e = (await db.library.get(songId)) ?? newEntry(songId, null);
    await db.library.put({ ...e, preferredVersionId: versionId, updatedAt: now() });
    await queue("library", "upsert", songId);
  });
  done(undefined);
}

// ---------------------------------------------------------------- tracks

export type TrackDraft = Omit<Track, "id" | "ownerId" | "createdAt" | "updatedAt"> & { id?: string };

export async function saveTrack(d: TrackDraft): Promise<Track> {
  const t = now();
  const existing = d.id ? await db.tracks.get(d.id) : undefined;
  const track: Track = {
    ...d,
    id: existing?.id ?? d.id ?? uuid(),
    ownerId: existing?.ownerId ?? ownerForNewRow(),
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };
  await db.transaction("rw", db.tracks, db.outbox, async () => {
    await db.tracks.put(track);
    await queue("tracks", "upsert", track.id);
  });
  return done(track);
}

export async function deleteTrack(id: string): Promise<void> {
  await db.transaction("rw", db.tracks, db.outbox, async () => {
    await db.tracks.delete(id);
    await queue("tracks", "delete", id);
  });
  done(undefined);
}
