/**
 * Jam mode data (Phase 7). A jam lives in the cloud while it lasts (it needs the internet), but the
 * "sync" is only this file, so a phone-to-phone version could replace it later (§5.10).
 * Security is in the database (0008_jam.sql): this file only asks.
 */
import type { JamMember, OfferSong, SetItem } from "../core/jam";
import { songRef } from "../core/jam";
import { transposeKey } from "../core/theory";
import { currentUserId } from "./auth";
import { OfflineError, myProfile } from "./community";
import { db } from "./local-db";
import { addSong, addToPlaylist, createPlaylist } from "./repo";
import { supabase } from "./supabase";

function sb() {
  if (!supabase || !currentUserId()) throw new OfflineError();
  return supabase;
}
const uid = () => currentUserId()!;
const check = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export interface Jam {
  id: string;
  code: string;
  hostId: string;
  name: string;
  includeLearning: boolean;
  targetMinutes: number | null;
  setlist: SetItem[];
  status: "open" | "ended";
}
export interface JamRequest {
  id: string;
  userId: string;
  title: string;
  artist: string;
}
export interface Room {
  jam: Jam;
  members: JamMember[];
  requests: JamRequest[];
}

// ---------------------------------------------------------------- what I bring

/** My Performing and Learning songs, each with the version I'd play, shared only inside the jam. */
export async function buildMyOffer(): Promise<OfferSong[]> {
  const entries = (await db.library.toArray()).filter((e) => e.status === "performing" || e.status === "learning");
  const out: OfferSong[] = [];
  for (const e of entries) {
    const song = await db.songs.get(e.songId);
    if (!song) continue;
    const versions = await db.versions.where("songId").equals(song.id).toArray();
    const prog = await db.progress.where("songId").equals(song.id).toArray();
    const rank = (id: string) => (prog.find((p) => p.versionId === id)?.status === "performing" ? 2 : prog.find((p) => p.versionId === id) ? 1 : 0);
    const ranked = [...versions].sort((x, y) => rank(y.id) - rank(x.id))[0];
    const v =
      (ranked && rank(ranked.id) > 0 ? ranked : undefined) ??
      versions.find((x) => x.id === e.preferredVersionId) ??
      versions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).find((x) => x.instrumentId === "guitar") ??
      versions[0];
    out.push({
      ref: songRef(song.title, song.artist),
      title: song.title,
      artist: song.artist,
      status: e.status,
      parts: e.canPlay,
      sing: e.canSing,
      // keyPlayed is the key of the shapes on the page; with a capo the sound is higher by that many semitones
      key: v?.keyPlayed ? transposeKey(v.keyPlayed, v.capo) : song.originalKey,
      capo: v?.capo ?? 0,
      bpm: v?.bpm ?? song.originalBpm,
      sec: song.durationSec,
    });
  }
  return out;
}

/** The name shown to the others in a jam: your display name, else your @handle, else a default. */
export async function myJamName(): Promise<string> {
  try {
    const p = await myProfile();
    return p?.displayName || (p?.handle ? `@${p.handle}` : "") || "Guitarist";
  } catch {
    return "Guitarist";
  }
}

// ---------------------------------------------------------------- the room

const KEY = "gitara.jam";
export const rememberedJam = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const rememberJam = (id: string | null) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: fine */
  }
};

const toJam = (r: Record<string, unknown>): Jam => ({
  id: r.id as string,
  code: r.code as string,
  hostId: r.host_id as string,
  name: r.name as string,
  includeLearning: r.include_learning as boolean,
  targetMinutes: (r.target_minutes as number | null) ?? null,
  setlist: (r.setlist as SetItem[]) ?? [],
  status: r.status as "open" | "ended",
});

/** Everything about a jam in three quick queries. Null when it's gone or you're no longer in it. */
export async function loadRoom(id: string): Promise<Room | null> {
  const s = sb();
  const [j, m, r] = await Promise.all([
    s.from("jams").select("*").eq("id", id).maybeSingle(),
    s.from("jam_members").select("user_id, display_name, offer, joined_at").eq("jam_id", id).order("joined_at"),
    s.from("jam_requests").select("id, user_id, title, artist").eq("jam_id", id).order("created_at"),
  ]);
  if (j.error) throw new Error(j.error.message);
  if (!j.data) return null;
  return {
    jam: toJam(j.data),
    members: (check(m) ?? []).map((x) => ({ id: x.user_id as string, name: x.display_name as string, offer: (x.offer as OfferSong[]) ?? [] })),
    requests: (check(r) ?? []).map((x) => ({ id: x.id as string, userId: x.user_id as string, title: x.title as string, artist: x.artist as string })),
  };
}

/** The open jam I'm in, if any (so the app can offer "back to your jam"). */
export async function myOpenJam(): Promise<{ id: string; name: string; code: string } | null> {
  if (!supabase || !currentUserId()) return null;
  const { data } = await supabase.from("jam_members").select("jam_id, jams!inner(id, name, code, status)").eq("user_id", uid()).eq("jams.status", "open").limit(1);
  const row = data?.[0] as unknown as { jams: { id: string; name: string; code: string } } | undefined;
  return row ? { id: row.jams.id, name: row.jams.name, code: row.jams.code } : null;
}

export async function createJam(name: string, includeLearning: boolean, targetMinutes: number | null): Promise<{ id: string; code: string }> {
  const s = sb();
  const rows = check(await s.rpc("create_jam", { p_name: name, p_display_name: await myJamName(), p_include_learning: includeLearning, p_target_minutes: targetMinutes }));
  const row = (rows as { id: string; code: string }[])[0]!;
  rememberJam(row.id);
  await publishOffer(row.id);
  return row;
}

export async function joinJam(code: string): Promise<string> {
  const s = sb();
  const id = check(await s.rpc("join_jam", { p_code: code, p_display_name: await myJamName() })) as string;
  rememberJam(id);
  await publishOffer(id);
  return id;
}

/** Share (or refresh) what I can play in this jam. Only the people inside it can see this. */
export async function publishOffer(jamId: string): Promise<void> {
  const s = sb();
  const offer = (await buildMyOffer()).slice(0, 300);
  check(await s.from("jam_members").update({ offer, display_name: await myJamName() }).eq("jam_id", jamId).eq("user_id", uid()));
}

export async function leaveJam(jamId: string): Promise<void> {
  check(await sb().from("jam_members").delete().eq("jam_id", jamId).eq("user_id", uid()));
  rememberJam(null);
}
export async function removeMember(jamId: string, userId: string): Promise<void> {
  check(await sb().from("jam_members").delete().eq("jam_id", jamId).eq("user_id", userId));
}
export async function endJam(jamId: string): Promise<void> {
  check(await sb().from("jams").update({ status: "ended" }).eq("id", jamId));
  rememberJam(null);
}

// host only (the database refuses anyone else)
export async function saveSetlist(jamId: string, setlist: SetItem[]): Promise<void> {
  check(await sb().from("jams").update({ setlist }).eq("id", jamId));
}
export async function updateSettings(jamId: string, patch: { name?: string; includeLearning?: boolean; targetMinutes?: number | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.includeLearning !== undefined) row.include_learning = patch.includeLearning;
  if (patch.targetMinutes !== undefined) row.target_minutes = patch.targetMinutes;
  check(await sb().from("jams").update(row).eq("id", jamId));
}

// requests (anyone inside)
export async function requestSong(jamId: string, title: string, artist: string): Promise<void> {
  check(await sb().from("jam_requests").insert({ jam_id: jamId, user_id: uid(), title: title.trim(), artist: artist.trim() }));
}
export async function removeRequest(id: string): Promise<void> {
  check(await sb().from("jam_requests").delete().eq("id", id));
}

// ---------------------------------------------------------------- live updates

/**
 * Calls `onChange` whenever anything in the jam changes. Row security decides what each person is
 * sent; we just refetch. Returns a function that stops listening.
 */
export function watchRoom(jamId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const ch = supabase
    .channel(`jam:${jamId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "jams", filter: `id=eq.${jamId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "jam_members", filter: `jam_id=eq.${jamId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "jam_requests", filter: `jam_id=eq.${jamId}` }, onChange)
    .subscribe();
  return () => void supabase!.removeChannel(ch);
}

// ---------------------------------------------------------------- keep it

/** Save the setlist as a normal playlist on this device (songs I don't have yet are added). */
export async function saveSetlistAsPlaylist(name: string, items: SetItem[]): Promise<{ id: string; added: number }> {
  const pl = await createPlaylist(name);
  const songs = await db.songs.toArray();
  let added = 0;
  for (const it of items) {
    const ref = songRef(it.title, it.artist);
    let song = songs.find((s) => songRef(s.title, s.artist) === ref);
    if (!song) {
      song = await addSong({ title: it.title, artist: it.artist, visibility: "private", originalKey: it.key, originalBpm: it.bpm, durationSec: it.sec });
      songs.push(song);
      added++;
    }
    await addToPlaylist(pl.id, song.id);
  }
  return { id: pl.id, added };
}
