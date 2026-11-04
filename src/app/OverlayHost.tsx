import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import type { LearnStatus, PlayablePart, Song, Visibility } from "../core/model";
import { normalize } from "../core/text";
import { isMine, useSession } from "../data/auth";
import { db } from "../data/local-db";
import { searchPublicSongs } from "../data/remote";
import * as repo from "../data/repo";
import { useSyncState } from "../data/sync";
import { myProfile } from "../data/community";
import { Segmented } from "../ui/bits";
import { IconCheck, IconPlus } from "../ui/icons";
import { Sheet } from "../ui/Sheet";
import { ChordSheet, FretboardBuilder } from "./ChordSheets";
import { useNav } from "./nav";
import { queue } from "./queue";
import { VersionMenu } from "./VersionMenu";
import { GroovesSheet } from "./screens/Track";
import { TrainerSheet } from "./TrainerSheet";
import { ReportSheet, SuggestSheet } from "./CommunitySheets";
import { useOverlays, type Overlay } from "./overlays";

export function OverlayHost() {
  const { overlay, close } = useOverlays();
  // Keep the last content on screen while the sheet slides away.
  const last = useRef<Overlay | null>(null);
  if (overlay) last.current = overlay;
  const o = overlay ?? last.current;
  const title = o ? TITLES[o.kind] : "";
  return (
    <Sheet open={!!overlay} onClose={close} title={title}>
      {o && <Content o={o} />}
    </Sheet>
  );
}

const TITLES: Record<Overlay["kind"], string> = {
  songMenu: "Song options",
  pickPlaylist: "Add to playlist",
  status: "Status",
  create: "Create",
  account: "Account",
  newPlaylist: "New playlist",
  editPlaylist: "Edit playlist",
  playlistMenu: "Playlist options",
  addToPlaylist: "Add songs",
  sort: "Sort by",
  chord: "Chord",
  fretboard: "Build a chord",
  versionMenu: "Version options",
  grooves: "Grooves",
  trainer: "Speed trainer",
  report: "Report",
  suggest: "Suggest a fix",
  pickTrack: "Backing track",
};

function Content({ o }: { o: Overlay }) {
  switch (o.kind) {
    case "songMenu":
      return <SongMenu songId={o.songId} playlistItemId={o.playlistItemId} />;
    case "status":
      return <SongMenu songId={o.songId} />;
    case "pickPlaylist":
      return <PickPlaylist songId={o.songId} />;
    case "create":
      return <CreateSheet />;
    case "account":
      return <AccountSheet />;
    case "newPlaylist":
      return <PlaylistForm addSongId={o.addSongId} />;
    case "editPlaylist":
      return <PlaylistForm id={o.id} />;
    case "playlistMenu":
      return <PlaylistMenu id={o.id} />;
    case "addToPlaylist":
      return <AddSongs playlistId={o.playlistId} />;
    case "sort":
      return <SortSheet {...o} />;
    case "chord":
      return <ChordSheet name={o.name} tuning={o.tuning} capo={o.capo} current={o.current} onPick={o.onPick} />;
    case "fretboard":
      return <FretboardBuilder tuning={o.tuning} capo={o.capo} start={o.start} onDone={o.onDone} />;
    case "versionMenu":
      return <VersionMenu id={o.id} />;
    case "report":
      return <ReportSheet targetType={o.targetType} targetId={o.targetId} label={o.label} />;
    case "suggest":
      return <SuggestFor songId={o.songId} />;
    case "trainer":
      return <TrainerSheet mode={o.mode} bpm={o.bpm} onStart={o.onStart} />;
    case "grooves":
      return <GroovesSheet onPick={o.onPick} />;
    case "pickTrack":
      return <PickTrack songId={o.songId} current={o.current} onPick={o.onPick} />;
  }
}

function SheetHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sheet__head">
      <div>
        <h2 className="sheet__title">{title}</h2>
        {sub && <p className="row__sub">{sub}</p>}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger, hint }: { label: string; onClick: () => void; danger?: boolean; hint?: string }) {
  return (
    <button className="menuitem" data-danger={danger} onClick={onClick}>
      <span>{label}</span>
      {hint && <span className="menuitem__hint">{hint}</span>}
    </button>
  );
}

const STATUS_OPTIONS: { id: LearnStatus | "none"; label: string }[] = [
  { id: "none", label: "None" },
  { id: "planning", label: "Planning" },
  { id: "learning", label: "Learning" },
  { id: "performing", label: "Performing" },
];

const PARTS: { id: PlayablePart; label: string }[] = [
  { id: "chords", label: "Chords" },
  { id: "lead", label: "Lead" },
  { id: "solo", label: "Solo" },
];

// ------------------------------------------------------------- song menu

function SongMenu({ songId, playlistItemId }: { songId: string; playlistItemId?: string }) {
  const { close, open, showToast } = useOverlays();
  const nav = useNav();
  const song = useLiveQuery(() => db.songs.get(songId), [songId]);
  const entry = useLiveQuery(() => db.library.get(songId), [songId]);
  if (!song) return null;
  const liked = !!entry;

  const toggleLike = async () => {
    if (liked) {
      const old = await repo.unlike(songId);
      close();
      showToast("Removed from your Library", old ? { label: "Undo", run: () => void repo.restoreEntry(old) } : undefined);
    } else {
      await repo.like(songId);
      showToast("Added to your Library");
    }
  };

  return (
    <>
      <SheetHead title={song.title} sub={song.artist} />
      <div className="menu-block">
        <p className="menu-label">How well you know it</p>
        <Segmented
          label="Status"
          options={STATUS_OPTIONS}
          value={entry?.status ?? "none"}
          onChange={(v) => void repo.setStatus(songId, v === "none" ? null : v)}
        />
      </div>
      {liked && (
        <div className="menu-block">
          <p className="menu-label">Parts you can play</p>
          <div className="chips chips--wrap">
            {PARTS.map((p) => {
              const on = entry!.canPlay.includes(p.id);
              return (
                <button
                  key={p.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => void repo.setCanPlay(songId, on ? entry!.canPlay.filter((x) => x !== p.id) : [...entry!.canPlay, p.id], entry!.canSing)}
                >
                  {p.label}
                </button>
              );
            })}
            <button className="chip" aria-pressed={entry!.canSing} onClick={() => void repo.setCanPlay(songId, entry!.canPlay, !entry!.canSing)}>
              Can sing it
            </button>
          </div>
        </div>
      )}
      <div className="menu">
        <MenuItem label={liked ? "Remove from Library" : "Add to Library"} onClick={() => void toggleLike()} />
        <MenuItem label="Add to playlist" onClick={() => open({ kind: "pickPlaylist", songId })} />
        <MenuItem
          label="Add to practice queue"
          hint="Up next in Practice"
          onClick={() => {
            queue.add(songId, entry?.preferredVersionId);
            close();
            showToast("Added to your practice queue");
          }}
        />
        {liked && (
          <MenuItem
            label={entry!.pinnedAt ? "Unpin from Library" : "Pin to Library"}
            onClick={async () => {
              const r = await repo.togglePinSong(songId);
              showToast(r === "full" ? `You can pin up to ${repo.MAX_PINS} items` : r === "pinned" ? "Pinned" : "Unpinned");
            }}
          />
        )}
        <MenuItem
          label="Open song"
          onClick={() => {
            close();
            nav.push({ name: "song", id: songId });
          }}
        />
        <MenuItem
          label="Go to artist"
          onClick={() => {
            close();
            nav.push({ name: "artist", artist: song.artist });
          }}
        />
        {isMine(song.createdBy) && (
          <MenuItem
            label="Edit song info"
            onClick={() => {
              close();
              nav.push({ name: "addSong", editId: songId });
            }}
          />
        )}
        {!isMine(song.createdBy) && song.visibility === "public" && (
          <MenuItem label="Suggest a fix to the song info" onClick={() => open({ kind: "suggest", songId })} />
        )}
        {!isMine(song.createdBy) && song.visibility === "public" && (
          <MenuItem label="Report" danger onClick={() => open({ kind: "report", targetType: "song", targetId: songId, label: `${song.title} · ${song.artist}` })} />
        )}
        {playlistItemId && (
          <MenuItem
            label="Remove from this playlist"
            danger
            onClick={async () => {
              const removed = await repo.removeFromPlaylist(playlistItemId);
              close();
              showToast("Removed from playlist", removed ? { label: "Undo", run: () => void repo.restorePlaylistItem(removed) } : undefined);
            }}
          />
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------- playlists

function PickPlaylist({ songId }: { songId: string }) {
  const { open, close, showToast } = useOverlays();
  const playlists = useLiveQuery(() => db.playlists.orderBy("updatedAt").reverse().toArray());
  const has = useLiveQuery(async () => new Set((await db.playlistItems.toArray()).filter((i) => i.songId === songId).map((i) => i.playlistId)), [songId]);
  const mine = (playlists ?? []).filter((p) => isMine(p.ownerId));
  return (
    <>
      <SheetHead title="Add to playlist" />
      <div className="menu">
        <button className="menuitem menuitem--accent" onClick={() => open({ kind: "newPlaylist", addSongId: songId })}>
          <IconPlus />
          <span>New playlist</span>
        </button>
        {mine.map((p) => {
          const already = has?.has(p.id);
          return (
            <button
              key={p.id}
              className="menuitem"
              onClick={async () => {
                if (already) {
                  showToast(`Already in ${p.name}`);
                  return;
                }
                await repo.addToPlaylist(p.id, songId);
                close();
                showToast(`Added to ${p.name}`);
              }}
            >
              <span>{p.name}</span>
              {already && (
                <span className="menuitem__hint">
                  <IconCheck /> Added
                </span>
              )}
            </button>
          );
        })}
        {!mine.length && <p className="sheet__text">No playlists yet. Make one for a gig, a jam night or songs to learn.</p>}
      </div>
    </>
  );
}

const PRIVACY: { id: Visibility; label: string; hint: string }[] = [
  { id: "private", label: "Private", hint: "Only you can see it." },
  { id: "unlisted", label: "Unlisted", hint: "Anyone with the link can see it (links arrive with sharing)." },
  { id: "public", label: "Public", hint: "Anyone can find it." },
];

function PlaylistForm({ id, addSongId }: { id?: string; addSongId?: string }) {
  const { close, showToast } = useOverlays();
  const nav = useNav();
  const existing = useLiveQuery(() => (id ? db.playlists.get(id) : undefined), [id]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [vis, setVis] = useState<Visibility>("private");
  const loaded = useRef(false);
  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true;
      setName(existing.name);
      setDesc(existing.description ?? "");
      setVis(existing.visibility);
    }
  }, [existing]);

  const save = async () => {
    if (id) {
      await repo.updatePlaylist(id, { name: name.trim() || "Untitled playlist", description: desc.trim() || undefined, visibility: vis });
      close();
      return;
    }
    const p = await repo.createPlaylist(name, vis, desc);
    if (addSongId) await repo.addToPlaylist(p.id, addSongId);
    close();
    showToast(addSongId ? `Added to ${p.name}` : `Made ${p.name}`);
    if (!addSongId) nav.goTo("library", { name: "playlist", id: p.id });
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <SheetHead title={id ? "Edit playlist" : "New playlist"} />
      <label className="field">
        <span className="field__label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campfire songs" maxLength={100} autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Description (optional)</span>
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
      </label>
      <div className="field">
        <span className="field__label">Who can see it</span>
        <Segmented label="Privacy" options={PRIVACY} value={vis} onChange={setVis} />
        <span className="field__hint">{PRIVACY.find((p) => p.id === vis)!.hint}</span>
      </div>
      <div className="stack">
        <button className="btn btn--primary" type="submit">
          {id ? "Save" : "Create"}
        </button>
        <button className="btn btn--ghost" type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PlaylistMenu({ id }: { id: string }) {
  const { open, close, showToast } = useOverlays();
  const nav = useNav();
  const p = useLiveQuery(() => db.playlists.get(id), [id]);
  const [confirm, setConfirm] = useState(false);
  if (!p) return null;
  return (
    <>
      <SheetHead title={p.name} />
      <div className="menu">
        <MenuItem label="Edit details" onClick={() => open({ kind: "editPlaylist", id })} />
        <MenuItem label="Add songs" onClick={() => open({ kind: "addToPlaylist", playlistId: id })} />
        <MenuItem
          label={p.pinnedAt ? "Unpin from Library" : "Pin to Library"}
          onClick={async () => {
            const r = await repo.togglePinPlaylist(id);
            showToast(r === "full" ? `You can pin up to ${repo.MAX_PINS} items` : r === "pinned" ? "Pinned" : "Unpinned");
          }}
        />
        <MenuItem
          label={confirm ? "Tap again to delete for good" : "Delete playlist"}
          danger
          onClick={async () => {
            if (!confirm) return setConfirm(true);
            await repo.deletePlaylist(id);
            close();
            nav.back();
            showToast(`Deleted ${p.name}`);
          }}
        />
      </div>
    </>
  );
}

function AddSongs({ playlistId }: { playlistId: string }) {
  const { showToast } = useOverlays();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Song[]>([]);
  const lib = useLiveQuery(async () => {
    const entries = await db.library.toArray();
    return (await db.songs.bulkGet(entries.map((e) => e.songId))).filter((s): s is Song => !!s);
  });
  const inList = useLiveQuery(async () => new Set((await db.playlistItems.where("playlistId").equals(playlistId).toArray()).map((i) => i.songId)), [playlistId]);

  useEffect(() => {
    if (q.trim().length < 2) return setRemote([]);
    const t = window.setTimeout(() => {
      searchPublicSongs(q, 15).then(setRemote, () => setRemote([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const nq = normalize(q);
  const local = (lib ?? []).filter((s) => !nq || normalize(s.title).includes(nq) || normalize(s.artist).includes(nq));
  const localIds = new Set(local.map((s) => s.id));
  const list = [...local, ...remote.filter((s) => !localIds.has(s.id))].slice(0, 40);

  return (
    <>
      <SheetHead title="Add songs" />
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your Library and Gitara" autoFocus />
      <div className="menu menu--scroll">
        {list.map((s) => {
          const added = inList?.has(s.id);
          return (
            <div className="pickrow" key={s.id}>
              <span className="irow__main">
                <span className="irow__title">{s.title}</span>
                <span className="irow__sub">{s.artist}</span>
              </span>
              <button
                className="iconbtn"
                aria-label={added ? "Added" : `Add ${s.title}`}
                data-on={added}
                onClick={async () => {
                  if (added) return;
                  await repo.addToPlaylist(playlistId, s.id);
                  showToast(`Added ${s.title}`);
                }}
              >
                {added ? <IconCheck /> : <IconPlus />}
              </button>
            </div>
          );
        })}
        {!list.length && <p className="sheet__text">{q ? "Nothing matches. Try another spelling, or add the song first." : "Like some songs first, or search for one."}</p>}
      </div>
    </>
  );
}

// ------------------------------------------------------------- create, account, sort

function CreateSheet() {
  const { close, open } = useOverlays();
  const nav = useNav();
  return (
    <>
      <SheetHead title="Create" />
      <div className="menu">
        <MenuItem
          label="Add a song"
          hint="Title, artist and details"
          onClick={() => {
            close();
            nav.push({ name: "addSong" });
          }}
        />
        <MenuItem label="New playlist" hint="A setlist, a jam night, songs to learn" onClick={() => open({ kind: "newPlaylist" })} />
        <MenuItem
          label="New chord version"
          hint="Pick a song from your Library"
          onClick={() => {
            close();
            nav.goTo("library", { name: "library" });
          }}
        />
        <MenuItem
          label="New backing track"
          hint="Drums and loops to play along with"
          onClick={() => {
            close();
            nav.push({ name: "track" });
          }}
        />
      </div>
    </>
  );
}

function AccountSheet() {
  const session = useSession();
  const sync = useSyncState();
  const nav = useNav();
  const { close } = useOverlays();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (session.status === "ready") myProfile().then((p) => setAdmin(!!p?.isAdmin), () => undefined);
  }, [session.status]);
  const status =
    session.status === "ready"
      ? session.isGuest
        ? "Guest account"
        : "Signed in"
      : session.status === "checking"
        ? "Connecting…"
        : session.status === "unconfigured"
          ? "This device only"
          : "Offline";
  const syncLine =
    sync.phase === "off"
      ? "Cloud sync is off (no Supabase keys)."
      : sync.phase === "syncing"
        ? "Saving to the cloud…"
        : sync.phase === "error"
          ? `Couldn't save everything yet: ${sync.error}. It'll retry.`
          : sync.pending
            ? `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to be saved to the cloud.`
            : sync.lastSyncedAt
              ? `Everything is saved to the cloud.`
              : "Your changes save to the cloud when you're online.";
  const go = (r: Parameters<typeof nav.push>[0]) => {
    close();
    nav.push(r);
  };
  return (
    <>
      <SheetHead title={status} sub={syncLine} />
      <p className="sheet__text">
        Your songs and playlists are kept on this device first. While you use a guest account, clearing this browser's data loses the cloud copy too. Real sign-in comes later and keeps
        everything.
      </p>
      <div className="menu">
        <MenuItem label="Your profile" hint="@handle, what others see" onClick={() => go({ name: "profile" })} />
        {admin && <MenuItem label="Review queue" hint="Reports and duplicates" onClick={() => go({ name: "admin" })} />}
        <MenuItem label="Terms, privacy and copyright" onClick={() => go({ name: "legal", page: "terms" })} />
        <MenuItem label="Credits" onClick={() => go({ name: "legal", page: "credits" })} />
        <a className="menuitem" href="#design">
          <span>Design preview</span>
        </a>
        <a className="menuitem" href="#check">
          <span>Build check</span>
        </a>
      </div>
    </>
  );
}

function SortSheet({ current, options, onPick }: Extract<Overlay, { kind: "sort" }>) {
  const { close } = useOverlays();
  return (
    <>
      <SheetHead title="Sort by" />
      <div className="menu">
        {options.map((o) => (
          <button
            key={o.id}
            className="menuitem"
            aria-pressed={o.id === current}
            onClick={() => {
              onPick(o.id);
              close();
            }}
          >
            <span>{o.label}</span>
            {o.id === current && (
              <span className="menuitem__hint">
                <IconCheck />
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}


function PickTrack({ songId, current, onPick }: { songId: string; current?: string; onPick: (id: string | null) => void }) {
  const { close } = useOverlays();
  const nav = useNav();
  const tracks = useLiveQuery(() => db.tracks.where("songId").equals(songId).toArray(), [songId]);
  return (
    <>
      <SheetHead title="Backing track" sub="Plays under the chords. Each section uses its own pattern." />
      <div className="menu">
        <button
          className="menuitem"
          aria-pressed={!current}
          onClick={() => {
            onPick(null);
            close();
          }}
        >
          <span>None (chords and click only)</span>
          {!current && (
            <span className="menuitem__hint">
              <IconCheck />
            </span>
          )}
        </button>
        {(tracks ?? []).map((t) => (
          <button
            key={t.id}
            className="menuitem"
            onClick={() => {
              onPick(t.id);
              close();
            }}
          >
            <span>{t.name}</span>
            <span className="menuitem__hint">
              {t.bpm} bpm{isMine(t.ownerId) ? "" : " · shared"} {current === t.id && <IconCheck />}
            </span>
          </button>
        ))}
        <button
          className="menuitem menuitem--accent"
          onClick={() => {
            close();
            nav.push({ name: "track", songId });
          }}
        >
          <IconPlus />
          <span>Make a backing track</span>
        </button>
      </div>
    </>
  );
}

function SuggestFor({ songId }: { songId: string }) {
  const song = useLiveQuery(() => db.songs.get(songId), [songId]);
  return song ? <SuggestSheet song={song} /> : null;
}
