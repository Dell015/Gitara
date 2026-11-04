import { useEffect, useState } from "react";
import type { PublicSections, Song } from "../../core/model";
import { tuningName } from "../../core/tunings";
import { currentUserId, useSession } from "../../data/auth";
import { getProfile, myProfile, profileStats, publicContentOf, updateMyProfile, type Profile as P, type ProfileStats } from "../../data/community";
import { Art } from "../../ui/Art";
import { warmthFor } from "../../ui/artwork";
import { Empty, ItemRow, Mark, TopBar } from "../../ui/bits";
import { HeatMark } from "../../ui/HeatMark";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { SongList } from "../rows";

const SECTIONS: { id: keyof PublicSections; label: string; hint: string }[] = [
  { id: "planning", label: "Planning to learn", hint: "Songs you want to learn" },
  { id: "learning", label: "Learning", hint: "Songs you're working on" },
  { id: "performing", label: "Performing", hint: "Songs you can play" },
  { id: "rating", label: "Your rating", hint: "Upvotes and ratings on what you've shared" },
];

function Stats({ s }: { s: ProfileStats | null }) {
  if (!s) return null;
  return (
    <div className="stats">
      <span className="stat">
        <span className="stat__n num">{s.versionVotes}</span>
        <span className="stat__l">upvotes</span>
      </span>
      <span className="stat">
        <span className="stat__n num">{s.publicVersions}</span>
        <span className="stat__l">versions shared</span>
      </span>
      <span className="stat">
        <span className="stat__n num">{s.ratingAvg !== null ? s.ratingAvg.toFixed(1) : "–"}</span>
        <span className="stat__l">{s.ratings ? `from ${s.ratings} ratings` : "song rating"}</span>
      </span>
      <span className="stat">
        <span className="stat__n num">{s.publicTracks}</span>
        <span className="stat__l">tracks shared</span>
      </span>
    </div>
  );
}

/** Your profile (H1/H3): who you are here, and exactly what you show. Everything starts private. */
export function MyProfile() {
  const nav = useNav();
  const { showToast } = useOverlays();
  const session = useSession();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [form, setForm] = useState({ handle: "", displayName: "", bio: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== "ready") return;
    myProfile().then((x) => {
      setP(x);
      if (x) setForm({ handle: x.handle ?? "", displayName: x.displayName ?? "", bio: x.bio ?? "" });
    }, () => setP(null));
    const id = currentUserId();
    if (id) profileStats(id).then(setStats, () => undefined);
  }, [session.status]);

  if (session.status !== "ready" || p === null)
    return (
      <>
        <TopBar onBack={nav.back} title="Your profile" />
        <Empty title={session.status === "checking" ? "Connecting…" : "Your profile needs the internet"} text="Your songs still work offline. Profiles, sharing and votes come back when you're online." />
      </>
    );
  if (p === undefined) return <TopBar onBack={nav.back} title="Your profile" />;

  const save = async () => {
    setError(null);
    if (form.handle && !/^[a-z0-9_]{3,20}$/.test(form.handle)) {
      setError("A handle is 3–20 lowercase letters, numbers or _.");
      return;
    }
    try {
      await updateMyProfile({ handle: form.handle, displayName: form.displayName, bio: form.bio });
      showToast("Profile saved");
      setP({ ...p, handle: form.handle || undefined, displayName: form.displayName || undefined, bio: form.bio || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  };
  const toggle = async (k: keyof PublicSections) => {
    const next = { ...p.publicSections, [k]: !p.publicSections[k] };
    setP({ ...p, publicSections: next });
    try {
      await updateMyProfile({ publicSections: next });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save");
      setP(p);
    }
  };

  return (
    <>
      <TopBar onBack={nav.back} title="Your profile" />
      <header className="profilehead">
        <Art seed={p.id} warmth={0.9} className="profilehead__art" round />
        <div>
          <h1 className="page-title page-title--sm">{p.displayName || (p.handle ? `@${p.handle}` : "Guitarist")}</h1>
          <p className="muted">{p.handle ? `@${p.handle}` : "No @handle yet"} · guest account</p>
        </div>
      </header>
      <Stats s={stats} />

      <section className="block">
        <h2 className="h2">About you</h2>
        <div className="form__grid">
          <label className="field">
            <span className="field__label">@handle</span>
            <input className="input" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) })} placeholder="e.g. ana_plays" autoCapitalize="off" />
            <span className="field__hint">Unique. Friends use it to share playlists with you.</span>
          </label>
          <label className="field">
            <span className="field__label">Display name</span>
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value.slice(0, 40) })} placeholder="Any name (real names are optional)" />
          </label>
          <label className="field field--wide">
            <span className="field__label">Bio</span>
            <input className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 280) })} placeholder="What you play, what you like" />
          </label>
        </div>
        {error && <p className="field__error">{error}</p>}
        <div className="stack">
          <button className="btn btn--primary" onClick={() => void save()}>
            Save
          </button>
        </div>
      </section>

      <section className="block">
        <h2 className="h2">What others can see</h2>
        <p className="muted">Everything is private until you switch it on. Songs, versions, tracks and playlists you make public are always shown.</p>
        <div className="list">
          {SECTIONS.map((s) => (
            <label key={s.id} className="switchrow">
              <span className="irow__main">
                <span className="irow__title">{s.label}</span>
                <span className="irow__sub">{s.hint}</span>
              </span>
              <input type="checkbox" className="switch" checked={p.publicSections[s.id]} onChange={() => void toggle(s.id)} />
            </label>
          ))}
        </div>
        <button className="link" onClick={() => nav.push({ name: "user", id: p.id })}>
          See your profile as others do
        </button>
      </section>
      <p className="muted num">Account id: {p.id}</p>
      {p.isAdmin && (
        <button className="btn btn--secondary" onClick={() => nav.push({ name: "admin" })}>
          Open the review queue
        </button>
      )}
    </>
  );
}

/** Someone's public profile (H2): only what they chose to show. */
export function UserProfile({ id }: { id: string }) {
  const nav = useNav();
  const { open } = useOverlays();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [content, setContent] = useState<Awaited<ReturnType<typeof publicContentOf>> | undefined>(undefined);
  useEffect(() => {
    getProfile(id).then(setP, () => setP(null));
    profileStats(id).then(setStats, () => undefined);
    publicContentOf(id).then(setContent, () => setContent(null));
  }, [id]);

  if (p === undefined) return <TopBar onBack={nav.back} />;
  if (!p)
    return (
      <>
        <TopBar onBack={nav.back} />
        <Empty title="This profile is private" text="They haven't shared anything yet, or you're offline." />
      </>
    );
  const sections = (["performing", "learning", "planning"] as const).filter((s) => p.publicSections[s]);
  const byId = content?.songsById ?? new Map<string, Song>();
  return (
    <>
      <TopBar
        onBack={nav.back}
        right={
          currentUserId() !== id && (
            <button className="link link--danger" onClick={() => open({ kind: "report", targetType: "profile", targetId: id, label: p.handle ? `@${p.handle}` : "Profile" })}>
              Report
            </button>
          )
        }
      />
      <header className="profilehead">
        <Art seed={p.id} warmth={0.9} className="profilehead__art" round />
        <div>
          <h1 className="page-title page-title--sm">{p.displayName || (p.handle ? `@${p.handle}` : "Guitarist")}</h1>
          {p.handle && <p className="muted">@{p.handle}</p>}
          {p.bio && <p className="muted">{p.bio}</p>}
        </div>
      </header>
      {p.publicSections.rating && <Stats s={stats} />}

      {sections.map((s) => {
        const songs = (content?.library ?? []).filter((l) => l.status === s).map((l) => byId.get(l.songId)).filter((x): x is Song => !!x);
        if (!songs.length) return null;
        return (
          <section className="block" key={s}>
            <h2 className="h2">
              <HeatMark heat={s} /> {s === "performing" ? "Performing" : s === "learning" ? "Learning" : "Planning to learn"}
            </h2>
            <SongList songs={songs.slice(0, 20)} />
          </section>
        );
      })}

      {content && content.versions.length > 0 && (
        <section className="block">
          <h2 className="h2">Versions</h2>
          <div className="list">
            {content.versions.map((v) => {
              const s = byId.get(v.songId);
              return (
                <ItemRow
                  key={v.id}
                  title={`${s?.title ?? "Song"}${v.label ? ` · ${v.label}` : ""}`}
                  sub={`${s?.artist ?? ""} · ${tuningName(v.tuning)}${v.capo ? ` · capo ${v.capo}` : ""} · ${v.votes ?? 0} upvotes`}
                  lead={<Art seed={v.songId} warmth={warmthFor("performing")} className="mark" />}
                  onClick={() => nav.push({ name: "version", id: v.id })}
                />
              );
            })}
          </div>
        </section>
      )}
      {content && content.playlists.length > 0 && (
        <section className="block">
          <h2 className="h2">Playlists</h2>
          <div className="list">
            {content.playlists.map((pl) => (
              <ItemRow key={pl.id} title={pl.name} sub="Playlist" lead={<Mark kind="playlist" seed={pl.id} />} onClick={() => nav.push({ name: "playlist", id: pl.id })} />
            ))}
          </div>
        </section>
      )}
      {content && content.tracks.length > 0 && (
        <section className="block">
          <h2 className="h2">Backing tracks</h2>
          <div className="list">
            {content.tracks.map((t) => (
              <ItemRow key={t.id} title={t.name} sub={`${t.bpm} bpm`} lead={<Mark kind="playlist" seed={t.id} />} onClick={() => nav.push({ name: "track", id: t.id })} />
            ))}
          </div>
        </section>
      )}
      {content && !content.versions.length && !content.playlists.length && !content.tracks.length && !sections.length && <Empty title="Nothing shared yet" />}
    </>
  );
}
