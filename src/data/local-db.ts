/**
 * Local-first storage (IndexedDB through Dexie). Your library, charts and tracks live on the device
 * and work offline; the outbox records changes to send to Supabase once there's a connection
 * (sync arrives with Phase 5, real sign-in). "Latest edit wins" for now (Q97).
 */
import Dexie, { type EntityTable } from "dexie";
import type { LibraryEntry, Playlist, PlaylistItem, Shape, Song, Version } from "../core/model";

export type SyncedTable = "songs" | "versions" | "library" | "playlists" | "playlistItems";

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
  }
}

export const db = new GitaraDB();
