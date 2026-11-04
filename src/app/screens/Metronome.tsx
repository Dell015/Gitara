import { useEffect, useRef, useState } from "react";
import { audio } from "../../audio/guitar";
import { keepAwake, startMetronome, type Metronome as M } from "../../audio/metronome";
import { beatsPerBar } from "../../core/chart";
import { TIME_SIGNATURES } from "../../core/genres";
import { TapTempo } from "../../core/tempo";
import { Segmented, TopBar } from "../../ui/bits";
import { IconPause, IconPlay } from "../../ui/icons";
import { pulseLights } from "../../ui/lightShader";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { usePrefs } from "../prefs";
import { Stepper } from "./Version";

const KEY = "gitara.metronome.v1";

/** Metronome (F4). The beat shows as a lit dot, without movement: it's seen hundreds of times a minute. */
export function Metronome() {
  const nav = useNav();
  const { open } = useOverlays();
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}") as { bpm?: number; ts?: string; sub?: number; accent?: boolean };
    } catch {
      return {};
    }
  })();
  const [bpm, setBpm] = useState(saved.bpm ?? 90);
  const [ts, setTs] = useState(saved.ts ?? "4/4");
  const [sub, setSub] = useState(saved.sub ?? 1);
  const [accent, setAccent] = useState(saved.accent ?? true);
  const [trainer, setTrainer] = useState(false);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const m = useRef<M | null>(null);
  const release = useRef<() => void>(() => undefined);
  const tapper = useRef(new TapTempo());
  const bars = useRef(0);
  const bpb = beatsPerBar(ts);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ bpm, ts, sub, accent }));
    } catch {
      /* ignore */
    }
    m.current?.update({ bpm, beatsPerBar: bpb, subdivision: sub, accent });
  }, [bpm, ts, sub, accent, bpb]);
  useEffect(() => () => (m.current?.stop(), release.current()), []);

  const toggle = async () => {
    if (m.current) {
      m.current.stop();
      m.current = null;
      release.current();
      setRunning(false);
      setBeat(-1);
      return;
    }
    audio();
    bars.current = 0;
    m.current = startMetronome({
      bpm,
      beatsPerBar: bpb,
      subdivision: sub,
      accent,
      onBeat: (b) => {
        setBeat(b);
        pulseLights(b === 0 ? 1 : 0.4);
        if (b === 0) {
          bars.current++;
          // speed trainer: 5 bpm faster every 4 bars, up to 240
          const tp = trainerPrefs.current;
          if (trainerRef.current && bars.current > 1 && (bars.current - 1) % tp.metroEvery === 0) setBpm((v) => Math.min(tp.metroTarget, v + tp.metroStep));
        }
      },
    });
    setRunning(true);
    release.current = await keepAwake();
  };
  const trainerRef = useRef(trainer);
  trainerRef.current = trainer;
  const { trainer: tprefs } = usePrefs();
  const trainerPrefs = useRef(tprefs);
  trainerPrefs.current = tprefs;

  return (
    <>
      <TopBar onBack={nav.back} title="Metronome" />
      <div className="metro">
        <div className="metro__bpm">
          <button className="ringbtn ringbtn--lg" aria-label="Slower" onClick={() => setBpm((v) => Math.max(20, v - 1))}>
            <svg viewBox="0 0 24 24" width="22" height="22" className="icon" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <span className="metro__num num" aria-live="polite">
            {bpm}
            <span className="metro__unit">bpm</span>
          </span>
          <button className="ringbtn ringbtn--lg" aria-label="Faster" onClick={() => setBpm((v) => Math.min(300, v + 1))}>
            <svg viewBox="0 0 24 24" width="22" height="22" className="icon" aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </div>
        <input className="range" type="range" min={20} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" />
        <div className="metro__beats" aria-hidden="true">
          {Array.from({ length: bpb }, (_, i) => (
            <span key={i} className="metro__dot" data-on={i === beat} data-accent={accent && i === 0} />
          ))}
        </div>
        <div className="stack metro__main">
          <button className="btn btn--primary btn--big" onClick={() => void toggle()} aria-pressed={running}>
            {running ? <IconPause /> : <IconPlay />} {running ? "Stop" : "Start"}
          </button>
          <button
            className="btn btn--secondary btn--big tapbtn"
            onPointerDown={(e) => {
              e.preventDefault();
              const b = tapper.current.tap(e.timeStamp);
              if (b) setBpm(b);
            }}
          >
            Tap tempo
          </button>
        </div>
        <div className="form__grid">
          <label className="field">
            <span className="field__label">Time signature</span>
            <select className="input" value={ts} onChange={(e) => setTs(e.target.value)}>
              {TIME_SIGNATURES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field__label">Accent the first beat</span>
            <Segmented
              label="Accent"
              value={accent ? "on" : "off"}
              onChange={(v) => setAccent(v === "on")}
              options={[
                { id: "on", label: "On" },
                { id: "off", label: "Off" },
              ]}
            />
          </div>
          <div className="field field--wide">
            <span className="field__label">Clicks per beat</span>
            <Segmented
              label="Subdivision"
              value={String(sub)}
              onChange={(v) => setSub(Number(v))}
              options={[
                { id: "1", label: "1" },
                { id: "2", label: "2" },
                { id: "3", label: "3" },
                { id: "4", label: "4" },
              ]}
            />
          </div>
          <div className="field field--wide">
            <span className="field__label">Speed trainer</span>
            <div className="chips chips--wrap">
              <button className="chip" aria-pressed={trainer} onClick={() => setTrainer((t) => !t)}>
                {trainer ? `On: +${tprefs.metroStep} bpm every ${tprefs.metroEvery} bars, up to ${tprefs.metroTarget}` : "Off"}
              </button>
              <button className="chip chip--sub" onClick={() => open({ kind: "trainer", mode: "metronome", bpm })}>
                Settings
              </button>
            </div>
          </div>
          <div className="field">
            <span className="field__label">Fine tempo</span>
            <Stepper label="±5" value={String(bpm)} onDown={() => setBpm((v) => Math.max(20, v - 5))} onUp={() => setBpm((v) => Math.min(300, v + 5))} />
          </div>
        </div>
      </div>
    </>
  );
}
