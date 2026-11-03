import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { HeatMark, type Heat } from "../ui/HeatMark";
import { IconDown, IconJam, IconPause, IconPlay, IconPlaylists, IconPlus, IconSongs, IconTuner } from "../ui/icons";
import { Sheet } from "../ui/Sheet";

const CHORDS = ["Am", "F", "C", "G"] as const;
const BEATS = 4;

const SONGS: { title: string; artist: string; key: string; capo: number; heat: Heat }[] = [
  { title: "Midnight Ember", artist: "Gitara Demo", key: "Am", capo: 0, heat: "performing" },
  { title: "Slow Tide", artist: "Sample Artist", key: "G", capo: 2, heat: "learning" },
  { title: "Paper Lanterns", artist: "Sample Artist", key: "D", capo: 0, heat: "planning" },
];

const TABS = [
  { id: "songs", label: "Songs", icon: <IconSongs /> },
  { id: "playlists", label: "Playlists", icon: <IconPlaylists /> },
  { id: "jam", label: "Jam", icon: <IconJam /> },
  { id: "tuner", label: "Tuner", icon: <IconTuner /> },
] as const;

/** Design-system preview: every component in context, with the one signature motion running. */
export default function Preview() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("songs");
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(84);
  const [step, setStep] = useState(0); // counts beats
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setStep((s) => s + 1), 60000 / bpm);
    return () => window.clearInterval(id);
  }, [playing, bpm]);

  const chord = Math.floor(step / BEATS) % CHORDS.length;
  const beat = step % BEATS;
  const progress = ((chord * BEATS + beat + (playing ? 1 : 0)) / (CHORDS.length * BEATS)) || 0;

  const glow = useMemo(
    () => ({ "--bpm": bpm, "--chord": chord, "--on": playing ? 1 : 0 }) as CSSProperties,
    [bpm, chord, playing],
  );

  return (
    <div className="shell" style={glow}>
      <div className="glow" aria-hidden="true">
        <div className="glow__move">
          <div className="glow__breathe" />
        </div>
      </div>

      <nav className="tabbar glass" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="screen">
        <header className="screen__head">
          <h1 className="screen__title">Songs</h1>
          <button className="btn btn--primary">
            <IconPlus />
            Add song
          </button>
        </header>

        <section aria-labelledby="now">
          <h2 id="now" className="h2">
            Now playing
          </h2>
          <div className="chart">
            <div className="chart__meta num">
              <span>Standard tuning</span>
              <span>Capo 0</span>
              <span>Key Am</span>
              <span>{bpm} bpm</span>
            </div>
            <ol className="chart__bars">
              {CHORDS.map((c, i) => (
                <li key={c} className="bar" aria-current={playing && i === chord ? "true" : undefined}>
                  <span className="bar__chord">{c}</span>
                  <span className="bar__beats" aria-hidden="true">
                    {Array.from({ length: BEATS }, (_, b) => (
                      <i key={b} data-on={playing && i === chord && b === beat} />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
            <label className="slider">
              <span>Tempo</span>
              <input type="range" min={50} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
              <span className="num">{bpm}</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="lib">
          <h2 id="lib" className="h2">
            Your songs
          </h2>
          <ul className="rows">
            {SONGS.map((s) => (
              <li key={s.title}>
                <button className="row" onClick={() => setSheet(true)}>
                  <span className="row__main">
                    <span className="row__title">{s.title}</span>
                    <span className="row__sub">{s.artist}</span>
                  </span>
                  <span className="row__aside num">
                    <span>
                      {s.key}
                      {s.capo ? ` · capo ${s.capo}` : ""}
                    </span>
                    <HeatMark heat={s.heat} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="btn">
          <h2 id="btn" className="h2">
            Buttons and states
          </h2>
          <div className="stack">
            <button className="btn btn--primary">Start jam</button>
            <button className="btn btn--secondary">Save version</button>
            <button className="btn btn--ghost">Cancel</button>
            <button className="btn btn--secondary" disabled>
              Disabled
            </button>
          </div>
          <div className="heats">
            <HeatMark heat="planning" showLabel />
            <HeatMark heat="learning" showLabel />
            <HeatMark heat="performing" showLabel />
          </div>
        </section>

        <section aria-labelledby="empty">
          <h2 id="empty" className="h2">
            Empty state
          </h2>
          <div className="empty">
            <p className="empty__title">No playlists yet</p>
            <p className="empty__text">Make one for the songs you play together, then share the link.</p>
            <button className="btn btn--secondary">New playlist</button>
          </div>
        </section>
      </main>

      <div className="player glass">
        <button className="player__info" onClick={() => setSheet(true)} aria-label="Open player">
          <span className="player__title">Midnight Ember</span>
          <span className="player__chord num">
            {playing ? CHORDS[chord] : "Paused"} · {bpm} bpm
          </span>
        </button>
        <button className="player__play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <span className="player__track" aria-hidden="true">
          <span className="player__fill" style={{ transform: `scaleX(${progress})`, transitionDuration: `${60000 / bpm}ms` }} />
        </span>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Midnight Ember">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Midnight Ember</h2>
            <p className="row__sub">Gitara Demo</p>
          </div>
          <button className="iconbtn" onClick={() => setSheet(false)} aria-label="Close">
            <IconDown />
          </button>
        </div>
        <p className="sheet__text">Drag the handle down, flick it, tap outside or press Esc to close.</p>
        <div className="stack">
          <button className="btn btn--primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play along"}
          </button>
          <button className="btn btn--secondary">Edit chords</button>
        </div>
      </Sheet>
    </div>
  );
}
