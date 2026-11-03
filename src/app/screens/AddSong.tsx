import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { GENRES, KEYS, TIME_SIGNATURES } from "../../core/genres";
import type { Song } from "../../core/model";
import { TapTempo } from "../../core/tempo";
import { db } from "../../data/local-db";
import { searchRecordings, type MbSuggestion } from "../../data/musicbrainz";
import { findPublicDuplicate } from "../../data/remote";
import * as repo from "../../data/repo";
import { Segmented, TopBar } from "../../ui/bits";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";

interface Form {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  key: string;
  bpm: string;
  time: string;
  length: string; // m:ss
  youtube: string;
  spotify: string;
  original: boolean;
  visibility: "private" | "public";
  mbid?: string;
}

const EMPTY: Form = { title: "", artist: "", album: "", year: "", genre: "", key: "", bpm: "", time: "4/4", length: "", youtube: "", spotify: "", original: false, visibility: "private" };

function fromSong(s: Song): Form {
  return {
    title: s.title,
    artist: s.artist,
    album: s.album ?? "",
    year: s.releaseYear ? String(s.releaseYear) : "",
    genre: s.genre ?? "",
    key: s.originalKey ?? "",
    bpm: s.originalBpm ? String(s.originalBpm) : "",
    time: s.timeSignature,
    length: s.durationSec ? `${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, "0")}` : "",
    youtube: s.youtubeUrl ?? "",
    spotify: s.spotifyUrl ?? "",
    original: s.tags.includes("original"),
    visibility: s.visibility,
    mbid: s.musicbrainzId,
  };
}

function parseLength(v: string): number | undefined {
  const m = v.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.title.trim()) e.title = "Add the song's title.";
  if (!f.artist.trim()) e.artist = "Add the artist (or your name, for your own song).";
  if (f.year && !/^\d{4}$/.test(f.year)) e.year = "Use a 4-digit year, like 2019.";
  if (f.bpm && !(Number(f.bpm) >= 20 && Number(f.bpm) <= 400)) e.bpm = "Tempo is between 20 and 400 bpm.";
  if (f.length && parseLength(f.length) === undefined) e.length = "Use minutes:seconds, like 3:45.";
  if (f.youtube && !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(f.youtube.trim())) e.youtube = "Paste a YouTube link.";
  if (f.spotify && !/^https?:\/\/open\.spotify\.com\//.test(f.spotify.trim())) e.spotify = "Paste a Spotify link (open.spotify.com).";
  return e;
}

export function AddSong({ title, artist, editId }: { title?: string; artist?: string; editId?: string }) {
  const nav = useNav();
  const { showToast } = useOverlays();
  const editing = useLiveQuery(() => (editId ? db.songs.get(editId) : undefined), [editId]);
  const [f, setF] = useState<Form>({ ...EMPTY, title: title ?? "", artist: artist ?? "" });
  const [touched, setTouched] = useState(false);
  const [more, setMore] = useState(false);
  const [mb, setMb] = useState<MbSuggestion[]>([]);
  const [mbState, setMbState] = useState<"idle" | "loading" | "error">("idle");
  const [picked, setPicked] = useState(false);
  const [localDupes, setLocalDupes] = useState<Song[]>([]);
  const [publicDupe, setPublicDupe] = useState<Song | null>(null);
  const [saving, setSaving] = useState(false);
  const tapper = useRef(new TapTempo());
  const loaded = useRef(false);

  useEffect(() => {
    if (editing && !loaded.current) {
      loaded.current = true;
      setF(fromSong(editing));
      setMore(true);
      setPicked(true);
    }
  }, [editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Name suggestions while typing title/artist (not when editing an existing song).
  useEffect(() => {
    if (editId || picked || f.title.trim().length < 2) {
      setMb([]);
      return;
    }
    const ctrl = new AbortController();
    setMbState("loading");
    const t = window.setTimeout(() => {
      searchRecordings(f.title, f.artist, ctrl.signal).then(
        (r) => {
          if (ctrl.signal.aborted) return;
          setMb(r);
          setMbState("idle");
        },
        () => !ctrl.signal.aborted && setMbState("error"),
      );
    }, 600);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [f.title, f.artist, picked, editId]);

  // "This song may already exist"
  useEffect(() => {
    const t = window.setTimeout(async () => {
      const local = (await repo.findLocalDuplicates(f.title, f.artist)).filter((s) => s.id !== editId);
      setLocalDupes(local);
      try {
        const pub = await findPublicDuplicate(f.title, f.artist);
        setPublicDupe(pub && pub.id !== editId ? pub : null);
      } catch {
        setPublicDupe(null);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [f.title, f.artist, editId]);

  const pick = (s: MbSuggestion) => {
    setF((p) => ({
      ...p,
      title: s.title,
      artist: s.artist,
      album: p.album || s.album || "",
      year: p.year || (s.year ? String(s.year) : ""),
      length: p.length || (s.durationSec ? `${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, "0")}` : ""),
      mbid: s.id,
    }));
    setPicked(true);
    setMb([]);
  };

  const errors = validate(f);
  const blockedPublic = f.visibility === "public" && !!publicDupe;
  const canSave = !Object.keys(errors).length && !blockedPublic && !saving;

  const save = async () => {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    const tags = (editing?.tags ?? []).filter((t) => t !== "original");
    if (f.original) tags.push("original");
    const data = {
      title: f.title.trim(),
      artist: f.artist.trim(),
      album: f.album.trim() || undefined,
      releaseYear: f.year ? Number(f.year) : undefined,
      genre: f.genre || undefined,
      originalKey: f.key || undefined,
      originalBpm: f.bpm ? Number(f.bpm) : undefined,
      timeSignature: f.time,
      durationSec: parseLength(f.length),
      youtubeUrl: f.youtube.trim() || undefined,
      spotifyUrl: f.spotify.trim() || undefined,
      musicbrainzId: f.mbid,
      visibility: f.visibility,
      tags,
    };
    if (editId) {
      await repo.updateSong(editId, data);
      showToast("Saved");
      nav.back();
      return;
    }
    const song = await repo.addSong(data);
    showToast("Added to your Library");
    nav.replace({ name: "song", id: song.id });
  };

  const err = (k: keyof Form) => (touched && errors[k] ? <span className="field__error">{errors[k]}</span> : null);

  return (
    <>
      <TopBar onBack={nav.back} title={editId ? "Edit song info" : "Add a song"} />
      <form
        className="form form--page"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="input"
            value={f.title}
            onChange={(e) => {
              set("title", e.target.value);
              setPicked(false);
            }}
            autoFocus={!title}
            autoComplete="off"
            maxLength={200}
            aria-invalid={touched && !!errors.title}
          />
          {err("title")}
        </label>
        <label className="field">
          <span className="field__label">Artist</span>
          <input
            className="input"
            value={f.artist}
            onChange={(e) => {
              set("artist", e.target.value);
              setPicked(false);
            }}
            autoComplete="off"
            maxLength={200}
            aria-invalid={touched && !!errors.artist}
          />
          {err("artist")}
        </label>

        {!editId && !picked && (mb.length > 0 || mbState === "loading") && (
          <div className="suggest" aria-live="polite">
            <p className="suggest__label">{mbState === "loading" && !mb.length ? "Looking up spellings…" : "Did you mean"}</p>
            {mb.map((s) => (
              <button type="button" key={s.id} className="suggest__item" onClick={() => pick(s)}>
                <span className="irow__title">{s.title}</span>
                <span className="irow__sub">{[s.artist, s.album, s.year].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
            <p className="suggest__credit">Names from MusicBrainz</p>
          </div>
        )}

        {(localDupes.length > 0 || publicDupe) && (
          <div className="notice" role="status">
            <p className="notice__title">This song may already be in Gitara</p>
            {[...localDupes, ...(publicDupe && !localDupes.some((d) => d.id === publicDupe.id) ? [publicDupe] : [])].map((d) => (
              <button type="button" key={d.id} className="link" onClick={() => nav.push({ name: "song", id: d.id })}>
                Open “{d.title}” by {d.artist} ({d.visibility === "public" ? "public" : "yours, private"})
              </button>
            ))}
            <p className="notice__text">If it's the same song, add your chords to that one instead. A cover, live or acoustic take is still the same song.</p>
          </div>
        )}

        <div className="field">
          <span className="field__label">Who can see it</span>
          <Segmented
            label="Who can see it"
            value={f.visibility}
            onChange={(v) => set("visibility", v)}
            options={[
              { id: "private", label: "Only me" },
              { id: "public", label: "Everyone" },
            ]}
          />
          <span className="field__hint">
            {f.visibility === "private" ? "Private: only you see it. You can make it public later." : "Public: anyone can find it, add it to their Library and add chords."}
          </span>
          {blockedPublic && <span className="field__error">There's already a public song with this title and artist. Open it above, or keep yours private.</span>}
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={f.original} onChange={(e) => set("original", e.target.checked)} />
          <span>This is my own song</span>
        </label>

        <button type="button" className="disclosure" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Fewer details" : "More details (optional)"}
        </button>

        {more && (
          <div className="form__grid">
            <label className="field">
              <span className="field__label">Album</span>
              <input className="input" value={f.album} onChange={(e) => set("album", e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Year</span>
              <input className="input num" inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              {err("year")}
            </label>
            <label className="field">
              <span className="field__label">Genre</span>
              <select className="input" value={f.genre} onChange={(e) => set("genre", e.target.value)}>
                <option value="">Not set</option>
                {GENRES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Original key</span>
              <select className="input" value={f.key} onChange={(e) => set("key", e.target.value)}>
                <option value="">Not set</option>
                {KEYS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="field__label">Tempo (bpm)</span>
              <div className="inline">
                <input
                  className="input num"
                  inputMode="numeric"
                  value={f.bpm}
                  onChange={(e) => set("bpm", e.target.value.replace(/\D/g, "").slice(0, 3))}
                  aria-label="Tempo in beats per minute"
                />
                <button
                  type="button"
                  className="btn btn--secondary tapbtn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const bpm = tapper.current.tap(e.timeStamp);
                    if (bpm) set("bpm", String(bpm));
                  }}
                >
                  Tap
                </button>
              </div>
              <span className="field__hint">Tap along with the song, four taps or more.</span>
              {err("bpm")}
            </div>
            <label className="field">
              <span className="field__label">Time signature</span>
              <select className="input" value={f.time} onChange={(e) => set("time", e.target.value)}>
                {TIME_SIGNATURES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Length</span>
              <input className="input num" value={f.length} onChange={(e) => set("length", e.target.value)} placeholder="3:45" inputMode="numeric" />
              {err("length")}
            </label>
            <label className="field field--wide">
              <span className="field__label">YouTube link to the original</span>
              <input className="input" type="url" value={f.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="https://youtube.com/watch?v=…" />
              {err("youtube")}
            </label>
            <label className="field field--wide">
              <span className="field__label">Spotify link</span>
              <input className="input" type="url" value={f.spotify} onChange={(e) => set("spotify", e.target.value)} placeholder="https://open.spotify.com/track/…" />
              {err("spotify")}
            </label>
          </div>
        )}

        <div className="form__footer">
          <button className="btn btn--primary btn--big" type="submit" disabled={saving}>
            {editId ? "Save changes" : "Add song"}
          </button>
          {touched && !canSave && !saving && <span className="field__error">Fix the highlighted fields first.</span>}
        </div>
      </form>
    </>
  );
}
