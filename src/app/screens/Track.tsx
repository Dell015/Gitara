import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { playDrum, schedulePattern } from "../../audio/drums";
import { audio } from "../../audio/guitar";
import { keepAwake } from "../../audio/metronome";
import { DRUM_SOUNDS, emptyPattern, PRESETS, presetPattern, resizePattern, SOUND_LABEL, stepsPerBar, stepsPerBeat, type DrumSound, type Pattern, type Track } from "../../core/drums";
import { TIME_SIGNATURES } from "../../core/genres";
import type { SectionKind } from "../../core/model";
import { TapTempo } from "../../core/tempo";
import { isMine } from "../../data/auth";
import { db } from "../../data/local-db";
import * as repo from "../../data/repo";
import { Segmented, TopBar } from "../../ui/bits";
import { IconPause, IconPlay, IconPlus } from "../../ui/icons";
import { pulseLights } from "../../ui/lightShader";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { KIND_LABEL, Stepper } from "./Version";

const pid = () => Math.random().toString(36).slice(2, 8);
const NEXT_VEL: Record<string, number> = { "0": 1, "1": 1.2, "1.2": 0.5, "0.5": 0 };

/**
 * Track maker v1 (G2): a drum step sequencer. Tap a step to cycle off → hit → accent → soft.
 * Every change saves on the device straight away (and syncs), so there's no Save button to forget.
 */
export function TrackScreen({ id, songId }: { id?: string; songId?: string }) {
  const nav = useNav();
  const { open, showToast } = useOverlays();
  const stored = useLiveQuery(async () => (id ? ((await db.tracks.get(id)) ?? null) : null), [id]);
  const songs = useLiveQuery(async () => {
    const entries = await db.library.toArray();
    return (await db.songs.bulkGet(entries.map((e) => e.songId))).filter((s) => !!s).map((s) => s!);
  });
  const [t, setT] = useState<Track | null>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState(-1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tapper = useRef(new TapTempo());
  const engine = useRef<{ stop: () => void } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const tRef = useRef<Track | null>(null);
  tRef.current = t;

  // load, or start a new track (rock groove, linked to the song if we came from one)
  useEffect(() => {
    if (t || stored === undefined) return;
    if (stored) {
      setT(stored);
      return;
    }
    const now = new Date().toISOString();
    setT({
      id: crypto.randomUUID(),
      ownerId: null,
      songId,
      name: "New backing track",
      bpm: 90,
      timeSignature: "4/4",
      swing: 0,
      content: { patterns: [presetPattern(PRESETS[0]!, pid(), "A", 1)] },
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    });
  }, [stored, t, songId]);

  // the linked song: its tempo and its section kinds (for "chorus uses pattern B")
  const linked = useLiveQuery(async () => (t?.songId ? db.songs.get(t.songId) : undefined), [t?.songId]);
  const kinds = useLiveQuery(async () => {
    if (!t?.songId) return [] as SectionKind[];
    const vs = await db.versions.where("songId").equals(t.songId).toArray();
    const set = new Set<SectionKind>();
    vs.forEach((v) => v.content.sections.forEach((s) => set.add(s.kind)));
    return [...set];
  }, [t?.songId]);

  useEffect(() => () => engine.current?.stop(), []);

  if (!t)
    return (
      <>
        <TopBar onBack={nav.back} title="Backing track" />
      </>
    );

  const mine = !t.ownerId || isMine(t.ownerId);
  const p = t.content.patterns[Math.min(current, t.content.patterns.length - 1)]!;
  const spb = stepsPerBar(t.timeSignature);
  const beatSteps = stepsPerBeat(t.timeSignature);
  const total = spb * p.bars;

  const update = (next: Track, quiet = false) => {
    setT(next);
    if (!mine) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const { ownerId: _o, createdAt: _c, updatedAt: _u, ...draft } = next;
      void repo.saveTrack(draft).then(() => !quiet && undefined);
    }, 500);
  };
  const setPattern = (np: Pattern) => update({ ...t, content: { ...t.content, patterns: t.content.patterns.map((x) => (x.id === np.id ? np : x)) } });

  const toggle = (li: number, si: number) => {
    const lane = p.lanes[li]!;
    const v = lane.steps[si] ?? 0;
    const nv = NEXT_VEL[String(v)] ?? 0;
    const steps = [...lane.steps];
    steps[si] = nv;
    if (nv > 0) {
      audio();
      playDrum(lane.sound, audio().ctx.currentTime + 0.005, nv * lane.volume);
    }
    setPattern({ ...p, lanes: p.lanes.map((l, i) => (i === li ? { ...l, steps } : l)) });
  };

  const play = async () => {
    if (engine.current) {
      engine.current.stop();
      engine.current = null;
      setPlaying(false);
      setHead(-1);
      return;
    }
    const { ctx } = audio();
    const release = await keepAwake();
    let next = ctx.currentTime + 0.08;
    const start = next;
    let stopped = false;
    let raf = 0;
    const loop = () => {
      if (stopped) return;
      const cur = tRef.current!;
      const pat = cur.content.patterns[Math.min(current, cur.content.patterns.length - 1)]!;
      while (next < ctx.currentTime + 0.15) next += schedulePattern(pat, next, cur.bpm, stepsPerBeat(cur.timeSignature), cur.swing);
      timer = window.setTimeout(loop, 40);
    };
    let timer = window.setTimeout(loop, 0);
    let lastBeat = -1;
    const draw = () => {
      if (stopped) return;
      const cur = tRef.current!;
      const pat = cur.content.patterns[Math.min(current, cur.content.patterns.length - 1)]!;
      const stepSec = 60 / cur.bpm / stepsPerBeat(cur.timeSignature);
      const n = pat.lanes[0]?.steps.length ?? 1;
      const s = Math.floor((ctx.currentTime - start) / stepSec);
      const h = s >= 0 ? s % n : -1;
      setHead(h);
      const beat = Math.floor(h / stepsPerBeat(cur.timeSignature));
      if (h >= 0 && beat !== lastBeat) {
        lastBeat = beat;
        pulseLights(h % stepsPerBar(cur.timeSignature) === 0 ? 1 : 0.4);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    engine.current = {
      stop() {
        stopped = true;
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        release();
      },
    };
    setPlaying(true);
  };

  const addPattern = (copy?: Pattern) => {
    const name = String.fromCharCode(65 + t.content.patterns.length);
    const np = copy ? { ...copy, id: pid(), name, lanes: copy.lanes.map((l) => ({ ...l, steps: [...l.steps] })) } : emptyPattern(pid(), name, t.timeSignature, p.bars, p.lanes.map((l) => l.sound));
    update({ ...t, content: { ...t.content, patterns: [...t.content.patterns, np] } });
    setCurrent(t.content.patterns.length);
  };
  const removePattern = () => {
    if (t.content.patterns.length < 2) return;
    const patterns = t.content.patterns.filter((x) => x.id !== p.id);
    const sectionPatterns = Object.fromEntries(Object.entries(t.content.sectionPatterns ?? {}).filter(([, v]) => v !== p.id));
    update({ ...t, content: { patterns, sectionPatterns } });
    setCurrent(0);
  };
  const usedSounds = new Set(p.lanes.map((l) => l.sound));

  return (
    <>
      <TopBar
        onBack={() => {
          engine.current?.stop();
          nav.back();
        }}
        title="Backing track"
      />
      <header className="page-head">
        {mine ? (
          <input className="input input--title" value={t.name} onChange={(e) => update({ ...t, name: e.target.value.slice(0, 80) || "Untitled track" })} aria-label="Track name" />
        ) : (
          <h1 className="page-title page-title--sm">{t.name}</h1>
        )}
        <p className="muted">{linked ? `For ${linked.title} by ${linked.artist}` : "Not linked to a song"} · saved on this device as you go</p>
      </header>

      <div className="trackbar">
        <button className="btn btn--primary btn--big" onClick={() => void play()} aria-pressed={playing}>
          {playing ? <IconPause /> : <IconPlay />} {playing ? "Stop" : `Play pattern ${p.name}`}
        </button>
        <Stepper label="Tempo" value={`${t.bpm}`} onDown={() => update({ ...t, bpm: Math.max(40, t.bpm - 1) })} onUp={() => update({ ...t, bpm: Math.min(240, t.bpm + 1) })} />
        <button
          className="chip"
          onPointerDown={(e) => {
            e.preventDefault();
            const b = tapper.current.tap(e.timeStamp);
            if (b) update({ ...t, bpm: Math.max(40, Math.min(240, b)) });
          }}
        >
          Tap tempo
        </button>
        {mine && (
          <button className="chip" onClick={() => open({ kind: "grooves", onPick: (preset) => {
            const np = presetPattern(preset, p.id, p.name, p.bars);
            const fresh = t.content.patterns.length === 1 && !stored;
            update({ ...t, bpm: fresh ? preset.bpm : t.bpm, swing: fresh ? (preset.swing ?? 0) : t.swing, timeSignature: fresh ? preset.timeSignature : t.timeSignature, content: { ...t.content, patterns: t.content.patterns.map((x) => (x.id === p.id ? (fresh ? np : resizePattern(np, t.timeSignature, p.bars)) : x)) } });
            showToast(`${preset.name} in pattern ${p.name}`);
          } })}>
            Grooves
          </button>
        )}
      </div>

      <div className="ptabs" role="tablist" aria-label="Patterns">
        {t.content.patterns.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={i === current} className="chip" onClick={() => setCurrent(i)}>
            Pattern {x.name}
          </button>
        ))}
        {mine && t.content.patterns.length < 6 && (
          <>
            <button className="chip chip--sub" onClick={() => addPattern(p)}>
              Copy {p.name}
            </button>
            <button className="chip chip--sub" onClick={() => addPattern()}>
              <IconPlus /> Empty
            </button>
          </>
        )}
      </div>

      <div className="seq" style={{ ["--steps" as string]: total, ["--beat" as string]: beatSteps }} role="grid" aria-label={`Pattern ${p.name}, ${p.bars} bar${p.bars > 1 ? "s" : ""}`}>
        {p.lanes.map((l, li) => (
          <div className="seq__row" role="row" key={l.sound}>
            <div className="seq__lane">
              <button className="seq__name" onClick={() => (audio(), playDrum(l.sound, audio().ctx.currentTime + 0.005, l.volume))}>
                {SOUND_LABEL[l.sound]}
              </button>
              {mine && (
                <button className="seq__mute" aria-pressed={!!l.muted} aria-label={l.muted ? `Unmute ${SOUND_LABEL[l.sound]}` : `Mute ${SOUND_LABEL[l.sound]}`} onClick={() => setPattern({ ...p, lanes: p.lanes.map((x, i) => (i === li ? { ...x, muted: !x.muted } : x)) })}>
                  M
                </button>
              )}
            </div>
            <div className="seq__steps">
              {l.steps.map((v, si) => (
                <button
                  key={si}
                  role="gridcell"
                  className="seq__step"
                  data-v={v === 0 ? "off" : v > 1 ? "accent" : v < 1 ? "soft" : "on"}
                  data-beat={si % beatSteps === 0}
                  data-bar={si % spb === 0 && si > 0}
                  data-head={head === si}
                  data-alt={Math.floor(si / beatSteps) % 2 === 1}
                  aria-label={`${SOUND_LABEL[l.sound]}, step ${si + 1}: ${v === 0 ? "off" : v > 1 ? "accent" : v < 1 ? "soft" : "on"}`}
                  disabled={!mine}
                  onClick={() => toggle(li, si)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="muted">Tap a step: hit, then accent, then soft, then off. Tap a sound's name to hear it.</p>

      {mine && (
        <section className="block">
          <h2 className="h2">Pattern {p.name}</h2>
          <div className="form__grid">
            <div className="field">
              <span className="field__label">Length</span>
              <Segmented label="Bars" value={String(p.bars)} onChange={(v) => setPattern(resizePattern(p, t.timeSignature, Number(v)))} options={[{ id: "1", label: "1 bar" }, { id: "2", label: "2 bars" }, { id: "4", label: "4 bars" }]} />
            </div>
            <label className="field">
              <span className="field__label">Add a sound</span>
              <select
                className="input"
                value=""
                onChange={(e) => {
                  const s = e.target.value as DrumSound;
                  if (!s) return;
                  setPattern({ ...p, lanes: [...p.lanes, { sound: s, steps: new Array(total).fill(0), volume: 0.8 }] });
                }}
              >
                <option value="">Choose…</option>
                {DRUM_SOUNDS.filter((s) => !usedSounds.has(s)).map((s) => (
                  <option key={s} value={s}>
                    {SOUND_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {t.content.patterns.length > 1 && (
              <div className="field">
                <span className="field__label">Remove</span>
                <button className="btn btn--ghost" onClick={removePattern}>
                  Delete pattern {p.name}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {mine && (
        <section className="block">
          <h2 className="h2">The whole track</h2>
          <div className="form__grid">
            <label className="field field--wide">
              <span className="field__label">Song</span>
              <select className="input" value={t.songId ?? ""} onChange={(e) => update({ ...t, songId: e.target.value || undefined, bpm: !t.songId && e.target.value ? (songs?.find((s) => s.id === e.target.value)?.originalBpm ?? t.bpm) : t.bpm })}>
                <option value="">Not linked</option>
                {(songs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {s.artist}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Time signature</span>
              <select
                className="input"
                value={t.timeSignature}
                onChange={(e) => {
                  const ts = e.target.value;
                  update({ ...t, timeSignature: ts, content: { ...t.content, patterns: t.content.patterns.map((x) => resizePattern(x, ts, x.bars)) } });
                }}
              >
                {TIME_SIGNATURES.filter((x) => ["4/4", "3/4", "6/8", "12/8", "2/4"].includes(x)).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Swing {Math.round(t.swing * 100)}%</span>
              <input className="range" type="range" min={0} max={60} value={Math.round(t.swing * 100)} onChange={(e) => update({ ...t, swing: Number(e.target.value) / 100 })} aria-label="Swing" />
            </label>
            {t.songId && kinds && kinds.length > 0 && t.content.patterns.length > 1 && (
              <div className="field field--wide">
                <span className="field__label">Which pattern plays where</span>
                <div className="secmap">
                  {kinds.map((k) => (
                    <label key={k} className="secmap__row">
                      <span>{KIND_LABEL[k]}</span>
                      <select
                        className="input input--sm"
                        value={t.content.sectionPatterns?.[k] ?? t.content.patterns[0]!.id}
                        onChange={(e) => update({ ...t, content: { ...t.content, sectionPatterns: { ...(t.content.sectionPatterns ?? {}), [k]: e.target.value } } })}
                      >
                        {t.content.patterns.map((x) => (
                          <option key={x.id} value={x.id}>
                            Pattern {x.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="field field--wide">
              <span className="field__label">Who can see it</span>
              <Segmented
                label="Who can see it"
                value={linked?.visibility === "private" ? "private" : t.visibility}
                onChange={(v) => linked?.visibility !== "private" && update({ ...t, visibility: v })}
                options={[
                  { id: "private", label: "Only me" },
                  { id: "unlisted", label: "Link" },
                  { id: "public", label: "Everyone" },
                ]}
              />
              {linked?.visibility === "private" && <span className="field__hint">The song is private, so this track is too.</span>}
            </div>
            <div className="field field--wide">
              <button
                className="btn btn--ghost link--danger"
                onClick={async () => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  engine.current?.stop();
                  if (stored) await repo.deleteTrack(t.id);
                  showToast("Track deleted");
                  nav.back();
                }}
              >
                {confirmDelete ? "Tap again to delete for good" : "Delete this track"}
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** The loop library (G3): grooves to start from. Every one is editable once it's in. */
export function GroovesSheet({ onPick }: { onPick: (p: (typeof PRESETS)[number]) => void }) {
  const { close } = useOverlays();
  const [preview, setPreview] = useState<string | null>(null);
  const stopRef = useRef<number | undefined>(undefined);
  const byStyle = useMemo(() => PRESETS, []);
  useEffect(() => () => window.clearTimeout(stopRef.current), []);
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">Grooves</h2>
          <p className="row__sub">Tap to hear two bars. Pick one to drop it into the pattern, then change anything.</p>
        </div>
      </div>
      <div className="menu">
        {byStyle.map((g) => (
          <div key={g.id} className="pickrow">
            <button
              className="iconbtn"
              aria-label={`Hear ${g.name}`}
              data-on={preview === g.id}
              onClick={() => {
                const { ctx } = audio();
                const pat = presetPattern(g, "p", "A", 1);
                let t0 = ctx.currentTime + 0.05;
                for (let k = 0; k < 2; k++) t0 += schedulePattern(pat, t0, g.bpm, stepsPerBeat(g.timeSignature), g.swing ?? 0);
                setPreview(g.id);
                window.clearTimeout(stopRef.current);
                stopRef.current = window.setTimeout(() => setPreview(null), (t0 - ctx.currentTime) * 1000);
              }}
            >
              <IconPlay />
            </button>
            <span className="irow__main">
              <span className="irow__title">{g.name}</span>
              <span className="irow__sub num">
                {g.style} · {g.timeSignature} · {g.bpm} bpm{g.swing ? " · swung" : ""}
              </span>
            </span>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => {
                onPick(g);
                close();
              }}
            >
              Use
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
