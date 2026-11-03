/**
 * Device ⇄ cloud sync. The device is the source of truth while you use it; the outbox is sent when
 * there's a connection, and a pull on start brings in what other devices changed.
 * Rule: anything still waiting in the outbox wins over the cloud copy; otherwise the cloud wins.
 * Ownership (created_by, owner_id, user_id) is always stamped with the signed-in account here,
 * which is what the database's security rules check.
 */
import { useSyncExternalStore } from "react";
import { currentUserId, LOCAL_OWNER } from "./auth";
import { db, type OutboxEntry, type SyncedTable } from "./local-db";
import { entryToRow, itemToRow, playlistToRow, rowToEntry, rowToItem, rowToPlaylist, rowToSong, songToRow } from "./mappers";
import { supabase } from "./supabase";

export type SyncState = { phase: "off" | "idle" | "syncing" | "error"; pending: number; lastSyncedAt?: number; error?: string };

let state: SyncState = { phase: supabase ? "idle" : "off", pending: 0 };
const listeners = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

let timer: number | undefined;
let running: Promise<void> | null = null;

/** Called after every local change; batches changes made close together. */
export function scheduleSync(delay = 800) {
  void refreshPending();
  if (!supabase) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

async function refreshPending() {
  set({ pending: await db.outbox.count() });
}

export async function syncNow(): Promise<void> {
  if (!supabase || !currentUserId()) return;
  if (running) return running;
  running = (async () => {
    set({ phase: "syncing" });
    try {
      await push();
      set({ phase: "idle", lastSyncedAt: Date.now(), error: undefined });
    } catch (e) {
      set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      await refreshPending();
      running = null;
    }
  })();
  return running;
}

// ------------------------------------------------------------------ push

const TABLE: Record<SyncedTable, { name: string; key: string }> = {
  songs: { name: "songs", key: "id" },
  library: { name: "library_entries", key: "song_id" },
  playlists: { name: "playlists", key: "id" },
  playlistItems: { name: "playlist_items", key: "id" },
};

/** Latest op per row wins: an upsert then a delete is just a delete. */
function collapse(entries: OutboxEntry[]) {
  const last = new Map<string, OutboxEntry>();
  for (const e of entries) last.set(`${e.table}:${e.rowId}`, e);
  return [...last.values()];
}

async function push() {
  const sb = supabase!;
  const uid = currentUserId()!;
  const all = await db.outbox.orderBy("seq").toArray();
  if (!all.length) return;
  const maxSeq = all[all.length - 1]!.seq!;
  const ops = collapse(all);
  const of = (t: SyncedTable, op: "upsert" | "delete") => ops.filter((o) => o.table === t && o.op === op).map((o) => o.rowId);
  const failed = new Map<string, string>(); // "table:rowId" -> error

  const del = async (t: SyncedTable) => {
    const ids = of(t, "delete");
    if (!ids.length) return;
    let q = sb.from(TABLE[t].name).delete().in(TABLE[t].key, ids);
    if (t === "library") q = q.eq("user_id", uid);
    const { error } = await q;
    if (error) ids.forEach((id) => failed.set(`${t}:${id}`, error.message));
  };

  const up = async (t: SyncedTable, rows: Record<string, unknown>[], ids: string[], onConflict?: string) => {
    if (!rows.length) return;
    const { error } = await sb.from(TABLE[t].name).upsert(rows, onConflict ? { onConflict } : undefined);
    if (!error) return;
    // One bad row shouldn't hold back the rest: retry one by one.
    for (let i = 0; i < rows.length; i++) {
      const r = await sb.from(TABLE[t].name).upsert(rows[i]!, onConflict ? { onConflict } : undefined);
      if (r.error) failed.set(`${t}:${ids[i]}`, r.error.message);
    }
  };

  await del("playlistItems");

  const songIds = of("songs", "upsert");
  const songs = (await db.songs.bulkGet(songIds)).filter((s) => !!s && (s.createdBy === LOCAL_OWNER || s.createdBy === uid));
  await up("songs", songs.map((s) => songToRow(s!, uid)), songs.map((s) => s!.id));
  // Claim songs made before the guest account existed.
  await db.songs.where("createdBy").equals(LOCAL_OWNER).modify({ createdBy: uid });

  const plIds = of("playlists", "upsert");
  const pls = (await db.playlists.bulkGet(plIds)).filter((p) => !!p);
  await up("playlists", pls.map((p) => playlistToRow(p!, uid)), pls.map((p) => p!.id));
  await db.playlists.where("ownerId").equals(LOCAL_OWNER).modify({ ownerId: uid });

  const libIds = of("library", "upsert");
  const libs = (await db.library.bulkGet(libIds)).filter((e) => !!e);
  await up("library", libs.map((e) => entryToRow(e!, uid)), libs.map((e) => e!.songId), "user_id,song_id");

  const itemIds = of("playlistItems", "upsert");
  const items = (await db.playlistItems.bulkGet(itemIds)).filter((i) => !!i);
  // Sent per playlist so each playlist's new order lands in one statement (positions are unique).
  const byPl = new Map<string, typeof items>();
  items.forEach((i) => byPl.set(i!.playlistId, [...(byPl.get(i!.playlistId) ?? []), i]));
  for (const group of byPl.values()) {
    await up("playlistItems", group.map((i) => itemToRow(i!, uid)), group.map((i) => i!.id));
  }

  await del("library");
  await del("playlists");
  await del("songs");

  // Clear what was sent; keep failures (marked) so they retry and are never overwritten by a pull.
  await db.transaction("rw", db.outbox, async () => {
    const sent = await db.outbox.where("seq").belowOrEqual(maxSeq).toArray();
    const keep = new Map<string, OutboxEntry>();
    for (const e of sent) {
      const k = `${e.table}:${e.rowId}`;
      if (failed.has(k)) keep.set(k, { ...e, error: failed.get(k) });
    }
    await db.outbox.where("seq").belowOrEqual(maxSeq).delete();
    for (const e of keep.values()) {
      const { seq: _seq, ...rest } = e;
      await db.outbox.add(rest);
    }
  });
  if (failed.size) throw new Error(`${failed.size} change(s) couldn't be saved to the cloud yet`);
}

// ------------------------------------------------------------------ pull

/** Brings in your rows from the cloud. Run on start (after the outbox is sent) and when coming back online. */
export async function pull(): Promise<void> {
  const sb = supabase;
  const uid = currentUserId();
  if (!sb || !uid) return;

  const [mySongs, lib, pls] = await Promise.all([
    sb.from("songs").select("*").eq("created_by", uid),
    sb.from("library_entries").select("*").eq("user_id", uid),
    sb.from("playlists").select("*").eq("owner_id", uid),
  ]);
  if (mySongs.error || lib.error || pls.error) throw mySongs.error ?? lib.error ?? pls.error;

  const plIds = (pls.data ?? []).map((p) => p.id as string);
  const items = plIds.length ? await sb.from("playlist_items").select("*").in("playlist_id", plIds) : { data: [], error: null };
  if (items.error) throw items.error;

  // Songs in your library that someone else made (public): fetch so they show offline.
  const libSongIds = (lib.data ?? []).map((r) => r.song_id as string);
  const mine = new Set((mySongs.data ?? []).map((s) => s.id as string));
  const others = libSongIds.filter((id) => !mine.has(id));
  const otherSongs = others.length ? await sb.from("songs").select("*").in("id", others) : { data: [], error: null };

  const pending = await db.outbox.toArray();
  const isPending = (t: SyncedTable, id: string) => pending.some((p) => p.table === t && p.rowId === id);

  await db.transaction("rw", [db.songs, db.library, db.playlists, db.playlistItems], async () => {
    // songs (yours, then others' you saved)
    const remoteSongs = [...(mySongs.data ?? []), ...(otherSongs.data ?? [])].map(rowToSong);
    await db.songs.bulkPut(remoteSongs.filter((s) => !isPending("songs", s.id)));
    const localMine = await db.songs.where("createdBy").equals(uid).toArray();
    const gone = localMine.filter((s) => !mine.has(s.id) && !isPending("songs", s.id));
    await db.songs.bulkDelete(gone.map((s) => s.id));

    // library
    const remoteLib = new Map((lib.data ?? []).map((r) => [r.song_id as string, r]));
    for (const [id, r] of remoteLib) {
      if (isPending("library", id)) continue;
      await db.library.put(rowToEntry(r, await db.library.get(id)));
    }
    const localLib = await db.library.toArray();
    await db.library.bulkDelete(localLib.filter((e) => !remoteLib.has(e.songId) && !isPending("library", e.songId)).map((e) => e.songId));

    // playlists
    const remotePl = new Map((pls.data ?? []).map((r) => [r.id as string, r]));
    for (const [id, r] of remotePl) {
      if (isPending("playlists", id)) continue;
      await db.playlists.put(rowToPlaylist(r, await db.playlists.get(id)));
    }
    const localPl = await db.playlists.where("ownerId").equals(uid).toArray();
    await db.playlists.bulkDelete(localPl.filter((p) => !remotePl.has(p.id) && !isPending("playlists", p.id)).map((p) => p.id));

    // items: replace each playlist's items unless something in it is waiting to be sent
    for (const pid of plIds) {
      const local = await db.playlistItems.where("playlistId").equals(pid).toArray();
      if (local.some((i) => isPending("playlistItems", i.id))) continue;
      await db.playlistItems.bulkDelete(local.map((i) => i.id));
      await db.playlistItems.bulkPut((items.data ?? []).filter((r) => r.playlist_id === pid).map(rowToItem));
    }
  });
}

/** Start-up: send what's waiting, then bring in what changed elsewhere. Re-runs when back online. */
export function startSync(): void {
  if (!supabase) return;
  const run = async () => {
    await syncNow();
    try {
      await pull();
    } catch (e) {
      set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };
  void run();
  window.addEventListener("online", () => void run());
  void refreshPending();
}
