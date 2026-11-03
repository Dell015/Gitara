import { useState } from "react";
import { Empty, SubChips, TopBar } from "../../ui/bits";
import { HeatMark } from "../../ui/HeatMark";
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
      <TopBar onBack={nav.back} />
      <header className="page-head">
        <h1 className="page-title">
          {kind === "learning" && <HeatMark heat="learning" />} {kind === "liked" ? "Liked songs" : "Learning now"}
        </h1>
        <p className="muted num">{plural(rows.length, "song")}</p>
      </header>
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
