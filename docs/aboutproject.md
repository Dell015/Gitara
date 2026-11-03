# About the Project — Project Bible

> The single source of truth for this project: every feature, decision and rule.
> When something is added, changed or dropped, update this file first, then build it.

- **Name:** Gitara (working name; check it's free to use before launch, Q108)
- **Last updated:** 2026-11-04
- **Stage:** Planning. Nothing built yet.
- **Companion file:** `questions.md` (open questions; answers move into this file)

## How to read this file

Every item has a tag:

- `[DECIDED]` you confirmed it
- `[PROPOSED]` Claude's suggestion, waiting for your OK
- `[LATER]` confirmed, but not in the first builds
- `[PREMIUM?]` candidate for the paid tier
- `[OPEN]` not decided yet, see questions.md

---

## 1. The idea

**Gitara is an all-in-one jamming utility app**: a free app for guitarists, and later other instruments. It works like Spotify, but for **playing** songs instead of listening to them:

- Keep a library and playlists of songs you know or want to learn.
- Every song has chord versions, yours and other people's, split into sections (intro, verse, chorus…) and showing where the chords change. The community votes on which versions are accurate.
- Practice with built-in tools and play-along tracks you make yourself (drums, bass, loops, your own recordings) or pick from existing ones.
- Jam with friends: the app combines everyone's songs into one setlist and tells each person what to play.

### Original idea (your words, lightly cleaned up)

> A project for guitarists that will ultimately be available for other instruments. Users make playlists of songs they know, like Spotify. Each song is tagged with info that matters to guitarists: genre, BPM and more. For each song, users can add their own version of the chords, as well as chords from other people, and mark which part of the song changes chords. Users can also make their own track: build the beat with whatever instruments they need to play along with, or use existing beats and loops like GarageBand, but more flexible to edit. Free, so that a lot of people use it. Everyone is creative and nobody wants to pay. Ways to make money come later.

Automatic tagging was later dropped (see Decision log).

## 2. Principles

1. `[DECIDED]` Free and flexible. The goal is lots of users.
2. `[DECIDED]` No ads. Ever.
3. `[DECIDED]` Money comes later, from paid features for the complex, professional and detailed parts. The free app must stay genuinely useful.
4. `[DECIDED]` Be different, not a copy of Ultimate Guitar, Songsterr, GarageBand or BandLab.
5. `[DECIDED]` Users make their own versions; the community decides what's accurate by voting.
6. `[DECIDED]` Guitar first. Other instruments only after the guitar side is complete.
7. `[PROPOSED]` Respect copyright: never host original recordings. Lyrics are `[OPEN]` because you want them (§5.7, §10).
8. `[PROPOSED]` Never take away something that was free, and never paywall sharing.

## 3. Users `[DECIDED]`

- Everyone, from beginners to professionals.
- Your cousin is a tester only. The idea and every decision are yours.
- **Goal (not a deadline):** real users before you graduate in June 2027. No timeline is attached; we work at your pace. See the note in §7.
- **The first 5 minutes** `[DECIDED]`: pick songs you're interested in → open an existing one and see the chords (and lyrics, `[OPEN]`, see §5.7) in a fresh take on the Ultimate Guitar layout → check other versions → find backing tracks other people made, or make your own. Early on nobody else will have made tracks yet, so "make your own" has to feel great by itself.
- **Why Gitara can stand out** (from your experience): Ultimate Guitar is for reading chords; GarageBand is hard to navigate and Apple-only. Gitara is simple, works on any device, and puts reading, practicing, making backing tracks and jamming in one place.

## 4. Platforms

- `[DECIDED]` All of them: web, iOS, Android, desktop.
- `[PROPOSED]` Order: a web app first that installs on phones and computers like a normal app (a PWA, see glossary). Then app-store versions made from the same code. Desktop uses the installable web app; a separate desktop app only if needed.
- `[DECIDED]` Offline: yes (if you edit on two devices offline, the latest edit wins). Your library, chord charts, practice tools and tracks work without internet. Community features (other people's versions, voting, live jam updates) need internet.

## 5. Features

### 5.1 Song library `[DECIDED]`

- Search for a song. If it isn't in the app yet, add it with a form (title, artist and other info).
- When adding, choose **Public** (everyone can see and rate it) or **Private** (only you).
- Others can rate public songs. Good ratings raise the contributor's profile rating.
- **No auto-tagging.** Song info is entered by people, not detected automatically.
- `[DECIDED]` Free helpers (accepted):
  - **Tap tempo:** tap along with the song to get its BPM.
  - **Key suggestion:** guess the key from the chords in a version.
  - **Duplicate warning:** "this song may already exist" while typing.
  - **Duplicate rule** `[DECIDED]`: if a new version is *exactly* the same as an existing one (same song, tuning, capo and identical chords in every section), publishing is denied and the existing version is shown. If anything differs, it can be published and the votes decide which is better. Private copies are never blocked. `[PROPOSED]` For song entries, the same title + artist means "add a version to the existing song" instead of a second song. Confirm in Q135.
  - **Name autocomplete** from MusicBrainz (a free, open music database), so titles and artists are spelled right. This only looks up names; it isn't auto-tagging. `[DECIDED]` It benefits us: fewer typos and fewer duplicates. MusicBrainz allows about 1 request per second, so we cache results.
- `[DECIDED]` Link to the original recording (YouTube embed, Spotify link) so people can listen while learning.
- `[DECIDED]` The "Add song" form requires title + artist (plus only what's truly needed). Covers, live and acoustic versions are the same song with a tag on the version. Users can add their own original songs. After publishing, the person who added a song edits its info; others suggest edits; high-rated users approve them. A song's rating measures accuracy and quality only. **"Songs I can play"** (songs that use only chords you know) is in.

### 5.2 Song info `[DECIDED]`

You chose: genre, BPM, key, time signature, tuning, capo, difficulty, plus more as needed. Because tuning depends on the version (your answer), the info is split in two:

- **Song info** (same for everyone): title, artist, album, year, genre, original key, original BPM, time signature, length, link to the original.
- **Version info** (depends on who plays it): tuning, capo, key played in, BPM if different, difficulty, strumming or picking style, techniques (barre chords, palm muting, fingerpicking…).
- `[DECIDED]` Genre is included: a fixed main list plus free tags. Extra fields: strumming pattern, chords used (filled in automatically), language.
- `[DECIDED]` **Difficulty is system-generated**, not typed in. `[PROPOSED]` How it's computed from the version's content:
  - how many different chords, and how hard each one is (open < barre < unusual shapes)
  - how fast the chords change (changes per minute at the version's BPM)
  - the BPM
  - strumming pattern complexity
  - for lead parts, once tabs exist: fret span, string skips, speed, bends/slides, and how many different notes are used
  - shown as Beginner / Intermediate / Advanced with the reasons visible ("4 chords, 1 barre, slow changes"). Until tabs exist, lead difficulty isn't scored.
  - `[OPEN]` Should players also say "felt harder / easier" to tune the formula? (Q131)

### 5.3 Playlists `[DECIDED]`

- Multiple playlists per user.
- Playlists can be shared.
- Playlists can be made together with friends.
- `[DECIDED]` Privacy: private, unlisted (anyone with the link) or public. Shared playlists: the owner and invited editors can change them; everyone else views only. A playlist item can point to a specific version. A gig setlist is a playlist with a "setlist mode" later.

### 5.4 Learning status and profile `[DECIDED]`

- Every song in your library has a status: **Planning to learn → Learning → Performing**.
- Your profile shows three sections: Planning to learn, Learning, Performing.
- Your profile rating grows when people rate your public songs and versions.
- You can move a song in any direction (Planning ↔ Learning ↔ Performing), including back to Learning if you've forgotten it. Dates are recorded automatically. Each song also has checkboxes for the parts you can play (chords / lead / solo).

### 5.5 Chord versions `[DECIDED]`

- A song can have many versions: yours plus other people's.
- You can view and copy other people's versions.
- Each version is split into sections (intro, verse, chorus, bridge, solo, outro…) and shows where the chords change.
- Tuning and capo belong to each version.
- Voting: more votes = more likely good and accurate. Best-voted versions show first, and the top one gets an automatic "best version" badge (moderators can override).
- `[OPEN]` **Down-votes (Q47).** You're unsure. My recommendation: **upvote only** at first, plus a report button for wrong or harmful versions. Reasons: down-votes invite pile-ons and discourage beginners from sharing; bad versions sink anyway because better ones collect more upvotes; and reports still bring real problems to you. One vote per account, no voting on your own versions. Difficulty is computed by the system, so there's no difficulty vote.
- `[DECIDED]` Publishing a version means allowing the public to save a copy. Copies always show credit ("based on Ana's version"), and you're credited in the version's info. Private versions can't be copied; if you take a public version private, copies already made stay. Each version keeps a simple edit history (undo / restore).
- `[DECIDED]` **Transpose and capo tools:** view any version in another key or capo position without editing it; the app recalculates every chord. Versions that differ only by capo are recognized as the same song in a different position.

### 5.6 Chord editor `[DECIDED]`

Two ways to enter a chord:

1. **Chord picker:** choose from existing chords (built-in and saved ones).
2. **Fretboard:** tap strings and frets and choose which finger goes where. If the shape matches a known chord, the app names it automatically.

`[DECIDED]` How user-made chords get names (you asked how; this is the plan):

- A chord's name comes from its **notes**, not its fingers. The app reads which notes the shape plays, finds the root note and matches the pattern (major, minor, 7, sus, add9…).
  - `x32010` = C
  - `x32033` = Cadd9
  - `332010` = C/G (a slash chord: C with G as the lowest note)
  - Numbers are frets from the thickest string to the thinnest; x = muted, 0 = open.
- If nothing matches cleanly, the app shows the notes and you name it. It's saved as your custom shape.
- One chord name has many shapes ("voicings"). Shapes are stored and linked to names, so "other ways to play C" works.
- `[PROPOSED]` Hear the chord when you tap it; tap above the nut to switch muted/open; drag across the strings for barre chords; left-handed mode.

### 5.7 Chord chart view

- `[DECIDED]` Sections with their chords.
- `[OPEN]` (Q36, let's talk) Main view: each section as a grid of bars and beats. Because the app knows exactly when each chord happens, play-along works. The alternative is a plain list of chords per section: simpler, but it can't drive play-along.
- `[PROPOSED]` Chord diagrams for every chord in the version.
- `[LATER]` Tabs for riffs, intros and solos (the lead parts Jam mode needs). You said later.
- `[DECIDED]` **Strumming patterns** shown as arrows (D D U U D U) per section, and you can tap to **hear** how the pattern sounds.
- `[OPEN]` **Lyrics (Q37, let's talk).** You want lyrics and chords together, like Ultimate Guitar. That's the biggest legal question in the project; see §10. Until we decide, nothing stores song lyrics. Short cue notes ("after the drum fill") are fine either way.
- `[OPEN]` (Q41, later) Display options: sharps or flats, chord-name style (Cmaj7 / CM7), Nashville numbers. Left-handed mode is a yes `[DECIDED]`.

### 5.8 Practice tools `[DECIDED]`

- Metronome
- Tuner
- Loop a section (one part on repeat)
- Play-along: the chord chart plays automatically at the song's BPM, highlighting the current chord, with a click or a backing track.
- `[PROPOSED]` Extras: count-in; speed trainer (start slow, speed up gradually); keep the screen awake; auto-scroll; foot-pedal page turning (Bluetooth pedals act like a keyboard); practice log.

### 5.9 Track maker `[DECIDED]`

- Make your own track to play along with, using whatever instruments you need.
- Or use existing beats and loops (like GarageBand), but more flexible to edit.
- Build order: **loops and drum beats → bass → rhythm guitar → more instruments → full multi-track recording.**
- `[DECIDED]` The loop library should be as flexible as we can make it: every loop editable (notes, timing, swing, length, key, tempo) and reusable across songs.
- Record your own playing, or build from loops and virtual instruments. Both.
- A track can be linked to a song as its backing track, public or private.
- Simple editor first, complex later.
- `[LATER]` Export and share tracks.
- `[PROPOSED]` Editor order. All three edit the same data, so a track made in the simple one opens in the advanced ones:
  1. **Step sequencer:** a grid of on/off steps. Best for drums.
  2. **Piano roll:** notes on a pitch × time grid. For bass and keys.
  3. **Timeline:** arrange clips and recordings across the whole song.
- `[PROPOSED]` Sound sources, in this order:
  1. Sounds the app generates (synthesized): no licensing issues, tiny, work offline.
  2. Built-in samples that are free to use (CC0) or that we record ourselves.
  3. User uploads, later (needs storage limits, moderation and copyright rules).
- `[PROPOSED]` `[PREMIUM?]` **Auto backing track:** pick a style (pop, rock, ballad…) and the app writes drums and bass that follow the chord chart.

### 5.10 Jam mode `[DECIDED: concept]` `[PREMIUM?]`

The scene: a party with 3–4 guitarists, each knowing different songs and solos.

- Friends join a temporary jam.
- The app compares everyone's libraries and builds a temporary playlist.
- For each song it shows who plays together and who plays alone, and who plays chords vs lead.
- Could become the main paid feature if it proves new enough. Worth checking that no other app already does this before betting on it.
- `[PROPOSED]` Details:
  - Join with a QR code or link.
  - Uses each person's status (Performing = confident) and the parts they know (chords / lead / solo).
  - **Key matching:** if people play a song in different keys or capo positions, the app picks one key and tells each person which capo and shapes to use. This is why the transpose/capo tools are core, not extra.
  - Swap or skip songs live.
- `[DECIDED]` (suggestions accepted) Join by QR code or link; everyone needs an account (a guest account works). "Can play" = Performing by default, with a switch to include Learning. Roles: rhythm / lead / solo, plus "can sing it". The setlist mixes group songs with solo spots, balances the spotlight and aims for a target length. If players use different keys or capos, the app picks one key and gives each person their capo and shapes. Swap, skip and request songs live. A jam can be saved as a playlist afterwards.
- `[DECIDED]` **No minimum or maximum length.** A jam lasts as long as the host wants. (To protect the free hosting, an empty jam that nobody has touched for a long time is cleaned up; the host can save it as a playlist first.)
- `[DECIDED]` Works online at first; once loaded it keeps working if the connection drops.
- `[OPEN]` **Offline jams if Gitara becomes a real native app.** A web app can't link phones to each other without the internet; native apps can (phones find each other directly over Bluetooth/Wi-Fi). So the jam's sync layer is built as a swappable piece: internet now, direct phone-to-phone in a native app later. A note for the future, not work for now.
- `[DECIDED]` Free vs paid limits: decide after testing at real jams.

### 5.11 Community `[DECIDED]`

- Songs, chord versions and tracks can each be public or private.
- Ratings on public songs and votes on versions; both raise the contributor's profile rating.
- `[DECIDED]` Reputation unlocks trust: people with a good rating can fix song info, merge duplicates and help moderate.
- `[DECIDED: idea]` **Earn a boost:** keep a good rating for a month and you get a small boost, such as temporary access to some Pro features. `[OPEN]` The exact numbers. Fake-vote protection (§5.12) matters so this can't be farmed.
- Reputation grows from ratings on your songs, votes on your versions, and others copying your tracks.

### 5.12 Moderation `[DECIDED: needed]` `[PROPOSED: how]`

You moderate at first (your cousin is a tester only); trusted users later. Cheapest layers first:

1. **Report button** on everything (wrong info, duplicate, spam, offensive, copyright) → a review queue for admins (you, at first).
2. **Votes** push bad versions down automatically.
3. **Limits for new accounts** (posts per day), email verification, invisible CAPTCHA.
4. **Duplicates:** search before adding, "possible duplicate" warnings, a merge tool.
5. **Trusted users** (high reputation) get moderation powers.
6. **Copyright takedown form** with fast removal. Needed before going public.
7. Later: automatic filters for profanity and spam.

### 5.13 Accounts `[DECIDED: required, built last]`

- Sign-in is required, but the sign-in screens are built after the core features.
- **Conflict:** public songs, ratings, votes, profiles, shared playlists and Jam mode all need to know who is who.
- `[PROPOSED]` **Guest accounts from day one:** the app quietly creates an account in the background (Supabase "anonymous sign-in"), with no login screen. When real sign-in is added, the guest account upgrades and nothing is lost.
- **Catch:** a guest account lives in one browser. Clearing browser data or switching devices loses access until it's linked to a real login. Fine for you and your cousin while building; add real sign-in before inviting others.

**Decided details**
- Sign-in later: email + Google first; Apple when the iPhone app comes. Minimum age 13+ (younger users bring strict child-privacy laws). Unique @handle plus any display name; real names optional. English only at first, built so it can be translated.
- **Profiles have a private side and a public side.** Everything is private by default; each person chooses what to make public (the three status sections, rating, instruments, songs, tracks…).
- Follow people, plus a "jam buddies" list. Users can block each other.
- Deleting an account keeps public content, shown as "deleted user".
- Anti-abuse: email verification, posting limits for new accounts, invisible CAPTCHA, one vote per account, and votes from brand-new accounts count less.

### 5.14 Other instruments `[LATER]`

- Only after the guitar side is complete.
- `[PROPOSED]` Build the core for any stringed instrument: an instrument is just "number of strings + tuning + number of frets". Bass and ukulele then reuse the fretboard, chord and tab tools.

### 5.15 Design direction `[DECIDED]`

- Clean, minimal, **frosted glassmorphism** (translucent, blurred panels). **Dark mode first.**
- `[DECIDED]` **Look: "Ember on Teal".** Based on your two reference images, turned down. The idea: a near-black teal night, with warm light only where it means something. It also reads as a sunburst guitar finish (amber → red → black) against a dark stage.
  - **Base:** ink `#0B1014`, deep teal `#112E33` / `#173E41` (soft glow in a corner, never a flood).
  - **Warm:** amber `#E08547`, ember `#C4472E`, deep red `#75171E`.
  - **Text:** `#ECEFF1`, secondary `#8A979E`.
  - **Noise grain** over everything (you liked it), subtle, like analog tape.
  - **Type:** a geometric sans, like your reference. Wide-tracked capitals are used for the wordmark and screen titles only (as in your reference image); everything else is sentence case at a readable size. Montserrat (free) is the closest match I know; the exact font can be swapped later.
  - **Glass:** only on the floating layer (tab bar, player bar, sheets, menus); content is solid tone steps. See §5.16. Starting values: about 5% white fill, 9% white hairline, 22px blur, plus a solid fallback.
- **"Quiet" rules (what makes it less loud than the references):** about 90% of any screen stays dark teal-black. The big warm arc appears as a soft glow behind the glass, once per screen, never behind text. Warm color is reserved for meaning: the chord playing now, the play button, the beat dot, the playhead, and the Learning/Performing states.
- **Where the look matches the purpose:**
  - **Heat = progress.** Planning to learn is cool teal → Learning is amber → Performing is hot ember. Difficulty and status use the same scale. How it's drawn is still to be designed (Q141); not as colored left-edge bars (§5.16).
  - **The glow follows the music.** It gently breathes on the beat of the song's BPM and lights up the chord that's playing. When nothing is playing it's nearly still.
  - **The flowing lines are strings.** Soft curved lines in headers ripple when a chord is strummed.
  - **Grain = analog warmth**, matching the "jam night" feel.
- A first preview was made on 2026-11-04 (song view and profile). It's a mood sketch, not the design: it had several "AI tells" (audit in §5.16). The mood stays; the execution gets redone.
- Motion, transitions and animation should feel **premium and smooth**.
- `[PROPOSED]` Guardrails so it stays smooth: blur is expensive on older phones and drains battery, so glass is used on a few key surfaces with a solid fallback; animations stick to movement and fade; the chart and audio screens never drop frames; the "reduce motion" setting is respected.
- **Phone first, but every major feature also gets a desktop layout** (you test both every time). Desktop is easier for creating tracks, with more room and controls, so the track editor is designed desktop-aware from the start.
- `[DECIDED]` Bottom tabs: Home · Library · Practice · Create · Profile. Short skippable first-time setup (level, instrument, genres, add a first song). Big-text and high-contrast modes; accessibility basics from the start.

### 5.16 Design standards `[DECIDED]` (standing rules from you, 2026-11-04)

**Goal:** Gitara must never read as "AI slop". UI/UX, motion, animation, transitions, how components interact, the intent behind each one, and creativity are the priority.

**Process, every time UI is touched**
1. **Research first.** Look up current references and best technique on the web, including what to avoid. Name the references used.
2. **Consult your three reference sets** (re-clone read-only when needed; never put them in the project or commit them):
   - Emil Kowalski's skills, for motion and polish: https://github.com/emilkowalski/skills
   - Taste Skill, the anti-slop rules: https://github.com/Leonxlnx/taste-skill
   - Impeccable, for critique, audit and polish: https://github.com/pbakaus/impeccable
3. **Ask you when intent is unclear.** (Taste Skill says to decide rather than ask; your rule wins.)
4. **Intent before pixels:** what is this component for, what does it respond to, how does it relate to its neighbours.
5. **Look at the render** at phone and desktop widths and check it against the tells below before showing you.
6. **Your pinned aesthetics win over generic warnings:** glass, grain, wide-tracked display type, dark teal + ember. The rules below govern how they're executed.

**Look**
- **Glass lives on the floating functional layer** (tab bar, player bar, sheets, popovers, menus). The **content layer** (chord chart, lists, text) uses solid tone steps so it stays legible on a music stand under stage light. Apple's guidelines say not to use Liquid Glass in the content layer and to use it sparingly on controls.
- Always provide a solid fallback for "Reduce transparency".
- Wide-tracked capitals only for the wordmark and screen titles. No tiny tracked labels above headings or scattered around.
- Warm light carries meaning (the playing chord, the playhead, the beat), never decoration. No zero-offset colored glow halos on buttons.
- No nested cards, no rows of identical icon cards, no colored left-edge bars on rows, no emoji or Unicode arrows as icons. Real drawn icons in one stroke weight, with custom ones for guitar things (strum arrows, capo, fretboard).
- Pill chips only when they're tappable; plain metadata (G major · 92 BPM · Capo 2) otherwise.
- Details defaults skip: themed text selection, caret, focus rings and scrollbars; tabular numerals for BPM and timers; honest empty, loading and error states; the trade's own words ("Capo 2", not "Item").
- Never color alone: finger numbers, open/muted marks and states must read in monochrome.

**Motion**
- Ask in order: should it animate (how often is it seen?), what is its purpose, which easing, how fast.
- Things used constantly (metronome beat, chord changes while playing, tab switches, anything triggered by keyboard) get minimal or no animation. Things seen occasionally (sheets, version switching, onboarding) get the craft.
- Strong ease-out curves for UI, e.g. `cubic-bezier(0.23, 1, 0.32, 1)`; never ease-in for UI; UI moves stay under about 300 ms; springs only for drag, sheets and interruptible things, with subtle bounce at most.
- Name exact properties (never `transition: all`); animate transform and opacity by default; blur and backdrop only where proven smooth on a mid-range phone; everything interruptible; things enter from where they logically came (a popover grows from its trigger).
- Press feedback on every tappable thing (scale to about 0.97).
- Choreograph, don't stamp: no identical fade-up on every block. **The one signature moment: the light follows the music.** The ambient glow breathes with the BPM and moves to the playing chord. Everything else stays quiet so it lands.
- Respect "Reduce motion".

**Feel on the phone:** safe areas, `dvh` instead of `vh`, no tap-highlight flash, inputs at 16px or more so iOS doesn't zoom, hover styles only on devices that hover, no pull-to-refresh hijack, status-bar color matched. Test on real hardware, not only an emulator.

**Lessons from other apps** (checked 2026-11-04)
- Chord name, diagram and sound must always refer to the same selection; show tuning, capo and key wherever they change meaning; label alternate shapes (guitar-app chord UX analysis, ScreensDesign).
- Don't interrupt practice with upsell pop-ups. Songsterr's locked-feature pop-ups on the mixer and speed control are the cautionary example for our free-first plan.

**Audit of the first preview (what gets redone):** tracked capitals on about 20 labels (should be 2); glass on every card; glow halos on the play button and the active chord; 3px colored left bars on the profile groups; Unicode strum arrows; pill chips that aren't buttons; same-weight cards stacked on the song view. The mood (dark teal, ember arc, grain) stays.

**Tools for later:** Impeccable's detector (a command-line tool that needs no AI) and Taste Skill's inspector can be run over built screens; they need Node 22+ and Chrome.

Sources: developer.apple.com/design/human-interface-guidelines/materials · screensdesign.com (guitar-app chord UX; Songsterr) · the three repos above.

## 6. Free vs paid

`[DECIDED]` No ads. Free and flexible; paid only for the professional, detailed and complex parts.

`[PROPOSED]` Split:

**Free forever**
- Library, playlists, statuses, profile
- Adding songs, chord versions, other people's versions, voting, copying
- Chord editor, transpose and capo tools
- Metronome, tuner, loop a section, play-along
- Track maker basics: step sequencer, loops, a few tracks
- Offline use

**Pro (paid) candidates**
- Jam mode (maybe with a free taste)
- Advanced track editor: piano roll, timeline, unlimited tracks, multi-track recording, effects
- More cloud storage for recordings
- Pro exports (WAV, stems, MIDI)
- Auto backing tracks
- Premium sound packs
- Practice stats

**Other money ideas (no ads)**
- Supporter donations early, with a profile badge
- A marketplace later: people sell backing tracks or arrangements, and the app keeps a small cut
- Teacher plans: assign songs and versions to students, see their progress
- Earned perks: keep a good community rating and unlock a temporary taste of Pro (§5.11)
- You said anything that helps the app is welcome. You haven't read the free-vs-paid split yet (Q111).

## 7. Build order (phases, no dates)

You don't follow timelines, so this is an order, not a schedule. Each session picks from **Next up** (§15): what's missing, what needs fixing, what's next.

**Goal, not a deadline:** real users before June 2027. Honest note: the full vision is much bigger than what fits before then. A realistic *launch slice* for first users is Phases 0–6 in a lean form (songs, chords, practice tools, a simple drum track maker, sign-in, public/private and voting). Jam mode, bass, recording and the app stores come after. We still work in your order; this just says what to protect if time gets tight.

- **Phase 0 — Foundations:** project setup, design basics, instrument definition, data model, guest accounts.
- **Phase 1 — My songbook:** add songs, library, playlists, statuses, song info, tap tempo, installable app.
- **Phase 2 — Chords:** chord picker, fretboard editor with fingers and auto-naming, sections, chart view, transpose/capo, multiple versions.
- **Phase 3 — Practice:** metronome, tuner, loop a section, play-along at the song's BPM, offline use.
- **Phase 4 — Track maker v1:** drum and loop step sequencer, linked to songs, play-along with your track.
- **Phase 5 — Real sign-in:** sign-in screens, upgrading guest accounts, sync across devices.
- **Phase 6 — Community:** public/private, copying versions, voting, ratings and reputation, shared playlists, moderation basics, legal pages.
- **Phase 7 — Jam mode.**
- **Phase 8 — Track maker v2:** bass, piano roll, recording your playing, timeline, effects.
- **Phase 9 — App stores and sharing:** iOS/Android apps, exporting and sharing tracks.
- **Phase 10 — Pro:** paid features and payments.
- **After:** other instruments.

## 8. Tech stack `[DECIDED]` (you accepted the proposal)

Goals: one codebase for every platform, $0 to start, strong audio, and easy for Claude to write.

- **Language:** TypeScript (one language everywhere; catches mistakes early)
- **App:** React + Vite, built as an installable web app (PWA)
- **Phone apps:** Capacitor wraps the same app for the App Store and Google Play
- **Desktop:** the installable web app; Tauri later only if needed
- **Styling:** Tailwind CSS
- **Backend:** Supabase: database (Postgres), sign-in including guest accounts, file storage, realtime updates for Jam mode. Already connected to your Claude, so Claude can set it up.
- **Offline storage:** IndexedDB via Dexie
- **Audio:** Web Audio API + Tone.js (timing, drum machine, synths, samplers, play-along)
- **Music theory:** Tonal (chord naming, transposing, keys)
- **Tuner:** microphone + pitch detection (e.g. the pitchy library)
- **Tabs (later):** alphaTab (shows and plays tabs, opens Guitar Pro files)
- **Song name lookup:** MusicBrainz API
- **Hosting:** a free static host (Cloudflare Pages, Vercel or Netlify)
- **Code:** a private GitHub repo (you create it and make every commit and push yourself)
- **Your setup:** Windows with Node.js installed; we work mostly through chat.
- **Test devices:** iPhone 17 Pro Max, a laptop and a PC. No Android device yet; see §14.

**Why a web app instead of separate native apps:** the browser's audio engine is the strongest audio toolkit that runs everywhere from one codebase. Trade-offs:

- Recording delay is worse on some Android phones.
- On iPhone, audio can only start after a tap.
- Bluetooth headphones and speakers add noticeable delay. Wired headphones are best for play-along and recording.

**Free limits to design around** (Supabase Free plan, checked 2026-11-03): 500 MB database, 1 GB file storage, 5 GB of downloads (egress) a month, 50,000 monthly active users, 2 projects. Free projects pause after a week without activity (you can restore them). Audio is the expensive part, so generate drums and loops, compress recordings, and cap free recording storage.

**Spotify:** no "import your Spotify playlists" for now. Spotify stopped giving new apps its BPM/key data in November 2024, and since February 2026 new developer apps need Spotify Premium and are capped at 5 test users. Linking to songs on Spotify or YouTube is fine.

**Costs that appear later, only when needed:**

- Apple App Store: $99 a year
- Google Play: $25 one time (personal accounts must pass a testing requirement before publishing)
- Domain name: optional, roughly $10–15 a year
- Supabase Pro: $25 a month, only when the app outgrows the free plan
- A lawyer's review before public launch

Sources: supabase.com/pricing.md · supabase.com/docs/guides/auth/auth-anonymous · developer.spotify.com/blog/2024-11-27-changes-to-the-web-api · techzine.eu (Spotify Development Mode changes, 2026) · support.google.com/googleplay/android-developer/answer/6112435 · exercise.com (Apple developer fee)

## 9. Data model (concept, not final)

```
User
 ├─ Library entry ── Song ── Version ── Section ── Bar ── Chord ── Shape
 ├─ Playlist ─────── songs (optionally a specific version)
 ├─ Track ────────── backing track, optionally linked to a song or version
 └─ Jam ──────────── members + generated setlist
```

- **Song:** the shared catalog entry: title, artist, album, year, genre, original key and BPM, time signature, links. Public or private.
- **Version:** one person's way to play a song: tuning, capo, key, difficulty, strumming, notes. Can be copied from another version (keeps credit). Gets votes.
- **Section:** intro, verse, chorus…, with an order and repeat count. Defined once and reused in the song's structure.
- **Bar and chord:** each section has bars; each bar has chords with their length in beats.
- **Shape (voicing):** fret and finger for each string, linked to a chord name. Built-in or user-made.
- **Tab:** optional notes for riffs and solos inside a section.
- **Library entry:** you + a song + status (Planning / Learning / Performing) + parts you can play (chords / lead / solo) + your preferred version.
- **Playlist:** ordered songs, owner, collaborators, privacy.
- **Track:** tempo, key, time signature, lanes (drums, bass, recordings…), optionally linked to a song or version. Public or private.
- **Instrument:** strings, tuning, frets.
- **Jam:** members, setlist with roles, end time.
- **Ratings, votes, reports.**

## 10. Copyright and legal `[PROPOSED]` (not legal advice)

> **Conflict to resolve (Q37, Q130):** you want lyrics + chords like Ultimate Guitar, but the stance below says no lyrics, and your answer to Q102 accepted that stance. Both can't hold yet. The options are at the end of this section. Nothing lyrics-related gets built until you pick one.

**Where you are:** the Philippines. Collecting emails and recordings brings data-privacy rules (the Philippines has the Data Privacy Act of 2012). I'll check the specifics, and business registration, when we reach that step, and a Philippine lawyer should review before public launch.

**Why storing lyrics is different from "just searching them online":** the big lyrics and tab sites you find online usually pay for licenses. If our app stores and shows lyrics, we become the publisher, without a license.

**History worth knowing:**

- Around 2004–2005, tab sites like MXtabs and Taborama closed after legal threats from music publishers.
- Publishers argue that tabs, even inaccurate ones, are "derivative works" of the songs.
- Ultimate Guitar survived by signing licenses with thousands of publishers, including a 2010 deal that covered displaying lyrics and tabs.
- Chord charts without lyrics are lower risk, but not zero risk, since they're still a transcription of a specific song.

**Our stance:**

1. No lyrics at first. Sections, chords and short cue notes only.
2. Never host original recordings. Link to or embed YouTube/Spotify instead.
3. User-made content with a clear takedown process (copyright notice form, fast removal).
4. Terms of Service: users only post what they're allowed to; they keep ownership but let the app display it.
5. Built-in sounds: only free-to-use (CC0), self-recorded or generated.
6. Before going public: Terms of Service, Privacy Policy and copyright policy, reviewed by a lawyer. App stores require a privacy policy, and so do data-privacy laws once you collect things like emails.
7. Later, with money: license lyrics from publishers or a licensed lyrics provider.

**Options for lyrics (Q130):**
- **A. Chords only** (lowest risk): sections, chords, cue notes. Link out to a licensed lyrics site.
- **B. User-typed lyrics with a takedown process** (like early tab sites): highest risk; publishers can still demand removal or pursue the site.
- **C. Licensed lyrics later:** launch with A, license lyrics once there are users and money.
- **D. Lyrics only for original songs:** users' own songs can have full lyrics; known songs can't.
- My recommendation: **A + D now, C later.** You get lyrics where it's safe (your own songs) and you can still ship.

Sources: en.wikipedia.org/wiki/Ultimate_Guitar · ultimate-guitar.com/article/blog/licensing · New York Times, "Now the Music Industry Wants Guitarists to Stop Sharing" (Aug 21, 2006)

## 11. Glossary

- **BPM:** beats per minute, the song's speed.
- **Key:** the "home" note and scale of a song (e.g. G major).
- **Time signature:** beats per bar; 4/4 means four beats per bar.
- **Bar (measure):** a group of beats. Charts count chords in bars.
- **Section:** a part of a song: intro, verse, pre-chorus, chorus, bridge, solo, outro.
- **Capo:** a clamp on the neck that raises the pitch of every string, so easy shapes sound in a higher key. G shapes at capo 2 sound in A.
- **Transpose:** move every chord up or down by the same amount to change the key.
- **Voicing / shape:** one specific way to finger a chord. C has many.
- **Barre chord:** one finger presses several strings at the same fret.
- **Slash chord:** a chord with a different lowest note, written C/G (C chord, G lowest).
- **Chord diagram:** a picture of the fretboard showing where the fingers go.
- **Tab (tablature):** six lines (the strings) with fret numbers; used for riffs and solos.
- **Nashville numbers:** chords written as numbers (1, 4, 5) so they work in any key.
- **Rhythm vs lead:** rhythm = chords and strumming; lead = riffs, melodies and solos.
- **Step sequencer:** a grid of on/off steps; the easiest way to make drum beats.
- **Piano roll:** notes drawn on a pitch × time grid; used for bass and keys.
- **Timeline:** the full-song view where clips and recordings are arranged.
- **Loop:** a short repeating pattern, e.g. two bars of drums.
- **Sample:** a recorded sound, e.g. one drum hit.
- **Stem:** one instrument exported on its own (drums only, bass only).
- **Latency:** the delay between playing (or pressing play) and hearing it.
- **PWA:** a website you can install like an app; it can work offline.
- **CC0:** a "no rights reserved" license; free to use for anything.
- **Copy (fork):** copying someone's version to edit it, with credit to the original.
- **Reputation / profile rating:** points earned when others rate your contributions.
- **Guest account:** an account created silently, without sign-up, that can later be upgraded to a real one.

## 12. Decision log

### 2026-11-03

- Free app for guitarists; other instruments later.
- No ads, ever. Money later, from paid features for the complex/pro parts.
- Platforms: web, iOS, Android, desktop.
- Users: beginner to professional. First users: you and your cousin.
- Auto-tagging dropped. Song info is entered by users.
- Adding songs: search first; if missing, add via a form; public or private; public songs can be rated, and ratings raise the contributor's profile rating.
- Song statuses: Planning to learn / Learning / Performing, shown as three sections on the profile.
- Multiple playlists, shareable, and playlists made with friends.
- Chord input: chord picker, or tap the fretboard and choose fingers; auto-named when the shape matches a known chord.
- Versions: many per song, split into sections; view and copy others' versions; votes decide accuracy.
- Tuning and capo belong to each version.
- Track maker order: loops and drum beats → bass → … → full multi-track recording. Record your own playing or build from loops: both.
- Tracks link to songs, public or private. Simple editor first, complex later. Export later.
- Practice: metronome, tuner, loop a section, play-along at the song's BPM.
- Jam mode concept (automatic setlist with roles for a group of friends); premium candidate.
- Sign-in required, built after the core features.
- Guitar only until the guitar side is complete.
- Solo builder; Claude writes most of the code. No timelines. Budget: $0.

### 2026-11-04

- Name: **Gitara** (working). Tagline: all-in-one jamming utility app. Goal: real users before June 2027 graduation, no timeline.
- Cousin = tester only. Vibe: clean, minimal, frosted glassmorphism, dark first, premium smooth motion. Colors TBD.
- Phone first, with a desktop layout for each major feature; tested on iPhone, laptop and PC. Windows + Node.
- Guest accounts approved. Sign-in: email + Google. 13+. @handles. Private-by-default profiles with chosen public parts. Follow + jam buddies. Block: yes. Deleted users keep content as "deleted user". English only.
- Genre included (fixed list + tags). Difficulty is system-generated.
- Duplicate rule: exactly identical = denied; any difference = allowed, votes decide.
- MusicBrainz autocomplete: yes. YouTube embed + Spotify link: yes.
- Publishing a version lets the public copy it, with credit. Version edit history: yes.
- Song statuses move freely in any direction.
- Strumming patterns playable by ear. Tabs later. Left-handed mode yes.
- Loops as flexible as possible; rhythm guitar after bass.
- Jams have no min/max length. Native-app offline jams noted as a future design point.
- Reputation perks: good rating for a month → small boost incl. temporary Pro features.
- You moderate first. Claude never touches git/GitHub; you commit and push.
- Tech stack accepted. Everything marked "suggested" in questions.md accepted.
- Design standards added (§5.16): research first, use the three reference repos, ask when unclear, never "AI slop". Glass moves to the floating layer; tracked caps shrink to titles; the first preview is a mood sketch.
- Look decided: "Ember on Teal" (your reference images, turned down; heat = progress; glow follows the beat; grain; wide-tracked caps). See §5.15.
- Phase 0 built in C:\Users\Admin\VS-IDE\Gitara. Supabase project `gitara` created (Singapore, free plan, ref uossxmxjedzdzelvypkw); schema + security rules applied (migrations 0001, 0002); security advisor clean. Anonymous sign-ins still need switching on in the dashboard.
- Still undecided: chart format (Q36), lyrics (Q37, Q130), display options (Q41), down-votes (Q47).

## 13. Parking lot (ideas, not decided)

- **Design to-do:** fine-tune the palette on real devices (glow strength, accent, grain amount) and confirm the font. Kept on the list as you asked.
- "Songs I can play": find songs that use only chords you already know.
- Auto backing track from a chord chart.
- Sync a chart with the original YouTube video.
- Chord-change trainer, speed trainer, practice log.
- The app listens and checks your chords.
- Hands-free: auto-scroll, screen stays awake, foot pedal.
- Left-handed mode.
- Gig setlist mode (order, notes, total time).
- Teacher accounts; creator marketplace.
- Seed the catalog with popular songs (chords only) before launch.
- Public song pages findable on Google; nice link previews on Messenger/Facebook.

## 14. Risks to watch

- **Scope:** this is four apps in one (library, chord site, music maker, social network). Finish one phase before starting the next.
- **June goal vs. scope:** see §7. Protect the launch slice.
- **Lyrics:** unresolved, see §10.
- **No Android device:** many people use Android, and browser audio behaves differently there. We'll test with browser emulation and ask someone with an Android phone (Q133). Your iPhone 17 Pro Max is also a very fast phone, so slower phones need checking too.
- **Glass effects and animation:** can lag on older phones; see §5.15.
- **Copyright:** see §10.
- **Audio delay:** Bluetooth adds lag; recording needs wired headphones or a calibration step.
- **Free limits:** audio storage and downloads run out first.
- **Empty app:** community apps feel dead without content. Seed songs and invite a first group.
- **Lost guest accounts:** add real sign-in before inviting other people.
- **Free plan pausing:** the free database pauses after a week unused; restore it from the dashboard.

## 15. How we work

- This file is the source of truth. Claude updates it whenever a feature is added, changed or dropped.
- Open questions live in `questions.md`. Once answered, the decision moves here (feature section + Decision log).
- Design work always follows §5.16.
- No deadlines. Each session picks from Next up.
- Claude writes most of the code. You review everything, test on real devices, make the calls, and handle all git commits and pushes yourself. Claude never touches git or GitHub.

### Next up

1. Talk through the open items: chart format (Q36), lyrics (Q37 / Q130), display options (Q41), down-votes (Q47).
2. Choose where the project folder lives on your PC (Q136).
3. Start Phase 0: project setup, data model, guest accounts.
