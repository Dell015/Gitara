import { useEffect, useMemo, useRef, useState } from "react";
import { strum } from "../../audio/guitar";
import { listenSpectrum, micStateFor, type Listener, type MicState } from "../../audio/mic";
import { ChordTracker, chromaFromDb, notesText, type Heard } from "../../core/chordlisten";
import { GUITAR } from "../../core/instrument";
import { findVoicings } from "../../core/shapes";
import type { Accidental } from "../../core/theory";
import { TopBar } from "../../ui/bits";
import { ChordDiagram } from "../../ui/ChordDiagram";
import { IconPlay } from "../../ui/icons";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { usePrefs } from "../prefs";

/**
 * Chord listener: play a chord on your guitar and Gitara names it. Strum, let it ring, and the name
 * appears with its chord box. Listening happens on the device; nothing is recorded or sent anywhere.
 */
export function Listen() {
  const nav = useNav();
  const { open } = useOverlays();
  const prefs = usePrefs();
  const acc: Accidental = prefs.accidentals === "flat" ? "flat" : "sharp";
  const tuning = GUITAR.standardTuning;

  const [state, setState] = useState<MicState>("idle");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [level, setLevel] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const mic = useRef<Listener | null>(null);
  const tracker = useRef(new ChordTracker(acc));
  // a chord only goes in "You played" once it has held for about half a second, so the in-between names while one chord blends into the next are skipped
  const lastName = useRef<string | null>(null);
  const held = useRef(0);
  // the microphone is open but nothing at all has come through
  const gotSound = useRef(false);
  const [deaf, setDeaf] = useState(false);

  useEffect(() => () => mic.current?.stop(), []);
  // a changed sharps/flats setting starts a fresh tracker
  useEffect(() => {
    tracker.current = new ChordTracker(acc);
  }, [acc]);

  const start = async () => {
    setState("asking");
    try {
      tracker.current.reset();
      gotSound.current = false;
      setDeaf(false);
      mic.current = await listenSpectrum((db, sampleRate, peak) => {
        if (peak > 0.002) gotSound.current = true;
        const loud = peak > 0.02;
        setLevel(Math.min(1, peak * 3));
        const r = chromaFromDb(db, sampleRate);
        const h = tracker.current.update(r, loud);
        setHeard((prev) => (prev?.name === h?.name && prev?.alternatives.join() === h?.alternatives.join() ? prev : h));
        if (!h) {
          lastName.current = null;
          held.current = 0;
        } else if (h.name !== lastName.current) {
          lastName.current = h.name;
          held.current = 1;
        } else if (++held.current === 5) {
          setHistory((p) => [h.name, ...p.filter((x) => x !== h.name)].slice(0, 8));
        }
      });
      setState("listening");
      window.setTimeout(() => !gotSound.current && mic.current && setDeaf(true), 6000);
    } catch (e) {
      setState(micStateFor(e));
    }
  };
  const stop = () => {
    mic.current?.stop();
    mic.current = null;
    tracker.current.reset();
    lastName.current = null;
    held.current = 0;
    setHeard(null);
    setLevel(0);
    setDeaf(false);
    setState("idle");
  };

  const shape = useMemo(() => (heard ? findVoicings(heard.name, tuning, 1)[0] : undefined), [heard, tuning]);
  const listening = state === "listening";

  return (
    <>
      <TopBar onBack={nav.back} title="Chord listener" />
      <div className="listen">
        <div className="listen__stage" data-heard={!!heard} data-on={listening} aria-live="polite">
          {!listening ? (
            <>
              <span className="listen__name listen__name--idle">Play a chord</span>
              <span className="listen__state">Gitara listens and tells you what it is</span>
            </>
          ) : heard ? (
            <>
              <span className="listen__name chordname">{heard.name}</span>
              <span className="listen__state num">{notesText(heard.notes, acc)}</span>
              {heard.alternatives.length > 0 && <span className="listen__alt">Could also be {heard.alternatives.join(" or ")}</span>}
            </>
          ) : (
            <>
              <span className="listen__name listen__name--idle">Start playing</span>
              <span className="listen__state">Strum all the strings and let the chord ring</span>
            </>
          )}
          {listening && (
            <span className="listen__meter" aria-hidden="true">
              <span className="listen__meterfill" style={{ transform: `scaleX(${level})` }} />
            </span>
          )}
        </div>

        {listening && heard && shape && (
          <div className="listen__shape">
            <ChordDiagram voicing={shape} name={heard.name} leftHanded={prefs.leftHanded} size={120} />
            <div className="listen__actions">
              <button className="btn btn--secondary" onClick={() => strum(shape.frets, tuning, 0)}>
                <IconPlay /> Hear it
              </button>
              <button className="btn btn--secondary" onClick={() => open({ kind: "chord", name: heard.name, tuning, capo: 0 })}>
                See all versions
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <section className="block" aria-label="Chords you played">
            <h2 className="h3">You played</h2>
            <div className="chips chips--wrap">
              {history.map((n) => (
                <button key={n} className="chip" onClick={() => open({ kind: "chord", name: n, tuning, capo: 0 })}>
                  {n}
                </button>
              ))}
            </div>
          </section>
        )}

        {state === "insecure" && (
          <div className="notice">
            <p className="notice__title">The microphone needs a secure connection</p>
            <p className="notice__text">Browsers only allow the microphone on https pages (or on localhost). Open Gitara from its https address, not an http address on your network.</p>
          </div>
        )}
        {listening && deaf && !gotSound.current && (
          <div className="notice" role="status">
            <p className="notice__title">No sound is reaching the microphone</p>
            <p className="notice__text">The microphone is on, but nothing has come through. Check that the right microphone is picked and not muted, and that no other app is using it. Then strum close to it.</p>
          </div>
        )}
        {state === "denied" && (
          <div className="notice">
            <p className="notice__title">The microphone is blocked</p>
            <p className="notice__text">Allow the microphone for this site in your browser's settings (on iPhone: Settings, Safari, Microphone), then try again.</p>
          </div>
        )}
        {state === "unavailable" && (
          <div className="notice">
            <p className="notice__title">No microphone found</p>
            <p className="notice__text">This device or browser can't listen. You can still look chords up in the Chord finder.</p>
            <button className="btn btn--secondary" onClick={() => nav.replace({ name: "chords" })}>
              Open the Chord finder
            </button>
          </div>
        )}

        <div className="stack">
          {listening ? (
            <button className="btn btn--secondary" onClick={stop}>
              Stop listening
            </button>
          ) : state !== "unavailable" && state !== "insecure" ? (
            <button className="btn btn--primary btn--big" onClick={() => void start()} disabled={state === "asking"}>
              {state === "denied" ? "Try again" : state === "asking" ? "Waiting for the microphone…" : "Start listening"}
            </button>
          ) : null}
        </div>

        <p className="muted listen__tip">
          Works best with one guitar in a quiet room. A single strum that rings out is clearer than fast changes. Nothing is recorded: Gitara only reads the sound live, on your device.
        </p>
      </div>
    </>
  );
}
