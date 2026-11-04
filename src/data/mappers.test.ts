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

describe("versions by part, progress and statuses", () => {
  it("round-trips a version's part, video and ratings", async () => {
    const { rowToVersion, versionToRow } = await import("./mappers");
    const v = rowToVersion({
      id: "v1", song_id: "s1", author_id: "u1", instrument_id: "guitar", tuning: [40, 45, 50, 55, 59, 64], capo: 0, tags: [], techniques: [],
      content: { sections: [], arrangement: [] }, content_hash: "h", difficulty_score: 1, difficulty_level: "beginner", visibility: "public",
      part: "lead", youtube_url: "https://youtu.be/abcdefghijk", rating_sum: 9, rating_count: 2, created_at: "t", updated_at: "t",
    });
    expect(v).toMatchObject({ part: "lead", youtubeUrl: "https://youtu.be/abcdefghijk", ratingSum: 9, ratingCount: 2 });
    expect(versionToRow(v, "u1")).toMatchObject({ part: "lead", youtube_url: "https://youtu.be/abcdefghijk" });
  });
  it("treats an unknown part as rhythm", async () => {
    const { rowToVersion } = await import("./mappers");
    const v = rowToVersion({ id: "v", song_id: "s", author_id: "u", tuning: [], content: {}, part: "weird", created_at: "t", updated_at: "t" } as never);
    expect(v.part).toBe("rhythm");
  });
  it("maps progress rows", async () => {
    const { progressToRow, rowToProgress } = await import("./mappers");
    const p = rowToProgress({ version_id: "v1", song_id: "s1", status: "learning", started_learning_at: "t", created_at: "t", updated_at: "t" });
    expect(p.status).toBe("learning");
    expect(progressToRow(p, "u1")).toEqual({ user_id: "u1", version_id: "v1", song_id: "s1", status: "learning" });
  });
  it("lists a song's statuses, falling back to the single status", async () => {
    const { entryStatuses } = await import("../core/model");
    expect(entryStatuses({ status: "learning", statuses: ["learning", "performing"] })).toEqual(["learning", "performing"]);
    expect(entryStatuses({ status: "performing" })).toEqual(["performing"]);
    expect(entryStatuses({ status: null, statuses: [] })).toEqual([]);
  });
});
