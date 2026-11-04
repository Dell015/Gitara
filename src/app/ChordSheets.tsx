import { useEffect, useMemo, useState } from "react";
import { findVoicings, SHAPE_KINDS, shapeKind, voicingFromFrets, type Voicing } from "../core/shapes";
import { accidentalForKey, chordTones, identifyChord, noteName, parseChord } from "../core/theory";
import { tuningName } from "../core/tunings";
import { strum } from "../audio/guitar";
import { ownerForNewRow } from "../data/auth";
import { db } from "../data/local-db";
import { ChordDiagram } from "../ui/ChordDiagram";
import { IconPlay } from "../ui/icons";
import { useOverlays } from "./overlays";
import { usePrefs } from "./prefs";

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
  // every shape we can find, grouped the way players think about them (open, moveable, barre, high)
  const grouped = useMemo(() => {
    const all = findVoicings(name, tuning, 24);
    return SHAPE_KINDS.map((k) => ({ ...k, shapes: all.filter((s) => shapeKind(s) === k.id) })).filter((g) => g.shapes.length);
  }, [name, tuning]);
  const shapes = useMemo(() => grouped.flatMap((g) => g.shapes), [grouped]);
  const parsed = parseChord(name);
  const spelled = parsed ? chordTones(parsed).map((pc) => noteName(pc, accidentalForKey(name))).join("  ") : "";
  const [sel, setSel] = useState(() => Math.max(0, current ? shapes.findIndex((s) => s.frets.join() === current.join()) : 0));
  const v = shapes[sel];
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title chordname">{name}</h2>
          <p className="row__sub">
            {tuningName(tuning)}
            {capo ? ` · capo ${capo}` : ""} · {shapes.length ? `${shapes.length} ${shapes.length === 1 ? "version" : "versions"}` : "no shape found"}
          </p>
          {spelled && <p className="row__sub num">{spelled}</p>}
        </div>
        {v && (
          <button className="ringbtn" aria-label={`Hear ${name}`} onClick={() => strum(v.frets, tuning, capo)}>
            <IconPlay />
          </button>
        )}
      </div>
      {shapes.length ? (
        grouped.map((g) => (
          <section key={g.id} className="shapegroup">
            <h3 className="shapegroup__title">
              {g.label} <span className="num">{g.shapes.length}</span>
            </h3>
            <p className="row__sub">{g.hint}</p>
            <div className="shapes" role="radiogroup" aria-label={`${g.label} for ${name}`}>
              {g.shapes.map((s) => {
                const i = shapes.indexOf(s);
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
                    <ChordDiagram voicing={s} name={name} leftHanded={prefs.leftHanded} size={84} highlight={i === sel} />
                    <span className="shape__frets num">{s.frets.map((f) => (f < 0 ? "x" : f)).join("")}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="sheet__text">Gitara couldn't find a shape for this in {tuningName(tuning)}. Build it on the fretboard.</p>
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
      <div className="fretboard" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {order.map((s) => (
          <button key={`n${s}`} className="fb__nut" data-state={frets[s]! < 0 ? "muted" : frets[s] === 0 ? "open" : "fretted"} onClick={() => tap(s, 0)} aria-label={`String ${n - s}: ${frets[s]! < 0 ? "muted" : frets[s] === 0 ? "open" : `fret ${frets[s]}`}`}>
            {frets[s]! < 0 ? <span className="fb__x" /> : frets[s] === 0 ? <span className="fb__o" /> : null}
          </button>
        ))}
        {rowsFrets.map((f) =>
          order.map((s) => (
            <button key={`${f}-${s}`} className="fb__cell" data-on={frets[s] === f} onClick={() => tap(s, f)} aria-label={`String ${n - s}, fret ${f}`}>
              {frets[s] === f && <span className="fb__dot">{fingers[s] || ""}</span>}
            </button>
          )),
        )}
      </div>
      <div className="fb__pos">
        <button className="btn btn--ghost" onClick={() => setBase((b) => Math.max(1, b - 1))} disabled={base <= 1}>
          Lower
        </button>
        <span className="num">Frets {base}–{base + shown - 1}</span>
        <button className="btn btn--ghost" onClick={() => setBase((b) => Math.min(17, b + 1))}>
          Higher
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
