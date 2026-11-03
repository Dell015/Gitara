import { useState } from "react";
import { Empty, SubChips, TopBar } from "../../ui/bits";
import { HeatMark } from "../../ui/HeatMark";
import { Hero } from "../../ui/Hero";
import { plural, useLibrarySongs } from "../hooks";
import { useNav } from "../nav";
import { SongList } from "../rows";
import type { LearnStatus } from "../../core/model";

export function Collection({ kind }: { kind: "liked" | "learning" }) {
  const nav = useNav();
  const lib = useLibrarySongs();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const rows = (lib ?? [])
    .filter((x) => (kind === "learning" ? x.entry.status === "learning" : !status || x.entry.status === status))
    .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  return (
    <>
      <TopBar over onBack={nav.back} />
      <Hero seed={kind === "liked" ? "liked-songs" : "learning-now"} style={kind === "liked" ? "arc" : "flow"} warmth={kind === "liked" ? 1 : 0.86} short>
        <div className="glass glass--card herocard">
          <h1 className="herocard__title">
            {kind === "learning" && <HeatMark heat="learning" />} {kind === "liked" ? "Liked songs" : "Learning now"}
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
        empty={<Empty title={kind === "liked" ? "No liked songs yet" : "Nothing in Learning"} text={kind === "liked" ? "Tap the heart on any song." : "Set a song to Learning from its menu."} />}
      />
    </>
  );
}
