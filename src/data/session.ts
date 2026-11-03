/**
 * Guest accounts from day one (docs/aboutproject.md §5.13): no login screen yet. The app quietly
 * creates an anonymous Supabase account so public/private, ratings and jams have a "who".
 * When real sign-in arrives (Phase 5) the guest account is upgraded, so nothing is lost.
 *
 * Catch: a guest lives in one browser. Clearing site data or switching device loses it until it's
 * linked to a real login.
 */
import { supabase } from "./supabase";

export type SessionState =
  | { status: "unconfigured" } // no Supabase keys: local-only mode
  | { status: "ready"; userId: string; isGuest: boolean }
  | { status: "offline"; reason: string }; // configured, but couldn't reach Supabase right now

export async function ensureSession(): Promise<SessionState> {
  if (!supabase) return { status: "unconfigured" };

  try {
    const existing = await supabase.auth.getSession();
    if (existing.error) throw existing.error;

    const current = existing.data.session;
    if (current) {
      return { status: "ready", userId: current.user.id, isGuest: current.user.is_anonymous ?? false };
    }

    const created = await supabase.auth.signInAnonymously();
    if (created.error) throw created.error;
    const user = created.data.user;
    if (!user) throw new Error("Guest sign-in returned no user");
    return { status: "ready", userId: user.id, isGuest: true };
  } catch (err) {
    // Offline or the project is paused: keep working locally, try again later.
    return { status: "offline", reason: err instanceof Error ? err.message : String(err) };
  }
}
