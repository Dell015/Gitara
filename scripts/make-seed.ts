/**
 * Turns supabase/seed/starter-songs.txt into SQL (supabase/seed/0001_starter_catalog.sql) and a
 * plain-words review sheet (supabase/seed/REVIEW.md) so every chart can be checked by ear before it
 * goes live. Run it with:  node scripts/make-seed.mjs
 *
 * Uses the app's own chart code, so charts are validated, hashed and rated for difficulty exactly as
 * if someone had typed them into the editor. Chords only: lyrics are never stored.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { beatsPerBar, chordsUsed, computeDifficulty, contentHash, parseBars } from "../src/core/chart";
import { GENRES } from "../src/core/genres";
import { GUITAR } from "../src/core/instrument";
import type { Section, SectionKind, VersionContent } from "../src/core/model";
import { normalize } from "../src/core/text";
import { suggestKey } from "../src/core/theory";

const OWNER = "00000000-0000-4000-8000-00000000a001"; // the official "Gitara" profile
const here = new URL("../supabase/seed/", import.meta.url);

interface Entry {
  title: string;
  artist: string;
  genre: string;
  year?: number;
  bpm?: number;
  capo: number;
  check: string;
  sections: { name: string; text: string }[];
  order?: string;
}

const KINDS: Record<string, SectionKind> = {
  intro: "intro",
  verse: "verse",
  "pre-chorus": "pre-chorus",
  prechorus: "pre-chorus",
  chorus: "chorus",
  bridge: "bridge",
  solo: "solo",
  interlude: "interlude",
  outro: "outro",
};

function parse(src: string): Entry[] {
  const out: Entry[] = [];
  let cur: Entry | null = null;
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("==")) {
      const p = line.slice(2).split("|").map((x) => x.trim());
      const [title, artist, genre, year, bpm, capo, check] = p;
      if (!title || !artist || !genre) throw new Error(`line ${i + 1}: needs Title | Artist | Genre`);
      if (!(GENRES as readonly string[]).includes(genre)) throw new Error(`line ${i + 1}: unknown genre "${genre}"`);
      cur = { title, artist, genre, year: year ? Number(year) : undefined, bpm: bpm ? Number(bpm) : undefined, capo: capo ? Number(capo) : 0, check: check || "verify", sections: [] };
      out.push(cur);
      return;
    }
    if (!cur) throw new Error(`line ${i + 1}: a song block must start with ==`);
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`line ${i + 1}: expected "Section: chords"`);
    if (m[1]!.trim().toLowerCase() === "order") cur.order = m[2]!;
    else cur.sections.push({ name: m[1]!.trim(), text: m[2]! });
  });
  return out;
}

function build(e: Entry): VersionContent {
  const bpb = beatsPerBar("4/4");
  const sections: Section[] = e.sections.map((s, i) => {
    const { bars, unknown } = parseBars(s.text, bpb);
    if (unknown.length) throw new Error(`${e.title} / ${s.name}: not chords: ${unknown.join(" ")}`);
    if (!bars.length) throw new Error(`${e.title} / ${s.name}: empty`);
    const kind = KINDS[s.name.toLowerCase().replace(/\s+\d+$/, "")] ?? "custom";
    return { id: `s${i + 1}`, kind, label: kind === "custom" ? s.name : undefined, bars };
  });
  const byName = new Map(e.sections.map((s, i) => [s.name.toLowerCase(), sections[i]!.id]));
  const arrangement = e.order
    ? e.order.split(",").map((t) => {
        const m = /^\s*(.+?)(?:\s+x\s*(\d+))?\s*$/i.exec(t)!;
        const id = byName.get(m[1]!.toLowerCase());
        if (!id) throw new Error(`${e.title}: Order mentions "${m[1]}" which isn't a section`);
        return { sectionId: id, repeat: m[2] ? Number(m[2]) : 1 };
      })
    : sections.map((s) => ({ sectionId: s.id, repeat: 1 }));
  return { sections, arrangement };
}

const q = (s: string) => `$q$${s}$q$`;
const arr = (a: string[]) => (a.length ? `array[${a.map(q).join(",")}]::text[]` : "'{}'::text[]");

const entries = parse(readFileSync(new URL("starter-songs.txt", here), "utf8"));
const seen = new Set<string>();
const songRows: string[] = [];
const versionRows: string[] = [];
const review: string[] = [];
let charts = 0;

review.push(`# Starter catalog: review sheet\n\nGenerated from \`starter-songs.txt\`. Chords only. For each chart: play it against the recording and tell me what's wrong. "verify" means I'm less sure.\n\n| # | Song | Artist | Chart (one bar per chord, | = new bar) | BPM | Capo | Key shown | Level | Check |\n|---|---|---|---|---|---|---|---|---|---|`);

for (const e of entries) {
  const k = `${normalize(e.title)}|${normalize(e.artist)}`;
  if (seen.has(k)) throw new Error(`duplicate: ${e.title} / ${e.artist}`);
  seen.add(k);
  songRows.push(`(${q(e.title)},${q(e.artist)},${q(e.genre)},${e.year ?? "null"})`);
  if (!e.sections.length) continue;
  charts++;
  const content = build(e);
  const tuning = [...GUITAR.standardTuning];
  const key = suggestKey(chordsUsed(content));
  const diff = computeDifficulty(content, tuning, e.bpm);
  const hash = contentHash(content);
  versionRows.push(`(${q(normalize(e.title))},${q(normalize(e.artist))},${e.capo},${key ? q(key) : "null"},${e.bpm ?? "null"},${q(JSON.stringify(content))},'${hash}',${diff.score},'${diff.level}')`);
  const chart = content.sections
    .map((s) => `${s.label ?? s.kind}: ${s.bars.map((b) => b.chords.map((c) => c.name).join(" ")).join(" \\| ")}`)
    .join("<br>");
  review.push(`| ${charts} | ${e.title} | ${e.artist} | ${chart} | ${e.bpm ?? ""} | ${e.capo || ""} | ${key ?? ""} | ${diff.level} | ${e.check} |`);
}

const tuning = `array[${GUITAR.standardTuning.join(",")}]::smallint[]`;
const sql = `-- Gitara starter catalog (generated by scripts/make-seed.mjs from starter-songs.txt; do not edit by hand).
-- Songs and chord-only starter charts, owned by the official "Gitara" profile. Safe to run again:
-- a song or chart that already exists is skipped. Charts leave the strumming pattern out, so the
-- app's default pattern is used until someone sets one.

insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
values ('${OWNER}', 'authenticated', 'authenticated', false, now(), now())
on conflict (id) do nothing;
insert into public.profiles (id) values ('${OWNER}') on conflict do nothing;
update public.profiles set handle = 'gitara', display_name = 'Gitara', bio = 'Starter songs and charts from the Gitara team.' where id = '${OWNER}';

insert into public.songs (created_by, title, artist, genre, release_year, visibility)
select '${OWNER}', v.t, v.a, v.g, v.y, 'public'
from (values
${songRows.join(",\n")}
) as v(t, a, g, y)
on conflict (norm_title, norm_artist) where visibility = 'public' do nothing;

insert into public.versions (song_id, author_id, instrument_id, tuning, capo, key_played, bpm, time_signature, techniques, label, tags, content, content_hash, difficulty_score, difficulty_level, visibility)
select s.id, '${OWNER}', 'guitar', ${tuning}, v.capo, v.k, v.bpm, '4/4', '{}', 'Starter version', array['simplified']::text[], v.c::jsonb, v.h, v.score, v.lvl, 'public'
from (values
${versionRows.join(",\n")}
) as v(nt, na, capo, k, bpm, c, h, score, lvl)
join public.songs s on s.norm_title = v.nt and s.norm_artist = v.na and s.visibility = 'public'
on conflict (song_id, content_hash, tuning, capo) where visibility = 'public' and content_hash is not null do nothing;
`;

writeFileSync(new URL("0001_starter_catalog.sql", here), sql);
writeFileSync(new URL("REVIEW.md", here), review.join("\n") + `\n\n${entries.length} songs, ${charts} with a chart, ${entries.length - charts} waiting for someone to add one.\n`);
console.log(`${entries.length} songs, ${charts} charts`);
