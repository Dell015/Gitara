import { useEffect, useMemo, useState } from "react";
import { GUITAR_TUNINGS } from "../../core/instrument";
import { findVoicings, type Voicing } from "../../core/shapes";
import { chordName, noteName, type Accidental } from "../../core/theory";
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

type Mode = "starter" | "key" | "type";

export function Chords() {
  const nav = useNav();
  const { open } = useOverlays();
  const prefs = usePrefs();
  const [mode, setMode] = useState<Mode>("starter");
  const [root, setRoot] = useState(0);
  const [suffix, setSuffix] = useState("");
  const [tuningId, setTuningId] = useState("standard");

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
function ChordCard({ name, tuning, left, onOpen }: { name: string; tuning: readonly number[]; left: boolean; onOpen: () => void }) {
  const [shape, setShape] = useState<Voicing | null | undefined>(undefined);
  const key = useMemo(() => `${name}|${tuning.join(",")}`, [name, tuning]);
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => {
      if (live) setShape(findVoicings(name, tuning, 1)[0] ?? null);
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [key, name, tuning]);

  return (
    <button className="chordcard" onClick={onOpen} aria-label={`${name}: see all versions`}>
      <span className="chordcard__name chordname">{name}</span>
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
