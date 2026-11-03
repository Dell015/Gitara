/**
 * Who is using the app right now. Until the guest account exists (or with no Supabase keys) we
 * write "local" as the owner; sync stamps the real account id when it sends rows.
 */
import { useSyncExternalStore } from "react";
import { ensureSession, type SessionState } from "./session";

let state: SessionState | { status: "checking" } = { status: "checking" };
const listeners = new Set<() => void>();

export const LOCAL_OWNER = "local";

export function getSession() {
  return state;
}

export function currentUserId(): string | null {
  return state.status === "ready" ? state.userId : null;
}

/** True when a row's owner is the person using this device. */
export function isMine(ownerId: string | null | undefined): boolean {
  if (!ownerId) return false;
  return ownerId === LOCAL_OWNER || ownerId === currentUserId();
}

export function ownerForNewRow(): string {
  return currentUserId() ?? LOCAL_OWNER;
}

export async function startSession(): Promise<SessionState> {
  const s = await ensureSession();
  state = s;
  listeners.forEach((l) => l());
  return s;
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
