import { useEffect, useMemo, useRef, useState } from "react";
import { GENRES } from "../../core/genres";
import type { Playlist, Song } from "../../core/model";
import { normalize } from "../../core/text";
import { searchPublicPlaylists } from "../../data/community";
import { db } from "../../data/local-db";
import { searchRecordings, type MbSuggestion } from "../../data/musicbrainz";
import { searchPublicSongs } from "../../data/remote";
import { Chips, Empty, ItemRow, Mark } from "../../ui/bits";
import { Art } from "../../ui/Art";
import { IconClose, IconSearch } from "../../ui/icons";
import { useNav } from "../nav";
import { ConnectedSongRow } from "../rows";
import { ScreenHead } from "../Shell";
import { useSearch } from "../searchStore";
import { useLiveQuery } from "dexie-react-hooks";

type Kind = "songs" | "artists" | "playlists";
const RECENT_KEY = "gitara.recentSearches";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* ignore */
  }
}

export function Search() {
  const nav = useNav();
  const [q, setQ] = useSearch();
  const [kind, setKind] = useState<Kind | null>(null);
  const [remote, setRemote] = useState<Song[]>([]);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "offline">("idle");
  const [mb, setMb] = useState<MbSuggestion[]>([]);
  const [remotePls, setRemotePls] = useState<Playlist[]>([]);
  const [recent, setRecent] = useState(loadRecent);
  const input = useRef<HTMLInputElement>(null);

  const allLocal = useLiveQuery(() => db.songs.toArray());
  const playlists = useLiveQuery(() => db.playlists.toArray());
  const nq = normalize(q);

  useEffect(() => {
    if (nq.length < 2) {
      setRemote([]);
      setMb([]);
      return;
    }
    setRemoteState("loading");
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        searchPublicPlaylists(q).then((x) => !ctrl.signal.aborted && setRemotePls(x), () => undefined);
        const r = await searchPublicSongs(q);
        if (!ctrl.signal.aborted) {
          setRemote(r);
          setRemoteState("idle");
        }
      } catch {
        if (!ctrl.signal.aborted) setRemoteState("offline");
      }
    }, 300);
    // MusicBrainz is slower and rate-limited: wait longer before asking.
    const t2 = window.setTimeout(() => {
      searchRecordings(q, "", ctrl.signal).then((r) => !ctrl.signal.aborted && setMb(r), () => setMb([]));
    }, 900);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [q, nq]);

  const results = useMemo(() => {
    const local = (allLocal ?? []).filter((s) => normalize(s.title).includes(nq) || normalize(s.artist).includes(nq));
    const ids = new Set(local.map((s) => s.id));
    const songs = [...local, ...remote.filter((s) => !ids.has(s.id))];
    const artists = [...new Map(songs.filter((s) => normalize(s.artist).includes(nq)).map((s) => [normalize(s.artist), s.artist])).values()];
    const localPls = (playlists ?? []).filter((p) => normalize(p.name).includes(nq));
    const pls = [...localPls, ...remotePls.filter((r) => !localPls.some((l) => l.id === r.id))];
    const known = new Set(songs.map((s) => `${normalize(s.title)}|${normalize(s.artist)}`));
    const missing = mb.filter((m) => !known.has(`${normalize(m.title)}|${normalize(m.artist)}`)).slice(0, 4);
    return { songs, artists, pls, missing };
  }, [allLocal, remote, remotePls, playlists, mb, nq]);

  const remember = () => {
    const term = q.trim();
    if (!term) return;
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())];
    setRecent(next);
    saveRecent(next);
  };

  const searching = nq.length >= 1;
  const none = searching && !results.songs.length && !results.artists.length && !results.pls.length;

  return (
    <>
      <ScreenHead title="Search" tracked />
      <form
        className="searchbar searchbar--page"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          remember();
          input.current?.blur();
        }}
      >
        <IconSearch />
        <input
          ref={input}
          className="searchbar__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, artists, playlists"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Search"
        />
        {q && (
          <button type="button" className="iconbtn iconbtn--plain" aria-label="Clear" onClick={() => setQ("")}>
            <IconClose />
          </button>
        )}
      </form>

      {!searching && (
        <>
          {recent.length > 0 && (
            <section className="block">
              <div className="block__head">
                <h2 className="h2">Recent searches</h2>
                <button
                  className="link"
                  onClick={() => {
                    setRecent([]);
                    saveRecent([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="chips chips--wrap">
                {recent.map((r) => (
                  <button key={r} className="chip" onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="block">
            <h2 className="h2">Browse by genre</h2>
            <div className="tiles">
              {GENRES.map((g) => (
                <button key={g} className="tile" onClick={() => nav.push({ name: "browse", genre: g })}>
                  <Art seed={`genre-${g}`} res={[72, 40]} className="tile__art" />
                  <span className="tile__label glass">{g}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {searching && (
        <>
          <Chips
            label="Result type"
            value={kind}
            onChange={setKind}
            options={[
              { id: "songs", label: "Songs" },
              { id: "artists", label: "Artists" },
              { id: "playlists", label: "Playlists" },
            ]}
          />
          {(!kind || kind === "songs") && results.songs.length > 0 && (
            <section className="block" onClick={remember}>
              {!kind && <h2 className="h2">Songs</h2>}
              <ul className="list">
                {results.songs.slice(0, kind ? 50 : 8).map((s) => (
                  <li key={s.id}>
                    <ConnectedSongRow song={s} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(!kind || kind === "artists") && results.artists.length > 0 && (
            <section className="block" onClick={remember}>
              {!kind && <h2 className="h2">Artists</h2>}
              <div className="list">
                {results.artists.slice(0, kind ? 50 : 4).map((a) => (
                  <ItemRow key={a} title={a} sub="Artist" lead={<Mark kind="artist" seed={a} />} onClick={() => nav.push({ name: "artist", artist: a })} />
                ))}
              </div>
            </section>
          )}
          {(!kind || kind === "playlists") && results.pls.length > 0 && (
            <section className="block" onClick={remember}>
              {!kind && <h2 className="h2">Playlists</h2>}
              <div className="list">
                {results.pls.map((p) => (
                  <ItemRow key={p.id} title={p.name} sub="Playlist" lead={<Mark kind="playlist" seed={p.id} />} onClick={() => nav.push({ name: "playlist", id: p.id })} />
                ))}
              </div>
            </section>
          )}
          {(!kind || kind === "songs") && results.missing.length > 0 && (
            <section className="block">
              <h2 className="h2">Not in Gitara yet</h2>
              <p className="muted">Spellings from MusicBrainz. Add one and it starts with the title and artist filled in.</p>
              <div className="list">
                {results.missing.map((m) => (
                  <ItemRow
                    key={m.id}
                    title={m.title}
                    sub={[m.artist, m.year].filter(Boolean).join(" · ")}
                    trail={<span className="link">Add</span>}
                    onClick={() => nav.push({ name: "addSong", title: m.title, artist: m.artist })}
                  />
                ))}
              </div>
            </section>
          )}
          {none && remoteState !== "loading" && (
            <Empty title={`No songs match "${q.trim()}"`} text={remoteState === "offline" ? "You're offline, so only your own songs were searched." : "Add it and you'll be the first."}>
              <button className="btn btn--primary" onClick={() => nav.push({ name: "addSong", title: q.trim() })}>
                Add this song
              </button>
            </Empty>
          )}
          {remoteState === "offline" && !none && <p className="muted">Offline: showing your own songs only.</p>}
        </>
      )}
    </>
  );
}
