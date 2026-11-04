import { describe, expect, it } from "vitest";
import { buildSetlist, canBring, capoForKey, chooseKey, instruction, planSong, replan, songRef, type JamMember, type OfferSong } from "./jam";

const song = (title: string, artist: string, o: Partial<OfferSong> = {}): OfferSong => ({
  ref: songRef(title, artist),
  title,
  artist,
  status: "performing",
  parts: ["chords"],
  sing: false,
  capo: 0,
  ...o,
});
const member = (id: string, offer: OfferSong[]): JamMember => ({ id, name: id, offer });

describe("keys and capo", () => {
  it("picks the lowest capo with friendly shapes", () => {
    expect(capoForKey("G")).toEqual({ capo: 0, shapesIn: "G" });
    expect(capoForKey("F#")).toEqual({ capo: 2, shapesIn: "E" }); // F# sounding, capo 2 -> E shapes
    expect(capoForKey("Bb")).toEqual({ capo: 1, shapesIn: "A" });
    expect(capoForKey("F#m")).toEqual({ capo: 2, shapesIn: "Em" });
  });
  it("chooses the most common key; lead players count double; ties go to the first", () => {
    expect(chooseKey([{ key: "G", weight: 1 }, { key: "G", weight: 1 }, { key: "A", weight: 1 }])).toBe("G");
    expect(chooseKey([{ key: "G", weight: 1 }, { key: "A", weight: 2 }, { key: "G", weight: 1 }])).toBe("G"); // 2 vs 2, first wins
    expect(chooseKey([{ key: "G", weight: 1 }, { key: "A", weight: 2 }])).toBe("A");
    expect(chooseKey([{ weight: 1 }])).toBeUndefined();
  });
});

describe("who can bring what", () => {
  it("Performing always, Learning only when switched on, never liked or planning", () => {
    expect(canBring(song("a", "b"), false)).toBe(true);
    expect(canBring(song("a", "b", { status: "learning" }), false)).toBe(false);
    expect(canBring(song("a", "b", { status: "learning" }), true)).toBe(true);
    expect(canBring(song("a", "b", { status: "planning" }), true)).toBe(false);
    expect(canBring(song("a", "b", { status: null }), true)).toBe(false);
  });
  it("matches songs across people regardless of 'The' and punctuation", () => {
    expect(songRef("Wonderwall", "Oasis")).toBe(songRef(" wonderwall ", "OASIS"));
    expect(songRef("Hey Jude", "The Beatles")).toBe(songRef("Hey Jude!", "Beatles"));
  });
});

describe("planSong", () => {
  it("gives one lead, one solo, one singer, and everyone else rhythm", () => {
    const ms = [
      member("ana", [song("S", "A", { parts: ["chords", "lead"], sing: true, key: "G" })]),
      member("bo", [song("S", "A", { parts: ["chords", "lead", "solo"], key: "G" })]),
      member("cy", [song("S", "A", { parts: ["chords"], key: "G" })]),
    ];
    const it = planSong(songRef("S", "A"), { title: "S", artist: "A" }, ms, false);
    expect(it.kind).toBe("group");
    const roles = Object.fromEntries(it.players.map((p) => [p.userId, p.roles]));
    expect(roles.bo).toContain("solo");
    expect(it.players.filter((p) => p.roles.includes("lead")).length).toBe(1);
    expect(it.players.filter((p) => p.roles.includes("vocals")).length).toBe(1);
    expect(roles.cy).toEqual(["rhythm"]);
    expect(it.players.every((p) => !p.moved)).toBe(true);
  });
  it("moves people who play in another key and gives them a capo", () => {
    const ms = [
      member("ana", [song("S", "A", { key: "G" })]),
      member("bo", [song("S", "A", { key: "G" })]),
      member("cy", [song("S", "A", { key: "A", capo: 2 })]), // sounding A with capo 2 (G shapes)
    ];
    const it = planSong(songRef("S", "A"), { title: "S", artist: "A" }, ms, false);
    expect(it.key).toBe("G");
    const cy = it.players.find((p) => p.userId === "cy")!;
    expect(cy.moved).toBe(true);
    expect(cy.capo).toBe(0);
    expect(cy.usual).toBe("A, capo 2");
    expect(instruction(cy)).toBe("Chords · no capo, shapes in G");
  });
  it("keeps your own capo when you already play the group's key", () => {
    const ms = [member("ana", [song("S", "A", { key: "A", capo: 2 })]), member("bo", [song("S", "A", { key: "A", capo: 0 })])];
    const it = planSong(songRef("S", "A"), { title: "S", artist: "A" }, ms, false);
    expect(it.players.find((p) => p.userId === "ana")).toMatchObject({ capo: 2, shapesIn: "G", moved: false });
    expect(it.players.find((p) => p.userId === "bo")).toMatchObject({ capo: 0, shapesIn: "A", moved: false });
  });
  it("a lead player's key wins over two rhythm players who differ", () => {
    const ms = [
      member("r1", [song("S", "A", { key: "G" })]),
      member("r2", [song("S", "A", { key: "C" })]),
      member("l", [song("S", "A", { key: "A", parts: ["chords", "lead"] })]),
    ];
    expect(planSong(songRef("S", "A"), { title: "S", artist: "A" }, ms, false).key).toBe("A");
  });
  it("a song nobody can play comes back as 'nobody' (for requests)", () => {
    const it = planSong(songRef("X", "Y"), { title: "X", artist: "Y" }, [member("ana", [])], false, new Map(), "bo");
    expect(it).toMatchObject({ kind: "nobody", players: [], requestedBy: "bo", title: "X" });
  });
});

describe("buildSetlist", () => {
  const ms = [
    member("ana", [song("Both", "X", { key: "G" }), song("Ana1", "X"), song("Ana2", "X"), song("Ana3", "X"), song("Learn", "X", { status: "learning" })]),
    member("bo", [song("Both", "X", { key: "G" }), song("Bo1", "X"), song("Bo2", "X")]),
    member("cy", [song("Cy1", "X")]),
  ];
  it("group songs first, solo spot every third slot, spotlight shared", () => {
    const set = buildSetlist(ms, { includeLearning: false });
    expect(set[0]!.title).toBe("Both");
    expect(set[0]!.kind).toBe("duo");
    expect(set[1]!.kind).toBe("solo"); // only one group song exists, so solos follow
    const spotlights = set.filter((i) => i.kind === "solo").map((i) => i.spotlight);
    expect(new Set(spotlights).size).toBe(3); // everybody gets a turn early
    expect(set.map((i) => i.title)).not.toContain("Learn");
  });
  it("includes Learning songs when switched on", () => {
    expect(buildSetlist(ms, { includeLearning: true }).map((i) => i.title)).toContain("Learn");
  });
  it("stops near the target length", () => {
    const many = member("m", Array.from({ length: 30 }, (_, i) => song("T" + i, "X", { sec: 200 })));
    const set = buildSetlist([many, member("n", [])], { includeLearning: false, targetMinutes: 20 });
    expect(set.length).toBe(6); // 6 x 200 s = 20 min
  });
  it("caps an untargeted list and handles an empty jam", () => {
    const many = member("m", Array.from({ length: 60 }, (_, i) => song("T" + i, "X")));
    expect(buildSetlist([many], { includeLearning: false }).length).toBe(24);
    expect(buildSetlist([member("a", [])], { includeLearning: false })).toEqual([]);
  });
  it("replan updates players but keeps order and requests", () => {
    const set = buildSetlist(ms, { includeLearning: false });
    const withReq = [...set, planSong(songRef("Req", "Z"), { title: "Req", artist: "Z" }, ms, false, new Map(), "cy")];
    const cyHasIt = [...ms.slice(0, 2), member("cy", [song("Req", "Z")])];
    const again = replan(withReq, cyHasIt, false);
    expect(again.map((i) => i.ref)).toEqual(withReq.map((i) => i.ref));
    expect(again.at(-1)!.kind).toBe("solo");
    expect(again.at(-1)!.requestedBy).toBe("cy");
  });
});
