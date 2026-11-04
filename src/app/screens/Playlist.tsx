import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import type { PlaylistItem, Song } from "../../core/model";
import { isMine } from "../../data/auth";
import { fetchPlaylistsInto, inviteEditor, othersPlaylistsCached, playlistMembers, removeEditor, savedPlaylistIds, setPlaylistSaved, type Member } from "../../data/community";
import { db } from "../../data/local-db";
import * as repo from "../../data/repo";
import { Empty, TopBar } from "../../ui/bits";
import { Hero } from "../../ui/Hero";
import { IconDrag, IconGlobe, IconHeart, IconLink, IconLock, IconMore, IconPlus } from "../../ui/icons";
import { formatDuration, plural } from "../hooks";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { ConnectedSongRow } from "../rows";

const PRIVACY = {
  private: { label: "Private", icon: <IconLock /> },
  unlisted: { label: "Unlisted", icon: <IconLink /> },
  public: { label: "Public", icon: <IconGlobe /> },
} as const;

export function PlaylistScreen({ id }: { id: string }) {
  const nav = useNav();
  const { open, showToast } = useOverlays();
  const p = useLiveQuery(() => db.playlists.get(id), [id]);
  const rows = useLiveQuery(async () => {
    const items = await repo.playlistItems(id);
    const songs = await db.songs.bulkGet(items.map((i) => i.songId));
    return items.map((item, i) => ({ item, song: songs[i] }));
  }, [id]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(() => othersPlaylistsCached().saved.has(id));
  const shared = othersPlaylistsCached().shared.has(id);
  useEffect(() => {
    // opened from someone's profile or a link: bring it onto this device
    fetchPlaylistsInto([id]).catch(() => undefined);
    savedPlaylistIds().then((s) => setSaved(s.has(id)), () => undefined);
  }, [id]);

  useEffect(() => {
    void repo.touchRecent("playlist", id);
  }, [id]);

  if (p === undefined) return <TopBar onBack={nav.back} />;
  if (!p)
    return (
      <>
        <TopBar onBack={nav.back} />
        <Empty title="This playlist isn't here" text="It may have been deleted." />
      </>
    );

  const mine = isMine(p.ownerId);
  const canEdit = mine || shared;
  const list = rows ?? [];
  const total = list.reduce((s, r) => s + (r.song?.durationSec ?? 0), 0);

  return (
    <>
      <TopBar
        over
        onBack={nav.back}
        right={
          mine && (
            <button className="glassbtn" aria-label="Playlist options" onClick={() => open({ kind: "playlistMenu", id })}>
              <IconMore />
            </button>
          )
        }
      />
      <Hero seed={p.id} style="arc">
        <div className="glass glass--card herocard">
          <h1 className="herocard__title">{p.name}</h1>
          {p.description && <p className="herocard__meta">{p.description}</p>}
          <p className="herocard__meta num meta-icons">
            {PRIVACY[p.visibility].icon}
            {PRIVACY[p.visibility].label} · {plural(list.length, "song")}
            {total > 0 && ` · ${formatDuration(total)}`}
          </p>
          {!mine && p.visibility !== "private" && (
            <div className="herocard__actions">
              <button
                className="ringbtn"
                data-on={saved}
                aria-pressed={saved}
                aria-label={saved ? "Remove from your Library" : "Save to your Library"}
                onClick={async () => {
                  try {
                    await setPlaylistSaved(id, !saved);
                    setSaved(!saved);
                    showToast(saved ? "Removed from your Library" : "Saved to your Library");
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : "Couldn't save it");
                  }
                }}
              >
                <IconHeart filled={saved} />
              </button>
              <button className="link link--danger" onClick={() => open({ kind: "report", targetType: "playlist", targetId: id, label: p.name })}>
                Report
              </button>
            </div>
          )}
          {canEdit && (
            <div className="herocard__actions">
              {shared && <span className="herocard__meta">Shared with you: you can edit</span>}
              <button className="ringbtn" aria-label="Add songs" onClick={() => open({ kind: "addToPlaylist", playlistId: id })}>
                <IconPlus />
              </button>
              {list.length > 1 && (
                <button className="statusbtn statusbtn--glass" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
                  {editing ? "Done" : "Edit order"}
                </button>
              )}
            </div>
          )}
        </div>
      </Hero>
      {list.length === 0 ? (
        <Empty title="No songs yet" text={canEdit ? "Add songs from your Library or search Gitara." : undefined} />
      ) : editing ? (
        <Reorder playlistId={id} rows={list} onDone={() => setEditing(false)} />
      ) : (
        <ul className="list">
          {list.map(({ item, song }) =>
            song ? (
              <li key={item.id}>
                <ConnectedSongRow song={song} playlistItemId={canEdit ? item.id : undefined} />
              </li>
            ) : (
              <li key={item.id} className="muted">
                Private song
              </li>
            ),
          )}
        </ul>
      )}
      {mine && <ShareBlock playlistId={id} />}
    </>
  );
}

/** Make a playlist together (§5.3): invite editors by @handle. They can add, remove and reorder songs. */
function ShareBlock({ playlistId }: { playlistId: string }) {
  const { showToast } = useOverlays();
  const [members, setMembers] = useState<Member[]>([]);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    playlistMembers(playlistId).then(setMembers, () => undefined);
  }, [playlistId]);
  return (
    <section className="block">
      <h2 className="h2">Make it together</h2>
      <p className="muted">Invite friends by their @handle. They can add, remove and reorder songs; only you can rename or delete it.</p>
      <form
        className="inline"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!handle.trim()) return;
          setBusy(true);
          try {
            const m = await inviteEditor(playlistId, handle.trim());
            setMembers((x) => [...x.filter((y) => y.userId !== m.userId), m]);
            setHandle("");
            showToast(`@${m.handle} can edit this playlist now`);
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't invite them");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="@handle" autoCapitalize="off" aria-label="Their @handle" />
        <button className="btn btn--secondary" disabled={busy || !handle.trim()}>
          Invite
        </button>
      </form>
      {members.length > 0 && (
        <ul className="list">
          {members.map((m) => (
            <li key={m.userId} className="qrow">
              <span className="irow__main">
                <span className="irow__title">{m.displayName || (m.handle ? `@${m.handle}` : "Guitarist")}</span>
                <span className="irow__sub">{m.handle ? `@${m.handle} · ` : ""}can edit</span>
              </span>
              <button
                className="link link--danger"
                onClick={async () => {
                  try {
                    await removeEditor(playlistId, m.userId);
                    setMembers((x) => x.filter((y) => y.userId !== m.userId));
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : "Couldn't remove them");
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Drag the handle to move a song. The list follows the finger; others shift to make room. */
function Reorder({ playlistId, rows }: { playlistId: string; rows: { item: PlaylistItem; song?: Song }[]; onDone: () => void }) {
  const [order, setOrder] = useState(rows.map((r) => r.item.id));
  const byId = new Map(rows.map((r) => [r.item.id, r]));
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ id: string; startY: number; from: number; h: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; dy: number; over: number } | null>(null);

  useEffect(() => setOrder(rows.map((r) => r.item.id)), [rows]);

  const onDown = (e: React.PointerEvent, id: string) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const li = (e.currentTarget as HTMLElement).closest("li")!;
    const gap = 8;
    drag.current = { id, startY: e.clientY, from: order.indexOf(id), h: li.getBoundingClientRect().height + gap };
    setDragState({ id, dy: 0, over: order.indexOf(id) });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const over = Math.max(0, Math.min(order.length - 1, d.from + Math.round(dy / d.h)));
    setDragState({ id: d.id, dy, over });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !dragState) return setDragState(null);
    const next = [...order];
    next.splice(d.from, 1);
    next.splice(dragState.over, 0, d.id);
    setOrder(next);
    setDragState(null);
    if (next.join() !== order.join()) void repo.reorderPlaylist(playlistId, next);
  };

  const h = drag.current?.h ?? 0;
  return (
    <ul className="list reorder" ref={listRef}>
      {order.map((id, i) => {
        const r = byId.get(id);
        if (!r) return null;
        let y = 0;
        if (dragState) {
          const from = order.indexOf(dragState.id);
          if (id === dragState.id) y = dragState.dy;
          else if (from < dragState.over && i > from && i <= dragState.over) y = -h;
          else if (from > dragState.over && i < from && i >= dragState.over) y = h;
        }
        const active = dragState?.id === id;
        return (
          <li key={id} className="reorder__item" data-active={active} style={{ transform: y ? `translateY(${y}px)` : undefined }}>
            <div className="irow irow--static">
              <span className="irow__main">
                <span className="irow__title">{r.song?.title ?? "Private song"}</span>
                <span className="irow__sub">{r.song?.artist}</span>
              </span>
              <span
                className="draghandle"
                role="button"
                aria-label={`Move ${r.song?.title ?? "song"}`}
                onPointerDown={(e) => onDown(e, id)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <IconDrag />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
