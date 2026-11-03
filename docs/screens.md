# Gitara: screen inventory

Every screen, what it must have, what it must not have, and where things sit. **Content, behaviour and placement, not looks** (looks follow §5.15–5.16 of `aboutproject.md`).
Phase numbers are from `aboutproject.md` §7. `[OPEN]` items link to `questions.md` or to the open questions at the end of this file.

How each screen is written:
- **For:** the one job of the screen.
- **Has:** everything on it.
- **Not:** things that must stay off it.
- **States:** empty, loading, offline, error, where they differ from the default.
- **From / to:** how you get there and where it leads.

---

## Rules for every screen

- No ads, ever. No upsell pop-ups that interrupt practice or playing. A Pro feature can show a quiet "Pro" mark where it lives, and nothing more.
- Tuning, capo and key are shown wherever they change what you play.
- Chord name, diagram and sound always refer to the same selection.
- Works offline for everything that's yours. Anything that needs the internet says so plainly and keeps what's already loaded.
- Every destructive action can be undone, or asks first if it can't be undone.
- Public or private is always visible on anything you made.
- Report is available on everything other people made (Phase 6).
- Desktop gets its own layout for every major screen, not a stretched phone.

---

## Navigation model (Spotify-style) `[PROPOSED 2026-11-04]`

Modelled on how Spotify and Apple Music are organised, because people already know it: a few always-visible tabs, a mini player docked above them, a "Your Library" that collects everything you saved, and the same song row with the same action menu everywhere.

### Tabs (phone, bottom; desktop, left sidebar)

| Tab | Holds | Spotify equivalent |
| --- | --- | --- |
| **Home** | your way back into playing; shelves picked for you | Home |
| **Search** | browse everything in Gitara, and search | Search (browse tiles + search) |
| **Library** | everything you saved or made: liked songs, playlists, artists, your versions and tracks | Your Library |
| **Practice** | tuner, metronome, play-along, practice queue; Jam later | (no equivalent; ours) |
| **Create (+)** | opens a sheet: new version, add a song, new playlist, new track | Create (+) |

- **Profile and Settings** move to your avatar at the top-left of Home, Search and Library (Spotify's placement). This changes the decided tabs (Home · Library · Practice · Create · Profile); see Q-S1.
- Tapping the tab you're on scrolls to top, then goes back to the tab's start.
- Each tab keeps its own back history (switching tabs doesn't lose your place).
- Create opens a sheet, not a screen, so it doesn't take you away from where you were. Drafts live in Library under "Made by you". (Some Spotify users dislike its Create tab because it sits where Library used to be; ours is a core pillar, so it stays, but at the far right so Library never moves.)

### The mini player (docked above the tabs)
Always the same place, appears once you've played something. Tap = full player (Play-along). Swipe left/right = previous/next in the practice queue. Swipe down on the full player = back to the mini player.

### Desktop (three panes, like Spotify desktop)
- **Left:** tabs at the top, then your Library list (collapsible to icons).
- **Centre:** the current screen.
- **Right (optional panel):** Now playing: the chord chart following the music, the queue, chord diagrams. Can be closed.
- **Bottom:** the full-width player bar (play, tempo, loop, count-in, click/track mix).
- Keyboard: space = play/pause, ← → = previous/next section, ↑ ↓ = tempo, L = loop, / = search.

### One song row, everywhere
Every list of songs (Home, Search, Library, playlists, artist pages, jam) uses the same row so people learn it once.
- **Shows:** title, artist, the version's key and capo (when a version is pinned), difficulty, your status mark (Planning / Learning / Performing), and a "liked" mark.
- **Tap:** opens the song (or plays it inside a playlist, like Spotify).
- **Heart:** like / unlike.
- **"…" menu (also long-press):** Like · Add to playlist · Set status (Planning / Learning / Performing) · Parts I can play · Add to practice queue · Play along now · Pick version · Go to artist · Share · Report (others' content) · Remove from this playlist (in your playlists).
- **Swipe right:** add to practice queue. **Swipe left:** like / unlike. (Spotify's swipe-to-queue.)
- Multi-select in Library and your playlists: long-press, then tap more rows.

### Liking vs status (the Spotify "save" plus our learning status)
- **Like (heart)** = save it to your Library. Fast, one tap, no decision needed.
- **Status** = how well you know it: none → Planning → Learning → Performing. Setting a status also likes it.
- Library's Songs view shows everything liked; the status chips filter it. See Q-S10.

### Practice queue (Spotify's "Up next", for playing)
A list of songs (each with its version) to play through in Play-along. Fill it from any "…" menu, by swiping, or "Play" on a playlist. Reorder, remove, clear. Shown in the full player and the desktop right panel.

### Where common things sit (placement rules)
- **Primary action of a page** (Play along, Play playlist): one large button at the right of the page header, in thumb reach; on phone it stays pinned under the header while scrolling.
- **Like, add, "…"**: next to the primary action, left to right in that order.
- **Filters and sort**: a row of chips under the header; sort and list/grid toggle at the right end of that row.
- **Search inside a page** (Library, a playlist): pulled down from the top or the search icon in the header.
- **Destructive actions**: only inside the "…" menu, never as a visible button.
- **Back**: top-left; edge-swipe back on phone.
- **Avatar** (profile, settings): top-left on the three main tabs; "+" (add) top-right in Library.

---

## A. App frame (always present)

### A1. Tabs
- **For:** moving between the five main areas.
- **Has:** Home · Search · Library · Practice · Create (+). The current tab is marked. See the navigation model above.
- **Not:** a Profile tab (it's the avatar), a "Pro" tab, marketing badges, more than five.
- **Placement:** bottom on phone; top of the left sidebar on desktop.

### A2. Mini player
- **For:** keeping the song you're practising one tap away while you browse.
- **Has:** song title, version (if not your default), chord now or "Paused", tempo, play/pause, a thin progress line. Tap = full player (F3); swipe sideways = previous/next in the queue.
- **Not:** volume, mixer, ads. Hidden until something has been played.
- **Placement:** docked directly above the tabs on phone; becomes the full-width player bar at the bottom on desktop.

### A3. Search tab (browse + search)
- **For:** finding anything in Gitara, or just browsing.
- **Before typing (browse):**
  - Recent searches.
  - Browse tiles: genres; "Beginner friendly"; by tuning (Drop D, Half-step down, Open G…); "Capo songs"; "Three-chord songs"; "Fingerstyle"; decades; language.
  - Charts (Phase 6): most-liked this week, most-practised, new versions, top-rated versions.
- **While typing:** results grouped like Spotify: Top result, Songs, Artists, Playlists, Versions, Tracks (Phase 4+), People (Phase 6). Chips at the top filter to one type.
- **Filters on song results:** difficulty, tuning, capo, key, genre, "songs I can play".
- **Not found:** MusicBrainz name suggestions marked "not in Gitara yet" → Add song with title and artist pre-filled.
- **Not:** sponsored results, auto-tagging, results from sites we don't license.
- **States:** offline = your library only, with a note.
- **Placement:** search field pinned at the top; browse tiles in a two-column grid below; desktop has the field in the top bar on every screen.

### A3b. Browse category (from a tile)
- **Has:** the category name, songs in it (sortable: most liked, newest, easiest first), playlists in it, artists in it.

### A3c. Artist page
- **For:** everything by one artist that's in Gitara.
- **Has:** artist name and photo (only from an allowed source, else none), short info; "Popular on Gitara" (most-liked songs); all songs (sort: popular, A–Z, easiest first, newest); "Easiest songs to start with"; playlists that feature the artist; follow artist (Phase 6: tells you about new songs and versions); share.
- **Not:** recordings, ads, lyrics.
- **Placement:** header with name; follow and "…" under it; song list below.

### A4. Shared overlays
- **Toast with undo:** after delete, remove from playlist, status change, etc.
- **Offline notice:** small and persistent while offline; says what still works.
- **Confirm sheet:** only for things that can't be undone (delete account, delete a published version).
- **Share sheet:** copy link, system share, QR code (playlists, versions, profile, jam).
- **Report sheet** (Phase 6): reason (wrong info, duplicate, spam, offensive, copyright), optional note, send.
- **Update available:** "A new version of Gitara is ready, reload" (PWA).
- **Install prompt:** offered once, after the person has used the app a bit, never on first open.

---

## B. First run

### B1. Welcome
- **For:** saying what Gitara is in one line and getting started.
- **Has:** the wordmark, one sentence, "Get started", "I already have an account" (Phase 5).
- **Not:** a carousel of feature slides, a sign-up wall, a paywall, a cookie banner wall (consent goes where the law needs it, in Settings and the legal pages).

### B2. Quick setup (skippable, every step)
- **For:** personalising the first five minutes (§3).
- **Has:** level (beginner / intermediate / advanced), instrument (guitar now, others shown as "later"), handedness, favourite genres, "pick a few songs you want to play" (search + suggestions) which go straight into Planning to learn. Skip on every step.
- **Not:** account creation, notifications permission, microphone permission (asked only when the tuner or recording is first used), age questions beyond the 13+ check (Phase 5).
- **To:** Home.

---

## C. Home

### C1. Home
- **For:** getting back to playing in one tap, then finding something new.
- **Has, top to bottom (Spotify's order: quick access, then shelves):**
  - Header: avatar (profile/settings) left, greeting, notifications (later) right.
  - Quick access grid: your 6–8 most recent songs, playlists and versions, one tap each.
  - Continue: the last song you practised, where you stopped (section, tempo), "Resume".
  - Learning now: your Learning songs, Play along on each.
  - Planning to learn: a few, "Start learning".
  - Quick tools: tuner, metronome.
  - Picked for you: "Songs you can play" (only chords you know), easy songs in your genres, more by artists you like.
  - Phase 6: new versions of songs you liked, popular this week, from people you follow.
  - Phase 7: "Start a jam" / jams you're invited to.
- **Not:** a feed of strangers' posts, streaks or guilt messages, upsells, endless scrolling (shelves end).
- **States:** brand new = "Like a few songs to get started" + popular public songs + search.

## D. Songs and versions

### D1. Add song
- **For:** putting a song into Gitara when search didn't find it.
- **Has:** title and artist (required, with MusicBrainz autocomplete); optional album, year, genre (fixed list + free tags), original key, original BPM (with tap tempo), time signature, length, language, link to the original (YouTube / Spotify); "this is my original song" switch; Public / Private; live duplicate warning ("this song may already exist") that offers "add a version to it instead".
- **Not:** more required fields, difficulty input (system-generated), lyrics (`[OPEN]` Q37/Q130), audio uploads.
- **To:** the new song page, with "Add the first version" ready.

### D2. Song page (like a Spotify album page; versions are the "tracks")
- **For:** everything about one song, and choosing which version to play.
- **Header:** title, artist (tap → artist page), year, genre, original key and BPM, time signature, length.
- **Action row (left to right):** heart, status, add to playlist, "…" (share, suggest an edit, report, go to artist), and the big **Play along** button on the right (plays your default version, or the best-voted one).
- **Listen to the original:** embedded YouTube or Spotify link.
- **Versions list (the main content):** sorted best-voted first, "best version" badge; yours on top; each row shows tuning, capo, key, difficulty, author, votes, tags (cover / live / acoustic); filters for tuning, capo and difficulty that really filter the list (Ultimate Guitar's filters don't, which users find confusing); "+ Add your version".
- **Backing tracks** for this song (yours and public).
- **In your playlists:** which of your playlists have it.
- **More like this:** same artist, similar chords, similar difficulty.
- **Not:** lyrics until decided, the full chord chart (that's D3), a comments thread (Q-S7).
- **States:** no versions = "Be the first to add chords"; offline = your versions only.

### D3. Version view (chord chart)
- **For:** reading and playing one version of a song.
- **Has:**
  - Header: song, artist, version author ("based on …" credit if copied), tuning, capo, key played in, BPM, time signature, difficulty with its reasons ("4 chords, 1 barre, slow changes"), tags and techniques.
  - Chords used: a strip of diagrams for every chord in the version; tap = hear it and see other shapes.
  - Sections in arrangement order (intro, verse, chorus…), each with its bars/beats and chords, repeat count, strumming pattern (tap to hear), cue notes.
  - View tools (never change the version): transpose, capo shift, sharps/flats, chord-name style, left-handed diagrams, text size.
  - Practice: Play along (F3), loop a section, metronome at this BPM, count-in.
  - Your library: status, parts you can play, "make this my default version".
  - Community (Phase 6): upvote, copy to my versions, report.
  - Owner only: edit, history (undo/restore), visibility, delete.
- **Not:** editing on this screen (avoids accidental changes on a music stand), lyrics until decided, anything that moves while you're reading except the playing highlight.
- **Placement:** header compact (meta in one line); chord-diagram strip under it, scrolls sideways; sections down the page; a bottom bar with Play along, loop, transpose/capo, tempo (thumb reach); heart, status and "…" in the top bar. Desktop: chart in the centre, diagrams and version list in the right panel.
- **Open:** grid of bars vs simple chord list (Q36); display options (Q41).

### D4. Version editor
- **For:** writing or changing chords for a version.
- **Has:**
  - Version info: tuning (presets + custom), capo, key (with key suggestion from the chords), BPM (tap tempo), time signature, tags (cover/live/acoustic), techniques, strumming/picking style.
  - Sections: add, rename kind, reorder, duplicate, delete, bars count, repeat count, strumming pattern, cue note.
  - Arrangement: the order sections are played in, with repeats (a section can appear many times without copying it).
  - Bars: put chords on beats; split a bar between chords; copy/paste bars.
  - Chord entry: from the chord picker (D5) or the fretboard builder (D6).
  - Preview: hear it at tempo before saving.
  - Saving: autosave as draft, undo/redo, edit history.
  - Publish: Private / Public; exact-duplicate check (denied with a link to the existing version); "copies keep credit" notice.
- **Not:** lyrics until decided, a difficulty field, any publishing without the duplicate check.
- **States:** leaving with unsaved changes never loses work (drafts are kept).

### D5. Chord picker (sheet)
- **For:** choosing a chord fast.
- **Has:** root + quality selector (major, minor, 7, maj7, m7, sus2, sus4, add9, dim, aug, slash bass…), recently used, chords already in this version, your saved custom shapes; each choice shows its diagram and plays its sound; "other shapes" for the same name; "build on fretboard" to go to D6.
- **Not:** a giant flat list of every chord with no grouping.

### D6. Fretboard chord builder
- **For:** making a chord by placing fingers.
- **Has:** a fretboard in the version's tuning and capo; tap fret per string; tap above the nut for open/muted; drag across strings for a barre; finger number per dot; start fret for higher shapes; live name from the notes (C, Cadd9, C/G…) or "name it yourself" with the notes shown; hear it; save as custom shape (private by default); left-handed mode.
- **Not:** names guessed from fingers instead of notes.

### D7. Chord detail
- **For:** everything about one chord name.
- **Has:** all known shapes (built-in, yours, public), the notes, how hard each shape is, hear each, "use this shape in the version".

### D8. Version history
- **For:** going back.
- **Has:** list of saved versions with time, restore, compare the chords changed.

---

## E. Library and playlists

### E1. Library (like Spotify's Your Library)
- **For:** everything you saved or made, in one list.
- **Header:** avatar left, "Library" title, search and "+" (new playlist / add song / new version) right.
- **Filter chips (dynamic, like Spotify: picking one shows the chips that make sense inside it):**
  - **Songs** → then Planning · Learning · Performing · Can play · Liked only
  - **Playlists** → then By you · Shared with you · Saved
  - **Artists** (followed, or with songs you liked)
  - **Made by you** → then Versions · Tracks · Songs · Drafts
- **Sort (right end of the chip row):** Recent · Recently added · A–Z · Artist · Difficulty · Status. **List / grid** toggle next to it.
- **Pinned:** up to 4 items stay on top (swipe or "…" → Pin).
- **Built-in collections at the top (auto-filled, like Spotify's Liked Songs):** Liked songs · Songs I can play · Learning now.
- **Rows:** the standard song row, playlist rows (name, owner, count), artist rows.
- **Search inside Library:** filters the list as you type.
- **Multi-select:** set status, add to playlist, remove.
- **Not:** public content you haven't saved; social counts.
- **States:** empty = "Like songs or make a playlist and they'll show up here".
- **Desktop:** this list is the left sidebar on every screen.

### E2. Liked songs / Songs I can play / Learning now (auto collections)
- **Has:** the songs, Play along all (fills the practice queue), sort, filter by status and difficulty; can't be renamed or shared as-is, but "Save as playlist" makes a normal playlist from it.

### E3. Playlist (like a Spotify playlist page)
- **For:** an ordered set of songs, e.g. a gig setlist or "campfire songs".
- **Header:** name, description, owner and editors, privacy, song count, total length.
- **Action row:** save (others' playlists), add editors (Phase 6), share, "…" (edit details, duplicate, delete), big **Play** (play-along through the list) on the right.
- **Items:** standard song rows, each with its pinned version (or "your default"), key, capo, BPM; drag to reorder (yours); search inside; sort.
- **"Add songs"** at the bottom: search inline plus suggestions that fit the playlist (same keys, similar difficulty, same genre).
- **Setlist mode (later):** keys and capos at a glance, next song, total time.
- **Not:** songs the viewer can't see (shown as "private song" to others).

### E4. New / edit playlist (sheet)
- **Has:** name, description, privacy (private / unlisted / public), invite editors (Phase 6), delete.

## F. Practice

### F1. Practice tab
- **For:** the tools, and going back to what you were practising.
- **Has:** resume last practice; practice queue (up next, reorder, clear); tuner; metronome; speed trainer; loop a section (picks a song); practice log (later, `[PREMIUM?]` stats); Phase 7: Jam (start / join).
- **Placement:** resume and queue on top (most used), tools as large tiles below, Jam at the top once it exists.
- **Not:** content feeds.

### F2. Tuner
- **Has:** detected note and how far off (cents), which string, in tune confirmation that doesn't rely on colour; tuning presets (standard, drop D, half-step down, open G, DADGAD…) and custom; reference tones per string; A4 calibration (440 Hz default); chromatic mode; capo-aware note naming.
- **Placement:** string buttons laid out like the tuning pegs on a headstock (3 + 3 or 6 in a row, matching the instrument), not six identical buttons in a row; beginners mix up the two E strings otherwise (Pratt IXD critique of Ultimate Guitar's tuner).
- **Not:** ads, recording.
- **States:** microphone permission not asked yet / denied (how to allow it) / no sound detected.

### F3. Play-along (full player; opened from the mini player)
- **For:** playing a version from start to finish with help. Same screen as Spotify's Now Playing, but the chart is the content.
- **Placement:** chart fills the screen; controls in a bar at the bottom (thumb reach); queue and options in a sheet that slides up; on desktop, also available as the right panel.
- **Has:** current chord big, next chord, current section, beat count; the chart with the playing highlight; play/pause, restart, jump to section; tempo (slower/faster without changing pitch of the click), speed trainer (start at X%, add Y% each loop); loop a section or range; count-in; sound: click, backing track (pick from linked tracks), strum preview; mix (click vs track); keep screen awake; auto-scroll; foot-pedal page turning; transpose/capo view tools.
- **Not:** editing chords, community actions, anything that pauses playback unexpectedly.
- **States:** no BPM in the version = asks for one (tap tempo); no backing track = click only.

### F4. Metronome
- **Has:** BPM (number, slider, tap tempo), time signature, accent first beat, subdivisions, sound choice, count-in, volume; speed trainer; "use this song's BPM".
- **Not:** visual animation per beat beyond a simple beat indicator.

---

## G. Create

### G1. Create sheet (from the + tab)
- **For:** starting something new without leaving where you are.
- **Has:** New chord version (pick a song, defaults to the song you're on) · Add a song · New playlist · New backing track (Phase 4) · Continue a draft (recent drafts listed).
- **Not:** a full screen; anything else.

### G2. Track maker (Phase 4: step sequencer)
- **For:** making a backing track to play along with.
- **Has:** tempo, key, time signature, length, swing; track lanes (drums first); step grid per sound; pattern per section of the linked song; loop library (G3) to drop in loops; play / stop / loop; link to a song or version; name, visibility; undo/redo, autosave.
- **Later (Phase 8):** bass, piano roll, timeline arranging, recording your playing, mixer, effects.
- **Not:** hosted copies of original recordings.
- **Desktop:** gets the fuller editing layout (Q146).

### G3. Loop library (sheet or panel)
- **Has:** browse by instrument, style, tempo, key, length; preview; drop into the track; every loop editable after dropping; your saved loops.

---

## H. Profile and people

### H1. Your profile (from your avatar)
- **For:** you, and what you choose to show others.
- **Reached from:** the avatar at the top-left of Home, Search and Library; the avatar menu also has Settings and (Phase 5) Sign in.
- **Has:** display name, @handle, photo (optional), instruments, rating; Planning / Learning / Performing sections; your public songs, versions, tracks, playlists; a visibility switch on each section (everything private by default); edit profile; settings entry; share profile.
- **Phase 6+:** following / followers, jam buddies.

### H2. Someone else's profile
- **Has:** only what they made public; their public versions, tracks, playlists; rating; follow, add as jam buddy, block, report.
- **Not:** anything they kept private, a "this is private" list of what's hidden.

### H3. Edit profile
- **Has:** display name, @handle (unique, rules shown), photo, bio (short), instruments, per-section visibility.

---

## I. Settings and account

### I1. Settings
- **Has:**
  - Account: guest status ("your songs are only on this device until you sign in"), sign in / upgrade (Phase 5), email, sign out, delete account (public content stays as "deleted user").
  - Display: sharps or flats, chord-name style, left-handed, text size, high contrast, reduce motion (follows the system), reduce transparency (follows the system).
  - Audio: click sound, volume, audio latency check (if needed for play-along accuracy).
  - Privacy: default visibility for new songs/versions/tracks, profile sections, blocked users.
  - Offline and storage: what's saved on this device, clear cache.
  - Your data: export everything you made.
  - About: version, credits and licences, terms, privacy policy, copyright/takedown, contact.
- **Not:** settings that belong on the screen they affect (tempo, tuning).

### I2. Sign in / Sign up (Phase 5)
- **Has:** email, Google (Apple when the iPhone app comes); 13+ age confirmation; "continue as guest"; upgrading a guest keeps everything.
- **Not:** forcing sign-in before the person has seen the app.

### I3. Forgot password, verify email (Phase 5)

---

## J. Jam (Phase 7)

### J1. Start or join
- **Has:** start a jam; join by QR code or link; recent jams.

### J2. Jam lobby
- **Has:** who's in, each person's parts (rhythm / lead / solo / sings), "include Learning songs" switch, target length (optional), invite (QR/link); host controls; start.

### J3. Jam setlist (live)
- **Has:** the shared setlist built from everyone's libraries; for each song who plays together, who plays alone, who plays chords vs lead; the agreed key with each person's capo and shapes; now playing, up next; swap, skip, request; host can reorder.
- **States:** connection lost = keeps the loaded setlist, shows reconnecting.

### J4. Song in a jam
- **Has:** the version view for you in the agreed key and your capo, your role this song, who else is playing what.

### J5. Jam ended
- **Has:** save as playlist, see what was played.

---

## K. Community and moderation (Phase 6)

### K1. Suggest an edit (song info)
- **Has:** the fields with your changes, a reason, send; status of your suggestion.

### K2. Review queue (admin and trusted users)
- **Has:** reports, suggested edits, possible duplicates; each with context, approve / reject / merge / remove, note to the reporter.

### K3. Merge duplicates
- **Has:** the two songs side by side, which info to keep, versions moved to the kept song.

### K4. Copyright takedown form (public web page, needed before launch)
- **Has:** what's infringing (link), who you are, the rights you hold, contact, declaration; confirmation.

---

## L. Legal and system pages

- **Terms of service**, **Privacy policy** (Philippine Data Privacy Act), **Copyright and takedown policy**, **Credits and licences** (fonts, sounds, MusicBrainz).
- **Not found** (bad link): what happened and a way back.
- **Something went wrong:** what happened in plain words, retry, and your work isn't lost.
- **Shared link landing** (playlist, version, profile opened by someone without the app): the content they're allowed to see, "Open in Gitara" / "Get started".

---

## Open questions from this inventory

- **Q-S1.** Tabs change from Home · Library · Practice · Create · Profile to **Home · Search · Library · Practice · Create (+)**, with Profile on the avatar (Spotify's placement). OK?
- **Q-S2.** ~~Where does Search live?~~ Proposed: its own tab with browse tiles (above).
- **Q-S3.** Where does **Jam** live (Phase 7)? Proposed: top of the Practice tab plus a card on Home; its own tab later only if it becomes the main paid feature.
- **Q-S4.** Is **Play-along** the same screen as the full player opened from the mini player? Suggestion: yes, one screen.
- **Q-S5.** Should Home show **community content** at all before Phase 6, or only your own things?
- **Q-S6.** **Practice log**: free basic history, Pro detailed stats? (§6 lists practice stats as a Pro candidate.)
- **Q-S7.** **Comments** on songs or versions: not in the bible. Leave out (less to moderate) or add later?
- **Q-S8.** **Notifications** (someone copied your version, a playlist you edit changed, a jam invite): needed, and when?
- **Q-S10.** **Like vs status:** liking saves a song to your Library with no status; setting a status also likes it. Or should liking always mean "Planning to learn"?
- **Q-S11.** **Swipe actions** on song rows (right = add to practice queue, left = like): keep, or menu only?
- **Q-S12.** **Follow artists** (Phase 6): worth it for "new songs by this artist"?
- **Q-S9.** Should the Version view allow **quick edits** (like fixing one chord), or always go through the editor? Suggestion: always the editor, to avoid accidental changes.

Note: the design preview made on 2026-11-04 used different tabs (Songs, Playlists, Jam, Tuner). It will be changed to these tabs once Q-S1 is answered.

Sources for the navigation model (checked 2026-11-04): MacStories, "Spotify brings back the tab bar on iOS" (macstories.net); MacRumors, "Spotify announces updated Your Library with grid views, dynamic filters" (macrumors.com, 2021); Spotify Community, "Get rid of Create button on mobile navigation bar" (community.spotify.com); Pratt IXD, "Design critique: Ultimate Guitar iOS app" (ixd.prattsi.org, 2024).
