import { useEffect, useState } from "react";
import { GUITAR, GUITAR_TUNINGS } from "./core/instrument";
import { db } from "./data/local-db";
import { ensureSession, type SessionState } from "./data/session";
import { isSupabaseConfigured } from "./data/supabase";
import Preview from "./design/Preview";
import { App as Gitara } from "./app/Shell";

type Check = { label: string; state: string; ok: boolean };

/**
 * Phase 0 build check: proves the toolchain, the on-device database and the guest account work.
 * It is not the real UI; the design system comes next (docs/questions.md section 19).
 */
export default function App() {
  // #design shows the design preview, #check the Phase 0 build check; everything else is the app.
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (hash === "#design") return <Preview />;
  if (hash === "#check") return <BuildCheck />;
  return <Gitara />;
}

function BuildCheck() {
  const [localDb, setLocalDb] = useState<Check>({ label: "On-device database", state: "checking…", ok: false });
  const [session, setSession] = useState<Check>({ label: "Guest account", state: "checking…", ok: false });

  useEffect(() => {
    db.open()
      .then(() => setLocalDb({ label: "On-device database", state: "open", ok: true }))
      .catch((e: unknown) =>
        setLocalDb({ label: "On-device database", state: e instanceof Error ? e.message : "failed", ok: false }),
      );

    ensureSession().then((s: SessionState) => {
      const state =
        s.status === "ready"
          ? s.isGuest
            ? "guest account ready"
            : "signed in"
          : s.status === "unconfigured"
            ? "not configured (local-only mode)"
            : `offline: ${s.reason}`;
      setSession({ label: "Guest account", state, ok: s.status === "ready" });
    });
  }, []);

  const checks: Check[] = [
    { label: "Instrument core", state: `${GUITAR.strings} strings, ${GUITAR_TUNINGS.length} tuning presets`, ok: true },
    { label: "Supabase keys", state: isSupabaseConfigured ? "found" : "missing (see .env.example)", ok: isSupabaseConfigured },
    localDb,
    session,
  ];

  return (
    <main className="check">
      <h1 className="check__wordmark">Gitara</h1>
      <p className="check__intro">Phase 0 build check. The real screens come after the design system.</p>
      <ul className="check__list">
        {checks.map((c) => (
          <li className="check__row" key={c.label}>
            <span>{c.label}</span>
            <span className="check__state" data-ok={c.ok}>
              {c.state}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
