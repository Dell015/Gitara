import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { audio, strumStep } from "../../audio/guitar";
import { playChart, type Playback, type PlayPosition } from "../../audio/player";
import { beatsPerBar, DEFAULT_STRUM, formatBars, NO_CHORD, parseBars, playOrder } from "../../core/chart";
import { TIME_SIGNATURES, KEYS } from "../../core/genres";
import { GUITAR, GUITAR_TUNINGS } from "../../core/instrument";
import { VERSION_TAGS, type ArrangementItem, type SectionKind, type StrumStep, type VersionContent, type VersionTag, type Visibility } from "../../core/model";
import { findVoicings } from "../../core/shapes";
import { TapTempo } from "../../core/tempo";
import { suggestKey, transposeKey } from "../../core/theory";
import { tuningName } from "../../core/tunings";
import { db } from "../../data/local-db";
import { findPublicVersionDuplicate } from "../../data/remote";
import * as repo from "../../data/repo";
import { Segmented, TopBar } from "../../ui/bits";
import { StrumGlyph } from "../../ui/ChordDiagram";
import { IconPause, IconPlay, IconPlus } from "../../ui/icons";
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
const TAG_LABEL: Record<VersionTag, string> = { cover: "Cover", live: "Live", acoustic: "Acoustic", original: "Original", simplified: "Simplified", fingerstyle: "Fingerstyle" };
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
export function EditVersion({ songId, id }: { songId: string; id?: string }) {
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
      setD(saved);
      setRestored(true);
      return;
    }
    if (base) return setD(base);
    const first: EditSection = { id: sid(), kind: "verse", label: "", text: "", strum: [...DEFAULT_STRUM], note: "" };
    setD({
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
  };
  const removeSection = (sidv: string) => set({ sections: d.sections.filter((s) => s.id !== sidv), arrangement: d.arrangement.filter((a) => a.sectionId !== sidv) });
  const duplicateSection = (s: EditSection) => {
    const c = { ...s, id: sid(), strum: [...s.strum] };
    const i = d.sections.findIndex((x) => x.id === s.id);
    const sections = [...d.sections];
    sections.splice(i + 1, 0, c);
    set({ sections, arrangement: [...d.arrangement, { sectionId: c.id, repeat: 1 }] });
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

  return (
    <>
      <TopBar
        onBack={() => {
          playback.current?.stop();
          if (touched) showToast("Your draft is kept on this device");
          nav.back();
        }}
        title={id ? "Edit version" : "New version"}
        right={
          <button className="btn btn--primary btn--sm" onClick={() => void save()} disabled={saving}>
            Save
          </button>
        }
      />
      <header className="page-head">
        <p className="muted">{song.artist}</p>
        <h1 className="page-title page-title--sm">{song.title}</h1>
      </header>

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

      <section className="block">
        <h2 className="h2">Sections</h2>
        <p className="muted">
          Type the chords, one per bar: <span className="kbdtext">Am F C G</span>. Put two in a bar with a bar line: <span className="kbdtext">Am C | F G</span>. A dot holds a chord one more beat:{" "}
          <span className="kbdtext">Am . . F</span>.
        </p>
        {d.sections.map((s) => {
          const p = parsed.get(s.id);
          return (
            <div className="esec" key={s.id}>
              <div className="esec__head">
                <select className="input input--sm" value={s.kind} onChange={(e) => setSection(s.id, { kind: e.target.value as SectionKind })} aria-label="Section type">
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input className="input input--sm" value={s.label} onChange={(e) => setSection(s.id, { label: e.target.value })} placeholder="Name (optional), e.g. Verse 2" maxLength={40} aria-label="Section name" />
              </div>
              <textarea
                className="input esec__chords"
                value={s.text}
                onChange={(e) => setSection(s.id, { text: e.target.value })}
                placeholder="Am F C G"
                rows={2}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label={`${nameOf(s)} chords`}
              />
              {p && p.unknown.length > 0 && <p className="field__error">Not chords: {p.unknown.join(", ")}. Check the spelling, or write N.C. for no chord.</p>}
              {p && p.bars.length > 0 && (
                <ol className="bars bars--mini" aria-label="Bars">
                  {p.bars.map((b, bi) => {
                    const on = !!pos && playOrder(content)[pos.part]?.id === s.id && pos.bar === bi;
                    return (
                      <li key={bi} className="cbar" data-on={on}>
                        {b.chords.map((c, ci) => (
                          <button
                            key={ci}
                            className="cbar__chord chordname"
                            style={{ flexGrow: c.beats }}
                            onClick={() =>
                              c.name !== NO_CHORD &&
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
                            {c.name}
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="esec__strum">
                <span className="field__label">Strum</span>
                <div className="strumedit" role="group" aria-label="Strumming pattern">
                  {s.strum.map((st, k) => (
                    <button
                      key={k}
                      className="strumedit__step"
                      aria-label={`Step ${k + 1}: ${st === "D" ? "down" : st === "U" ? "up" : st === "x" ? "muted" : "rest"}`}
                      onClick={() => {
                        const steps = [...s.strum];
                        steps[k] = NEXT[(NEXT.indexOf(st) + 1) % NEXT.length]!;
                        setSection(s.id, { strum: steps });
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
                    const first = p?.bars[0]?.chords[0]?.name;
                    const f = first && first !== NO_CHORD ? d.voicings[first]?.frets ?? findVoicings(first, d.tuning, 1)[0]?.frets : null;
                    if (!f) return showToast("Add a chord to hear the pattern");
                    const { ctx } = audio();
                    const stepSec = (60 / (Number(d.bpm) || 90)) * (bpb / s.strum.length);
                    s.strum.forEach((st, k) => strumStep(st, f, d.tuning, d.capo, ctx.currentTime + 0.05 + k * stepSec, stepSec * 2, k === 0));
                  }}
                >
                  <IconPlay />
                </button>
              </div>
              <input className="input input--sm" value={s.note} onChange={(e) => setSection(s.id, { note: e.target.value })} placeholder="Cue note (optional), e.g. after the drum fill" maxLength={120} aria-label="Cue note" />
              <div className="esec__actions">
                <button className="link" onClick={() => duplicateSection(s)}>
                  Duplicate
                </button>
                {d.sections.length > 1 && (
                  <button className="link link--danger" onClick={() => removeSection(s.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <button className="btn btn--secondary" onClick={addSection}>
          <IconPlus /> Add a section
        </button>
      </section>

      <section className="block">
        <h2 className="h2">Song order</h2>
        <p className="muted">The order the sections are played in. A section can come back as many times as you like without typing it again.</p>
        <ol className="arr">
          {d.arrangement.map((a, i) => {
            const s = d.sections.find((x) => x.id === a.sectionId);
            if (!s) return null;
            return (
              <li key={`${a.sectionId}-${i}`} className="arr__item">
                <span className="arr__name">{nameOf(s)}</span>
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
        <div className="chips chips--wrap">
          {d.sections.map((s) => (
            <button key={s.id} className="chip" onClick={() => set({ arrangement: [...d.arrangement, { sectionId: s.id, repeat: 1 }] })}>
              <IconPlus /> {nameOf(s)}
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <h2 className="h2">Details</h2>
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
          <div className="field field--wide">
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
                  ? "Everyone can see it, save a copy (your credit stays) and vote on it later."
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
        </div>
      </section>

      <div className="form__footer form__footer--row">
        <button className="btn btn--secondary btn--big" onClick={preview} disabled={!allChords.length}>
          {pos ? <IconPause /> : <IconPlay />} {pos ? "Stop" : "Hear it"}
        </button>
        <button className="btn btn--primary btn--big" onClick={() => void save()} disabled={saving}>
          Save version
        </button>
      </div>
    </>
  );
}
