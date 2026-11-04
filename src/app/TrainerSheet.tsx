import { Stepper } from "./screens/Version";
import { setPrefs, TRAINER_DEFAULTS, usePrefs, type TrainerPrefs } from "./prefs";
import { useOverlays } from "./overlays";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Speed trainer settings. "Start slow, speed up gradually" (§5.8), the way the player wants it. */
export function TrainerSheet({ mode, bpm, onStart }: { mode: "playalong" | "metronome"; bpm?: number; onStart?: () => void }) {
  const { close } = useOverlays();
  const { trainer } = usePrefs();
  const set = (p: Partial<TrainerPrefs>) => setPrefs({ trainer: { ...trainer, ...p } });
  const presets: { label: string; p: Partial<TrainerPrefs> }[] =
    mode === "playalong"
      ? [
          { label: "Gentle", p: { start: 0.6, step: 0.05, every: 2, target: 1, thenStop: 0 } },
          { label: "Standard", p: { start: 0.7, step: 0.05, every: 1, target: 1, thenStop: 0 } },
          { label: "Push past it", p: { start: 0.8, step: 0.05, every: 1, target: 1.15, thenStop: 2 } },
        ]
      : [
          { label: "Gentle", p: { metroStep: 2, metroEvery: 8 } },
          { label: "Standard", p: { metroStep: 5, metroEvery: 4 } },
          { label: "Fast climb", p: { metroStep: 10, metroEvery: 2 } },
        ];
  const base = bpm ?? 90;
  // how long until the target: loops needed (play-along) or bars (metronome)
  const climb =
    mode === "playalong"
      ? Math.max(0, Math.ceil((trainer.target - trainer.start) / Math.max(0.01, trainer.step)) * trainer.every)
      : Math.max(0, Math.ceil((trainer.metroTarget - base) / Math.max(1, trainer.metroStep)) * trainer.metroEvery);
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">Speed trainer</h2>
          <p className="row__sub">
            {mode === "playalong"
              ? `Loop a section from ${pct(trainer.start)} up to ${pct(trainer.target)} (${Math.round(base * trainer.start)} → ${Math.round(base * trainer.target)} bpm), ${pct(trainer.step)} faster every ${trainer.every === 1 ? "time" : `${trainer.every} times`} round. About ${climb} loops to get there.`
              : `${trainer.metroStep} bpm faster every ${trainer.metroEvery} bars, up to ${trainer.metroTarget} bpm. About ${climb} bars from ${base} bpm.`}
          </p>
        </div>
      </div>
      <div className="chips chips--wrap">
        {presets.map((x) => (
          <button key={x.label} className="chip" onClick={() => set(x.p)}>
            {x.label}
          </button>
        ))}
        <button className="chip chip--sub" onClick={() => setPrefs({ trainer: TRAINER_DEFAULTS })}>
          Reset
        </button>
      </div>
      {mode === "playalong" ? (
        <div className="trainer">
          <Stepper label="Start at" value={pct(trainer.start)} onDown={() => set({ start: Math.max(0.3, round(trainer.start - 0.05)) })} onUp={() => set({ start: Math.min(trainer.target, round(trainer.start + 0.05)) })} />
          <Stepper label="Add" value={pct(trainer.step)} onDown={() => set({ step: Math.max(0.01, round(trainer.step - 0.01)) })} onUp={() => set({ step: Math.min(0.2, round(trainer.step + 0.01)) })} />
          <Stepper label="Every" value={`${trainer.every} loop${trainer.every > 1 ? "s" : ""}`} onDown={() => set({ every: Math.max(1, trainer.every - 1) })} onUp={() => set({ every: Math.min(8, trainer.every + 1) })} />
          <Stepper label="Up to" value={pct(trainer.target)} onDown={() => set({ target: Math.max(trainer.start, round(trainer.target - 0.05)) })} onUp={() => set({ target: Math.min(1.5, round(trainer.target + 0.05)) })} />
          <Stepper
            label="Then"
            value={trainer.thenStop ? `stop after ${trainer.thenStop}` : "keep looping"}
            onDown={() => set({ thenStop: Math.max(0, trainer.thenStop - 1) })}
            onUp={() => set({ thenStop: Math.min(8, trainer.thenStop + 1) })}
          />
        </div>
      ) : (
        <div className="trainer">
          <Stepper label="Add" value={`${trainer.metroStep} bpm`} onDown={() => set({ metroStep: Math.max(1, trainer.metroStep - 1) })} onUp={() => set({ metroStep: Math.min(20, trainer.metroStep + 1) })} />
          <Stepper label="Every" value={`${trainer.metroEvery} bars`} onDown={() => set({ metroEvery: Math.max(1, trainer.metroEvery / 2 >= 1 ? trainer.metroEvery / 2 : 1) })} onUp={() => set({ metroEvery: Math.min(16, trainer.metroEvery * 2) })} />
          <Stepper label="Up to" value={`${trainer.metroTarget} bpm`} onDown={() => set({ metroTarget: Math.max(40, trainer.metroTarget - 5) })} onUp={() => set({ metroTarget: Math.min(300, trainer.metroTarget + 5) })} />
        </div>
      )}
      {onStart && (
        <div className="stack">
          <button
            className="btn btn--primary"
            onClick={() => {
              close();
              onStart();
            }}
          >
            Start training
          </button>
        </div>
      )}
    </>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;
