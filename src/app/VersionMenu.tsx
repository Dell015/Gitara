import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { isMine } from "../data/auth";
import { db } from "../data/local-db";
import * as repo from "../data/repo";
import { useNav } from "./nav";
import { useOverlays } from "./overlays";

export function VersionMenu({ id }: { id: string }) {
  const nav = useNav();
  const { close, open, showToast } = useOverlays();
  const v = useLiveQuery(() => db.versions.get(id), [id]);
  const entry = useLiveQuery(async () => (v ? db.library.get(v.songId) : undefined), [v?.songId]);
  const [confirm, setConfirm] = useState(false);
  if (!v) return null;
  const mine = isMine(v.authorId);
  const isDefault = entry?.preferredVersionId === id;
  return (
    <>
      <div className="sheet__head">
        <div>
          <h2 className="sheet__title">{v.label || (mine ? "Your version" : "Version")}</h2>
          <p className="row__sub">{v.visibility === "public" ? "Public" : v.visibility === "unlisted" ? "Unlisted" : "Private"}</p>
        </div>
      </div>
      <div className="menu">
        {mine && (
          <button
            className="menuitem"
            onClick={() => {
              close();
              nav.push({ name: "editVersion", songId: v.songId, id });
            }}
          >
            <span>Edit chords and details</span>
          </button>
        )}
        <button
          className="menuitem"
          onClick={async () => {
            await repo.setPreferredVersion(v.songId, isDefault ? undefined : id);
            showToast(isDefault ? "No default version" : "This version now opens first");
            close();
          }}
        >
          <span>{isDefault ? "Stop opening this first" : "Open this version first"}</span>
        </button>
        {!mine && (
          <button
            className="menuitem"
            onClick={async () => {
              const copy = await repo.copyVersion(v);
              close();
              showToast("Copied to your versions, with credit");
              nav.push({ name: "editVersion", songId: v.songId, id: copy.id });
            }}
          >
            <span>Copy to my versions</span>
            <span className="menuitem__hint">Keeps the credit</span>
          </button>
        )}
        {!mine && v.visibility !== "private" && (
          <button className="menuitem" data-danger="true" onClick={() => open({ kind: "report", targetType: "version", targetId: id, label: v.label || "Version" })}>
            <span>Report this version</span>
          </button>
        )}
        {mine && (
          <button
            className="menuitem"
            data-danger="true"
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              await repo.deleteVersion(id);
              close();
              nav.back();
              showToast("Version deleted");
            }}
          >
            <span>{confirm ? "Tap again to delete for good" : "Delete this version"}</span>
          </button>
        )}
      </div>
    </>
  );
}
