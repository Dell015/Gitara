/**
 * Local-first storage (IndexedDB through Dexie). Your library, charts and tracks live on the device
 * and work offline; the outbox records changes to send to Supabase once there's a connection
 * (sync arrives with Phase 5, real sign-in). "Latest edit wins" for now (Q97).
 */
import Dexie, { type EntityTable } from "dexie";
import type { Track } from "../core/drums";
import type { LibraryEntry, Playlist, PlaylistItem, Shape, Song, Version, VersionProgress } from "../core/model";

export type SyncedTable = "songs" | "versions" | "tracks" | "library" | "playlists" | "playlistItems" | "progress";

export interface OutboxEntry {
  seq?: number; // auto-increment
  table: SyncedTable;
  op: "upsert" | "delete";
  rowId: string;
  createdAt: number;
  /** Set when sending failed; the entry stays and is retried. */
  error?: string;
}

/** Things you opened recently, for Home's quick access grid. key = "song:<id>" | "playlist:<id>" | "artist:<name>". */
export interface RecentEntry {
  key: string;
  kind: "song" | "playlist" | "artist";
  refId: string;
  openedAt: number;
}

export class GitaraDB extends Dexie {
  songs!: EntityTable<Song, "id">;
  versions!: EntityTable<Version, "id">;
  library!: EntityTable<LibraryEntry, "songId">;
  playlists!: EntityTable<Playlist, "id">;
  playlistItems!: EntityTable<PlaylistItem, "id">;
  shapes!: EntityTable<Shape, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;
  recents!: EntityTable<RecentEntry, "key">;
  tracks!: EntityTable<Track, "id">;
  progress!: EntityTable<VersionProgress, "versionId">;

  constructor() {
    super("gitara");
    // Only indexed fields are listed; everything else is stored but not searchable.
    this.version(1).stores({
      songs: "id, visibility, updatedAt",
      versions: "id, songId, updatedAt",
      library: "songId, status, updatedAt",
      playlists: "id, updatedAt",
      playlistItems: "id, playlistId, [playlistId+position]",
      shapes: "id, name",
      outbox: "++seq, table, createdAt",
    });
    // v2 (Phase 1): liked songs (status may be null), pins, recents, artist index.
    this.version(2).stores({
      songs: "id, visibility, updatedAt, artist, createdBy",
      library: "songId, status, updatedAt, createdAt, pinnedAt",
      playlists: "id, updatedAt, ownerId, pinnedAt",
      outbox: "++seq, table, rowId, createdAt",
      recents: "key, openedAt",
    });
    // v3 (Phase 2): find your own versions quickly.
    this.version(3).stores({
      versions: "id, songId, updatedAt, authorId",
    });
    // v4 (Phase 4): backing tracks.
    this.version(4).stores({
      tracks: "id, songId, ownerId, updatedAt",
    });
    // v5: every version has a part (Rhythm, Lead, Solo, Fingerstyle) and its own Learning / Performing status.
    this.version(5)
      .stores({
        progress: "versionId, songId, status, updatedAt",
      })
      .upgrade(async (tx) => {
        const versions = tx.table("versions");
        const lib = tx.table("library");
        const progress = tx.table("progress");
        const outbox = tx.table("outbox");
        const ts = new Date().toISOString();
        const touched: string[] = [];
        // existing versions: Rhythm (or Fingerstyle if they were tagged that way)
        await versions.toCollection().modify((v: Version & { tags?: string[] }) => {
          if (!v.part) {
            v.part = v.tags?.includes("fingerstyle") ? "fingerstyle" : "rhythm";
            if (v.authorId) touched.push(v.id);
          }
        });
        // the status you had on a song moves onto the version you opened first (else its oldest version)
        for (const e of (await lib.toArray()) as LibraryEntry[]) {
          if (!e.status) continue;
          const vs = ((await versions.where("songId").equals(e.songId).toArray()) as Version[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const pick = vs.find((v) => v.id === e.preferredVersionId) ?? vs[0];
          await lib.update(e.songId, { statuses: [e.status] });
          if (!pick) continue; // no chart yet: the song keeps its status until one exists
          await progress.put({
            versionId: pick.id,
            songId: e.songId,
            status: e.status,
            startedLearningAt: e.startedLearningAt,
            startedPerformingAt: e.startedPerformingAt,
            createdAt: ts,
            updatedAt: ts,
          });
          await outbox.add({ table: "progress", op: "upsert", rowId: pick.id, createdAt: Date.now() });
        }
        for (const id of touched) await outbox.add({ table: "versions", op: "upsert", rowId: id, createdAt: Date.now() });
      });
  }
}

export const db = new GitaraDB();
