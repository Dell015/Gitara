import { useEffect, useState } from "react";
import { adminHide, closeReport, mergeSongs, openReports, possibleDuplicates, type ReportRow } from "../../data/community";
import { Empty, Segmented, TopBar } from "../../ui/bits";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";

const REASON: Record<string, string> = { wrong_info: "Wrong chords or info", duplicate: "Duplicate", spam: "Spam", offensive: "Offensive", copyright: "Copyright", other: "Something else" };

/** Review queue (K2/K3), for admins and later trusted users: reports and possible duplicates. */
export function Admin() {
  const nav = useNav();
  const { showToast } = useOverlays();
  const [tab, setTab] = useState<"reports" | "dupes">("reports");
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [dupes, setDupes] = useState<{ a: string; b: string; title: string; artist: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => {
    openReports().then(setReports, (e) => setErr(e instanceof Error ? e.message : String(e)));
    possibleDuplicates().then(setDupes, () => setDupes([]));
  };
  useEffect(load, []);
  const open = (r: ReportRow) => {
    if (r.targetType === "song") nav.push({ name: "song", id: r.targetId });
    else if (r.targetType === "version") nav.push({ name: "version", id: r.targetId });
    else if (r.targetType === "playlist") nav.push({ name: "playlist", id: r.targetId });
    else if (r.targetType === "track") nav.push({ name: "track", id: r.targetId });
    else nav.push({ name: "user", id: r.targetId });
  };
  const act = async (f: () => Promise<void>, msg: string) => {
    try {
      await f();
      showToast(msg);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't do that");
    }
  };
  return (
    <>
      <TopBar onBack={nav.back} title="Review queue" />
      <Segmented
        label="Queue"
        value={tab}
        onChange={setTab}
        options={[
          { id: "reports", label: `Reports${reports ? ` (${reports.length})` : ""}` },
          { id: "dupes", label: `Possible duplicates${dupes ? ` (${dupes.length})` : ""}` },
        ]}
      />
      {err && <p className="field__error">{err}</p>}
      {tab === "reports" &&
        (reports && reports.length ? (
          <div className="list">
            {reports.map((r) => (
              <div key={r.id} className="notice">
                <p className="notice__title">
                  {REASON[r.reason]} · {r.targetType} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
                {r.note && <p className="notice__text">“{r.note}”</p>}
                {r.contact && <p className="notice__text">Contact: {r.contact}</p>}
                <div className="stack">
                  <button className="btn btn--secondary btn--sm" onClick={() => open(r)}>
                    Open it
                  </button>
                  {r.targetType !== "profile" && (
                    <button className="btn btn--secondary btn--sm" onClick={() => act(async () => (await adminHide(r.targetType as "song", r.targetId), await closeReport(r.id, "resolved", "hidden")), "Hidden and resolved")}>
                      Hide it
                    </button>
                  )}
                  <button className="btn btn--ghost btn--sm" onClick={() => act(() => closeReport(r.id, "resolved", "fixed"), "Marked resolved")}>
                    Resolved
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => act(() => closeReport(r.id, "dismissed"), "Dismissed")}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title={reports ? "No open reports" : "Loading…"} />
        ))}
      {tab === "dupes" &&
        (dupes && dupes.length ? (
          <div className="list">
            {dupes.map((d) => (
              <div key={d.a + d.b} className="notice">
                <p className="notice__title">
                  {d.title} · {d.artist}
                </p>
                <p className="notice__text">Two public songs look the same. Merging moves versions, tracks, likes and playlists to the one you keep.</p>
                <div className="stack">
                  <button className="btn btn--secondary btn--sm" onClick={() => nav.push({ name: "song", id: d.a })}>
                    Open first
                  </button>
                  <button className="btn btn--secondary btn--sm" onClick={() => nav.push({ name: "song", id: d.b })}>
                    Open second
                  </button>
                  <button className="btn btn--primary btn--sm" onClick={() => act(() => mergeSongs(d.a, d.b), "Merged into the first")}>
                    Keep first, merge
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title={dupes ? "No duplicates found" : "Loading…"} />
        ))}
    </>
  );
}
