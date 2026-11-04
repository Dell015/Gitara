import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { audio } from "../../audio/guitar";
import { chordsUsed } from "../../core/chart";
import { tuningName } from "../../core/tunings";
import { isMine } from "../../data/auth";
import { decideSuggestion, myRating, openSuggestions, rateSong, refreshCounts, type Suggestion } from "../../data/community";
import { publicTracksForSong, publicVersionsForSong } from "../../data/remote";
import { db } from "../../data/local-db";
import * as repo from "../../data/repo";
import { Empty, ItemRow, Mark, TopBar } from "../../ui/bits";
import { warmthFor } from "../../ui/artwork";
import { HeatMark } from "../../ui/HeatMark";
import { Hero } from "../../ui/Hero";
import { IconExternal, IconHeart, IconMore, IconPlus, IconStar, IconUp } from "../../ui/icons";
import { formatDuration } from "../hooks";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";
import { SongList } from "../rows";

const FIELD: Record<string, string> = { title: "Title", artist: "Artist", album: "Album", releaseYear: "Year", genre: "Genre", originalKey: "Key", originalBpm: "Tempo" };
const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
const STATUS_LABEL = { planning: "Planning to learn", learning: "Learning", performing: "Performing" } as const;

function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1]! : null;
}

export function SongScreen({ id }: { id: string }) {
  const nav = useNav();
  const { open, showToast } = useOverlays();
  const song = useLiveQuery(() => db.songs.get(id), [id]);
  const entry = useLiveQuery(() => db.library.get(id), [id]);
  const inPlaylists = useLiveQuery(async () => {
    const items = await db.playlistItems.toArray();
    const ids = [...new Set(items.filter((i) => i.songId === id).map((i) => i.playlistId))];
    return (await db.playlists.bulkGet(ids)).filter((p) => !!p).map((p) => p!);
  }, [id]);
  const moreByArtist = useLiveQuery(async () => {
    if (!song) return [];
    return db.songs.where("artist").equals(song.artist).filter((s) => s.id !== id).limit(5).toArray();
  }, [song?.artist, id]);
  const [showVideo, setShowVideo] = useState(false);
  const tracks = useLiveQuery(() => db.tracks.where("songId").equals(id).toArray(), [id]);
  useEffect(() => {
    publicTracksForSong(id).catch(() => undefined);
  }, [id]);
  const localVersions = useLiveQuery(() => db.versions.where("songId").equals(id).toArray(), [id]);
  useEffect(() => {
    publicVersionsForSong(id).catch(() => undefined);
  }, [id]);
  // yours first, then the best-voted, then the newest
  const versions = [...(localVersions ?? [])].sort(
    (a, b) => Number(isMine(b.authorId)) - Number(isMine(a.authorId)) || (b.votes ?? 0) - (a.votes ?? 0) || b.updatedAt.localeCompare(a.updatedAt),
  );
  const publicVs = versions.filter((x) => x.visibility === "public");
  const bestId = publicVs.reduce<{ id?: string; v: number }>((m, x) => ((x.votes ?? 0) > m.v ? { id: x.id, v: x.votes ?? 0 } : m), { v: 0 }).id;
  const [stars, setStars] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  useEffect(() => {
    refreshCounts(id).catch(() => undefined);
    myRating(id).then(setStars, () => undefined);
    openSuggestions(id).then(setSuggestions, () => undefined);
  }, [id]);

  useEffect(() => {
    void repo.touchRecent("song", id);
  }, [id]);

  if (song === undefined) return <TopBar onBack={nav.back} />;
  if (song === null || !song)
    return (
      <>
        <TopBar onBack={nav.back} />
        <Empty title="This song isn't available" text="It may have been removed, or it's private." />
      </>
    );

  const liked = !!entry;
  const meta = [song.releaseYear, song.genre, song.originalKey && `Key ${song.originalKey}`, song.originalBpm && `${song.originalBpm} bpm`, song.timeSignature !== "4/4" && song.timeSignature, formatDuration(song.durationSec)]
    .filter(Boolean)
    .join(" · ");
  const yt = youtubeId(song.youtubeUrl);

  const toggleLike = async () => {
    if (liked) {
      const old = await repo.unlike(id);
      showToast("Removed from your Library", old ? { label: "Undo", run: () => void repo.restoreEntry(old) } : undefined);
    } else {
      await repo.like(id);
      showToast("Added to your Library");
    }
  };

  return (
    <>
      <TopBar
        over
        onBack={nav.back}
        right={
          <button className="glassbtn" aria-label="More" onClick={() => open({ kind: "songMenu", songId: id })}>
            <IconMore />
          </button>
        }
      />
      <Hero seed={song.id} warmth={warmthFor(entry?.status)}>
        <div className="glass glass--card herocard">
          <h1 className="herocard__title">{song.title}</h1>
          <button className="artistlink" onClick={() => nav.push({ name: "artist", artist: song.artist })}>
            {song.artist}
          </button>
          {meta && <p className="herocard__meta num">{meta}</p>}
          <p className="herocard__meta">
            {song.album ? `${song.album} · ` : ""}
            {song.visibility === "public" ? "Public" : "Private"}
            {isMine(song.createdBy) ? " · Added by you" : ""}
          </p>
          {song.visibility === "public" && (
            <div className="rating">
              <span className="rating__avg num">
                {song.ratingCount ? `${(song.ratingSum! / song.ratingCount).toFixed(1)} from ${song.ratingCount} rating${song.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
              </span>
              {!isMine(song.createdBy) && (
                <span className="rating__stars" role="radiogroup" aria-label="Rate how accurate and complete this song is">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={stars === n}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="star"
                      data-on={(stars ?? 0) >= n}
                      onClick={async () => {
                        const next = stars === n ? null : n;
                        try {
                          await rateSong(id, next);
                          setStars(next);
                          showToast(next ? `Rated ${next} star${next > 1 ? "s" : ""}` : "Rating removed");
                        } catch (e) {
                          showToast(e instanceof Error ? e.message : "Couldn't save the rating");
                        }
                      }}
                    >
                      <IconStar filled={(stars ?? 0) >= n} />
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
          <div className="herocard__actions">
            <button className="ringbtn" data-on={liked} aria-pressed={liked} aria-label={liked ? "Remove from Library" : "Add to Library"} onClick={() => void toggleLike()}>
              <IconHeart filled={liked} />
            </button>
            <button className="ringbtn" aria-label="Add to playlist" onClick={() => open({ kind: "pickPlaylist", songId: id })}>
              <IconPlus />
            </button>
            <button className="statusbtn statusbtn--glass" onClick={() => open({ kind: "songMenu", songId: id })}>
              {entry?.status ? (
                <>
                  <HeatMark heat={entry.status} /> {STATUS_LABEL[entry.status]}
                </>
              ) : (
                "Set status"
              )}
            </button>
            <span className="actions__spacer" />
            <button
              className="btn btn--primary btn--big"
              disabled={!versions.length}
              title={versions.length ? undefined : "Add a chord version first"}
              onClick={() => {
                const pick = versions.find((x) => x.id === entry?.preferredVersionId) ?? versions[0];
                if (!pick) return;
                audio(); // sound can only start from a tap
                nav.push({ name: "version", id: pick.id, play: true });
              }}
            >
              Play along
            </button>
          </div>
        </div>
      </Hero>

      {(yt || song.spotifyUrl || song.youtubeUrl) && (
        <section className="block">
          <h2 className="h2">Listen to the original</h2>
          {yt && showVideo && (
            <div className="video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt}`}
                title={`${song.title} on YouTube`}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
          <div className="stack">
            {yt && !showVideo && (
              <button className="btn btn--secondary" onClick={() => setShowVideo(true)}>
                Play on YouTube here
              </button>
            )}
            {!yt && song.youtubeUrl && (
              <a className="btn btn--secondary" href={song.youtubeUrl} target="_blank" rel="noreferrer">
                YouTube <IconExternal />
              </a>
            )}
            {song.spotifyUrl && (
              <a className="btn btn--secondary" href={song.spotifyUrl} target="_blank" rel="noreferrer">
                Spotify <IconExternal />
              </a>
            )}
          </div>
        </section>
      )}

      {isMine(song.createdBy) && suggestions.length > 0 && (
        <section className="block">
          <h2 className="h2">Suggested fixes</h2>
          {suggestions.map((sg) => (
            <div key={sg.id} className="notice">
              <p className="notice__title">
                {Object.entries(sg.patch)
                  .map(([k, val]) => `${FIELD[k] ?? k}: ${val === null ? "(remove)" : String(val)}`)
                  .join(" · ")}
              </p>
              {sg.note && <p className="notice__text">“{sg.note}”</p>}
              <div className="stack">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    const patch = Object.fromEntries(Object.entries(sg.patch).map(([k, val]) => [k, val === null ? undefined : val]));
                    await repo.updateSong(id, patch);
                    await decideSuggestion(sg.id, true).catch(() => undefined);
                    setSuggestions((s) => s.filter((x) => x.id !== sg.id));
                    showToast("Applied");
                  }}
                >
                  Apply
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    await decideSuggestion(sg.id, false).catch(() => undefined);
                    setSuggestions((s) => s.filter((x) => x.id !== sg.id));
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="block">
        <div className="block__head">
          <h2 className="h2">Versions</h2>
          <button className="link" onClick={() => nav.push({ name: "editVersion", songId: id })}>
            Add yours
          </button>
        </div>
        {versions.length ? (
          <ul className="list">
            {versions.map((x) => (
              <li key={x.id}>
                <button className="vrow" onClick={() => nav.push({ name: "version", id: x.id })}>
                  <span className="irow__main">
                    <span className="irow__title">
                      {x.label || (isMine(x.authorId) ? "Your version" : "Version")}
                      {x.id === bestId && <span className="vrow__mark vrow__mark--best">Best version</span>}
                      {entry?.preferredVersionId === x.id && <span className="vrow__mark">Opens first</span>}
                    </span>
                    <span className="irow__sub num">
                      {[tuningName(x.tuning), x.capo ? `Capo ${x.capo}` : "No capo", x.keyPlayed && `Key ${x.keyPlayed}`, x.difficultyLevel && LEVEL[x.difficultyLevel], x.visibility !== "public" ? (x.visibility === "unlisted" ? "Link only" : "Private") : isMine(x.authorId) ? "Public" : undefined, ...x.tags]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="vrow__chords chordname">{chordsUsed(x.content).slice(0, 5).join(" ")}</span>
                  {x.visibility === "public" && (
                    <span className="vrow__votes num" aria-label={`${x.votes ?? 0} upvotes`}>
                      <IconUp /> {x.votes ?? 0}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No chord versions yet" text="Be the first: type the chords section by section and Gitara turns them into bars you can play along with.">
            <button className="btn btn--primary" onClick={() => nav.push({ name: "editVersion", songId: id })}>
              Add the chords
            </button>
          </Empty>
        )}
      </section>

      <section className="block">
        <div className="block__head">
          <h2 className="h2">Backing tracks</h2>
          <button className="link" onClick={() => nav.push({ name: "track", songId: id })}>
            Make one
          </button>
        </div>
        {tracks && tracks.length > 0 ? (
          <div className="list">
            {tracks.map((t) => (
              <ItemRow key={t.id} title={t.name} sub={`${t.bpm} bpm · ${t.content.patterns.length} pattern${t.content.patterns.length === 1 ? "" : "s"}${isMine(t.ownerId) ? "" : " · shared"}`} lead={<Mark kind="playlist" seed={t.id} />} onClick={() => nav.push({ name: "track", id: t.id })} />
            ))}
          </div>
        ) : (
          <p className="muted">Make a drum groove to play along with. Each section can have its own pattern.</p>
        )}
      </section>

      {inPlaylists && inPlaylists.length > 0 && (
        <section className="block">
          <h2 className="h2">In your playlists</h2>
          <div className="chips chips--wrap">
            {inPlaylists.map((p) => (
              <button key={p.id} className="chip" onClick={() => nav.goTo("library", { name: "playlist", id: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {moreByArtist && moreByArtist.length > 0 && (
        <section className="block">
          <div className="block__head">
            <h2 className="h2">More by {song.artist}</h2>
            <button className="link" onClick={() => nav.push({ name: "artist", artist: song.artist })}>
              Show all
            </button>
          </div>
          <SongList songs={moreByArtist} />
        </section>
      )}
    </>
  );
}
