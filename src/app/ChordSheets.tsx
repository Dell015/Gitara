import { useEffect, useMemo, useState } from "react";
import { findVoicings, SHAPE_KINDS, shapeKind, voicingFromFrets, type Voicing } from "../core/shapes";
import { accidentalForKey, chordName, chordTones, identifyChord, noteName, parseChord } from "../core/theory";
import { tuningName } from "../core/tunings";
import { strum } from "../audio/guitar";
import { ownerForNewRow } from "../data/auth";
import { db } from "../data/local-db";
import { ChordDiagram } from "../ui/ChordDiagram";
import { IconPlay } from "../ui/icons";
import { useOverlays } from "./overlays";
import { usePrefs } from "./prefs";

/** The most shapes the sheet will list for one chord (a chord has up to a few hundred). */
const SHAPE_LIMIT = 800;
/** Each group shows this many at first; "Show all" reveals the rest. */
const FIRST_SHOWN = 9;

/** Everything about one chord name: its shapes in this tuning, each one playable. (D5/D7) */
export function ChordSheet({
  name,
  tuning,
  capo,
  current,
  onPick,
}: {
  name: string;
  tuning: readonly number[];
  capo: number;
  current?: number[];
  onPick?: (v: Voicing) => void;
}) {
  const { open, close } = useOverlays();
  const prefs = usePrefs();
  // The chord can be viewed over another bass note ("C" then "C/E"); the sheet's own name tracks that.
  const base = parseChord(name);
  const [bass, setBass] = useState<number | null>(null);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const shown = bass !== null && base ? chordName({ ...base, bass }, accidentalForKey(name) === "flat" ? "flat" : "sharp") : name;
  const acc = accidentalForKey(name);
  // every shape there is, grouped the way players think about them (open, moveable, barre, high)
  const grouped = useMemo(() => {
    const all = findVoicings(shown, tuning, SHAPE_LIMIT);
    return SHAPE_KINDS.map((k) => ({ ...k, shapes: all.filter((s) => shapeKind(s) === k.id) })).filter((g) => g.shapes.length);
  }, [shown, tuning]);
  const shapes = useMemo(() => grouped.flatMap((g) => g.shapes), [grouped]);
  const index = useMemo(() => new Map(shapes.map((sh, i) => [sh, i] as const)), [shapes]);
  const parsed = parseChord(shown);
  const spelled = parsed ? chordTones(parsed).map((pc) => noteName(pc, acc)).join("  ") : "";
  const [sel, setSel] = useState(() => Math.max(0, current ? shapes.findIndex((s) => s.frets.join() === current.join()) : 0));
  const v = shapes[sel];
  // bass choices: the other notes of the chord (not shown when the sheet is picking a shape for a chart)
  const bassChoices = !onPick && base && !base.bass ? chordTones(base).filter((t) => t !== base.root) : [];
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title chordname">{shown}</h2>
          <p className="row__sub">
            {tuningName(tuning)}
            {capo ? ` · capo ${capo}` : ""} · {shapes.length ? `${shapes.length} ${shapes.length === 1 ? "version" : "versions"}` : "no shape found"}
          </p>
          {spelled && <p className="row__sub num">{spelled}</p>}
        </div>
        {v && (
          <button className="ringbtn" aria-label={`Hear ${shown}`} onClick={() => strum(v.frets, tuning, capo)}>
            <IconPlay />
          </button>
        )}
      </div>
      {bassChoices.length > 0 && (
        <div className="chips chips--wrap" role="group" aria-label="Bass note">
          <button className="chip" aria-pressed={bass === null} onClick={() => (setBass(null), setSel(0))}>
            Root position
          </button>
          {bassChoices.map((t) => (
            <button key={t} className="chip" aria-pressed={bass === t} onClick={() => (setBass(t), setSel(0))}>
              Over {noteName(t, acc)}
            </button>
          ))}
        </div>
      )}
      {shapes.length ? (
        grouped.map((g) => (
          <section key={g.id} className="shapegroup">
            <h3 className="shapegroup__title">
              {g.label} <span className="num">{g.shapes.length}</span>
            </h3>
            <p className="row__sub">{g.hint}</p>
            <div className="shapes" role="radiogroup" aria-label={`${g.label} for ${shown}`}>
              {(more[g.id] ? g.shapes : g.shapes.slice(0, FIRST_SHOWN)).map((s) => {
                const i = index.get(s) ?? 0;
                return (
                  <button
                    key={s.frets.join()}
                    role="radio"
                    aria-checked={i === sel}
                    className="shape"
                    onClick={() => {
                      setSel(i);
                      strum(s.frets, tuning, capo);
                    }}
                  >
                    <ChordDiagram voicing={s} name={shown} leftHanded={prefs.leftHanded} size={84} highlight={i === sel} />
                    <span className="shape__frets num">{s.frets.map((f) => (f < 0 ? "x" : f)).join("")}</span>
                  </button>
                );
              })}
            </div>
            {g.shapes.length > FIRST_SHOWN && (
              <button className="btn btn--ghost shapegroup__more" onClick={() => setMore((m) => ({ ...m, [g.id]: !m[g.id] }))}>
                {more[g.id] ? "Show fewer" : `Show all ${g.shapes.length}`}
              </button>
            )}
          </section>
        ))
      ) : (
        <p className="sheet__text">Gitara couldn't find a shape for {shown} in {tuningName(tuning)}. Build it on the fretboard.</p>
      )}
      <div className="stack">
        {onPick && v && (
          <button
            className="btn btn--primary"
            onClick={() => {
              onPick(v);
              close();
            }}
          >
            Use this shape
          </button>
        )}
        <button
          className="btn btn--secondary"
          onClick={() =>
            open({
              kind: "fretboard",
              tuning,
              capo,
              start: v?.frets,
              onDone: (n, shape) => {
                if (onPick && n === name) onPick(shape);
              },
            })
          }
        >
          Build on the fretboard
        </button>
      </div>
    </>
  );
}

/**
 * Make a chord by placing fingers (D6). Tap a fret on a string; tap the nut row to switch between
 * open and muted; tap a dot again to change its finger. The name comes from the notes.
 */
export function FretboardBuilder({
  tuning,
  capo,
  start,
  onDone,
}: {
  tuning: readonly number[];
  capo: number;
  start?: number[];
  onDone: (name: string, v: Voicing) => void;
}) {
  const { close, showToast } = useOverlays();
  const prefs = usePrefs();
  const n = tuning.length;
  const [frets, setFrets] = useState<number[]>(() => start ?? new Array(n).fill(-1));
  const [fingers, setFingers] = useState<number[]>(() => new Array(n).fill(0));
  const [base, setBase] = useState(() => {
    const fs = (start ?? []).filter((f) => f > 0);
    return fs.length && Math.max(...fs) > 5 ? Math.min(...fs) : 1;
  });
  const [custom, setCustom] = useState("");
  const shown = 5;

  const sounding = tuning.map((t) => t + capo);
  const auto = identifyChord(frets, tuning);
  const name = (custom.trim() || auto) ?? "";
  const notes = frets.map((f, i) => (f >= 0 ? noteName((sounding[i]! + f) % 12, accidentalForKey(auto ?? undefined)) : null)).filter(Boolean);

  useEffect(() => {
    // fingers follow the frets unless the player set them
    setFingers((prev) => prev.map((x, i) => (frets[i]! > 0 ? x : 0)));
  }, [frets]);

  const tap = (s: number, f: number) => {
    setFrets((p) => {
      const next = [...p];
      if (f === 0) next[s] = p[s] === 0 ? -1 : 0;
      else if (p[s] === f) {
        // tapping a dot again cycles its finger 1→2→3→4→none(auto)
        setFingers((fg) => {
          const g = [...fg];
          g[s] = ((g[s] ?? 0) % 4) + 1;
          return g;
        });
        return p;
      } else next[s] = f;
      return next;
    });
  };

  const save = async () => {
    if (!name) {
      showToast("Give the chord a name first");
      return;
    }
    const v = { ...voicingFromFrets(frets, fingers.some((x) => x) ? fingers : undefined) };
    const finger = fingers.some((x) => x) ? fingers : findVoicings(name, tuning, 8).find((s) => s.frets.join() === frets.join())?.fingers;
    const shape: Voicing = { ...v, fingers: finger ?? v.fingers };
    await db.shapes.put({
      id: crypto.randomUUID(),
      instrumentId: "guitar",
      createdBy: ownerForNewRow(),
      name,
      frets,
      fingers: shape.fingers as never,
      baseFret: shape.baseFret,
      visibility: "private",
    });
    onDone(name, shape);
    close();
    showToast(`Saved ${name} to your shapes`);
  };

  const rowsFrets = Array.from({ length: shown }, (_, r) => base + r);
  const order = Array.from({ length: n }, (_, i) => (prefs.leftHanded ? n - 1 - i : i));

  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title chordname">{name || "Unnamed chord"}</h2>
          <p className="row__sub num">{notes.length ? notes.join(" ") : "Tap the strings to place your fingers"}</p>
        </div>
        <button className="ringbtn" aria-label="Hear it" onClick={() => strum(frets, tuning, capo)} disabled={!frets.some((f) => f >= 0)}>
          <IconPlay />
        </button>
      </div>
      <div className="fbd" style={{ gridTemplateColumns: `30px repeat(${n}, 1fr)` }} role="group" aria-label="Fretboard">
        <span />
        {order.map((s) => (
          <span key={`l${s}`} className="fbd__name num">
            {noteName(sounding[s]! % 12, "sharp")}
          </span>
        ))}
        <span aria-hidden="true" />
        {order.map((s) => (
          <button
            key={`n${s}`}
            className="fbd__top"
            data-state={frets[s]! < 0 ? "muted" : frets[s] === 0 ? "open" : "fretted"}
            onClick={() => tap(s, 0)}
            aria-label={`String ${n - s}: ${frets[s]! < 0 ? "muted" : frets[s] === 0 ? "open" : `fret ${frets[s]}`}. Tap to switch between open and muted`}
          >
            {frets[s]! < 0 ? <span className="fb__x" /> : frets[s] === 0 ? <span className="fb__o" /> : <span className="fbd__hint" />}
          </button>
        ))}
        {rowsFrets.map((f, ri) => (
          <div key={f} className="fbd__row" data-nut={base === 1 && ri === 0 ? "" : undefined} data-inlay={[3, 5, 7, 9, 12, 15].includes(f) ? "" : undefined} style={{ gridColumn: "1 / -1", gridTemplateColumns: `30px repeat(${n}, 1fr)` }}>
            <span className="fbd__fret num">{f}</span>
            {order.map((s) => (
              <button
                key={`${f}-${s}`}
                className="fbd__cell"
                data-on={frets[s] === f}
                style={{ "--sw": `${(1 + ((n - 1 - s) * 0.28)).toFixed(2)}px` } as React.CSSProperties}
                onClick={() => tap(s, f)}
                aria-label={`String ${n - s}, fret ${f}${frets[s] === f ? ". Tap to change the finger" : ""}`}
              >
                {frets[s] === f && <span className="fbd__dot num">{fingers[s] || ""}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="fbd__tip">Tap a fret to place a finger. Tap the top row to switch a string between open (○) and muted (×). Tap a dot again to set its finger.</p>
      <div className="fb__pos">
        <button className="iconbtn iconbtn--plain" aria-label="Show lower frets" onClick={() => setBase((x) => Math.max(1, x - 1))} disabled={base <= 1}>
          <svg viewBox="0 0 24 24" width="20" height="20" className="icon" aria-hidden="true">
            <path d="M14.5 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="num">Frets {base}–{base + shown - 1}</span>
        <button className="iconbtn iconbtn--plain" aria-label="Show higher frets" onClick={() => setBase((x) => Math.min(17, x + 1))}>
          <svg viewBox="0 0 24 24" width="20" height="20" className="icon" aria-hidden="true">
            <path d="M9.5 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <label className="field">
        <span className="field__label">{auto ? `Gitara reads this as ${auto}. Name it differently?` : "Gitara can't name this one. What's it called?"}</span>
        <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={auto ?? "e.g. Cadd9"} maxLength={24} />
      </label>
      <div className="stack">
        <button className="btn btn--primary" onClick={() => void save()} disabled={!frets.some((f) => f >= 0)}>
          Use this chord
        </button>
        <button className="btn btn--ghost" onClick={() => setFrets(new Array(n).fill(-1))}>
          Clear
        </button>
      </div>
    </>
  );
}
