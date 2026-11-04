import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../data/auth";
import { loadRoom, rememberJam, watchRoom, type Room } from "../data/jam";

export type RoomState = { status: "loading" } | { status: "offline" } | { status: "gone" } | { status: "ready"; room: Room };

/** A jam kept up to date: live changes from the database, plus a slow refresh in case a message is missed. */
export function useRoom(jamId: string): { state: RoomState; reload: () => void } {
  const session = useSession();
  const [state, setState] = useState<RoomState>({ status: "loading" });
  const busy = useRef(false);
  const again = useRef(false);

  const reload = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        const room = await loadRoom(jamId);
        if (!room) {
          rememberJam(null);
          setState({ status: "gone" });
        } else setState({ status: "ready", room });
      } while (again.current);
    } catch {
      setState((s) => (s.status === "ready" ? s : { status: "offline" }));
    } finally {
      busy.current = false;
    }
  }, [jamId]);

  useEffect(() => {
    if (session.status !== "ready") {
      if (session.status !== "checking") setState({ status: "offline" });
      return;
    }
    void reload();
    const stop = watchRoom(jamId, () => void reload());
    const tick = setInterval(() => void reload(), 20000);
    const vis = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [jamId, session.status, reload]);

  return { state, reload: () => void reload() };
}
