import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { audio, strum, strumStep } from "../../audio/guitar";
import { playChart, type Playback, type PlayPosition } from "../../audio/player";
import { beatsPerBar, chordsUsed, computeDifficulty, DEFAULT_STRUM, NO_CHORD } from "../../core/chart";
import type { Section, Version } from "../../core/model";
import { findVoicings } from "../../core/shapes";
import { accidentalForKey, transposeChord, transposeKey, type Accidental } from "../../core/theory";
import { tuningName } from "../../core/tunings";
import { isMine } from "../../data/auth";
import { db } from "../../data/local-db";
import * as repo from "../../data/repo";
import { Empty, TopBar } from "../../ui/bits";
import { ChordDiagram, StrumGlyph } from "../../ui/ChordDiagram";
import { warmthFor } from "../../ui/artwork";
import { Hero } from "../../ui/Hero";
import { IconMore, IconPause, IconPlay } from "../../ui/icons";
import { pulseLights } from "../../ui/lightShader";
import { keepAwake } from "../../audio/metronome";
import { useNav } from "../nav";
import { queue } from "../queue";
import { useOverlays } from "../overlays";
import { usePrefs, setPrefs } from "../prefs";

export const KIND_LABEL: Record<Section["kind"], string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  solo: "Solo",
  interlude: "Interlude",
  outro: "Outro",
  custom: "Section",
};

const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

/** One version of a song, ready to read on a music stand and play along with (D3). */
export function VersionScreen({ id, play, fromQueue }: { id: string; play?: boolean; fromQueue?: boolean }) {
  const nav = useNav();
  const { open } = useOverlays();
  const prefs = usePrefs();
  const v = useLiveQuery(() => db.versions.get(id), [id]);
  const song = useLiveQuery(async () => (v ? db.songs.get(v.songId) : undefined), [v?.songId]);
  const entry = useLiveQuery(async () => (v ? db.library.get(v.songId) : undefined), [v?.songId]);

  const [transpose, setTranspose] = useState(0);
  const [viewCapo, setViewCapo] = useState<number | null>(null);
  const [pos, setPos] = useState<PlayPosition | null>(null);
  const playback = useRef<Playback | null>(null);
  const [countIn, setCountIn] = useState(true);
  const [clickTrack, setClickTrack] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loopItem, setLoopItem] = useState<number | null>(null);
  const [trainer, setTrainer] = useState(false);
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const userStopped = useRef(false);
  const releaseWake = useRef<() => void>(() => undefined);

  useEffect(() => () => (playback.current?.stop(), releaseWake.current()), []);
  useEffect(() => {
    if (v) void repo.touchRecent("song", v.songId);
  }, [v?.songId]);

  const capo = viewCapo ?? v?.capo ?? 0;
  const shift = transpose - (capo - (v?.capo ?? 0));
  const key = transposeKey(v?.keyPlayed, transpose);
  const acc: Accidental = prefs.accidentals === "auto" ? accidentalForKey(transposeKey(v?.keyPlayed, shift) ?? key) : prefs.accidentals;
  const show = (n: string) => (n === NO_CHORD ? n : transposeChord(n, shift, acc));

  const used = useMemo(() => (v ? chordsUsed(v.content) : []), [v]);
  const shapeFor = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!v) return (_: string) => null;
    for (const n of used) {
      const shown = show(n);
      const custom = shift === 0 ? v.content.voicings?.[n]?.frets : undefined;
      const f = custom ?? findVoicings(shown, v.tuning, 1)[0]?.frets;
      if (f) map.set(shown, f);
    }
    return (n: string) => map.get(n) ?? findVoicings(n, v.tuning, 1)[0]?.frets ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, used, shift, acc]);

  const order = useMemo(() => {
    if (!v) return [] as { section: Section; repeat: number; firstPart: number }[];
    const byId = new Map(v.content.sections.map((s) => [s.id, s]));
    const arr = v.content.arrangement.length ? v.content.arrangement : v.content.sections.map((s) => ({ sectionId: s.id, repeat: 1 }));
    let part = 0;
    return arr.flatMap((a) => {
      const s = byId.get(a.sectionId);
      if (!s) return [];
      const item = { section: s, repeat: Math.max(1, a.repeat), firstPart: part };
      part += item.repeat;
      return [item];
    });
  }, [v]);

  const playOrderList = useMemo(() => order.flatMap((o) => Array.from({ length: o.repeat }, () => o.section)), [order]);
  const bpm = v?.bpm ?? song?.originalBpm ?? 90;

  const start = (fromPart = 0) => {
    if (!v) return;
    userStopped.current = true;
    playback.current?.stop();
    userStopped.current = false;
    audio();
    void keepAwake().then((rel) => (releaseWake.current(), (releaseWake.current = rel)));
    const li = loopItem !== null ? order[loopItem] : undefined;
    const startSpeed = trainer && li ? Math.min(speed, 0.7) : speed;
    setLiveSpeed(trainer && li ? startSpeed : null);
    playback.current = playChart({
      order: playOrderList,
      bpm,
      timeSignature: v.timeSignature ?? song?.timeSignature,
      tuning: v.tuning,
      capo,
      shapeFor,
      nameFor: show,
      fromPart,
      loop: li ? { from: li.firstPart, to: li.firstPart + li.repeat - 1 } : undefined,
      speed: startSpeed,
      speedStep: trainer && li ? 0.05 : undefined,
      countIn,
      clickTrack,
      onLoop: (s) => setLiveSpeed(trainer ? s : null),
      onPosition: (p) => {
        setPos(p);
        if (!p) {
          playback.current = null;
          releaseWake.current();
          // finished on its own: play the next song in the queue
          if (!userStopped.current && fromQueue) void playNext();
        }
      },
      onBeat: (accent) => pulseLights(accent ? 1 : 0.5),
    });
  };
  const stop = () => {
    userStopped.current = true;
    playback.current?.stop();
    playback.current = null;
    userStopped.current = false;
    releaseWake.current();
    setPos(null);
  };
  const playNext = async () => {
    const next = queue.shift();
    if (!next) return;
    const vs = await db.versions.where("songId").equals(next.songId).toArray();
    const e = await db.library.get(next.songId);
    const nv = vs.find((x) => x.id === (next.versionId ?? e?.preferredVersionId)) ?? vs[0];
    if (nv) nav.replace({ name: "version", id: nv.id, play: true, fromQueue: true });
  };

  const autoplayed = useRef(false);
  useEffect(() => {
    if (play && v && song !== undefined && !autoplayed.current) {
      autoplayed.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, v, song]);

  if (v === undefined) return <TopBar onBack={nav.back} />;
  if (!v)
    return (
      <>
        <TopBar onBack={nav.back} />
        <Empty title="This version isn't available" text="It may have been deleted, or it's private." />
      </>
    );

  const mine = isMine(v.authorId);
  const diff = computeDifficulty(v.content, v.tuning, v.bpm);
  const playing = !!pos;
  const changed = transpose !== 0 || viewCapo !== null;
  const size = ["chart--s", "chart--m", "chart--l"][prefs.chartSize];

  return (
    <>
      <TopBar
        over
        onBack={() => {
          stop();
          nav.back();
        }}
        right={
          <button className="glassbtn" aria-label="Version options" onClick={() => open({ kind: "versionMenu", id })}>
            <IconMore />
          </button>
        }
      />
      <Hero seed={v.songId} warmth={warmthFor(entry?.status)} short>
        <div className="glass glass--card herocard">
          <button className="artistlink herocard__song" onClick={() => song && nav.push({ name: "song", id: song.id })}>
            {song?.title ?? "Song"}
          </button>
          <h1 className="herocard__title herocard__title--sm">{v.label || (mine ? "Your version" : "Version")}</h1>
          <p className="herocard__meta num">
            {[song?.artist, tuningName(v.tuning), capo ? `Capo ${capo}` : "No capo", key && `Key ${key}`, `${bpm} bpm`].filter(Boolean).join(" · ")}
          </p>
          <p className="herocard__meta">
            {LEVEL[diff.level]} · {diff.reasons.join(", ")}
            {v.tags.length ? ` · ${v.tags.join(", ")}` : ""}
          </p>
          <div className="herocard__actions">
            <button className="btn btn--primary btn--big" onClick={() => (playing ? stop() : start())} aria-pressed={playing}>
              {playing ? <IconPause /> : <IconPlay />}
              {playing ? "Stop" : "Play along"}
            </button>
            {entry?.preferredVersionId === id && <span className="herocard__meta">Opens first</span>}
          </div>
        </div>
      </Hero>

      <div className="tools" role="toolbar" aria-label="Practice tools">
        <Stepper
          label="Speed"
          value={`${Math.round((liveSpeed ?? speed) * 100)}%`}
          onDown={() => setSpeed((s) => Math.max(0.4, Math.round((s - 0.05) * 100) / 100))}
          onUp={() => setSpeed((s) => Math.min(1.5, Math.round((s + 0.05) * 100) / 100))}
        />
        <span className="tools__bpm num">{Math.round(bpm * (liveSpeed ?? speed))} bpm</span>
        <button className="chip" aria-pressed={countIn} onClick={() => setCountIn((c) => !c)}>
          Count-in
        </button>
        <button className="chip" aria-pressed={clickTrack} onClick={() => setClickTrack((c) => !c)}>
          Click
        </button>
        <button className="chip" aria-pressed={trainer} onClick={() => setTrainer((t) => !t)} title="Needs a looped section">
          Speed trainer
        </button>
        {loopItem !== null && (
          <button className="chip" aria-pressed onClick={() => setLoopItem(null)}>
            Looping {order[loopItem]?.section.label || KIND_LABEL[order[loopItem]?.section.kind ?? "custom"]}
          </button>
        )}
      </div>
      {trainer && loopItem === null && <p className="muted">Loop a section (the loop button next to its name) and the speed trainer starts slow and adds 5% each time round.</p>}

      <div className="tools" role="toolbar" aria-label="View tools">
        <Stepper label="Transpose" value={transpose > 0 ? `+${transpose}` : String(transpose)} onDown={() => setTranspose((t) => Math.max(-11, t - 1))} onUp={() => setTranspose((t) => Math.min(11, t + 1))} />
        <Stepper label="Capo" value={capo ? String(capo) : "None"} onDown={() => setViewCapo(Math.max(0, capo - 1))} onUp={() => setViewCapo(Math.min(12, capo + 1))} />
        <button className="chip" aria-pressed={prefs.accidentals !== "auto"} onClick={() => setPrefs({ accidentals: prefs.accidentals === "auto" ? "sharp" : prefs.accidentals === "sharp" ? "flat" : "auto" })}>
          {prefs.accidentals === "auto" ? "Sharps/flats: auto" : prefs.accidentals === "sharp" ? "Sharps" : "Flats"}
        </button>
        <button className="chip" aria-pressed={prefs.leftHanded} onClick={() => setPrefs({ leftHanded: !prefs.leftHanded })}>
          Left-handed
        </button>
        <Stepper label="Text" value={["S", "M", "L"][prefs.chartSize]!} onDown={() => setPrefs({ chartSize: Math.max(0, prefs.chartSize - 1) as 0 | 1 | 2 })} onUp={() => setPrefs({ chartSize: Math.min(2, prefs.chartSize + 1) as 0 | 1 | 2 })} />
        {changed && (
          <button
            className="link"
            onClick={() => {
              setTranspose(0);
              setViewCapo(null);
            }}
          >
            Back to original
          </button>
        )}
      </div>
      {changed && <p className="muted">Only your view changes. The version itself stays as written.</p>}

      {used.length > 0 && (
        <section className="block" aria-label="Chords in this version">
          <div className="chordstrip">
            {used.map((n) => {
              const name = show(n);
              const f = shapeFor(name);
              const vv = f ? findVoicings(name, v.tuning, 8).find((x) => x.frets.join() === f.join()) ?? (shift === 0 ? v.content.voicings?.[n] : undefined) ?? findVoicings(name, v.tuning, 1)[0] : undefined;
              return (
                <button
                  key={n}
                  className="chordcard"
                  onClick={() => {
                    if (f) strum(f, v.tuning, capo);
                    open({ kind: "chord", name, tuning: v.tuning, capo, current: f ?? undefined });
                  }}
                >
                  <span className="chordname">{name}</span>
                  {vv ? <ChordDiagram voicing={vv} name={name} leftHanded={prefs.leftHanded} size={72} /> : <span className="muted">No shape</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className={`chart ${size}`}>
        {order.map((o, i) => {
          const s = o.section;
          const active = pos && pos.part >= o.firstPart && pos.part < o.firstPart + o.repeat;
          const pattern = s.strum?.steps?.length ? s.strum.steps : DEFAULT_STRUM;
          const firstChord = s.bars[0]?.chords[0]?.name;
          return (
            <section key={`${s.id}-${i}`} className="csec" data-active={!!active}>
              <header className="csec__head">
                <span className="csec__left">
                  <button className="csec__title" onClick={() => start(o.firstPart)} title="Play from here">
                    {s.label || KIND_LABEL[s.kind]}
                    {o.repeat > 1 && <span className="csec__rep num">×{o.repeat}</span>}
                  </button>
                  <button className="loopbtn" aria-pressed={loopItem === i} aria-label={loopItem === i ? "Stop looping this section" : "Loop this section"} onClick={() => setLoopItem((x) => (x === i ? null : i))}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M17 4.5l2.5 2.5L17 9.5M4.5 11.5V10a3 3 0 0 1 3-3h12M7 19.5 4.5 17 7 14.5M19.5 12.5V14a3 3 0 0 1-3 3h-12" />
                    </svg>
                  </button>
                </span>
                <button
                  className="strum"
                  aria-label={`Strumming: ${pattern.join(" ")}. Tap to hear`}
                  onClick={() => {
                    const name = firstChord ? show(firstChord) : undefined;
                    const f = name ? shapeFor(name) : null;
                    if (!f) return;
                    const { ctx } = audio();
                    const stepSec = (60 / bpm) * (beatsPerBar(v.timeSignature) / pattern.length);
                    pattern.forEach((st, k) => strumStep(st, f, v.tuning, capo, ctx.currentTime + 0.05 + k * stepSec, stepSec * 2, k === 0));
                  }}
                >
                  {pattern.map((st, k) => (
                    <StrumGlyph key={k} step={st} />
                  ))}
                </button>
              </header>
              {s.note && <p className="csec__note">{s.note}</p>}
              <ol className="bars">
                {s.bars.map((b, bi) => {
                  const on = !!active && pos!.bar === bi;
                  return (
                    <li key={bi} className="cbar" data-on={on}>
                      {b.chords.map((c, ci) => {
                        const name = show(c.name);
                        return (
                          <button
                            key={ci}
                            className="cbar__chord chordname"
                            style={{ flexGrow: c.beats }}
                            onClick={() => {
                              const f = name === NO_CHORD ? null : shapeFor(name);
                              if (f) strum(f, v.tuning, capo);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (name !== NO_CHORD) open({ kind: "chord", name, tuning: v.tuning, capo });
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {!order.length && <Empty title="This version has no chords yet" text={mine ? "Edit it to add sections." : undefined} />}
      </div>
      {v.basedOn && <p className="muted">Based on another player's version. Credit stays with every copy.</p>}
      <VersionFooter v={v} />
    </>
  );
}

function VersionFooter({ v }: { v: Version }) {
  return <p className="muted">Last changed {new Date(v.updatedAt).toLocaleDateString()}</p>;
}

function Stepper({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <button className="stepper__btn" onClick={onDown} aria-label={`${label} down`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <span className="stepper__value num">{value}</span>
      <button className="stepper__btn" onClick={onUp} aria-label={`${label} up`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
    </div>
  );
}

export { Stepper };
