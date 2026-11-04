import { useState } from "react";
import { Empty, SubChips, TopBar } from "../../ui/bits";
import { HeatMark } from "../../ui/HeatMark";
import { Hero } from "../../ui/Hero";
import { plural, useCanPlay, useLibrarySongs } from "../hooks";
import { useNav } from "../nav";
import { SongList } from "../rows";
import { entryStatuses, type LearnStatus } from "../../core/model";

export function Collection({ kind }: { kind: "liked" | "learning" | "canplay" }) {
  const nav = useNav();
  const lib = useLibrarySongs();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const canPlay = useCanPlay();
  const rows = (lib ?? [])
    .filter((x) => (kind === "canplay" ? canPlay?.has(x.song.id) : kind === "learning" ? entryStatuses(x.entry).includes("learning") : !status || entryStatuses(x.entry).includes(status)))
    .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  return (
    <>
      <TopBar over onBack={nav.back} />
      <Hero seed={kind === "liked" ? "liked-songs" : kind === "canplay" ? "songs-i-can-play" : "learning-now"} style={kind === "liked" ? "arc" : "flow"} warmth={kind === "learning" ? 0.86 : 1} short>
        <div className="glass glass--card herocard">
          <h1 className="herocard__title">
            {kind === "learning" && <HeatMark heat="learning" />} {kind === "liked" ? "Liked songs" : kind === "canplay" ? "Songs I can play" : "Learning now"}
          </h1>
          <p className="herocard__meta num">{plural(rows.length, "song")}</p>
        </div>
      </Hero>
      {kind === "liked" && (
        <div className="chips">
          <SubChips
            value={status}
            onChange={setStatus}
            options={[
              { id: "planning", label: "Planning" },
              { id: "learning", label: "Learning" },
              { id: "performing", label: "Performing" },
            ]}
          />
        </div>
      )}
      <SongList
        songs={rows.map((r) => r.song)}
        empty={
          <Empty
            title={kind === "liked" ? "No liked songs yet" : kind === "canplay" ? "Nothing here yet" : "Nothing in Learning"}
            text={
              kind === "liked"
                ? "Tap the heart on any song."
                : kind === "canplay"
                  ? "Songs you're Performing teach Gitara which chords you know. Songs that only use those chords show up here."
                  : "Set a song to Learning from its menu."
            }
          />
        }
      />
    </>
  );
}
