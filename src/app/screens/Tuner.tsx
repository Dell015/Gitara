import { useEffect, useMemo, useRef, useState } from "react";
import { strum } from "../../audio/guitar";
import { listen, micStateFor, type Listener, type MicState } from "../../audio/mic";
import { GUITAR_TUNINGS } from "../../core/instrument";
import { noteName } from "../../core/theory";
import { octaveOf, TuneTracker, type TuneReading } from "../../core/tune";
import { TopBar } from "../../ui/bits";
import { Stepper } from "./Version";
import { useNav } from "../nav";

const A4_KEY = "gitara.tuner.a4";
const TUNING_KEY = "gitara.tuner.tuning";
const TICKS = Array.from({ length: 21 }, (_, i) => (i - 10) * 5);

/**
 * Tuner (F2). While a string rings, a marker slides along a scale: left of the middle is flat, right is
 * sharp, and it settles in the middle (with a check and words, not just colour) when the string is in
 * tune. The last reading stays for a moment after the string dies away. The string buttons sit like
 * tuning pegs on a headstock (three a side), so the two E strings can't be mixed up; the one you are
 * playing shows how far off it is.
 */
export function Tuner() {
  const nav = useNav();
  const [state, setState] = useState<MicState>("idle");
  const [tuningId, setTuningId] = useState(() => localStorage.getItem(TUNING_KEY) ?? "standard");
  const [a4, setA4] = useState(() => Number(localStorage.getItem(A4_KEY)) || 440);
  const [target, setTarget] = useState<number | null>(null); // locked string, or auto
  const [reading, setReading] = useState<TuneReading | null>(null);
  const mic = useRef<Listener | null>(null);
  const tuning = GUITAR_TUNINGS.find((t) => t.id === tuningId)?.tuning ?? GUITAR_TUNINGS[0]!.tuning;
  const tracker = useRef(new TuneTracker(tuning, a4, target));
  const started = useRef(false);
  // the microphone is open but nothing at all has come through
  const heard = useRef(false);
  const [deaf, setDeaf] = useState(false);

  useEffect(() => {
    tracker.current.configure(tuning, a4, target);
    setReading(null);
  }, [tuning, a4, target]);
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
    if (started.current) return;
    started.current = true;
    setState("asking");
    try {
      heard.current = false;
      setDeaf(false);
      mic.current = await listen((hz, level) => {
        if (level > 0.002) heard.current = true;
        const r = tracker.current.update(hz, performance.now());
        setReading((prev) => (prev && r && prev.cents === r.cents && prev.held === r.held && prev.string === r.string && prev.inTune === r.inTune && Math.abs(prev.exact - r.exact) < 0.5 ? prev : r));
      });
      setState("listening");
      window.setTimeout(() => !heard.current && mic.current && setDeaf(true), 6000);
    } catch (e) {
      started.current = false;
      setState(micStateFor(e));
    }
  };

  // if the microphone was already allowed, start listening straight away: open, play a string, see the marker
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const p = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (alive && p?.state === "granted") void startMic();
      } catch {
        /* the button is there */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listening = state === "listening";
  const shown = useMemo(() => (listening ? reading : null), [listening, reading]);
  const mode = !shown ? "idle" : shown.inTune ? "in" : shown.cents < 0 ? "flat" : "sharp";
  const exact = shown ? Math.max(-50, Math.min(50, shown.exact)) : 0;
  const midi = shown ? tuning[shown.string]! : null;
  const left = tuning.slice(0, 3).map((_, i) => i);
  const right = tuning.slice(3).map((_, i) => i + 3);
  const abs = shown ? Math.abs(shown.cents) : 0;
  useEffect(() => {
    if (shown) setDeaf(false);
  }, [shown]);

  const peg = (i: number) => {
    const on = shown?.string === i;
    return (
      <button
        key={i}
        className="peg"
        aria-pressed={target === i}
        data-active={on}
        data-tune={on ? mode : undefined}
        onClick={() => {
          setTarget((t) => (t === i ? null : i));
          // a reference tone: the open string, the way it should sound
          const frets = tuning.map((_, k) => (k === i ? 0 : -1));
          strum(frets, tuning, 0, { length: 2.4 });
        }}
        aria-label={`String ${tuning.length - i}, ${noteName(tuning[i]! % 12)}. ${target === i ? "Locked" : "Tap to hear it and lock"}`}
      >
        <span className="peg__note">{noteName(tuning[i]! % 12)}</span>
        {on && shown ? (
          <span className="peg__off num">
            {mode === "in" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" className="icon" aria-label="In tune">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              `${shown.cents > 0 ? "+" : "−"}${abs}`
            )}
          </span>
        ) : (
          <span className="peg__num num">{tuning.length - i}</span>
        )}
      </button>
    );
  };

  const cue =
    !listening || !shown
      ? listening
        ? "Play a string and let it ring"
        : " "
      : mode === "in"
        ? "In tune"
        : mode === "flat"
          ? `${abs} cents flat: tighten the string`
          : `${abs} cents sharp: loosen the string`;

  return (
    <>
      <TopBar onBack={nav.back} title="Tuner" />
      <div className="tuner">
        <div className="tuner__read" data-mode={mode} data-held={!!shown?.held} aria-live="polite">
          <span className="tuner__note" data-idle={!shown}>
            {midi === null ? "–" : noteName(midi % 12)}
            {midi !== null && <span className="tuner__oct num">{octaveOf(midi)}</span>}
          </span>
          <span className="tuner__state">{cue}</span>

          <div className="tmeter" style={{ ["--pos" as string]: exact / 50 }}>
            <div className="tmeter__scale">
              {TICKS.map((c) => (
                <span key={c} className="tmeter__tick" data-major={c % 25 === 0} data-zero={c === 0} style={{ ["--at" as string]: c / 50 }} />
              ))}
              <span className="tmeter__zone" />
              <span className="tmeter__marker" data-on={!!shown} />
            </div>
            <div className="tmeter__ends" aria-hidden="true">
              <span>Flat</span>
              <span>Sharp</span>
            </div>
          </div>

          <span className="tuner__hz num">{shown ? `${shown.hz.toFixed(1)} Hz · target ${shown.targetHz.toFixed(1)} Hz` : " "}</span>
        </div>

        {!listening && (
          <div className="notice">
            {state === "insecure" ? (
              <>
                <p className="notice__title">The microphone needs a secure connection</p>
                <p className="notice__text">Browsers only allow the microphone on https pages (or on localhost). Open Gitara from its https address, not an http address on your network.</p>
              </>
            ) : state === "denied" ? (
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
            {state !== "unavailable" && state !== "insecure" && (
              <button className="btn btn--primary" onClick={() => void startMic()} disabled={state === "asking"}>
                {state === "denied" ? "Try again" : state === "asking" ? "Waiting for the microphone…" : "Start listening"}
              </button>
            )}
          </div>
        )}

        {listening && deaf && (
          <div className="notice" role="status">
            <p className="notice__title">No sound is reaching the microphone</p>
            <p className="notice__text">The microphone is on, but nothing has come through. Check that the right microphone is picked and not muted, and that no other app is using it. Then play a string close to it.</p>
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
