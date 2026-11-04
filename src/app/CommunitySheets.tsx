import { useState } from "react";
import { GENRES, KEYS } from "../core/genres";
import type { Song } from "../core/model";
import { report, suggestEdit, type ReportReason, type ReportTarget } from "../data/community";
import { useOverlays } from "./overlays";

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: "wrong_info", label: "Wrong chords or info", hint: "The chords, key, tuning or song details are wrong." },
  { id: "duplicate", label: "Duplicate", hint: "The same song or version is already in Gitara." },
  { id: "spam", label: "Spam", hint: "Ads, nonsense or something unrelated to music." },
  { id: "offensive", label: "Offensive", hint: "Hateful, harassing or inappropriate." },
  { id: "copyright", label: "Copyright", hint: "It copies material someone owns (for a formal takedown, use the copyright form in About)." },
  { id: "other", label: "Something else", hint: "Tell us what's wrong." },
];

/** Report something (K-series). Goes to the review queue; the reporter isn't shown to the author. */
export function ReportSheet({ targetType, targetId, label }: { targetType: ReportTarget; targetId: string; label: string }) {
  const { close, showToast } = useOverlays();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">Report</h2>
          <p className="row__sub">{label}</p>
        </div>
      </div>
      <div className="menu" role="radiogroup" aria-label="What's wrong">
        {REASONS.map((r) => (
          <button key={r.id} role="radio" aria-checked={reason === r.id} className="menuitem menuitem--choice" onClick={() => setReason(r.id)}>
            <span>
              <span className="menuitem__title">{r.label}</span>
              <span className="menuitem__hint menuitem__hint--block">{r.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Details (optional)</span>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} placeholder="What should be fixed?" />
      </label>
      <div className="stack">
        <button
          className="btn btn--primary"
          disabled={!reason || sending}
          onClick={async () => {
            if (!reason) return;
            setSending(true);
            try {
              await report(targetType, targetId, reason, note);
              close();
              showToast("Thanks. It's in the review queue.");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Couldn't send the report");
              setSending(false);
            }
          }}
        >
          Send report
        </button>
        <button className="btn btn--ghost" onClick={close}>
          Cancel
        </button>
      </div>
    </>
  );
}

/** Suggest a fix to a public song's info (K1). The person who added it decides. */
export function SuggestSheet({ song }: { song: Song }) {
  const { close, showToast } = useOverlays();
  const [f, setF] = useState({
    title: song.title,
    artist: song.artist,
    album: song.album ?? "",
    releaseYear: song.releaseYear ? String(song.releaseYear) : "",
    genre: song.genre ?? "",
    originalKey: song.originalKey ?? "",
    originalBpm: song.originalBpm ? String(song.originalBpm) : "",
  });
  const [note, setNote] = useState("");
  const patch: Record<string, unknown> = {};
  if (f.title.trim() !== song.title) patch.title = f.title.trim();
  if (f.artist.trim() !== song.artist) patch.artist = f.artist.trim();
  if (f.album.trim() !== (song.album ?? "")) patch.album = f.album.trim() || null;
  if (f.releaseYear !== (song.releaseYear ? String(song.releaseYear) : "")) patch.releaseYear = f.releaseYear ? Number(f.releaseYear) : null;
  if (f.genre !== (song.genre ?? "")) patch.genre = f.genre || null;
  if (f.originalKey !== (song.originalKey ?? "")) patch.originalKey = f.originalKey || null;
  if (f.originalBpm !== (song.originalBpm ? String(song.originalBpm) : "")) patch.originalBpm = f.originalBpm ? Number(f.originalBpm) : null;
  const changed = Object.keys(patch).length > 0;
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">Suggest a fix</h2>
          <p className="row__sub">Change what's wrong. The person who added the song decides.</p>
        </div>
      </div>
      <div className="form__grid">
        <label className="field field--wide">
          <span className="field__label">Title</span>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field field--wide">
          <span className="field__label">Artist</span>
          <input className="input" value={f.artist} onChange={(e) => set("artist", e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Album</span>
          <input className="input" value={f.album} onChange={(e) => set("album", e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Year</span>
          <input className="input num" inputMode="numeric" value={f.releaseYear} onChange={(e) => set("releaseYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />
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
          <select className="input" value={f.originalKey} onChange={(e) => set("originalKey", e.target.value)}>
            <option value="">Not set</option>
            {KEYS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Tempo (bpm)</span>
          <input className="input num" inputMode="numeric" value={f.originalBpm} onChange={(e) => set("originalBpm", e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </label>
        <label className="field field--wide">
          <span className="field__label">Why (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="e.g. it's on the 2019 album, not 2018" />
        </label>
      </div>
      <div className="stack">
        <button
          className="btn btn--primary"
          disabled={!changed}
          onClick={async () => {
            try {
              await suggestEdit(song.id, patch, note);
              close();
              showToast("Suggestion sent");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Couldn't send it");
            }
          }}
        >
          Send suggestion
        </button>
        <button className="btn btn--ghost" onClick={close}>
          Cancel
        </button>
      </div>
    </>
  );
}
