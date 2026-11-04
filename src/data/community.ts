/**
 * Community (Phase 6): votes, ratings, reports, suggested edits, profiles, shared and saved playlists,
 * and the admin tools. These need the internet; each throws a plain-words error when offline.
 * The security rules live in the database (0007_community.sql): this file only asks.
 */
import type { PublicSections } from "../core/model";
import { currentUserId } from "./auth";
import { db } from "./local-db";
import { rowToItem, rowToPlaylist, rowToSong, rowToTrack, rowToVersion } from "./mappers";
import { cacheSongs } from "./repo";
import { supabase } from "./supabase";

export class OfflineError extends Error {
  constructor() {
    super("You're offline. This needs the internet.");
  }
}

function sb() {
  if (!supabase || !currentUserId()) throw new OfflineError();
  return supabase;
}
const uid = () => currentUserId()!;
const check = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

// ---------------------------------------------------------------- ratings (stars on each version)

export async function myVersionRating(versionId: string): Promise<number | null> {
  if (!supabase || !currentUserId()) return null;
  const { data } = await supabase.from("version_ratings").select("stars").eq("version_id", versionId).eq("user_id", uid()).maybeSingle();
  return (data?.stars as number) ?? null;
}

/** Your stars for every version of a song, keyed by version id. */
export async function myVersionRatings(versionIds: string[]): Promise<Map<string, number>> {
  if (!supabase || !currentUserId() || !versionIds.length) return new Map();
  const { data } = await supabase.from("version_ratings").select("version_id, stars").eq("user_id", uid()).in("version_id", versionIds);
  return new Map((data ?? []).map((r) => [r.version_id as string, r.stars as number]));
}

export async function rateVersion(versionId: string, stars: number | null): Promise<{ sum: number; count: number }> {
  const s = sb();
  if (stars === null) check(await s.from("version_ratings").delete().eq("version_id", versionId).eq("user_id", uid()));
  else check(await s.from("version_ratings").upsert({ version_id: versionId, user_id: uid(), stars }, { onConflict: "version_id,user_id" }));
  const { data } = await s.from("versions").select("rating_sum, rating_count").eq("id", versionId).maybeSingle();
  const out = { sum: (data?.rating_sum as number) ?? 0, count: (data?.rating_count as number) ?? 0 };
  await db.versions.update(versionId, { ratingSum: out.sum, ratingCount: out.count });
  return out;
}

/** Fresh ratings for the versions of a song (and the song's own total, which is kept for old data). */
export async function refreshCounts(songId: string): Promise<void> {
  if (!supabase) return;
  const vers = await supabase.from("versions").select("id, rating_sum, rating_count").eq("song_id", songId);
  for (const v of vers.data ?? []) await db.versions.update(v.id as string, { ratingSum: v.rating_sum as number, ratingCount: v.rating_count as number });
}

/** Average stars for a version, or null when nobody has rated it. */
export function versionAverage(v: { ratingSum?: number; ratingCount?: number }): number | null {
  return v.ratingCount ? (v.ratingSum ?? 0) / v.ratingCount : null;
}

// ---------------------------------------------------------------- reports

export type ReportReason = "wrong_info" | "duplicate" | "spam" | "offensive" | "copyright" | "other";
export type ReportTarget = "song" | "version" | "track" | "playlist" | "profile";

export async function report(targetType: ReportTarget, targetId: string, reason: ReportReason, note?: string, contact?: string): Promise<void> {
  check(await sb().from("reports").insert({ reporter_id: uid(), target_type: targetType, target_id: targetId, reason, note: note || null, contact: contact || null }));
}

// ---------------------------------------------------------------- suggested edits

export interface Suggestion {
  id: string;
  songId: string;
  userId: string | null;
  patch: Record<string, unknown>;
  note?: string;
  status: "open" | "accepted" | "declined";
  createdAt: string;
}

export async function suggestEdit(songId: string, patch: Record<string, unknown>, note?: string): Promise<void> {
  check(await sb().from("song_suggestions").insert({ song_id: songId, user_id: uid(), patch, note: note || null }));
}

export async function openSuggestions(songId: string): Promise<Suggestion[]> {
  if (!supabase || !currentUserId()) return [];
  const { data } = await supabase.from("song_suggestions").select("*").eq("song_id", songId).eq("status", "open").order("created_at");
  return (data ?? []).map((r) => ({ id: r.id, songId: r.song_id, userId: r.user_id, patch: r.patch, note: r.note ?? undefined, status: r.status, createdAt: r.created_at }));
}

export async function decideSuggestion(id: string, accept: boolean): Promise<void> {
  check(await sb().from("song_suggestions").update({ status: accept ? "accepted" : "declined" }).eq("id", id));
}

// ---------------------------------------------------------------- profiles

export interface Profile {
  id: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  publicSections: PublicSections;
  isAdmin: boolean;
}

export interface ProfileStats {
  versionVotes: number;
  publicVersions: number;
  publicSongs: number;
  ratings: number;
  ratingAvg: number | null;
  publicTracks: number;
}

const toProfile = (r: Record<string, unknown>): Profile => ({
  id: r.id as string,
  handle: (r.handle as string) ?? undefined,
  displayName: (r.display_name as string) ?? undefined,
  bio: (r.bio as string) ?? undefined,
  publicSections: (r.public_sections as PublicSections) ?? { planning: false, learning: false, performing: false, rating: false },
  isAdmin: Boolean(r.is_admin),
});

export async function getProfile(id: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return data ? toProfile(data) : null;
}

export async function myProfile(): Promise<Profile | null> {
  const id = currentUserId();
  return id ? getProfile(id) : null;
}

export async function updateMyProfile(p: Partial<Pick<Profile, "handle" | "displayName" | "bio" | "publicSections">>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (p.handle !== undefined) row.handle = p.handle ? p.handle.toLowerCase().trim() : null;
  if (p.displayName !== undefined) row.display_name = p.displayName.trim() || null;
  if (p.bio !== undefined) row.bio = p.bio.trim() || null;
  if (p.publicSections) row.public_sections = p.publicSections;
  const r = await sb().from("profiles").update(row).eq("id", uid());
  if (r.error) {
    if (/profiles_handle_key|duplicate/i.test(r.error.message)) throw new Error("That @handle is taken. Try another.");
    if (/handle_check|check constraint/i.test(r.error.message)) throw new Error("A handle is 3–20 lowercase letters, numbers or _.");
    throw new Error(r.error.message);
  }
}

export async function profileStats(id: string): Promise<ProfileStats | null> {
  if (!supabase || !currentUserId()) return null;
  const { data } = await supabase.rpc("profile_stats", { uid: id });
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (!r) return null;
  return {
    versionVotes: Number(r.version_votes),
    publicVersions: Number(r.public_versions),
    publicSongs: Number(r.public_songs),
    ratings: Number(r.ratings),
    ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
    publicTracks: Number(r.public_tracks),
  };
}

/** What someone has made public (versions, songs, tracks, playlists, library sections they share). */
export async function publicContentOf(id: string) {
  const s = supabase;
  if (!s) return null;
  const [vers, songs, tracks, pls, lib] = await Promise.all([
    s.from("versions").select("*").eq("author_id", id).eq("visibility", "public").order("rating_sum", { ascending: false }).limit(50),
    s.from("songs").select("*").eq("created_by", id).eq("visibility", "public").limit(50),
    s.from("tracks").select("*").eq("owner_id", id).eq("visibility", "public").limit(50),
    s.from("playlists").select("*").eq("owner_id", id).eq("visibility", "public").limit(50),
    s.from("library_entries").select("song_id, status, statuses").eq("user_id", id).not("status", "is", null).limit(300),
  ]);
  const versions = (vers.data ?? []).map(rowToVersion);
  const libSongIds = (lib.data ?? []).map((r) => r.song_id as string);
  const needed = [...new Set([...versions.map((v) => v.songId), ...libSongIds])];
  const songRows = needed.length ? ((await s.from("songs").select("*").in("id", needed)).data ?? []) : [];
  const allSongs = [...(songs.data ?? []), ...songRows].map(rowToSong);
  await cacheSongs(allSongs);
  // keep their public versions and tracks on the device so they open (and work offline later)
  const pending = new Set((await db.outbox.toArray()).map((o) => o.rowId));
  await db.versions.bulkPut(versions.filter((v) => !pending.has(v.id)));
  await db.tracks.bulkPut((tracks.data ?? []).map(rowToTrack).filter((t) => !pending.has(t.id)));
  return {
    versions,
    songs: (songs.data ?? []).map(rowToSong),
    tracks: (tracks.data ?? []).map(rowToTrack),
    playlists: (pls.data ?? []).map((r) => rowToPlaylist(r)),
    library: (lib.data ?? []).flatMap((r) => {
      const all = ((r.statuses as string[] | null)?.length ? (r.statuses as string[]) : [r.status as string]) as ("planning" | "learning" | "performing")[];
      return all.map((status) => ({ songId: r.song_id as string, status }));
    }),
    songsById: new Map(allSongs.map((x) => [x.id, x])),
  };
}

// ---------------------------------------------------------------- playlists: save, share

export async function savedPlaylistIds(): Promise<Set<string>> {
  if (!supabase || !currentUserId()) return new Set();
  const { data } = await supabase.from("playlist_saves").select("playlist_id").eq("user_id", uid());
  return new Set((data ?? []).map((r) => r.playlist_id as string));
}

export async function setPlaylistSaved(id: string, on: boolean): Promise<void> {
  const s = sb();
  if (on) check(await s.from("playlist_saves").insert({ playlist_id: id, user_id: uid() }));
  else check(await s.from("playlist_saves").delete().eq("playlist_id", id).eq("user_id", uid()));
  // keep the "saved" list on this device in step, so Library shows it straight away
  const cur = othersPlaylistsCached();
  if (on) cur.saved.add(id);
  else cur.saved.delete(id);
  try {
    localStorage.setItem("gitara.othersPlaylists", JSON.stringify({ shared: [...cur.shared], saved: [...cur.saved] }));
  } catch {
    /* ignore */
  }
  await fetchPlaylistsInto([id]);
}

/** Brings playlists you can see (saved, shared with you, opened from a link) onto this device. */
export async function fetchPlaylistsInto(ids: string[]): Promise<void> {
  if (!supabase || !ids.length) return;
  const pls = (await supabase.from("playlists").select("*").in("id", ids)).data ?? [];
  const items = (await supabase.from("playlist_items").select("*").in("playlist_id", ids)).data ?? [];
  const songIds = [...new Set(items.map((i) => i.song_id as string))];
  const songs = songIds.length ? ((await supabase.from("songs").select("*").in("id", songIds)).data ?? []) : [];
  await cacheSongs(songs.map(rowToSong));
  const pending = new Set((await db.outbox.where("table").equals("playlistItems").toArray()).map((o) => o.rowId));
  await db.transaction("rw", db.playlists, db.playlistItems, async () => {
    for (const r of pls) await db.playlists.put(rowToPlaylist(r, await db.playlists.get(r.id as string)));
    for (const pid of ids) {
      const local = await db.playlistItems.where("playlistId").equals(pid).toArray();
      if (local.some((i) => pending.has(i.id))) continue;
      await db.playlistItems.bulkDelete(local.map((i) => i.id));
      await db.playlistItems.bulkPut(items.filter((i) => i.playlist_id === pid).map(rowToItem));
    }
  });
}

/** Playlists shared with you (you're an editor) and ones you saved: refreshed on start. */
export async function pullOthersPlaylists(): Promise<{ shared: Set<string>; saved: Set<string> }> {
  if (!supabase || !currentUserId()) return { shared: new Set(), saved: new Set() };
  const [mem, sav] = await Promise.all([
    supabase.from("playlist_members").select("playlist_id").eq("user_id", uid()),
    supabase.from("playlist_saves").select("playlist_id").eq("user_id", uid()),
  ]);
  const shared = new Set((mem.data ?? []).map((r) => r.playlist_id as string));
  const saved = new Set((sav.data ?? []).map((r) => r.playlist_id as string));
  await fetchPlaylistsInto([...new Set([...shared, ...saved])]);
  try {
    localStorage.setItem("gitara.othersPlaylists", JSON.stringify({ shared: [...shared], saved: [...saved] }));
  } catch {
    /* ignore */
  }
  return { shared, saved };
}

export function othersPlaylistsCached(): { shared: Set<string>; saved: Set<string> } {
  try {
    const j = JSON.parse(localStorage.getItem("gitara.othersPlaylists") ?? "{}") as { shared?: string[]; saved?: string[] };
    return { shared: new Set(j.shared ?? []), saved: new Set(j.saved ?? []) };
  } catch {
    return { shared: new Set(), saved: new Set() };
  }
}

export interface Member {
  userId: string;
  handle?: string;
  displayName?: string;
}

export async function playlistMembers(pid: string): Promise<Member[]> {
  if (!supabase || !currentUserId()) return [];
  const { data } = await supabase.rpc("playlist_member_names", { pid });
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({ userId: r.user_id as string, handle: (r.handle as string) ?? undefined, displayName: (r.display_name as string) ?? undefined }));
}

export async function inviteEditor(pid: string, handle: string): Promise<Member> {
  const s = sb();
  const { data } = await s.rpc("find_profile_by_handle", { h: handle.replace(/^@/, "") });
  const p = (data as Record<string, unknown>[] | null)?.[0];
  if (!p) throw new Error(`Nobody is called @${handle.replace(/^@/, "")} yet.`);
  if (p.id === uid()) throw new Error("That's you: you already own this playlist.");
  const r = await s.from("playlist_members").insert({ playlist_id: pid, user_id: p.id, role: "editor" });
  if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message);
  return { userId: p.id as string, handle: (p.handle as string) ?? undefined, displayName: (p.display_name as string) ?? undefined };
}

export async function removeEditor(pid: string, userId: string): Promise<void> {
  check(await sb().from("playlist_members").delete().eq("playlist_id", pid).eq("user_id", userId));
}

export async function searchPublicPlaylists(term: string) {
  if (!supabase || term.trim().length < 2) return [];
  const t = term.replace(/[,()*%\\:"]/g, " ").trim();
  const { data } = await supabase.from("playlists").select("*").eq("visibility", "public").ilike("name", `%${t}%`).limit(10);
  return (data ?? []).map((r) => rowToPlaylist(r));
}

// ---------------------------------------------------------------- admin

export interface ReportRow {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  note?: string;
  contact?: string;
  status: string;
  createdAt: string;
}

export async function openReports(): Promise<ReportRow[]> {
  const { data } = await sb().from("reports").select("*").eq("status", "open").order("created_at").limit(200);
  return (data ?? []).map((r) => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, note: r.note ?? undefined, contact: r.contact ?? undefined, status: r.status, createdAt: r.created_at }));
}

export async function closeReport(id: string, status: "resolved" | "dismissed", resolution?: string): Promise<void> {
  check(await sb().from("reports").update({ status, resolution: resolution ?? null, resolved_at: new Date().toISOString() }).eq("id", id));
}

export async function adminHide(kind: Exclude<ReportTarget, "profile">, id: string): Promise<void> {
  check(await sb().rpc("admin_hide", { kind, target: id }));
}

export async function possibleDuplicates(): Promise<{ a: string; b: string; title: string; artist: string }[]> {
  const { data } = await sb().rpc("admin_possible_duplicates");
  return (data as { a: string; b: string; title: string; artist: string }[] | null) ?? [];
}

export async function mergeSongs(keep: string, dupe: string): Promise<void> {
  check(await sb().rpc("admin_merge_songs", { keep, dupe }));
  await db.songs.delete(dupe);
}
