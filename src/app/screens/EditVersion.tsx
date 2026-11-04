import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { audio, strumStep } from "../../audio/guitar";
import { playChart, type Playback, type PlayPosition } from "../../audio/player";
import { beatsPerBar, DEFAULT_STRUM, formatBars, NO_CHORD, parseBars, playOrder } from "../../core/chart";
import { TIME_SIGNATURES, KEYS } from "../../core/genres";
import { GUITAR, GUITAR_TUNINGS } from "../../core/instrument";
import { PART_HINT, PART_LABEL, VERSION_PARTS, VERSION_TAGS, type VersionPart, type ArrangementItem, type SectionKind, type StrumStep, type VersionContent, type VersionTag, type Visibility } from "../../core/model";
import { findVoicings } from "../../core/shapes";
import { TapTempo } from "../../core/tempo";
import { suggestKey, transposeKey } from "../../core/theory";
import { tuningName } from "../../core/tunings";
import { db } from "../../data/local-db";
import { findPublicVersionDuplicate } from "../../data/remote";
import * as repo from "../../data/repo";
import { Segmented, TopBar } from "../../ui/bits";
import { ChordDiagram, StrumGlyph } from "../../ui/ChordDiagram";
import { usePrefs } from "../prefs";
import { IconPause, IconPlay, IconPlus } from "../../ui/icons";
import type { Bar } from "../../core/model";
import { VideoPanel } from "../../ui/VideoPanel";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { KIND_LABEL, Stepper } from "./Version";

interface EditSection {
  id: string;
  kind: SectionKind;
  label: string;
  text: string;
  strum: StrumStep[];
  note: string;
}

interface Draft {
  part: VersionPart;
  youtubeUrl: string;
  label: string;
  tuning: number[];
  capo: number;
  keyPlayed: string;
  bpm: string;
  timeSignature: string;
  tags: VersionTag[];
  techniques: string[];
  visibility: Visibility;
  sections: EditSection[];
  arrangement: ArrangementItem[];
  voicings: NonNullable<VersionContent["voicings"]>;
  savedAt: number;
}

const KINDS: SectionKind[] = ["intro", "verse", "pre-chorus", "chorus", "bridge", "solo", "interlude", "outro", "custom"];
const TECHNIQUES = ["Barre chords", "Power chords", "Palm muting", "Fingerpicking", "Hammer-ons", "Slides"];
const TAG_LABEL: Record<VersionTag, string> = { cover: "Cover", live: "Live", acoustic: "Acoustic", original: "Original", simplified: "Simplified" };
const NEXT: StrumStep[] = ["D", "U", "-", "x"];
const sid = () => Math.random().toString(36).slice(2, 9);

function nextKind(sections: EditSection[]): SectionKind {
  const last = sections[sections.length - 1]?.kind;
  if (!last) return "verse";
  if (last === "intro") return "verse";
  if (last === "verse") return "chorus";
  if (last === "chorus") return "verse";
  return "verse";
}

/** Writing or changing the chords of a version (D4). Works offline; nothing is lost if you leave. */
export function EditVersion({ songId, id, part }: { songId: string; id?: string; part?: VersionPart }) {
  const nav = useNav();
  const { open, showToast } = useOverlays();
  const song = useLiveQuery(() => db.songs.get(songId), [songId]);
  const existing = useLiveQuery(async () => (id ? ((await db.versions.get(id)) ?? null) : null), [id]);
  const draftKey = `gitara.draft.${songId}.${id ?? "new"}`;
  const [d, setD] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dupe, setDupe] = useState<string | null>(null);
  const [pos, setPos] = useState<PlayPosition | null>(null);
  const playback = useRef<Playback | null>(null);
  const tapper = useRef(new TapTempo());
  const prefs = usePrefs();
  const [step, setStep] = useState(0);
  const [secId, setSecId] = useState<string | null>(null);
  const [strumSecId, setStrumSecId] = useState<string | null>(null);

  // load: saved draft (if newer) → the version → a fresh one
  useEffect(() => {
    if (d || song === undefined || existing === undefined) return;
    let saved: Draft | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    } catch {
      saved = null;
    }
    const fromVersion = (): Draft | null => {
      if (!existing) return null;
      const bpb = beatsPerBar(existing.timeSignature ?? song?.timeSignature);
      return {
        part: existing.part,
        youtubeUrl: existing.youtubeUrl ?? "",
        label: existing.label ?? "",
        tuning: [...existing.tuning],
        capo: existing.capo,
        keyPlayed: existing.keyPlayed ?? "",
        bpm: existing.bpm ? String(existing.bpm) : "",
        timeSignature: existing.timeSignature ?? song?.timeSignature ?? "4/4",
        tags: [...existing.tags],
        techniques: [...existing.techniques],
        visibility: existing.visibility,
        sections: existing.content.sections.map((s) => ({
          id: s.id,
          kind: s.kind,
          label: s.label ?? "",
          text: formatBars(s.bars, bpb),
          strum: s.strum?.steps?.length ? [...s.strum.steps] : [...DEFAULT_STRUM],
          note: s.note ?? "",
        })),
        arrangement: existing.content.arrangement.map((a) => ({ ...a })),
        voicings: { ...(existing.content.voicings ?? {}) },
        savedAt: Date.parse(existing.updatedAt),
      };
    };
    const base = fromVersion();
    if (saved && (!base || saved.savedAt > base.savedAt)) {
      setD({ ...saved, part: saved.part ?? part ?? "rhythm", youtubeUrl: saved.youtubeUrl ?? "" });
      setRestored(true);
      return;
    }
    if (base) return setD(base);
    const first: EditSection = { id: sid(), kind: "verse", label: "", text: "", strum: [...DEFAULT_STRUM], note: "" };
    setD({
      part: part ?? "rhythm",
      youtubeUrl: "",
      label: "",
      tuning: [...GUITAR.standardTuning],
      capo: 0,
      keyPlayed: song?.originalKey ?? "",
      bpm: song?.originalBpm ? String(song.originalBpm) : "",
      timeSignature: song?.timeSignature ?? "4/4",
      tags: [],
      techniques: [],
      visibility: "private",
      sections: [first],
      arrangement: [{ sectionId: first.id, repeat: 1 }],
      voicings: {},
      savedAt: 0,
    });
  }, [song, existing, d, draftKey]);

  // keep a draft on the device while editing
  useEffect(() => {
    if (!d || !touched) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...d, savedAt: Date.now() }));
      } catch {
        /* storage full or private mode: the in-memory copy still saves */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [d, touched, draftKey]);

  useEffect(() => () => playback.current?.stop(), []);

  const bpb = beatsPerBar(d?.timeSignature);
  const parsed = useMemo(() => new Map((d?.sections ?? []).map((s) => [s.id, parseBars(s.text, bpb)])), [d?.sections, bpb]);
  const content: VersionContent = useMemo(
    () => ({
      sections: (d?.sections ?? []).map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label.trim() || undefined,
        bars: parsed.get(s.id)?.bars ?? [],
        strum: { steps: s.strum },
        note: s.note.trim() || undefined,
      })),
      arrangement: d?.arrangement ?? [],
      voicings: d?.voicings,
    }),
    [d, parsed],
  );
  const allChords = useMemo(() => {
    const seen: string[] = [];
    for (const s of playOrder(content)) for (const b of s.bars) for (const c of b.chords) if (c.name !== NO_CHORD && !seen.includes(c.name)) seen.push(c.name);
    return seen;
  }, [content]);
  const unknown = [...new Set([...parsed.values()].flatMap((p) => p.unknown))];

  if (!d || song === undefined) return <TopBar onBack={nav.back} title={id ? "Edit version" : "New version"} />;
  if (!song)
    return (
      <>
        <TopBar onBack={nav.back} title="New version" />
        <p className="muted">This song isn't on this device.</p>
      </>
    );

  const set = (patch: Partial<Draft>) => {
    setTouched(true);
    setDupe(null);
    setD((p) => (p ? { ...p, ...patch } : p));
  };
  const setSection = (sidv: string, patch: Partial<EditSection>) => set({ sections: d.sections.map((s) => (s.id === sidv ? { ...s, ...patch } : s)) });
  const addSection = () => {
    const s: EditSection = { id: sid(), kind: nextKind(d.sections), label: "", text: "", strum: [...(d.sections[d.sections.length - 1]?.strum ?? DEFAULT_STRUM)], note: "" };
    set({ sections: [...d.sections, s], arrangement: [...d.arrangement, { sectionId: s.id, repeat: 1 }] });
    setSecId(s.id);
  };
  /** Chords are edited as bars; the section keeps them as text so drafts and saved versions stay the same shape. */
  const writeBars = (sidv: string, fn: (bars: Bar[]) => Bar[]) => {
    setTouched(true);
    setD((p) => {
      if (!p) return p;
      const bp = beatsPerBar(p.timeSignature);
      return {
        ...p,
        sections: p.sections.map((x) => (x.id === sidv ? { ...x, text: formatBars(fn(parseBars(x.text, bp).bars), bp) } : x)),
      };
    });
  };
  const evenBeats = (names: string[], bp: number) => names.map((name, i) => ({ name, beats: Math.floor(bp / names.length) + (i < bp % names.length ? 1 : 0) })).filter((c) => c.beats > 0);
  /** Adds a chord as a new bar, or into an existing bar (sharing its beats). */
  const appendChord = (sidv: string, name: string, barIndex?: number) =>
    writeBars(sidv, (bars) => {
      const bp = beatsPerBar(d?.timeSignature);
      if (barIndex === undefined || !bars[barIndex]) return [...bars, { chords: [{ name, beats: bp }] }];
      const names = [...bars[barIndex]!.chords.map((c) => c.name), name].slice(0, bp);
      return bars.map((b, i) => (i === barIndex ? { chords: evenBeats(names, bp) } : b));
    });
  const removeChord = (sidv: string, bi: number, ci: number) =>
    writeBars(sidv, (bars) => {
      const bp = beatsPerBar(d?.timeSignature);
      const b = bars[bi];
      if (!b) return bars;
      const names = b.chords.filter((_, k) => k !== ci).map((c) => c.name);
      if (!names.length) return bars.filter((_, i) => i !== bi);
      return bars.map((x, i) => (i === bi ? { chords: evenBeats(names, bp) } : x));
    });
  const moveBar = (sidv: string, bi: number, dir: -1 | 1) =>
    writeBars(sidv, (bars) => {
      const j = bi + dir;
      if (j < 0 || j >= bars.length) return bars;
      const out = [...bars];
      [out[bi], out[j]] = [out[j]!, out[bi]!];
      return out;
    });
  const repeatBar = (sidv: string, bi: number) =>
    writeBars(sidv, (bars) => {
      const b = bars[bi];
      if (!b) return bars;
      const out = [...bars];
      out.splice(bi + 1, 0, { chords: b.chords.map((c) => ({ ...c })) });
      return out;
    });
  const removeSection = (sidv: string) => set({ sections: d.sections.filter((s) => s.id !== sidv), arrangement: d.arrangement.filter((a) => a.sectionId !== sidv) });
  const duplicateSection = (s: EditSection) => {
    const c = { ...s, id: sid(), strum: [...s.strum] };
    const i = d.sections.findIndex((x) => x.id === s.id);
    const sections = [...d.sections];
    sections.splice(i + 1, 0, c);
    set({ sections, arrangement: [...d.arrangement, { sectionId: c.id, repeat: 1 }] });
    setSecId(c.id);
  };
  const moveArr = (i: number, dir: -1 | 1) => {
    const a = [...d.arrangement];
    const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j]!, a[i]!];
    set({ arrangement: a });
  };

  const songPrivate = song.visibility === "private";
  const suggested = transposeKey(suggestKey(allChords), d.capo);
  const nameOf = (s: { kind: SectionKind; label?: string }) => s.label || KIND_LABEL[s.kind];

  const preview = () => {
    if (playback.current) {
      playback.current.stop();
      playback.current = null;
      return;
    }
    audio();
    playback.current = playChart({
      order: playOrder(content),
      bpm: Number(d.bpm) || song.originalBpm || 90,
      timeSignature: d.timeSignature,
      tuning: d.tuning,
      capo: d.capo,
      shapeFor: (n) => d.voicings[n]?.frets ?? findVoicings(n, d.tuning, 1)[0]?.frets ?? null,
      nameFor: (n) => n,
      onPosition: (p) => {
        setPos(p);
        if (!p) playback.current = null;
      },
    });
  };

  const save = async () => {
    if (!content.sections.some((s) => s.bars.length)) {
      showToast("Add some chords first");
      return;
    }
    if (d.visibility !== "private" && unknown.length) {
      showToast(`Fix the words that aren't chords first: ${unknown.join(", ")}`);
      return;
    }
    setSaving(true);
    const draft: repo.VersionDraft = {
      id,
      songId,
      part: d.part,
      youtubeUrl: d.youtubeUrl.trim() || undefined,
      instrumentId: "guitar",
      tuning: d.tuning,
      capo: d.capo,
      keyPlayed: d.keyPlayed || suggested || undefined,
      bpm: Number(d.bpm) || undefined,
      timeSignature: d.timeSignature,
      techniques: d.techniques,
      label: d.label.trim() || undefined,
      tags: d.tags,
      basedOn: existing?.basedOn,
      content,
      visibility: songPrivate ? "private" : d.visibility,
    };
    if (draft.visibility === "public") {
      try {
        const { contentHash } = await import("../../core/chart");
        const twin = await findPublicVersionDuplicate({ id: id ?? "", songId, contentHash: contentHash(content), tuning: d.tuning, capo: d.capo });
        if (twin) {
          setDupe(twin.id);
          setSaving(false);
          return;
        }
      } catch {
        /* offline: the database refuses an exact duplicate anyway when it syncs */
      }
    }
    const v = await repo.saveVersion(draft);
    if (!existing) await repo.like(songId);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    playback.current?.stop();
    showToast(id ? "Saved" : "Version saved");
    nav.replace({ name: "version", id: v.id });
  };

  const tuningOptions = GUITAR_TUNINGS.some((t) => t.tuning.every((m, i) => m === d.tuning[i])) ? GUITAR_TUNINGS : [...GUITAR_TUNINGS, { id: "custom", name: tuningName(d.tuning), tuning: d.tuning }];


  const STEPS = ["Basics", "Chords", "Strumming", "Order", "Review"] as const;
  const cur = d.sections.find((x) => x.id === secId) ?? d.sections[0]!;
  const curStrum = d.sections.find((x) => x.id === strumSecId) ?? d.sections[0]!;
  const barsCount = content.sections.reduce((n, x) => n + x.bars.length, 0);
  const videoUrl = d.youtubeUrl.trim() || song.youtubeUrl;
  // What is still needed before moving on (null = this step is done).
  const orderedParts = d.arrangement.filter((a) => d.sections.some((x) => x.id === a.sectionId && (parsed.get(x.id)?.bars.length ?? 0) > 0));
  const missing = (i: number): string | null => {
    if (i === 0) return null;
    if (i === 1) return barsCount === 0 ? "Add at least one chord to go on." : unknown.length ? `Fix the words that aren't chords: ${unknown.join(", ")}.` : null;
    if (i === 3) return orderedParts.length === 0 ? "Put at least one section in the song order." : null;
    return null;
  };
  const reachable = (i: number) => STEPS.slice(0, i).every((_, k) => !missing(k));
  const blocked = missing(step);
  const goto = (n: number) => {
    if (n > step && !reachable(n)) return;
    playback.current?.stop();
    playback.current = null;
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    window.scrollTo?.({ top: 0 });
  };

  const sectionPills = (activeId: string, pick: (id: string) => void, withAdd?: boolean) => (
    <div className="chips chips--wrap esteps__secs" role="tablist" aria-label="Sections">
      {d.sections.map((x) => (
        <button key={x.id} role="tab" className="chip" aria-selected={x.id === activeId} aria-pressed={x.id === activeId} onClick={() => pick(x.id)}>
          {nameOf(x)}
          {withAdd && !(parsed.get(x.id)?.bars.length) ? " ·" : ""}
        </button>
      ))}
      {withAdd && (
        <button
          className="chip"
          onClick={() => {
            addSection();
          }}
        >
          <IconPlus /> Section
        </button>
      )}
    </div>
  );

  const cp = parsed.get(cur.id);

  return (
    <>
      <TopBar
        onBack={() => {
          playback.current?.stop();
          if (touched) showToast("Your draft is kept on this device");
          nav.back();
        }}
        title={id ? "Edit version" : "New version"}
      />
      <header className="page-head">
        <p className="muted">{song.artist}</p>
        <h1 className="page-title page-title--sm">{song.title}</h1>
      </header>

      <ol className="esteps" aria-label="Steps">
        {STEPS.map((name, i) => (
          <li key={name} className="esteps__item" data-state={i === step ? "now" : i < step ? "done" : "todo"}>
            <button className="esteps__btn" aria-current={i === step ? "step" : undefined} disabled={!reachable(i)} onClick={() => goto(i)}>
              <span className="esteps__n num">{i + 1}</span>
              <span className="esteps__name">{name}</span>
            </button>
          </li>
        ))}
      </ol>

      {restored && (
        <div className="notice">
          <p className="notice__title">Picked up where you left off</p>
          <p className="notice__text">These are your unsaved changes from last time.</p>
          <button
            className="link"
            onClick={() => {
              try {
                localStorage.removeItem(draftKey);
              } catch {
                /* ignore */
              }
              setD(null);
              setRestored(false);
              setTouched(false);
            }}
          >
            Discard them
          </button>
        </div>
      )}

      {step === 0 && (
        <section className="block">
          <h2 className="h2">What are you adding?</h2>
          <div className="parttabs" role="radiogroup" aria-label="Part of the song">
            {VERSION_PARTS.map((p) => (
              <button key={p} role="radio" aria-checked={d.part === p} className="parttab" aria-selected={d.part === p} onClick={() => set({ part: p })}>
                {PART_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="parthint">{PART_HINT[d.part]}</p>
          <div className="form__grid">
            <label className="field field--wide">
              <span className="field__label">Name of this version (optional)</span>
              <input className="input" value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Easy version, Live 2019" maxLength={60} />
            </label>
            <label className="field">
              <span className="field__label">Tuning</span>
              <select
                className="input"
                value={tuningOptions.find((t) => t.tuning.every((m, i) => m === d.tuning[i]))?.id}
                onChange={(e) => set({ tuning: [...tuningOptions.find((t) => t.id === e.target.value)!.tuning] })}
              >
                {tuningOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="field__label">Capo</span>
              <Stepper label="Capo" value={d.capo ? String(d.capo) : "None"} onDown={() => set({ capo: Math.max(0, d.capo - 1) })} onUp={() => set({ capo: Math.min(12, d.capo + 1) })} />
            </div>
            <div className="field">
              <span className="field__label">Key (as it sounds)</span>
              <select className="input" value={d.keyPlayed} onChange={(e) => set({ keyPlayed: e.target.value })}>
                <option value="">{suggested ? `Suggested: ${suggested}` : "Not set"}</option>
                {KEYS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              {suggested && d.keyPlayed !== suggested && (
                <button className="link" onClick={() => set({ keyPlayed: suggested })}>
                  Use {suggested} (from the chords{d.capo ? ` and capo ${d.capo}` : ""})
                </button>
              )}
            </div>
            <div className="field">
              <span className="field__label">Tempo (bpm)</span>
              <div className="inline">
                <input className="input num" inputMode="numeric" value={d.bpm} onChange={(e) => set({ bpm: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label="Tempo in beats per minute" />
                <button
                  type="button"
                  className="btn btn--secondary tapbtn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const b = tapper.current.tap(e.timeStamp);
                    if (b) set({ bpm: String(b) });
                  }}
                >
                  Tap
                </button>
              </div>
            </div>
            <label className="field">
              <span className="field__label">Time signature</span>
              <select className="input" value={d.timeSignature} onChange={(e) => set({ timeSignature: e.target.value })}>
                {TIME_SIGNATURES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className="field field--wide">
              <span className="field__label">What kind of take</span>
              <div className="chips chips--wrap">
                {VERSION_TAGS.map((t) => (
                  <button key={t} className="chip" aria-pressed={d.tags.includes(t)} onClick={() => set({ tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] })}>
                    {TAG_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field field--wide">
              <span className="field__label">Techniques</span>
              <div className="chips chips--wrap">
                {TECHNIQUES.map((t) => (
                  <button key={t} className="chip" aria-pressed={d.techniques.includes(t)} onClick={() => set({ techniques: d.techniques.includes(t) ? d.techniques.filter((x) => x !== t) : [...d.techniques, t] })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="field field--wide">
              <span className="field__label">Video to listen to (optional)</span>
              <input className="input" type="url" inputMode="url" value={d.youtubeUrl} onChange={(e) => set({ youtubeUrl: e.target.value })} placeholder={song.youtubeUrl ? "Leave empty to use the song's video" : "A YouTube link"} autoCapitalize="off" spellCheck={false} />
              <span className="field__hint">Handy for a lead or solo played in a different recording.</span>
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="block">
          <h2 className="h2">Chords, one section at a time</h2>
          <p className="muted">Add the chords in the order they are played, one bar each. Tap a shape to pick a different fingering. “+ Chord” puts a second chord in the same bar.</p>
          {videoUrl && <VideoPanel url={videoUrl} title={song.title} />}
          {sectionPills(cur.id, setSecId, true)}
          <div className="esec">
            <div className="esec__head">
              <select className="input input--sm" value={cur.kind} onChange={(e) => setSection(cur.id, { kind: e.target.value as SectionKind })} aria-label="Section type">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input className="input input--sm" value={cur.label} onChange={(e) => setSection(cur.id, { label: e.target.value })} placeholder="Name (optional), e.g. Verse 2" maxLength={40} aria-label="Section name" />
            </div>
            {cp && cp.unknown.length > 0 && <p className="field__error">Not chords: {cp.unknown.join(", ")}. Remove them and pick the chord again.</p>}
            {cp && cp.bars.length > 0 ? (
              <ol className="ebars" aria-label={`${nameOf(cur)} bars`}>
                {cp.bars.map((b, bi) => (
                  <li key={bi} className="ebar">
                    <span className="ebar__n num">{bi + 1}</span>
                    <div className="ebar__chords">
                      {b.chords.map((c, ci) => {
                        const v = c.name === NO_CHORD ? null : d.voicings[c.name] ?? findVoicings(c.name, d.tuning, 1)[0];
                        return (
                          <div key={ci} className="echord">
                            <button
                              className="echord__remove"
                              aria-label={`Remove ${c.name} from bar ${bi + 1}`}
                              onClick={() => removeChord(cur.id, bi, ci)}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" className="icon" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                            <span className="echord__name chordname">{c.name}</span>
                            {v && (
                              <button
                                className="echord__shape"
                                aria-label={`Choose a shape for ${c.name}`}
                                onClick={() =>
                                  open({
                                    kind: "chord",
                                    name: c.name,
                                    tuning: d.tuning,
                                    capo: d.capo,
                                    current: d.voicings[c.name]?.frets,
                                    onPick: (vv) => set({ voicings: { ...d.voicings, [c.name]: { frets: vv.frets, fingers: vv.fingers, baseFret: vv.baseFret } } }),
                                  })
                                }
                              >
                                <ChordDiagram voicing={v} leftHanded={prefs.leftHanded} size={72} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="ebar__tools">
                      <button className="iconbtn iconbtn--plain" aria-label={`Move bar ${bi + 1} earlier`} disabled={bi === 0} onClick={() => moveBar(cur.id, bi, -1)}>
                        <svg viewBox="0 0 24 24" width="18" height="18" className="icon" aria-hidden="true">
                          <path d="M14.5 6l-6 6 6 6" />
                        </svg>
                      </button>
                      <button className="iconbtn iconbtn--plain" aria-label={`Move bar ${bi + 1} later`} disabled={bi === cp.bars.length - 1} onClick={() => moveBar(cur.id, bi, 1)}>
                        <svg viewBox="0 0 24 24" width="18" height="18" className="icon" aria-hidden="true">
                          <path d="M9.5 6l6 6-6 6" />
                        </svg>
                      </button>
                      <button className="link" onClick={() => repeatBar(cur.id, bi)}>
                        Repeat
                      </button>
                      <button className="link" onClick={() => open({ kind: "chordPicker", tuning: d.tuning, onPick: (name) => appendChord(cur.id, name, bi) })}>
                        + Chord
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No chords in this section yet.</p>
            )}
            <button className="btn btn--secondary" onClick={() => open({ kind: "chordPicker", tuning: d.tuning, onPick: (name) => appendChord(cur.id, name) })}>
              <IconPlus /> Add chords
            </button>
            <input className="input input--sm" value={cur.note} onChange={(e) => setSection(cur.id, { note: e.target.value })} placeholder="Cue note (optional), e.g. after the drum fill" maxLength={120} aria-label="Cue note" />
            <div className="esec__actions">
              <button
                className="link"
                onClick={() => {
                  duplicateSection(cur);
                }}
              >
                Duplicate
              </button>
              {d.sections.length > 1 && (
                <button
                  className="link link--danger"
                  onClick={() => {
                    setSecId(null);
                    removeSection(cur.id);
                  }}
                >
                  Remove this section
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="block">
          <h2 className="h2">Strumming</h2>
          <p className="muted">Tap a step to change it: down, up, rest or muted. Each section keeps its own pattern.</p>
          {sectionPills(curStrum.id, setStrumSecId)}
          <div className="esec">
            <div className="esec__strum">
              <div className="strumedit" role="group" aria-label="Strumming pattern">
                {curStrum.strum.map((st, k) => (
                  <button
                    key={k}
                    className="strumedit__step"
                    aria-label={`Step ${k + 1}: ${st === "D" ? "down" : st === "U" ? "up" : st === "x" ? "muted" : "rest"}`}
                    onClick={() => {
                      const steps = [...curStrum.strum];
                      steps[k] = NEXT[(NEXT.indexOf(st) + 1) % NEXT.length]!;
                      setSection(curStrum.id, { strum: steps });
                    }}
                  >
                    <StrumGlyph step={st} />
                  </button>
                ))}
              </div>
              <button
                className="iconbtn iconbtn--plain"
                aria-label="Hear this pattern"
                onClick={() => {
                  const first = parsed.get(curStrum.id)?.bars[0]?.chords[0]?.name ?? allChords[0];
                  const f = first && first !== NO_CHORD ? d.voicings[first]?.frets ?? findVoicings(first, d.tuning, 1)[0]?.frets : null;
                  if (!f) return showToast("Add a chord to hear the pattern");
                  const { ctx } = audio();
                  const stepSec = (60 / (Number(d.bpm) || 90)) * (bpb / curStrum.strum.length);
                  curStrum.strum.forEach((st, k) => strumStep(st, f, d.tuning, d.capo, ctx.currentTime + 0.05 + k * stepSec, stepSec * 2, k === 0));
                }}
              >
                <IconPlay />
              </button>
            </div>
            <div className="esec__actions">
              <button className="link" onClick={() => set({ sections: d.sections.map((x) => ({ ...x, strum: [...curStrum.strum] })) })}>
                Use this pattern for every section
              </button>
              <button className="link" onClick={() => setSection(curStrum.id, { strum: [...DEFAULT_STRUM] })}>
                Reset
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="block">
          <h2 className="h2">Song order</h2>
          <p className="muted">The order the sections are played in. A section can come back as many times as you like without typing it again.</p>
          <ol className="arr">
            {d.arrangement.map((a, i) => {
              const sec = d.sections.find((x) => x.id === a.sectionId);
              if (!sec) return null;
              return (
                <li key={`${a.sectionId}-${i}`} className="arr__item">
                  <span className="arr__name">{nameOf(sec)}</span>
                  <Stepper
                    label="Times"
                    value={`×${a.repeat}`}
                    onDown={() => set({ arrangement: d.arrangement.map((x, j) => (j === i ? { ...x, repeat: Math.max(1, x.repeat - 1) } : x)) })}
                    onUp={() => set({ arrangement: d.arrangement.map((x, j) => (j === i ? { ...x, repeat: Math.min(16, x.repeat + 1) } : x)) })}
                  />
                  <button className="iconbtn iconbtn--plain" aria-label="Move earlier" onClick={() => moveArr(i, -1)} disabled={i === 0}>
                    <svg viewBox="0 0 24 24" width="20" height="20" className="icon" aria-hidden="true">
                      <path d="M6 14.5l6-6 6 6" />
                    </svg>
                  </button>
                  <button className="iconbtn iconbtn--plain" aria-label="Move later" onClick={() => moveArr(i, 1)} disabled={i === d.arrangement.length - 1}>
                    <svg viewBox="0 0 24 24" width="20" height="20" className="icon" aria-hidden="true">
                      <path d="M6 9.5l6 6 6-6" />
                    </svg>
                  </button>
                  <button className="link link--danger" onClick={() => set({ arrangement: d.arrangement.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="field__label">Add to the order</p>
          <div className="chips chips--wrap">
            {d.sections.map((x) => (
              <button key={x.id} className="chip" onClick={() => set({ arrangement: [...d.arrangement, { sectionId: x.id, repeat: 1 }] })}>
                <IconPlus /> {nameOf(x)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="block">
          <h2 className="h2">Review</h2>
          <dl className="esummary">
            <div>
              <dt>Part</dt>
              <dd>{PART_LABEL[d.part]}</dd>
            </div>
            <div>
              <dt>Setup</dt>
              <dd>
                {tuningName(d.tuning)} · {d.capo ? `capo ${d.capo}` : "no capo"} · {d.timeSignature}
                {d.bpm ? ` · ${d.bpm} bpm` : ""}
              </dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>
                {d.sections.length} · {barsCount} bar{barsCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt>Chords</dt>
              <dd className="chordname">{allChords.join(" ") || "None yet"}</dd>
            </div>
          </dl>
          {unknown.length > 0 && <p className="field__error">Not chords: {unknown.join(", ")}. Go back to Chords to fix them.</p>}
          {barsCount === 0 && <p className="field__error">No chords yet. Go back to Chords and add some.</p>}
          <div className="field">
            <span className="field__label">Who can see it</span>
            <Segmented
              label="Who can see it"
              value={songPrivate ? "private" : d.visibility}
              onChange={(v) => !songPrivate && set({ visibility: v })}
              options={[
                { id: "private", label: "Only me" },
                { id: "unlisted", label: "Link" },
                { id: "public", label: "Everyone" },
              ]}
            />
            <span className="field__hint">
              {songPrivate
                ? "The song is private, so its versions are too. Make the song public to share versions."
                : d.visibility === "public"
                  ? "Everyone can see it, save a copy (your credit stays) and rate it."
                  : d.visibility === "unlisted"
                    ? "Anyone with the link can see it (links arrive with sharing)."
                    : "Only you can see it."}
            </span>
            {dupe && (
              <p className="field__error">
                The exact same chords, tuning and capo are already public.{" "}
                <button className="link" onClick={() => nav.push({ name: "version", id: dupe })}>
                  Open that version
                </button>{" "}
                or change something (a different capo or chords is fine).
              </p>
            )}
          </div>
          <button className="btn btn--secondary btn--big" onClick={preview} disabled={!allChords.length}>
            {pos ? <IconPause /> : <IconPlay />} {pos ? "Stop" : "Hear it"}
          </button>
        </section>
      )}

      {blocked && step < STEPS.length - 1 && (
        <p className="field__hint" role="status">
          {blocked}
        </p>
      )}
      <div className="form__footer form__footer--row">
        {step > 0 ? (
          <button className="btn btn--secondary btn--big" onClick={() => goto(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn btn--primary btn--big" onClick={() => goto(step + 1)} disabled={!!blocked}>
            Next: {STEPS[step + 1]}
          </button>
        ) : (
          <button className="btn btn--primary btn--big" onClick={() => void save()} disabled={saving || [0, 1, 3].some((k) => !!missing(k))}>
            Save version
          </button>
        )}
      </div>
    </>
  );
}
