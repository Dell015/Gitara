import { useEffect, useRef, useState } from "react";
import { strum } from "../../audio/guitar";
import { listen, type Listener, type MicState } from "../../audio/mic";
import { GUITAR_TUNINGS } from "../../core/instrument";
import { nearest, nearestString } from "../../core/pitch";
import { noteName } from "../../core/theory";
import { TopBar } from "../../ui/bits";
import { Stepper } from "./Version";
import { useNav } from "../nav";

const A4_KEY = "gitara.tuner.a4";
const TUNING_KEY = "gitara.tuner.tuning";

/**
 * Tuner (F2). The string buttons sit like tuning pegs on a headstock (three a side), so the two E
 * strings can't be mixed up. In tune is shown by a check and words as well as colour.
 */
export function Tuner() {
  const nav = useNav();
  const [state, setState] = useState<MicState>("idle");
  const [tuningId, setTuningId] = useState(() => localStorage.getItem(TUNING_KEY) ?? "standard");
  const [a4, setA4] = useState(() => Number(localStorage.getItem(A4_KEY)) || 440);
  const [target, setTarget] = useState<number | null>(null); // locked string, or auto
  const [reading, setReading] = useState<{ hz: number; string: number; cents: number; note: string } | null>(null);
  const [steady, setSteady] = useState(0);
  const mic = useRef<Listener | null>(null);
  const smooth = useRef<number | null>(null);
  const tuning = GUITAR_TUNINGS.find((t) => t.id === tuningId)?.tuning ?? GUITAR_TUNINGS[0]!.tuning;

  useEffect(() => () => mic.current?.stop(), []);
  useEffect(() => {
    try {
      localStorage.setItem(A4_KEY, String(a4));
      localStorage.setItem(TUNING_KEY, tuningId);
    } catch {
      /* ignore */
    }
  }, [a4, tuningId]);

  const startMic = async () => {
    setState("asking");
    try {
      mic.current = await listen((hz) => {
        if (!hz) {
          smooth.current = null;
          setReading(null);
          setSteady(0);
          return;
        }
        // light smoothing so the needle doesn't jitter; jump straight to a new note
        const prev = smooth.current;
        const s = prev && Math.abs(1200 * Math.log2(hz / prev)) < 60 ? prev * 0.65 + hz * 0.35 : hz;
        smooth.current = s;
        const ns = nearestString(s, tuning, a4);
        const str = target ?? ns.string;
        const cents = Math.round(1200 * Math.log2(s / (a4 * Math.pow(2, (tuning[str]! - 69) / 12))));
        const nn = nearest(s, a4);
        setReading({ hz: s, string: str, cents, note: noteName(nn.midi % 12) });
        setSteady((c) => (Math.abs(cents) <= 4 ? c + 1 : 0));
      });
      setState("listening");
    } catch (e) {
      setState(e instanceof Error && /denied|NotAllowed|Permission/i.test(e.name + e.message) ? "denied" : "unavailable");
    }
  };

  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const inTune = !!reading && Math.abs(reading.cents) <= 4 && steady >= 4;
  const left = tuning.slice(0, 3).map((_, i) => i);
  const right = tuning.slice(3).map((_, i) => i + 3);
  const peg = (i: number) => (
    <button
      key={i}
      className="peg"
      aria-pressed={target === i}
      data-active={reading?.string === i}
      onClick={() => {
        setTarget((t) => (t === i ? null : i));
        // a reference tone: the open string, the way it should sound
        const frets = tuning.map((_, k) => (k === i ? 0 : -1));
        strum(frets, tuning, 0, { length: 2.4 });
      }}
      aria-label={`String ${tuning.length - i}, ${noteName(tuning[i]! % 12)}. ${target === i ? "Locked" : "Tap to hear it and lock"}`}
    >
      <span className="peg__note">{noteName(tuning[i]! % 12)}</span>
      <span className="peg__num num">{tuning.length - i}</span>
    </button>
  );

  return (
    <>
      <TopBar onBack={nav.back} title="Tuner" />
      <div className="tuner">
        <div className="tuner__read" data-in={inTune} aria-live="polite">
          <span className="tuner__note">{reading ? noteName(tuning[reading.string]! % 12) : "–"}</span>
          <span className="tuner__state">
            {state !== "listening"
              ? " "
              : !reading
                ? "Play a string"
                : inTune
                  ? "In tune"
                  : reading.cents < 0
                    ? `${-reading.cents} cents flat: tighten`
                    : `${reading.cents} cents sharp: loosen`}
          </span>
          <svg className="gauge" viewBox="0 0 200 110" aria-hidden="true">
            <path className="gauge__arc" d="M20 100 A80 80 0 0 1 180 100" />
            {[-50, -25, 0, 25, 50].map((c) => {
              const a = ((c / 50) * 70 - 90) * (Math.PI / 180);
              return <line key={c} className="gauge__tick" data-zero={c === 0} x1={100 + Math.cos(a) * 72} y1={100 + Math.sin(a) * 72} x2={100 + Math.cos(a) * 82} y2={100 + Math.sin(a) * 82} />;
            })}
            <g className="gauge__needle" style={{ transform: `rotate(${(cents / 50) * 70}deg)` }}>
              <line x1="100" y1="100" x2="100" y2="30" />
              <circle cx="100" cy="100" r="5" />
            </g>
            {inTune && <path className="gauge__check" d="M88 80l8 8 16-18" />}
          </svg>
          {reading && <span className="tuner__hz num">{reading.hz.toFixed(1)} Hz · hearing {reading.note}</span>}
        </div>

        {state !== "listening" && (
          <div className="notice">
            {state === "denied" ? (
              <>
                <p className="notice__title">The microphone is blocked</p>
                <p className="notice__text">Allow the microphone for this site in your browser's settings (on iPhone: Settings, Safari, Microphone), then try again.</p>
              </>
            ) : state === "unavailable" ? (
              <>
                <p className="notice__title">No microphone found</p>
                <p className="notice__text">This device or browser can't listen. You can still tune by ear: tap a string to hear its note.</p>
              </>
            ) : (
              <>
                <p className="notice__title">The tuner listens through your microphone</p>
                <p className="notice__text">Nothing is recorded or sent anywhere. You can also tap a string to hear its note.</p>
              </>
            )}
            {state !== "unavailable" && (
              <button className="btn btn--primary" onClick={() => void startMic()} disabled={state === "asking"}>
                {state === "denied" ? "Try again" : "Start listening"}
              </button>
            )}
          </div>
        )}

        <div className="headstock" aria-label="Strings">
          <div className="headstock__side">{left.map(peg).reverse()}</div>
          <div className="headstock__body" aria-hidden="true" />
          <div className="headstock__side">{right.map(peg)}</div>
        </div>
        <p className="muted tuner__hint">{target === null ? "Gitara picks the string you play. Tap a string to lock it and hear its note." : "Locked to one string. Tap it again to go back to automatic."}</p>

        <div className="tuner__opts">
          <label className="field">
            <span className="field__label">Tuning</span>
            <select className="input" value={tuningId} onChange={(e) => setTuningId(e.target.value)}>
              {GUITAR_TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.tuning.map((m) => noteName(m % 12)).join(" ")})
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field__label">Reference pitch</span>
            <Stepper label="A4" value={`${a4} Hz`} onDown={() => setA4((v) => Math.max(430, v - 1))} onUp={() => setA4((v) => Math.min(450, v + 1))} />
          </div>
        </div>
      </div>
    </>
  );
}
