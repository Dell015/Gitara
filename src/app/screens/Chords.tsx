import { useEffect, useMemo, useState } from "react";
import { GUITAR_TUNINGS } from "../../core/instrument";
import { familyForms, findVoicings, formLabel, formSuffix, moveShape, SHAPE_FAMILIES, type ShapeFamily, type Voicing } from "../../core/shapes";
import { chordName, mod12, noteName, QUALITIES, type Accidental } from "../../core/theory";
import { Segmented, TopBar } from "../../ui/bits";
import { ChordDiagram } from "../../ui/ChordDiagram";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { usePrefs } from "../prefs";

/**
 * The chord library, laid out like a printed chord chart: a name, then the box with its finger
 * dots. Three ways in: Starter (the chords everyone learns first), By key (every type for one root)
 * and By type (one type in all 12 keys). Tap any chord to see all of its versions.
 */

const ROOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

interface Cat {
  label: string;
  note?: string;
  /** Starter: whole chord names. By key / type use suffixes. */
  items: string[];
}

/** The chords people learn first, in the groups a teacher would use. */
const STARTER: Cat[] = [
  { label: "Major", note: "The happy, open sound", items: ["A", "B", "C", "D", "E", "F", "G"] },
  { label: "Minor", note: "Darker and softer", items: ["Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm"] },
  { label: "Sevenths", note: "Add colour and pull towards the next chord", items: ["A7", "B7", "C7", "D7", "E7", "G7", "Am7", "Dm7", "Em7", "Cmaj7", "Fmaj7", "Gmaj7"] },
  { label: "Suspended and added", note: "Open, unresolved sounds", items: ["Asus2", "Asus4", "Dsus2", "Dsus4", "Esus4", "Gsus4", "Csus2", "Cadd9"] },
  { label: "Power chords", note: "Two or three notes, solid and loud", items: ["A5", "C5", "D5", "E5", "G5"] },
  { label: "Slash chords", note: "Same chord, different note in the bass", items: ["C/G", "C/E", "D/F#", "G/B", "Am/G", "Em/D"] },
];

/** Every chord type, grouped. Each suffix is a Quality the app understands. */
const TYPES: { label: string; items: { suffix: string; chip: string; long: string }[] }[] = [
  {
    label: "Basic",
    items: [
      { suffix: "", chip: "Major", long: "Major" },
      { suffix: "m", chip: "Minor", long: "Minor" },
      { suffix: "5", chip: "5", long: "Power chord" },
      { suffix: "sus2", chip: "sus2", long: "Suspended 2nd" },
      { suffix: "sus4", chip: "sus4", long: "Suspended 4th" },
      { suffix: "dim", chip: "dim", long: "Diminished" },
      { suffix: "aug", chip: "aug", long: "Augmented" },
    ],
  },
  {
    label: "Sixths and added notes",
    items: [
      { suffix: "6", chip: "6", long: "Major 6th" },
      { suffix: "m6", chip: "m6", long: "Minor 6th" },
      { suffix: "69", chip: "6/9", long: "Six-nine" },
      { suffix: "add9", chip: "add9", long: "Major add 9" },
      { suffix: "madd9", chip: "m add9", long: "Minor add 9" },
      { suffix: "add11", chip: "add11", long: "Major add 11" },
      { suffix: "madd11", chip: "m add11", long: "Minor add 11" },
    ],
  },
  {
    label: "Sevenths",
    items: [
      { suffix: "7", chip: "7", long: "Dominant 7th" },
      { suffix: "maj7", chip: "maj7", long: "Major 7th" },
      { suffix: "m7", chip: "m7", long: "Minor 7th" },
      { suffix: "mMaj7", chip: "m maj7", long: "Minor-major 7th" },
      { suffix: "7sus4", chip: "7sus4", long: "Dominant 7th, suspended 4th" },
      { suffix: "dim7", chip: "dim7", long: "Diminished 7th" },
      { suffix: "m7b5", chip: "m7♭5", long: "Half-diminished 7th" },
    ],
  },
  {
    label: "Ninths, elevenths, thirteenths",
    items: [
      { suffix: "9", chip: "9", long: "Dominant 9th" },
      { suffix: "maj9", chip: "maj9", long: "Major 9th" },
      { suffix: "m9", chip: "m9", long: "Minor 9th" },
      { suffix: "9sus4", chip: "9sus4", long: "9th, suspended 4th" },
      { suffix: "11", chip: "11", long: "Dominant 11th" },
      { suffix: "m11", chip: "m11", long: "Minor 11th" },
      { suffix: "13", chip: "13", long: "Dominant 13th" },
      { suffix: "m13", chip: "m13", long: "Minor 13th" },
      { suffix: "maj13", chip: "maj13", long: "Major 13th" },
    ],
  },
  {
    label: "Altered",
    items: [
      { suffix: "7b5", chip: "7♭5", long: "Dominant 7th, flat 5th" },
      { suffix: "7#5", chip: "7♯5", long: "Dominant 7th, sharp 5th" },
      { suffix: "7b9", chip: "7♭9", long: "Dominant 7th, flat 9th" },
      { suffix: "7#9", chip: "7♯9", long: "Dominant 7th, sharp 9th" },
      { suffix: "maj7#5", chip: "maj7♯5", long: "Major 7th, sharp 5th" },
      { suffix: "maj7#11", chip: "maj7♯11", long: "Major 7th, sharp 11th" },
    ],
  },
];
const LONG = new Map(TYPES.flatMap((g) => g.items.map((i) => [i.suffix, i.long] as const)));

type Mode = "starter" | "key" | "type" | "barre" | "all";

export function Chords() {
  const nav = useNav();
  const { open } = useOverlays();
  const prefs = usePrefs();
  const [mode, setMode] = useState<Mode>("starter");
  const [root, setRoot] = useState(0);
  const [suffix, setSuffix] = useState("");
  const [tuningId, setTuningId] = useState("standard");
  const [picked, setPicked] = useState<{ family: string; key: string } | null>(null);

  const tuning = (GUITAR_TUNINGS.find((t) => t.id === tuningId) ?? GUITAR_TUNINGS[0]!).tuning;
  const acc: Accidental = prefs.accidentals === "flat" ? "flat" : "sharp";
  const openChord = (name: string) => open({ kind: "chord", name, tuning, capo: 0 });
  const card = (name: string) => <ChordCard key={`${name}|${tuningId}`} name={name} tuning={tuning} left={prefs.leftHanded} onOpen={() => openChord(name)} />;

  return (
    <>
      <TopBar onBack={nav.back} title="Chord finder" />
      <div className="chordlab">
        <header className="chordlab__head">
          <h1 className="h1">Chord finder</h1>
          <p className="muted">Browse every chord like a chart. Tap one to see all its versions.</p>
        </header>

        <div className="chordlab__bar">
          <Segmented
            label="Browse"
            value={mode}
            onChange={setMode}
            options={[
              { id: "starter", label: "Starter" },
              { id: "key", label: "By key" },
              { id: "type", label: "By type" },
              { id: "barre", label: "Barre & power" },
              { id: "all", label: "Everything" },
            ]}
          />
          <label className="chordlab__tuning">
            <span className="chordlab__tuninglabel">Tuning</span>
            <select className="input input--sm" value={tuningId} onChange={(e) => setTuningId(e.target.value)} aria-label="Tuning">
              {GUITAR_TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "starter" &&
          STARTER.map((c) => (
            <section key={c.label} className="chordlab__section">
              <div className="chordlab__sechead">
                <h2 className="h2">{c.label}</h2>
                {c.note && <p className="muted">{c.note}</p>}
              </div>
              <div className="chordlab__grid">{c.items.map(card)}</div>
            </section>
          ))}

        {mode === "key" && (
          <>
            <div className="chordlab__roots" role="group" aria-label="Key">
              {ROOTS.map((r) => (
                <button key={r} className="chip chordlab__root" aria-pressed={root === r} onClick={() => setRoot(r)} aria-label={noteName(r, "sharp") === noteName(r, "flat") ? noteName(r, "sharp") : `${noteName(r, "sharp")} or ${noteName(r, "flat")}`}>
                  {noteName(r, acc)}
                </button>
              ))}
            </div>
            {TYPES.map((g) => (
              <section key={g.label} className="chordlab__section">
                <div className="chordlab__sechead">
                  <h2 className="h2">{g.label}</h2>
                </div>
                <div className="chordlab__grid">{g.items.map((it) => card(chordName({ root, quality: { suffix: it.suffix, intervals: [] } }, acc)))}</div>
              </section>
            ))}
          </>
        )}

        {mode === "type" && (
          <>
            {TYPES.map((g) => (
              <section key={g.label} className="chordlab__section">
                <h2 className="h3">{g.label}</h2>
                <div className="chips chips--wrap">
                  {g.items.map((it) => (
                    <button key={it.suffix} className="chip" aria-pressed={suffix === it.suffix} onClick={() => setSuffix(it.suffix)}>
                      {it.chip}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <section className="chordlab__section">
              <div className="chordlab__sechead">
                <h2 className="h2">{LONG.get(suffix) ?? "Chord"} in every key</h2>
              </div>
              <div className="chordlab__grid">{ROOTS.map((r) => card(chordName({ root: r, quality: { suffix, intervals: [] } }, acc)))}</div>
            </section>
          </>
        )}

        {mode === "all" && <EverythingView root={root} setRoot={setRoot} tuning={tuning} acc={acc} onOpen={openChord} />}

        {mode === "barre" && (
          <ShapesView
            picked={picked}
            setPicked={setPicked}
            tuning={tuning}
            standard={tuningId === "standard"}
            acc={acc}
            left={prefs.leftHanded}
            onOpenChord={openChord}
            onTuning={() => setTuningId("standard")}
          />
        )}

        <div className="stack">
          <button className="btn btn--secondary" onClick={() => open({ kind: "fretboard", tuning, capo: 0, onDone: () => undefined })}>
            Place your fingers instead
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * One chord in the chart: its name over its box, showing the easiest shape. The shape is worked out
 * a moment after the card appears (and remembered), so a long chart never freezes the screen.
 */
function ChordCard({ name, tuning, left, onOpen, shape: fixed, sub }: { name: string; tuning: readonly number[]; left: boolean; onOpen: () => void; shape?: Voicing; sub?: string }) {
  const [found, setFound] = useState<Voicing | null | undefined>(undefined);
  const shape = fixed ?? found;
  const key = useMemo(() => `${name}|${tuning.join(",")}`, [name, tuning]);
  useEffect(() => {
    if (fixed) return;
    let live = true;
    const t = window.setTimeout(() => {
      if (live) setFound(findVoicings(name, tuning, 1)[0] ?? null);
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [key, name, tuning, fixed]);

  return (
    <button className="chordcard" onClick={onOpen} aria-label={`${name}: see all versions`}>
      <span className="chordcard__name chordname">{name}</span>
      {sub && <span className="chordcard__sub num">{sub}</span>}
      {shape ? (
        <ChordDiagram voicing={shape} name={name} leftHanded={left} size={104} />
      ) : (
        <span className="chordcard__ph" data-none={shape === null || undefined}>
          {shape === null ? "No shape" : ""}
        </span>
      )}
    </button>
  );
}

/**
 * Barre and power chords: shapes you slide up the neck. First every shape on one page (grouped by
 * family), then tap one to see it in all 12 keys.
 */
function ShapesView({
  picked,
  setPicked,
  tuning,
  standard,
  acc,
  left,
  onOpenChord,
  onTuning,
}: {
  picked: { family: string; key: string } | null;
  setPicked: (p: { family: string; key: string } | null) => void;
  tuning: readonly number[];
  standard: boolean;
  acc: Accidental;
  left: boolean;
  onOpenChord: (name: string) => void;
  onTuning: () => void;
}) {
  if (!standard) {
    return (
      <section className="chordlab__section">
        <h2 className="h2">Barre and power chords</h2>
        <p className="muted">These shapes are written for standard tuning, where sliding a shape changes the key the same way on every string.</p>
        <button className="btn btn--secondary" onClick={onTuning}>
          Switch to standard tuning
        </button>
      </section>
    );
  }
  const fam = picked ? SHAPE_FAMILIES.find((f) => f.id === picked.family) : undefined;
  if (picked && fam) {
    const suffix = formSuffix(picked.key);
    const cards = ROOTS.map((r) => ({ r, m: moveShape(fam, picked.key, r) }))
      .filter((x) => x.m)
      .sort((a, b) => a.m!.shift - b.m!.shift);
    return (
      <>
        <section className="chordlab__section">
          <button className="link chordlab__back" onClick={() => setPicked(null)}>
            All shapes
          </button>
          <div className="chordlab__sechead">
            <h2 className="h2">
              {fam.label} · {formLabel(fam, picked.key)}
            </h2>
          </div>
          <p className="muted">{fam.hint}</p>
          <div className="chips chips--wrap" role="group" aria-label="Chord type">
            {familyForms(fam).map((k) => (
              <button key={k} className="chip" aria-pressed={picked.key === k} onClick={() => setPicked({ family: fam.id, key: k })}>
                {formLabel(fam, k)}
              </button>
            ))}
          </div>
        </section>
        <section className="chordlab__section">
          <div className="chordlab__grid">
            {cards.map(({ r, m }) => {
              const name = chordName({ root: r, quality: { suffix, intervals: [] } }, acc);
              return <ChordCard key={`${fam.id}|${picked.key}|${r}`} name={name} tuning={tuning} left={left} shape={m!.voicing} sub={m!.shift === 0 ? "Open" : `Fret ${m!.shift}`} onOpen={() => onOpenChord(name)} />;
            })}
          </div>
        </section>
      </>
    );
  }
  const groups: { title: string; intro: string; families: ShapeFamily[] }[] = [
    { title: "Barre chords", intro: "One finger lies across the neck like a movable nut. Learn a shape once, slide it up, and it plays a different chord at every fret. The five shapes below are the five open chords C, A, G, E and D turned into sliding shapes.", families: SHAPE_FAMILIES.filter((f) => f.group === "barre") },
    { title: "Power chords", intro: "Two or three notes: the root and its fifth. Loud, simple and easy to slide, the basis of rock and punk.", families: SHAPE_FAMILIES.filter((f) => f.group === "power") },
  ];
  return (
    <>
      <p className="muted">Every shape on one page. Tap a shape to see it in all 12 keys.</p>
      {groups.map((g) => (
        <div key={g.title} className="chordlab__group">
          <div className="chordlab__sechead">
            <h2 className="h1 chordlab__grouptitle">{g.title}</h2>
          </div>
          <p className="muted">{g.intro}</p>
          {g.families.map((f) => (
            <section key={f.id} className="chordlab__section">
              <div className="chordlab__sechead">
                <h3 className="h2">{f.label}</h3>
              </div>
              <p className="muted chordlab__hint">{f.hint}</p>
              <div className="chordlab__grid">
                {familyForms(f).map((k) => {
                  const m = moveShape(f, k, (f.base + f.ref) % 12, f.ref);
                  return (
                    <button key={k} className="chordcard" onClick={() => setPicked({ family: f.id, key: k })} aria-label={`${f.label}, ${formLabel(f, k)}: see it in every key`}>
                      <span className="chordcard__name">{formLabel(f, k)}</span>
                      {m && <ChordDiagram voicing={m.voicing} name={formLabel(f, k)} leftHanded={left} size={104} />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Every chord Gitara knows, as an index: pick a root and all 36 types are listed with how many
 * shapes each has. Tap one for every version (and every bass note) of it.
 */
function EverythingView({ root, setRoot, tuning, acc, onOpen }: { root: number; setRoot: (r: number) => void; tuning: readonly number[]; acc: Accidental; onOpen: (name: string) => void }) {
  const rows = useMemo(
    () =>
      TYPES.map((g) => ({
        label: g.label,
        items: g.items.map((it) => {
          const q = QUALITIES.find((x) => x.suffix === it.suffix)!;
          const name = chordName({ root, quality: q }, acc);
          return { name, long: it.long, notes: q.intervals.map((i) => noteName(mod12(root + i), acc)).join(" "), suffix: it.suffix };
        }),
      })),
    [root, acc],
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  // shape counts are worked out a few at a time so the list appears instantly and fills in
  useEffect(() => {
    setCounts({});
    let live = true;
    const names = rows.flatMap((g) => g.items.map((i) => i.name));
    let i = 0;
    const step = () => {
      if (!live) return;
      const batch: Record<string, number> = {};
      for (const n of names.slice(i, i + 4)) batch[n] = findVoicings(n, tuning, 800).length;
      i += 4;
      setCounts((c) => ({ ...c, ...batch }));
      if (i < names.length) window.setTimeout(step, 0);
    };
    window.setTimeout(step, 0);
    return () => {
      live = false;
    };
  }, [rows, tuning]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const done = Object.keys(counts).length;

  return (
    <>
      <p className="muted">All 36 chord types for any key. Tap a chord to see every shape for it, and every way to play it over a different bass note.</p>
      <div className="chordlab__roots" role="group" aria-label="Key">
        {ROOTS.map((r) => (
          <button key={r} className="chip chordlab__root" aria-pressed={root === r} onClick={() => setRoot(r)}>
            {noteName(r, acc)}
          </button>
        ))}
      </div>
      <p className="muted num chordlab__total" aria-live="polite">
        {done < 36 ? "Counting shapes…" : `${noteName(root, acc)} has 36 chords and ${total.toLocaleString()} shapes`}
      </p>
      {rows.map((g) => (
        <section key={g.label} className="chordlab__section">
          <h2 className="h2">{g.label}</h2>
          <ul className="list chordlab__index">
            {g.items.map((it) => (
              <li key={it.name}>
                <button className="chordrow" onClick={() => onOpen(it.name)} aria-label={`${it.name}, ${it.long}${counts[it.name] !== undefined ? `, ${counts[it.name]} shapes` : ""}`}>
                  <span className="chordrow__name chordname">{it.name}</span>
                  <span className="chordrow__main">
                    <span className="chordrow__long">{it.long}</span>
                    <span className="chordrow__notes num">{it.notes}</span>
                  </span>
                  <span className="chordrow__count num">{counts[it.name] !== undefined ? `${counts[it.name]} shapes` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
