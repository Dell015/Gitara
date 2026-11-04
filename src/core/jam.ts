/**
 * Jam mode (§5.10): from what each person can play, build a setlist and say who plays what.
 * Pure functions, no UI and no network, so the rules can be tested.
 *
 * Rules (all decided in the docs):
 *  - "Can play" = Performing by default; Learning too when the host switches it on.
 *  - Songs several people know are group songs; songs one person knows are that person's solo spot.
 *  - The spotlight is shared out fairly, and a solo spot comes up every third slot.
 *  - If people play a song in different keys the group agrees on one key, and everyone gets the
 *    capo and the shape key they need. People who play lead or solo count more when choosing the
 *    key, because their parts are the hardest to move.
 */
import type { LearnStatus, PlayablePart } from "./model";
import { accidentalForKey, mod12, noteName, parseNote, transposeKey } from "./theory";
import { looseKey } from "./text";

export type Role = "rhythm" | "lead" | "solo" | "vocals";

/** One song someone can play, as they share it with the jam. Self-contained: nobody else has their library. */
export interface OfferSong {
  ref: string;
  title: string;
  artist: string;
  status: LearnStatus | null;
  parts: PlayablePart[];
  sing: boolean;
  /** The sounding key as this person plays it. */
  key?: string;
  capo: number;
  bpm?: number;
  sec?: number;
}

export interface JamMember {
  id: string;
  name: string;
  offer: OfferSong[];
}

export interface SetPlayer {
  userId: string;
  name: string;
  roles: Role[];
  /** The capo this person should use in the group's key. */
  capo: number;
  /** The key their chord shapes are in with that capo (e.g. sounding G, capo 2 -> shapes in F). */
  shapesIn?: string;
  /** True when this person has to leave how they normally play it. */
  moved: boolean;
  /** What they normally do, shown only when moved: "G, capo 0". */
  usual?: string;
}

export type ItemKind = "group" | "duo" | "solo" | "nobody";

export interface SetItem {
  ref: string;
  title: string;
  artist: string;
  /** The key the group plays in. */
  key?: string;
  bpm?: number;
  sec?: number;
  kind: ItemKind;
  /** For a solo spot: whose turn it is. */
  spotlight?: string;
  players: SetPlayer[];
  requestedBy?: string;
  /** Set by the host while the jam runs: the song being played now, or one that's finished. */
  status?: "now" | "done";
}

export const songRef = (title: string, artist: string) => `${looseKey(title)}|${looseKey(artist)}`;

export const DEFAULT_SEC = 210;

export interface BuildOptions {
  includeLearning: boolean;
  /** Aim for about this many minutes. Without it the setlist is a sensible evening's worth. */
  targetMinutes?: number | null;
}

// ---------------------------------------------------------------- keys

interface KeyInfo {
  pc: number;
  minor: boolean;
}

export function parseKey(key: string | undefined): KeyInfo | null {
  if (!key) return null;
  const minor = /m$/.test(key) && !/maj$/i.test(key);
  const pc = parseNote(minor ? key.slice(0, -1) : key);
  return pc === null ? null : { pc, minor };
}

const keyName = (k: KeyInfo) => {
  const probe = noteName(k.pc, "sharp") + (k.minor ? "m" : "");
  return noteName(k.pc, accidentalForKey(probe)) + (k.minor ? "m" : "");
};

/** Keys with easy open shapes. A capo is chosen to land the shapes in one of these. */
const FRIENDLY = new Set(["C", "G", "D", "A", "E", "Am", "Em", "Dm"]);

/** Which capo (0–7) gives the friendliest shapes for a sounding key; the lowest capo wins a tie. */
export function capoForKey(sounding: string): { capo: number; shapesIn: string } {
  const k = parseKey(sounding);
  if (!k) return { capo: 0, shapesIn: sounding };
  for (let capo = 0; capo <= 7; capo++) {
    const shapes = keyName({ pc: mod12(k.pc - capo), minor: k.minor });
    if (FRIENDLY.has(shapes)) return { capo, shapesIn: shapes };
  }
  return { capo: 0, shapesIn: keyName(k) };
}

/** Choose the group's key: the one most people (weighted by how hard their part is to move) already play. */
export function chooseKey(votes: { key?: string; weight: number }[]): string | undefined {
  const tally = new Map<string, { w: number; first: number }>();
  votes.forEach((v, i) => {
    const k = parseKey(v.key);
    if (!k) return;
    const name = keyName(k);
    const cur = tally.get(name);
    if (cur) cur.w += v.weight;
    else tally.set(name, { w: v.weight, first: i });
  });
  let best: string | undefined;
  let bw = -1;
  let bf = Infinity;
  for (const [name, t] of tally) {
    if (t.w > bw || (t.w === bw && t.first < bf)) {
      best = name;
      bw = t.w;
      bf = t.first;
    }
  }
  return best;
}

// ---------------------------------------------------------------- who can play what

const PART_ROLE: Record<PlayablePart, Role> = { chords: "rhythm", lead: "lead", solo: "solo" };

/** Which songs a member can bring, given the jam's rule. */
export function canBring(o: OfferSong, includeLearning: boolean): boolean {
  return o.status === "performing" || (includeLearning && o.status === "learning");
}

interface Ability {
  m: JamMember;
  o: OfferSong;
  roles: Set<Role>;
}

function abilities(ref: string, members: JamMember[], includeLearning: boolean): Ability[] {
  const out: Ability[] = [];
  for (const m of members) {
    const o = m.offer.find((x) => x.ref === ref && canBring(x, includeLearning));
    if (!o) continue;
    const roles = new Set<Role>((o.parts.length ? o.parts : (["chords"] as PlayablePart[])).map((p) => PART_ROLE[p]));
    if (o.sing) roles.add("vocals");
    out.push({ m, o, roles });
  }
  return out;
}

/** How many times each person has been given each role so far; used to keep the load fair. */
type Load = Map<string, Record<Role, number>>;
const zero = (): Record<Role, number> => ({ rhythm: 0, lead: 0, solo: 0, vocals: 0 });

/** Give lead, solo and vocals to one person each (the one who has had the least of it), the rest play rhythm. */
function assignRoles(ab: Ability[], load: Load): Map<string, Set<Role>> {
  const given = new Map<string, Set<Role>>(ab.map((a) => [a.m.id, new Set<Role>()]));
  for (const role of ["lead", "solo", "vocals"] as const) {
    const can = ab.filter((a) => a.roles.has(role));
    if (!can.length) continue;
    // fewest of this role so far; ties go to whoever already has the fewest roles in this song
    can.sort((a, b) => (load.get(a.m.id)?.[role] ?? 0) - (load.get(b.m.id)?.[role] ?? 0) || given.get(a.m.id)!.size - given.get(b.m.id)!.size);
    given.get(can[0]!.m.id)!.add(role);
  }
  for (const a of ab) {
    const g = given.get(a.m.id)!;
    if (a.roles.has("rhythm")) g.add("rhythm");
    else if (!g.size) g.add("rhythm"); // can only do lead/solo/vocals but wasn't picked: plays along
  }
  for (const a of ab) for (const r of given.get(a.m.id)!) {
    const l = load.get(a.m.id) ?? zero();
    if (r !== "rhythm") l[r]++;
    load.set(a.m.id, l);
  }
  return given;
}

const ROLE_ORDER: Role[] = ["lead", "solo", "rhythm", "vocals"];

/** Plan one song: who plays it, with which roles, in which key, with which capo. */
export function planSong(ref: string, fallback: { title: string; artist: string }, members: JamMember[], includeLearning: boolean, load: Load = new Map(), requestedBy?: string): SetItem {
  const ab = abilities(ref, members, includeLearning);
  const first = ab[0]?.o;
  const base = { ref, title: first?.title ?? fallback.title, artist: first?.artist ?? fallback.artist };
  if (!ab.length) return { ...base, kind: "nobody", players: [], requestedBy };

  const given = assignRoles(ab, load);
  const key = chooseKey(
    ab.map((a) => {
      const r = given.get(a.m.id)!;
      return { key: a.o.key, weight: r.has("lead") || r.has("solo") ? 2 : r.has("vocals") && !r.has("rhythm") ? 1.5 : 1 };
    }),
  );

  const players: SetPlayer[] = ab.map((a) => {
    const roles = ROLE_ORDER.filter((r) => given.get(a.m.id)!.has(r));
    const own = parseKey(a.o.key);
    const target = parseKey(key);
    // Already in the group's key: keep your own capo, nothing changes for you.
    if (!key || !target || (own && own.pc === target.pc && own.minor === target.minor)) {
      const shapesIn = key ? transposeKey(key, -a.o.capo) : undefined;
      return { userId: a.m.id, name: a.m.name, roles, capo: a.o.capo, shapesIn, moved: false };
    }
    const { capo, shapesIn } = capoForKey(key);
    return { userId: a.m.id, name: a.m.name, roles, capo, shapesIn, moved: true, usual: a.o.key ? `${a.o.key}${a.o.capo ? `, capo ${a.o.capo}` : ""}` : undefined };
  });

  const kind: ItemKind = ab.length === 1 ? "solo" : ab.length === 2 ? "duo" : "group";
  const bpm = ab.find((a) => a.o.bpm)?.o.bpm;
  const sec = ab.find((a) => a.o.sec)?.o.sec;
  return { ...base, key, bpm, sec, kind, spotlight: ab.length === 1 ? ab[0]!.m.id : undefined, players, requestedBy };
}

// ---------------------------------------------------------------- the setlist

const MAX_DEFAULT = 24;

/**
 * Build the evening: group songs first (the more people the better), a solo spot every third slot
 * (given to whoever has had the fewest), aiming for the target length.
 */
export function buildSetlist(members: JamMember[], opts: BuildOptions): SetItem[] {
  const byRef = new Map<string, { count: number; title: string; artist: string }>();
  for (const m of members)
    for (const o of m.offer) {
      if (!canBring(o, opts.includeLearning)) continue;
      const cur = byRef.get(o.ref);
      if (cur) cur.count++;
      else byRef.set(o.ref, { count: 1, title: o.title, artist: o.artist });
    }

  const groups = [...byRef.entries()].filter(([, v]) => v.count > 1).sort((a, b) => b[1].count - a[1].count || a[1].title.localeCompare(b[1].title));
  const solos = new Map<string, string[]>(); // member id -> refs only they know
  for (const m of members) {
    const mine = m.offer
      .filter((o) => canBring(o, opts.includeLearning) && byRef.get(o.ref)!.count === 1)
      .sort((a, b) => Number(b.status === "performing") - Number(a.status === "performing") || a.title.localeCompare(b.title));
    if (mine.length) solos.set(m.id, mine.map((o) => o.ref));
  }

  const target = opts.targetMinutes ? opts.targetMinutes * 60 : null;
  const load: Load = new Map();
  const spots = new Map<string, number>(members.map((m) => [m.id, 0]));
  const out: SetItem[] = [];
  let total = 0;
  let gi = 0;

  const nextSolo = () => {
    const can = [...solos.entries()].filter(([, refs]) => refs.length);
    if (!can.length) return null;
    can.sort((a, b) => (spots.get(a[0]) ?? 0) - (spots.get(b[0]) ?? 0) || members.findIndex((m) => m.id === a[0]) - members.findIndex((m) => m.id === b[0]));
    const [id, refs] = can[0]!;
    return { id, ref: refs.shift()! };
  };

  for (let slot = 0; ; slot++) {
    if (target ? total >= target : out.length >= MAX_DEFAULT) break;
    const wantSolo = slot % 3 === 2;
    const haveGroup = gi < groups.length;
    let item: SetItem | null = null;
    if ((wantSolo || !haveGroup) && [...solos.values()].some((r) => r.length)) {
      const s = nextSolo()!;
      const info = byRef.get(s.ref)!;
      item = planSong(s.ref, info, members, opts.includeLearning, load);
      spots.set(s.id, (spots.get(s.id) ?? 0) + 1);
    } else if (haveGroup) {
      const [ref, info] = groups[gi++]!;
      item = planSong(ref, info, members, opts.includeLearning, load);
    }
    if (!item) break;
    out.push(item);
    total += item.sec ?? DEFAULT_SEC;
  }
  return out;
}

/** Re-plan every song after people changed what they bring (keeps order and requests). */
export function replan(items: SetItem[], members: JamMember[], includeLearning: boolean): SetItem[] {
  const load: Load = new Map();
  return items.map((it) => {
    const next = planSong(it.ref, it, members, includeLearning, load, it.requestedBy);
    return it.status ? { ...next, status: it.status } : next;
  });
}

export function totalSeconds(items: SetItem[]): number {
  return items.reduce((s, i) => s + (i.sec ?? DEFAULT_SEC), 0);
}

/** "Anaïs and Bo" / "Ana, Bo and Cy". */
export function names(players: { name: string }[]): string {
  const n = players.map((p) => p.name);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/** The one-line instruction for a person on a song: "Lead · capo 2, shapes in F". */
export function instruction(p: SetPlayer): string {
  const label = p.roles
    .map((r) => (r === "rhythm" ? "Chords" : r === "lead" ? "Lead" : r === "solo" ? "Solo" : "Vocals"))
    .join(" + ");
  const shapes = p.shapesIn ? (p.capo ? `capo ${p.capo}, shapes in ${p.shapesIn}` : `no capo, shapes in ${p.shapesIn}`) : p.capo ? `capo ${p.capo}` : "";
  return shapes ? `${label} · ${shapes}` : label;
}
