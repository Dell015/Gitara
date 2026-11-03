import { describe, expect, it } from "vitest";
import type { Song } from "../core/model";
import { parseRecordings } from "./musicbrainz";
import { rowToSong, safeSearchTerm, songToRow } from "./mappers";

const song: Song = {
  id: "s1", createdBy: "local", title: "Midnight Ember", artist: "Gitara Demo", tags: ["acoustic"],
  timeSignature: "4/4", originalBpm: 84, visibility: "private", createdAt: "2026-11-04T00:00:00Z", updatedAt: "2026-11-04T00:00:00Z",
};

describe("mappers", () => {
  it("stamps the account id as creator and round-trips fields", () => {
    const row = songToRow(song, "u1");
    expect(row.created_by).toBe("u1");
    expect(row.album).toBeNull();
    const back = rowToSong({ ...row, created_at: song.createdAt, updated_at: song.updatedAt });
    expect(back).toMatchObject({ title: "Midnight Ember", originalBpm: 84, album: undefined, createdBy: "u1" });
  });
  it("strips characters that would break the search filter", () => {
    expect(safeSearchTerm("AC/DC, (live)*")).toBe("ac/dc live");
  });
});

describe("MusicBrainz parsing", () => {
  it("joins artist credits, picks a dated release and dedupes", () => {
    const json = {
      recordings: [
        { id: "r1", title: "Under Pressure", length: 248000, "artist-credit": [{ name: "Queen", joinphrase: " & " }, { name: "David Bowie" }], releases: [{ title: "Hot Space", date: "1982-05-21" }] },
        { id: "r2", title: "Under Pressure", "artist-credit": [{ name: "Queen", joinphrase: " & " }, { name: "David Bowie" }] },
      ],
    };
    const out = parseRecordings(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ artist: "Queen & David Bowie", album: "Hot Space", year: 1982, durationSec: 248 });
  });
});
