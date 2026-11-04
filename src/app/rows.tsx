import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import type { Song } from "../core/model";
import { db } from "../data/local-db";
import * as repo from "../data/repo";
import { useRemoteVersionCount } from "../data/versionCounts";
import { SongRow } from "../ui/SongRow";
import { useNav } from "./nav";
import { useOverlays } from "./overlays";
import { queue } from "./queue";

/** A song row wired to the app: knows whether it's liked, opens the song, the menu and the undo toast. */
export function ConnectedSongRow({ song, playlistItemId, lead, trail, onOpen }: { song: Song; playlistItemId?: string; lead?: ReactNode; trail?: ReactNode; onOpen?: () => void }) {
  const nav = useNav();
  const { open, showToast } = useOverlays();
  const entry = useLiveQuery(() => db.library.get(song.id), [song.id]);
  const liked = !!entry;
  // what's on this device (yours and cached) or in the cloud (public + yours), whichever is more
  const local = useLiveQuery(() => db.versions.where("songId").equals(song.id).count(), [song.id]);
  const remote = useRemoteVersionCount(song.id);
  const versions = local === undefined && remote === undefined ? undefined : Math.max(local ?? 0, remote ?? 0);
  return (
    <SongRow
      song={song}
      versions={versions}
      liked={liked}
      status={entry?.status}
      lead={lead}
      trail={trail}
      onOpen={onOpen ?? (() => nav.push({ name: "song", id: song.id }))}
      onMenu={() => open({ kind: "songMenu", songId: song.id, playlistItemId })}
      onQueue={() => {
        queue.add(song.id, entry?.preferredVersionId);
        showToast("Added to your practice queue");
      }}
      onLike={async () => {
        if (liked) {
          const old = await repo.unlike(song.id);
          showToast("Removed from your Library", old ? { label: "Undo", run: () => void repo.restoreEntry(old) } : undefined);
        } else {
          await repo.like(song.id);
          showToast("Added to your Library");
        }
      }}
    />
  );
}

export function SongList({ songs, empty }: { songs: Song[]; empty?: ReactNode }) {
  if (!songs.length) return <>{empty ?? null}</>;
  return (
    <ul className="list">
      {songs.map((s) => (
        <li key={s.id}>
          <ConnectedSongRow song={s} />
        </li>
      ))}
    </ul>
  );
}
