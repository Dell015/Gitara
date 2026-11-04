import { useState } from "react";
import { report } from "../../data/community";
import { Segmented, TopBar } from "../../ui/bits";
import { useNav } from "../nav";
import { useOverlays } from "../overlays";

type Page = "terms" | "privacy" | "copyright" | "credits";

/**
 * Legal pages (L). DRAFTS written in plain words for the owner to review with a Philippine lawyer
 * before launch (§10). Not legal advice. [Contact email] must be filled in before going public.
 */
export function Legal({ page }: { page: Page }) {
  const nav = useNav();
  const [p, setP] = useState<Page>(page);
  return (
    <>
      <TopBar onBack={nav.back} title="About Gitara" />
      <Segmented
        label="Page"
        value={p}
        onChange={setP}
        options={[
          { id: "terms", label: "Terms" },
          { id: "privacy", label: "Privacy" },
          { id: "copyright", label: "Copyright" },
          { id: "credits", label: "Credits" },
        ]}
      />
      <p className="draftnote">Draft: to be reviewed by a lawyer before Gitara opens to the public.</p>
      <article className="prose">{p === "terms" ? <Terms /> : p === "privacy" ? <Privacy /> : p === "copyright" ? <Copyright /> : <Credits />}</article>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p>Gitara is a free app for playing music: your songbook, chord versions, practice tools and backing tracks. No ads, ever.</p>
      <h2>Your account</h2>
      <p>You need to be 13 or older. Until real sign-in exists, Gitara gives you a guest account that lives in this browser: if you clear your browser's data, you lose access to it. Keep your account to yourself.</p>
      <h2>What you share</h2>
      <p>Everything you make starts private. When you make a song, version, track or playlist public, you let others see it and save a copy of it (with your credit kept). You keep ownership of what you create.</p>
      <p>Only share what you have the right to share. Chords you work out are fine; don't upload other people's recordings or copy full lyrics.</p>
      <h2>Be decent</h2>
      <p>No spam, harassment, hate or anything illegal. Don't fake votes or ratings. We can hide content or close accounts that break these rules.</p>
      <h2>No guarantees</h2>
      <p>Gitara is provided as it is. Chord versions are written by people and can be wrong: the community votes help, but check by ear.</p>
      <h2>Changes</h2>
      <p>If these terms change in a way that matters, we'll say so in the app first.</p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p>Written to follow the Philippine Data Privacy Act of 2012 (Republic Act 10173).</p>
      <h2>What Gitara keeps</h2>
      <ul>
        <li>An account id (a guest account until real sign-in exists). No name, email or phone is needed.</li>
        <li>What you make and save: songs, chord versions, tracks, playlists, your Library and statuses, votes, ratings and reports.</li>
        <li>Optional profile details you type in: a display name, @handle and bio.</li>
      </ul>
      <h2>What it doesn't</h2>
      <ul>
        <li>No ads and no ad tracking. Nothing is sold.</li>
        <li>The tuner listens through the microphone only while it's open. Nothing is recorded or sent anywhere.</li>
        <li>Your location, contacts and photos are never asked for.</li>
      </ul>
      <h2>Where it's kept</h2>
      <p>On your device first, and in a database run by Supabase in Singapore so it syncs and can be shared. Song names you search for are looked up on MusicBrainz.</p>
      <h2>Who sees it</h2>
      <p>Only you, unless you make something public or switch on a public profile section. Moderators can see reports and what was reported.</p>
      <h2>Your rights</h2>
      <p>You can see, correct, download and delete your data, and object to how it's used. You can complain to the National Privacy Commission (privacy.gov.ph). To ask about your data, write to [contact email].</p>
      <h2>Deleting your account</h2>
      <p>Your private data is deleted. Public versions others rely on stay, shown as by a "deleted user".</p>
    </>
  );
}

function Copyright() {
  const { showToast } = useOverlays();
  const [f, setF] = useState({ link: "", who: "", contact: "", rights: "", ok: false });
  const [sent, setSent] = useState(false);
  const idFromLink = (l: string) => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(l)?.[0];
  return (
    <>
      <h1>Copyright and takedowns</h1>
      <p>Gitara hosts chords people work out themselves, never original recordings. Lyrics aren't stored. If you believe something on Gitara copies work you own, tell us here and we'll act quickly, usually by hiding it while we look.</p>
      <h2>Takedown request</h2>
      {sent ? (
        <p>
          <strong>Received.</strong> We'll review it and reply to the contact you gave.
        </p>
      ) : (
        <div className="form">
          <label className="field">
            <span className="field__label">What's infringing (link or id)</span>
            <input className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="Paste the link to the song, version or track" />
          </label>
          <label className="field">
            <span className="field__label">Your name, and who you represent</span>
            <input className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">How to reach you</span>
            <input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Email or phone" />
          </label>
          <label className="field">
            <span className="field__label">The work and your rights to it</span>
            <textarea className="input" rows={3} value={f.rights} onChange={(e) => setF({ ...f, rights: e.target.value })} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} />
            <span>I believe in good faith this use isn't allowed, and what I've written is accurate.</span>
          </label>
          <button
            className="btn btn--primary"
            disabled={!f.link || !f.who || !f.contact || !f.ok}
            onClick={async () => {
              try {
                await report("song", idFromLink(f.link) ?? "00000000-0000-0000-0000-000000000000", "copyright", `Takedown. ${f.who}. Work: ${f.rights}. Link: ${f.link}`, f.contact);
                setSent(true);
              } catch (e) {
                showToast(e instanceof Error ? e.message : "Couldn't send it");
              }
            }}
          >
            Send takedown request
          </button>
        </div>
      )}
    </>
  );
}

function Credits() {
  return (
    <>
      <h1>Credits</h1>
      <ul>
        <li>Type: Montserrat, by Julieta Ulanovsky and contributors (SIL Open Font License).</li>
        <li>Song names: MusicBrainz, the open music encyclopedia.</li>
        <li>Database and sync: Supabase. On-device storage: Dexie.js.</li>
        <li>Built with React and Vite.</li>
        <li>The light: domain-warped noise after Inigo Quilez; "hash without sine" by Dave Hoskins.</li>
        <li>Every sound (guitar, drums, clicks) is made on your device. No recordings are used.</li>
      </ul>
    </>
  );
}
