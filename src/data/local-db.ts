/**
 * Local-first storage (IndexedDB through Dexie). Your library, charts and tracks live on the device
 * and work offline; the outbox records changes to send to Supabase once there's a connection
 * (sync arrives with Phase 5, real sign-in). "Latest edit wins" for now (Q97).
 */
import Dexie, { type EntityTable } from "dexie";
import type { LibraryEntry, Playlist, PlaylistItem, Shape, Song, Version } from "../core/model";

export interface OutboxEntry {
  seq?: number; // auto-increment
  table: "songs" | "versions" | "library" | "playlists" | "playlistItems" | "shapes";
  op: "upsert" | "delete";
  rowId: string;
  createdAt: number;
}

export class GitaraDB extends Dexie {
  songs!: EntityTable<Song, "id">;
  versions!: EntityTable<Version, "id">;
  library!: EntityTable<LibraryEntry, "songId">;
  playlists!: EntityTable<Playlist, "id">;
  playlistItems!: EntityTable<PlaylistItem, "id">;
  shapes!: EntityTable<Shape, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;

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
  }
}

export const db = new GitaraDB();
