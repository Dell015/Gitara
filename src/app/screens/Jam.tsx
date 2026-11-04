import { useEffect, useMemo, useState } from "react";
import { canBring, instruction, names, planSong, replan, songRef, totalSeconds, buildSetlist, type SetItem } from "../../core/jam";
import { currentUserId, useSession } from "../../data/auth";
import {
  createJam,
  endJam,
  joinJam,
  leaveJam,
  myOpenJam,
  publishOffer,
  removeMember,
  removeRequest,
  requestSong,
  saveSetlist,
  saveSetlistAsPlaylist,
  updateSettings,
  type Room,
} from "../../data/jam";
import { Empty, ItemRow, Segmented, TopBar } from "../../ui/bits";
import { IconArrow, IconClose, IconGroup, IconLink } from "../../ui/icons";
import { QrCode } from "../../ui/QrCode";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { useRoom } from "../useRoom";

const clean = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

// ---------------------------------------------------------------- start or join

/** Jam (J1): start one or join one with a code. Joining shares your songs with that jam only. */
export function JamStart({ code }: { code?: string }) {
  const nav = useNav();
  const { showToast } = useOverlays();
  const session = useSession();
  const [join, setJoin] = useState(clean(code ?? ""));
  const [name, setName] = useState("Jam night");
  const [learning, setLearning] = useState(false);
  const [target, setTarget] = useState<"open" | "30" | "60" | "90">("open");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<{ id: string; name: string; code: string } | null>(null);

  useEffect(() => {
    if (session.status === "ready") void myOpenJam().then(setCurrent, () => setCurrent(null));
  }, [session.status]);

  if (session.status !== "ready")
    return (
      <>
        <TopBar onBack={nav.back} title="Jam" />
        <Empty title={session.status === "checking" ? "Connecting…" : "Jam needs the internet"} text="Everything else in Gitara works offline. Jam links your phones together, so it needs a connection." />
      </>
    );

  const run = async (f: () => Promise<string>) => {
    setBusy(true);
    try {
      nav.replace({ name: "jamRoom", id: await f() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't do that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar onBack={nav.back} title="Jam" />
      <header className="jamintro">
        <h1 className="page-title">Jam with friends</h1>
        <p className="muted">Everyone brings the songs they can play. Gitara builds the setlist and tells each person what to play, and in which key.</p>
      </header>

      {current && (
        <div className="list">
          <ItemRow title={`Back to ${current.name}`} sub={`Code ${current.code}`} lead={<IconGroup />} trail={<IconArrow />} onClick={() => nav.replace({ name: "jamRoom", id: current.id })} />
        </div>
      )}

      <section className="block">
        <h2 className="h2">Join a jam</h2>
        <div className="joinrow">
          <input
            className="input jamcode-input"
            aria-label="Jam code"
            value={join}
            onChange={(e) => setJoin(clean(e.target.value))}
            placeholder="CODE"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn--primary" disabled={join.length !== 6 || busy} onClick={() => void run(() => joinJam(join))}>
            Join
          </button>
        </div>
        <p className="muted">Joining shares the songs you've marked Performing or Learning with the people in that jam, and nobody else.</p>
      </section>

      <section className="block">
        <h2 className="h2">Start a jam</h2>
        <div className="form">
          <label className="field">
            <span className="field__label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} />
          </label>
          <div className="field">
            <span className="field__label">Length</span>
            <Segmented
              label="Length"
              value={target}
              onChange={setTarget}
              options={[
                { id: "open", label: "Open" },
                { id: "30", label: "30 min" },
                { id: "60", label: "1 hour" },
                { id: "90", label: "90 min" },
              ]}
            />
            <span className="field__hint">Only a guide for the setlist. A jam lasts as long as you want.</span>
          </div>
          <label className="switchrow">
            <span className="irow__main">
              <span className="irow__title">Include songs we're still learning</span>
              <span className="irow__sub">Otherwise only songs marked Performing</span>
            </span>
            <input type="checkbox" className="switch" checked={learning} onChange={(e) => setLearning(e.target.checked)} />
          </label>
          <button className="btn btn--primary btn--big" disabled={busy || !name.trim()} onClick={() => void run(async () => (await createJam(name.trim(), learning, target === "open" ? null : Number(target))).id)}>
            Start the jam
          </button>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- the room

export function JamRoom({ id }: { id: string }) {
  const nav = useNav();
  const { state, reload } = useRoom(id);
  if (state.status === "loading") return <TopBar onBack={nav.back} title="Jam" />;
  if (state.status === "offline")
    return (
      <>
        <TopBar onBack={nav.back} title="Jam" />
        <Empty title="Can't reach the jam" text="Check your connection. The jam is still there, and the page updates by itself when you're back." />
      </>
    );
  if (state.status === "gone")
    return (
      <>
        <TopBar onBack={nav.back} title="Jam" />
        <Empty title="This jam has ended" text="The host ended it, or you were removed. Start or join another one any time.">
          <button className="btn btn--primary" onClick={() => nav.replace({ name: "jam" })}>
            Jam
          </button>
        </Empty>
      </>
    );
  return <RoomView room={state.room} reload={reload} />;
}

/** Key order doesn't matter to the database (jsonb sorts keys), so compare without it. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const mins = (sec: number) => Math.max(1, Math.round(sec / 60));

function RoomView({ room, reload }: { room: Room; reload: () => void }) {
  const nav = useNav();
  const { showToast } = useOverlays();
  const { jam, members } = room;
  const me = currentUserId();
  const isHost = me === jam.hostId;
  const ended = jam.status === "ended";
  const [local, setLocal] = useState<SetItem[] | null>(null);
  const [confirm, setConfirm] = useState<"rebuild" | "end" | null>(null);
  const list = local ?? jam.setlist;

  useEffect(() => setLocal(null), [jam.setlist]);
  // share my songs once on opening (my library may have changed since I joined)
  useEffect(() => {
    if (!ended) void publishOffer(jam.id).then(reload, () => undefined);
  }, [jam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host keeps roles, keys and capos in step with who's here and what they bring.
  const offersKey = useMemo(() => canon(members.map((m) => [m.id, m.name, m.offer])), [members]);
  useEffect(() => {
    if (!isHost || ended || !jam.setlist.length) return;
    const next = replan(jam.setlist, members, jam.includeLearning);
    if (canon(next) !== canon(jam.setlist)) void saveSetlist(jam.id, next).catch(() => undefined);
  }, [offersKey, jam.includeLearning, jam.setlist]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : "Couldn't do that");
  const edit = async (next: SetItem[]) => {
    setLocal(next);
    try {
      await saveSetlist(jam.id, next);
    } catch (e) {
      setLocal(null);
      fail(e);
    }
  };

  const link = `${location.origin}/?jam=${jam.code}`;
  const sharing = typeof navigator.share === "function";
  const copy = async () => {
    try {
      if (sharing) await navigator.share({ title: jam.name, text: `Join my jam on Gitara: code ${jam.code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        showToast("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const total = totalSeconds(list);
  const mine = members.find((m) => m.id === me);
  const myCount = mine ? mine.offer.filter((o) => canBring(o, jam.includeLearning)).length : 0;
  const build = () => {
    void edit(buildSetlist(members, { includeLearning: jam.includeLearning, targetMinutes: jam.targetMinutes }));
    setConfirm(null);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void edit(next);
  };
  const setStatus = (i: number, status: SetItem["status"]) =>
    void edit(list.map((it, k) => (k === i ? { ...it, status } : status === "now" && it.status === "now" ? { ...it, status: "done" as const } : it)));

  return (
    <>
      <TopBar onBack={nav.back} title={jam.name} />
      <div className="jamroom">
        <div className="jamroom__main">
          {ended && <p className="draftnote">This jam has ended. You can still save the setlist.</p>}

          <section className="block">
            <div className="block__head">
              <h2 className="h2">Setlist</h2>
              {isHost && !ended && list.length > 0 && (
                <button className="link" onClick={() => (confirm === "rebuild" ? build() : setConfirm("rebuild"))}>
                  {confirm === "rebuild" ? "Replace the whole setlist?" : "Rebuild"}
                </button>
              )}
            </div>
            {list.length > 0 && (
              <p className="muted num">
                {list.length} {list.length === 1 ? "song" : "songs"} · about {mins(total)} min{jam.targetMinutes ? ` of ${jam.targetMinutes}` : ""}
              </p>
            )}
            {list.length === 0 ? (
              <Empty
                title={isHost ? "Build the setlist" : "Waiting for the host"}
                text={
                  isHost
                    ? members.length < 2
                      ? "Share the code so friends can join. Each person's songs come together here."
                      : "Gitara compares everyone's songs, picks what the group can play together and gives each person a solo spot."
                    : "The setlist shows up here as soon as the host builds it."
                }
              >
                {isHost && !ended && (
                  <button className="btn btn--primary" onClick={build} disabled={members.every((m) => !m.offer.length)}>
                    Build from everyone's songs
                  </button>
                )}
              </Empty>
            ) : (
              <ol className="setlist">
                {list.map((it, i) => (
                  <SetRow
                    key={`${it.ref}:${i}`}
                    it={it}
                    n={i + 1}
                    me={me}
                    peopleCount={members.length}
                    host={isHost && !ended}
                    onNow={() => setStatus(i, it.status === "now" ? undefined : "now")}
                    onDone={() => setStatus(i, it.status === "done" ? undefined : "done")}
                    onUp={() => move(i, -1)}
                    onDown={() => move(i, 1)}
                    onRemove={() => void edit(list.filter((_, k) => k !== i))}
                    first={i === 0}
                    last={i === list.length - 1}
                  />
                ))}
              </ol>
            )}
            {list.length > 0 && (
              <div className="stack">
                <button
                  className="btn btn--secondary"
                  onClick={() =>
                    void saveSetlistAsPlaylist(jam.name, list).then(
                      (r) => {
                        showToast(r.added ? `Saved as a playlist (${r.added} new songs added)` : "Saved as a playlist");
                        nav.push({ name: "playlist", id: r.id });
                      },
                      fail,
                    )
                  }
                >
                  Save as playlist
                </button>
              </div>
            )}
          </section>
        </div>

        <aside className="jamroom__side">
          {!ended && (
            <section className="block">
              <h2 className="h2">Invite</h2>
              <div className="invite">
                <div className="invite__code" aria-label={`Jam code ${jam.code.split("").join(" ")}`}>
                  <span className="invite__label">Code</span>
                  <span className="invite__digits num">{jam.code}</span>
                </div>
                <QrCode text={link} label={`QR code to join ${jam.name}`} />
              </div>
              <button className="btn btn--secondary" onClick={() => void copy()}>
                <IconLink />
                {sharing ? "Share the link" : "Copy the link"}
              </button>
            </section>
          )}

          <section className="block">
            <h2 className="h2">In the jam</h2>
            {myCount === 0 && !ended && (
              <p className="muted">You haven't marked any songs {jam.includeLearning ? "Performing or Learning" : "Performing"} yet, so there's nothing of yours to play. Set a song's status in your Library and it appears here.</p>
            )}
            <ul className="list">
              {members.map((m) => {
                const n = m.offer.filter((o) => canBring(o, jam.includeLearning)).length;
                return (
                  <li key={m.id} className="memberrow">
                    <span className="irow__main">
                      <span className="irow__title">
                        {m.name}
                        {m.id === me ? " (you)" : ""}
                        {m.id === jam.hostId ? " · host" : ""}
                      </span>
                      <span className="irow__sub num">{n === 1 ? "1 song" : `${n} songs`}</span>
                    </span>
                    {isHost && !ended && m.id !== me && (
                      <button className="iconbtn iconbtn--plain" aria-label={`Remove ${m.name}`} onClick={() => void removeMember(jam.id, m.id).then(reload, fail)}>
                        <IconClose />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {!ended && (
              <button className="link" onClick={() => void publishOffer(jam.id).then(() => (reload(), showToast("Your songs are up to date")), fail)}>
                Refresh my songs
              </button>
            )}
          </section>

          {!ended && (
            <Requests
              room={room}
              me={me}
              isHost={isHost}
              onAdd={(r) => {
                const item = planSong(songRef(r.title, r.artist), { title: r.title, artist: r.artist }, members, jam.includeLearning, new Map(), r.userId);
                void edit([...list, item]).then(() => removeRequest(r.id).then(reload, fail));
              }}
              onChange={reload}
              fail={fail}
            />
          )}

          {isHost && !ended && (
            <section className="block">
              <h2 className="h2">Settings</h2>
              <label className="switchrow">
                <span className="irow__main">
                  <span className="irow__title">Include songs people are learning</span>
                  <span className="irow__sub">Otherwise only Performing</span>
                </span>
                <input type="checkbox" className="switch" checked={jam.includeLearning} onChange={(e) => void updateSettings(jam.id, { includeLearning: e.target.checked }).then(reload, fail)} />
              </label>
              <div className="field">
                <span className="field__label">Length guide</span>
                <Segmented
                  label="Length guide"
                  value={jam.targetMinutes ? String(jam.targetMinutes) : "open"}
                  onChange={(v) => void updateSettings(jam.id, { targetMinutes: v === "open" ? null : Number(v) }).then(reload, fail)}
                  options={[
                    { id: "open", label: "Open" },
                    { id: "30", label: "30" },
                    { id: "60", label: "60" },
                    { id: "90", label: "90" },
                  ]}
                />
                <span className="field__hint">Used the next time you build the setlist.</span>
              </div>
            </section>
          )}

          <div className="stack">
            {isHost && !ended ? (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  if (confirm !== "end") return setConfirm("end");
                  void endJam(jam.id).then(() => nav.replace({ name: "jam" }), fail);
                }}
              >
                {confirm === "end" ? "End it for everyone?" : "End the jam"}
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={() => void leaveJam(jam.id).then(() => nav.replace({ name: "jam" }), fail)}>
                {ended ? "Close" : "Leave the jam"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function SetRow({
  it,
  n,
  me,
  peopleCount,
  host,
  first,
  last,
  onNow,
  onDone,
  onUp,
  onDown,
  onRemove,
}: {
  it: SetItem;
  n: number;
  me: string | null;
  peopleCount: number;
  host: boolean;
  first: boolean;
  last: boolean;
  onNow: () => void;
  onDone: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mine = it.players.find((p) => p.userId === me);
  const who =
    it.kind === "nobody"
      ? "Nobody has this yet"
      : it.kind === "solo"
        ? `${it.players[0]?.name}'s spot`
        : it.players.length === peopleCount
          ? "Everyone"
          : names(it.players);
  return (
    <li className="setrow" data-status={it.status} data-open={open || undefined}>
      <button className="setrow__main" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="setrow__n num">{it.status === "now" ? <span className="setrow__playing" aria-hidden="true" /> : n}</span>
        <span className="setrow__text">
          <span className="setrow__title">
            {it.title}
            {it.status === "now" && <span className="setrow__tag"> Now</span>}
            {it.status === "done" && <span className="setrow__tag setrow__tag--quiet"> Played</span>}
          </span>
          <span className="setrow__sub">
            {it.artist} · {who}
          </span>
          {mine && (
            <span className="setrow__mine">
              {instruction(mine)}
              {mine.moved && mine.usual ? ` (you usually play it in ${mine.usual})` : ""}
            </span>
          )}
          {!mine && it.kind !== "nobody" && <span className="setrow__listen">You're listening to this one</span>}
        </span>
        <span className="setrow__key num">{it.key ?? ""}</span>
      </button>
      {open && (
        <div className="setrow__more">
          {it.players.length > 0 && (
            <ul className="parts">
              {it.players.map((p) => (
                <li key={p.userId}>
                  <span className="parts__name">{p.name}</span>
                  <span className="parts__what">{instruction(p)}</span>
                </li>
              ))}
            </ul>
          )}
          {it.requestedBy && it.kind === "nobody" && <p className="muted">Requested. Whoever learns it first can add it to their Performing songs.</p>}
          {host && (
            <div className="stack">
              <button className="btn btn--sm btn--secondary" onClick={onNow}>
                {it.status === "now" ? "Not playing" : "Play now"}
              </button>
              <button className="btn btn--sm btn--secondary" onClick={onDone}>
                {it.status === "done" ? "Not played" : "Mark played"}
              </button>
              <button className="btn btn--sm btn--ghost" disabled={first} onClick={onUp}>
                Move up
              </button>
              <button className="btn btn--sm btn--ghost" disabled={last} onClick={onDown}>
                Move down
              </button>
              <button className="btn btn--sm btn--ghost" onClick={onRemove}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Requests({
  room,
  me,
  isHost,
  onAdd,
  onChange,
  fail,
}: {
  room: Room;
  me: string | null;
  isHost: boolean;
  onAdd: (r: Room["requests"][number]) => void;
  onChange: () => void;
  fail: (e: unknown) => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const names_ = new Map(room.members.map((m) => [m.id, m.name]));
  return (
    <section className="block">
      <h2 className="h2">Requests</h2>
      {room.requests.length > 0 && (
        <ul className="list">
          {room.requests.map((r) => (
            <li key={r.id} className="memberrow">
              <span className="irow__main">
                <span className="irow__title">{r.title}</span>
                <span className="irow__sub">
                  {[r.artist, names_.get(r.userId)].filter(Boolean).join(" · ")}
                </span>
              </span>
              {isHost && (
                <button className="btn btn--sm btn--secondary" onClick={() => onAdd(r)}>
                  Add
                </button>
              )}
              {(isHost || r.userId === me) && (
                <button className="iconbtn iconbtn--plain" aria-label={`Remove request for ${r.title}`} onClick={() => void removeRequest(r.id).then(onChange, fail)}>
                  <IconClose />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="reqform"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void requestSong(room.jam.id, title, artist).then(() => (setTitle(""), setArtist(""), onChange()), fail);
        }}
      >
        <input className="input" aria-label="Song to request" placeholder="Ask for a song" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} />
        <input className="input" aria-label="Artist" placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value.slice(0, 120))} />
        <button className="btn btn--secondary" disabled={!title.trim()}>
          Request
        </button>
      </form>
    </section>
  );
}
