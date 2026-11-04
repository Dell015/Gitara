import { useEffect, useMemo, useRef, useState } from "react";
import { audio } from "../../audio/guitar";
import { keepAwake, startMetronome, tickSound, type Metronome as M } from "../../audio/metronome";
import {
  accentsForConfig,
  applySetup,
  DEFAULT_CONFIG,
  MAX_BEATS,
  meterBeats,
  meterDef,
  meterGroupings,
  METERS,
  nextLevel,
  rhythmFor,
  RHYTHMS,
  sanitizeConfig,
  SETUPS,
  SOUNDS,
  tempoWord,
  TEMPO_MARKS,
  type Gap,
  type Level,
  type MetroConfig,
} from "../../core/metro";
import { TapTempo } from "../../core/tempo";
import { TopBar } from "../../ui/bits";
import { IconPause, IconPlay } from "../../ui/icons";
import { pulseLights } from "../../ui/lightShader";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { usePrefs } from "../prefs";
import { Stepper } from "./Version";

const KEY = "gitara.metronome.v2";
const OLD_KEY = "gitara.metronome.v1";

function load(): MetroConfig {
  try {
    const v2 = localStorage.getItem(KEY);
    if (v2) return sanitizeConfig(JSON.parse(v2) as Partial<MetroConfig>);
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "null") as { bpm?: number; ts?: string; sub?: number; accent?: boolean } | null;
    if (old) {
      const meter = meterDef(old.ts ?? "")?.id ?? "4/4";
      const c = sanitizeConfig({ ...DEFAULT_CONFIG, bpm: old.bpm, meter, rhythm: ["beat", "eighths", "triplets", "sixteenths"][(old.sub ?? 1) - 1] });
      return old.accent === false ? { ...c, accents: c.accents.map(() => 2 as Level) } : c;
    }
  } catch {
    /* ignore */
  }
  return sanitizeConfig(null);
}

const GAPS: { label: string; gap: Gap | null }[] = [
  { label: "Off", gap: null },
  { label: "1 on, 1 silent", gap: { play: 1, mute: 1 } },
  { label: "2 on, 1 silent", gap: { play: 2, mute: 1 } },
  { label: "3 on, 1 silent", gap: { play: 3, mute: 1 } },
  { label: "2 on, 2 silent", gap: { play: 2, mute: 2 } },
  { label: "4 on, 4 silent", gap: { play: 4, mute: 4 } },
];
const DROPS = [0, 0.15, 0.3, 0.5];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Metronome. Every beat has its own level, every beat can hold a rhythm, and the practice options (silent bars, random drop-outs, speed trainer) keep you honest. The beat shows as a lit bar, with no movement: it's seen hundreds of times a minute. */
export function Metronome() {
  const nav = useNav();
  const { open } = useOverlays();
  const { trainer: tprefs } = usePrefs();
  const [cfg, setCfg] = useState<MetroConfig>(load);
  const [trainer, setTrainer] = useState(false);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [silent, setSilent] = useState(false);
  const [bar, setBar] = useState(0);
  const [secs, setSecs] = useState(0);
  const m = useRef<M | null>(null);
  const release = useRef<() => void>(() => undefined);
  const tapper = useRef(new TapTempo());
  const live = useRef({ cfg, trainer, tprefs });
  live.current = { cfg, trainer, tprefs };

  const hits = useMemo(() => rhythmFor(cfg.rhythm).hits, [cfg.rhythm]);
  const groups = useMemo(() => {
    const gs = meterGroupings(cfg.meter, cfg.eighths, cfg.custom);
    return gs[Math.min(cfg.grouping, gs.length - 1)]!;
  }, [cfg.meter, cfg.eighths, cfg.custom, cfg.grouping]);
  const def = meterDef(cfg.meter);
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

  const set = (p: Partial<MetroConfig>) => setCfg((c) => ({ ...c, ...p }));
  /** a change of meter, grouping or counting resets the accents to that meter's natural feel */
  const setMeter = (p: Partial<Pick<MetroConfig, "meter" | "grouping" | "eighths" | "custom">>) =>
    setCfg((c) => {
      const next = { ...c, grouping: 0, ...p, ...(p.meter && p.meter !== c.meter ? { eighths: false } : {}) };
      return { ...next, accents: accentsForConfig(next) };
    });
  const setBpm = (f: (v: number) => number) => setCfg((c) => ({ ...c, bpm: Math.min(300, Math.max(20, Math.round(f(c.bpm)))) }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    m.current?.update({ bpm: cfg.bpm, accents: cfg.accents, hits, sound: cfg.sound, volume: cfg.volume, gap: cfg.gap, drop: cfg.drop });
  }, [cfg, hits]);
  useEffect(() => () => (m.current?.stop(), release.current()), []);

  // time spent in this run
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    setSecs(0);
    const id = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = async () => {
    if (m.current) {
      m.current.stop();
      m.current = null;
      release.current();
      setRunning(false);
      setBeat(-1);
      setSilent(false);
      return;
    }
    audio();
    setBar(0);
    const c = live.current.cfg;
    m.current = startMetronome({
      bpm: c.bpm,
      accents: c.accents,
      hits,
      sound: c.sound,
      volume: c.volume,
      gap: c.gap,
      drop: c.drop,
      onBeat: (b, br, mute) => {
        const { cfg: now, trainer: on, tprefs: tp } = live.current;
        setBeat(b);
        setSilent(mute);
        if (!mute) {
          pulseLights(b === 0 ? 1 : 0.4);
          if (now.vibrate && canVibrate) navigator.vibrate(b === 0 ? 18 : 9);
        }
        if (b === 0) {
          setBar(br);
          // speed trainer: a bit faster every few bars, up to the target
          if (on && br > 0 && br % tp.metroEvery === 0) setBpm((v) => Math.min(tp.metroTarget, v + tp.metroStep));
        }
      },
    });
    setRunning(true);
    release.current = await keepAwake();
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  // keyboard: Space starts and stops, arrows nudge the tempo (Shift for five)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, button, [contenteditable]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggleRef.current();
      } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        setBpm((v) => v + (e.shiftKey ? 5 : 1));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        setBpm((v) => v - (e.shiftKey ? 5 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const preview = (s: (typeof SOUNDS)[number]["id"]) => {
    const { ctx } = audio();
    tickSound(s, ctx.currentTime + 0.02, 3, 1, cfg.volume);
    tickSound(s, ctx.currentTime + 0.32, 2, 1, cfg.volume);
  };

  // pad index → which group it starts, for the gap between groups
  const starts = new Set<number>();
  groups.reduce((acc, g) => (starts.add(acc), acc + g), 0);
  const beats = cfg.accents.length;
  const dropLabel = (d: number) => (d === 0 ? "Off" : `${Math.round(d * 100)}%`);

  return (
    <>
      <TopBar onBack={nav.back} title="Metronome" />
      <div className="metro">
        <div className="metro__bpm">
          <button className="ringbtn ringbtn--lg" aria-label="Slower" onClick={() => setBpm((v) => v - 1)}>
            <svg viewBox="0 0 24 24" width="22" height="22" className="icon" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <span className="metro__num num" aria-live="polite">
            {cfg.bpm}
            <span className="metro__unit">{tempoWord(cfg.bpm)} · bpm</span>
          </span>
          <button className="ringbtn ringbtn--lg" aria-label="Faster" onClick={() => setBpm((v) => v + 1)}>
            <svg viewBox="0 0 24 24" width="22" height="22" className="icon" aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </div>
        <input className="range" type="range" min={20} max={300} value={cfg.bpm} onChange={(e) => set({ bpm: Number(e.target.value) })} aria-label="Tempo" />
        <div className="chips" role="group" aria-label="Tempo marks">
          {TEMPO_MARKS.map((t) => (
            <button key={t.label} className="chip chip--sub" aria-pressed={tempoWord(cfg.bpm) === t.label} onClick={() => set({ bpm: t.bpm })}>
              {t.label} <span className="num muted">{t.bpm}</span>
            </button>
          ))}
        </div>

        <div className="metro__bar" data-silent={silent} role="group" aria-label={`Bar of ${beats} beats. Tap a beat to change how strong it is.`}>
          {cfg.accents.map((lv, i) => (
            <button
              key={i}
              className="metro__pad"
              data-level={lv}
              data-on={i === beat}
              data-start={starts.has(i) && i > 0}
              aria-label={`Beat ${i + 1}: ${["silent", "soft", "normal", "accent"][lv]}`}
              onClick={() => set({ accents: cfg.accents.map((a, k) => (k === i ? nextLevel(a) : a)) })}
            >
              <span className="metro__fill" />
              <span className="metro__n num">{i + 1}</span>
            </button>
          ))}
        </div>
        <p className="metro__status muted num" aria-live="off">
          {running ? (silent && cfg.gap ? "Silent bar: keep the time yourself" : `Bar ${bar + 1} · ${clock(secs)}`) : "Tap a beat to make it stronger, softer or silent"}
        </p>

        <div className="stack metro__main">
          <button className="btn btn--primary btn--big" onClick={() => void toggle()} aria-pressed={running}>
            {running ? <IconPause /> : <IconPlay />} {running ? "Stop" : "Start"}
          </button>
          <button
            className="btn btn--secondary btn--big tapbtn"
            onPointerDown={(e) => {
              e.preventDefault();
              const b = tapper.current.tap(e.timeStamp);
              if (b) set({ bpm: b });
            }}
          >
            Tap tempo
          </button>
        </div>

        <section className="block" aria-label="Setups">
          <h2 className="h3">Setups</h2>
          <div className="metro__cards">
            {SETUPS.map((s) => (
              <button key={s.id} className="metro__card" onClick={() => setCfg((c) => applySetup(c, s))}>
                <span className="metro__cardtitle">{s.label}</span>
                <span className="metro__cardnote">{s.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="block" aria-label="Time signature">
          <h2 className="h3">Time signature</h2>
          <div className="chips chips--wrap" role="radiogroup" aria-label="Time signature">
            {METERS.map((t) => (
              <button key={t.id} className="chip chip--sub num" role="radio" aria-checked={cfg.meter === t.id} aria-pressed={cfg.meter === t.id} onClick={() => setMeter({ meter: t.id })}>
                {t.id}
              </button>
            ))}
            <button className="chip chip--sub" role="radio" aria-checked={cfg.meter === "custom"} aria-pressed={cfg.meter === "custom"} onClick={() => setMeter({ meter: "custom" })}>
              Custom
            </button>
          </div>
          {meterGroupings(cfg.meter, cfg.eighths, cfg.custom).length > 1 && (
            <div className="metro__sub">
              <span className="field__label">Group the beats</span>
              <div className="chips chips--wrap">
                {meterGroupings(cfg.meter, cfg.eighths, cfg.custom).map((g, i) => (
                  <button key={g.join("+")} className="chip chip--sub num" aria-pressed={cfg.grouping === i} onClick={() => setMeter({ grouping: i })}>
                    {g.join(" + ")}
                  </button>
                ))}
              </div>
            </div>
          )}
          {def?.compound && (
            <div className="metro__sub">
              <span className="field__label">Counting</span>
              <div className="chips chips--wrap">
                <button className="chip chip--sub" aria-pressed={!cfg.eighths} onClick={() => setMeter({ eighths: false })}>
                  {def.beats} big beats
                </button>
                <button className="chip chip--sub" aria-pressed={cfg.eighths} onClick={() => setMeter({ eighths: true })}>
                  Every eighth ({def.compound})
                </button>
              </div>
            </div>
          )}
          {cfg.meter === "custom" && (
            <div className="metro__sub">
              <span className="field__label">Beats in the bar</span>
              <Stepper label="Beats" value={String(cfg.custom)} onDown={() => setMeter({ custom: Math.max(1, cfg.custom - 1) })} onUp={() => setMeter({ custom: Math.min(MAX_BEATS, cfg.custom + 1) })} />
            </div>
          )}
          <p className="muted metro__hint">
            {meterBeats(cfg.meter, cfg.eighths, cfg.custom)} clicks a bar. The bpm counts {cfg.meter.endsWith("/8") && !(def?.compound && !cfg.eighths) ? "eighth notes" : def?.compound ? "dotted quarters" : "quarter notes"}.
          </p>
        </section>

        <section className="block" aria-label="Rhythm">
          <h2 className="h3">Inside each beat</h2>
          <div className="metro__cards metro__cards--rhythm" role="radiogroup" aria-label="Rhythm inside each beat">
            {RHYTHMS.map((r) => (
              <button key={r.id} className="metro__card metro__rcard" role="radio" aria-checked={cfg.rhythm === r.id} aria-pressed={cfg.rhythm === r.id} onClick={() => set({ rhythm: r.id })}>
                <svg viewBox="0 0 64 20" className="metro__ticks" aria-hidden="true">
                  <line x1="2" y1="17" x2="62" y2="17" className="metro__tickline" />
                  <line x1="62" y1="6" x2="62" y2="17" className="metro__tickline" />
                  {r.hits.map((h) => (
                    <rect key={h.at} x={2 + h.at * 60 - 1.5} y={h.at === 0 ? 3 : 8} width="3" height={h.at === 0 ? 14 : 9} rx="1.5" className="metro__tick" />
                  ))}
                </svg>
                <span className="metro__cardtitle">{r.label}</span>
                <span className="metro__cardnote">{r.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="block" aria-label="Sound">
          <h2 className="h3">Sound</h2>
          <div className="chips chips--wrap" role="radiogroup" aria-label="Click sound">
            {SOUNDS.map((s) => (
              <button
                key={s.id}
                className="chip chip--sub"
                role="radio"
                aria-checked={cfg.sound === s.id}
                aria-pressed={cfg.sound === s.id}
                onClick={() => {
                  set({ sound: s.id });
                  preview(s.id);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="metro__vol">
            <span className="field__label">Volume</span>
            <input className="range" type="range" min={10} max={100} value={Math.round(cfg.volume * 100)} onChange={(e) => set({ volume: Number(e.target.value) / 100 })} aria-label="Volume" />
          </label>
        </section>

        <section className="block" aria-label="Practice">
          <h2 className="h3">Practice</h2>
          <div className="metro__sub">
            <span className="field__label">Speed trainer</span>
            <div className="chips chips--wrap">
              <button className="chip" aria-pressed={trainer} onClick={() => setTrainer((t) => !t)}>
                {trainer ? `On: +${tprefs.metroStep} bpm every ${tprefs.metroEvery} bars, up to ${tprefs.metroTarget}` : "Off"}
              </button>
              <button className="chip chip--sub" onClick={() => open({ kind: "trainer", mode: "metronome", bpm: cfg.bpm })}>
                Settings
              </button>
            </div>
          </div>
          <div className="metro__sub">
            <span className="field__label">Silent bars: the click stops and you hold the tempo</span>
            <div className="chips chips--wrap">
              {GAPS.map((g) => (
                <button key={g.label} className="chip chip--sub" aria-pressed={(cfg.gap?.play ?? 0) === (g.gap?.play ?? 0) && (cfg.gap?.mute ?? 0) === (g.gap?.mute ?? 0)} onClick={() => set({ gap: g.gap })}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="metro__sub">
            <span className="field__label">Random drop-outs: beats go missing now and then</span>
            <div className="chips chips--wrap">
              {DROPS.map((d) => (
                <button key={d} className="chip chip--sub num" aria-pressed={cfg.drop === d} onClick={() => set({ drop: d })}>
                  {dropLabel(d)}
                </button>
              ))}
            </div>
          </div>
          {canVibrate && (
            <div className="metro__sub">
              <span className="field__label">Feel the beat</span>
              <div className="chips chips--wrap">
                <button className="chip chip--sub" aria-pressed={cfg.vibrate} onClick={() => set({ vibrate: !cfg.vibrate })}>
                  Vibrate on each beat
                </button>
              </div>
            </div>
          )}
          <div className="metro__sub">
            <span className="field__label">Fine tempo</span>
            <Stepper label="±5" value={String(cfg.bpm)} onDown={() => setBpm((v) => v - 5)} onUp={() => setBpm((v) => v + 5)} />
          </div>
        </section>
        <p className="muted metro__hint metro__keys">On a keyboard: Space starts and stops, the arrow keys change the tempo (Shift for 5).</p>
      </div>
    </>
  );
}
