# Questions to Answer

Answer anytime, in any order. Answered questions get moved into `aboutproject.md`.

- Write your answer after **A:**
- ⭐ = needed before we start coding (12 questions). The rest can wait until we reach that part.
- **Suggested** is what I'd pick. Write "ok" to accept it. If you skip a question, I'll use the suggestion and tell you.
- **When it matters** says which build phase needs the answer (phases are in `aboutproject.md` §7).
- **Status (2026-11-04):** answered questions were removed; their decisions live in `aboutproject.md` (see the Decision log). What's left: 4 to talk about (36, 37, 41, 47), 1 unread (111), 13 decide-later (117–129) and 6 new (130, 131, 133–136) and 11 design questions (137–147, only 137 is ⭐). Of the ⭐ questions, only **36, 37 and 130** are open.

---

## 5. Chord charts and versions
*When it matters: Phase 2 (voting in Phase 6)*

**36. ⭐ Chart format: chords placed in bars and beats, or a simple chord list per section?** Bars and beats are what make play-along possible.
Suggested: bars and beats underneath, with a simple view on top.
A: ⏳ Couldn't picture it; let's talk more (explained in chat).

**37. ⭐ Lyrics: none, short cue notes only, or licensed lyrics later?** (`aboutproject.md` §10)
Suggested: none for now; cue notes allowed; licensed lyrics later if there's money.
A: ⏳ Let's talk more. Conflicts with the no-lyrics stance (Q102). See aboutproject.md §10 and new Q130.

**41. Chord display:** sharps or flats, name style (Cmaj7 / CM7 / CΔ7), Nashville numbers (1–4–5)?
Suggested: sharps or flats picked from the key; Cmaj7 style; Nashville numbers as an option.
A: ⏳ Talk about it later.

**47. Voting style:** upvote only, up and down, or stars? Separate votes for "accurate" and "easy to play"? Can authors vote on their own?
Suggested: up/down for accuracy; difficulty voted separately; no self-votes.
A: ⏳ Unsure about the down-vote; the rest of the suggestion looks good. Difficulty is now system-generated, so no difficulty vote. My recommendation: upvote only + a report button. Confirm?

---

## 14. Business and money
*When it matters: Phase 10 (no rush)*

**111. Accept the draft free vs paid split?** (`aboutproject.md` §6) Anything there you'd never charge for?
A: Hasn't read it yet.

**117. Payments:** which providers can you use from your country (e.g. PayPal, PayMongo, Xendit, Paddle)? App stores also take a cut of in-app purchases.
Suggested: decide when Pro is ready.
A: Decide later.

---

## 15. Launch and growth
*When it matters: after Phase 6*

**118. Who are the first 10–50 users after you two?** (friends, classmates, a church band, a Facebook group…)
A: Decide later.

**119. Where do the guitarists you know hang out online?** (Facebook groups, TikTok, Reddit, Discord…)
A: Decide later.

**120. Post short videos of the app while building (TikTok, Reels)?**
Suggested: yes. It's free marketing.
A: Decide later.

**121. Feedback channel:** an in-app button, a group chat, Discord?
Suggested: an in-app button + one group chat.
A: Decide later.

**122. Invite-only beta first?**
Suggested: yes.
A: Decide later.

**123. Seed content:** add popular songs (chords only) before launch so the app isn't empty? Who adds them?
Suggested: yes. You two add 50–100 songs you actually play (see Q109).
A: Decide later.

---

## 16. Running it
*When it matters: once other people use it*

**124. Who answers support messages?**
Suggested: you, from one inbox.
A: Decide later.

**125. What if we outgrow the free plan?** (waitlist, donations, paying about $25 a month for hosting)
Suggested: decide when usage reaches about 70% of the free limits.
A: Decide later.

**126. Backups and a "what's new" note in the app?**
Suggested: a weekly database export while on the free plan; a short changelog in the app.
A: Decide later.

---

## 17. Other instruments
*When it matters: after guitar is complete*

**127. Which instrument comes right after guitar?**
Suggested: bass or ukulele, since they reuse the fretboard tools.
A: Decide later.

**128. Build the core for any stringed instrument from day one?**
Suggested: yes. Cheap now, expensive later.
A: Decide later.

**129. Non-fretted instruments later (piano, drums, vocals)?**
Suggested: much later; they need different editors.
A: Decide later.

---

## 18. New questions from your answers
*Added 2026-11-04*

**130. ⭐ Lyrics: which option?** You want lyrics and chords like Ultimate Guitar, but showing lyrics for known songs without a license is the biggest legal risk in the project (`aboutproject.md` §10). Options: **A** chords only; **B** user-typed lyrics with a takedown process; **C** licensed lyrics later; **D** full lyrics only for original songs.
Suggested: A + D now, C later.
A:

**131. Difficulty:** it's computed by the system. Should players also be able to say "felt harder / easier" to tune it? And which matters most to you: chord shapes, chord-change speed, or tempo?
Suggested: yes to feedback, shown separately; change speed and barre chords count most for beginners.
A:

**133. Android testing:** you only have an iPhone. Does your cousin (or a friend) have an Android phone you can borrow now and then?
A:

**134. Earned Pro perks:** what should the boost be and for how long? (e.g. one week of a Pro feature per month of good rating)
Suggested: decide when Pro exists.
A:

**135. Duplicate songs:** when the title and artist already exist, should the app send the person to add a *version* to the existing song instead of creating a second song? (Different album or year only is not a reason for a new song.)
Suggested: yes.
A:

**136. Where should the project folder live on your PC?** (a path like `C:\Users\you\gitara`). I can write the code there when your computer is linked; you then commit and push yourself.
A:

---

## 19. Design direction
*Added 2026-11-04. Needed before the design system is built; none of these block Phase 0 setup.*

**137. ⭐ Which apps have the best feel and motion, in any category?** Name 2–3 specific screens or interactions whose *feeling* you'd steal (a sheet that opens, a toggle, a scrubber…). This is the single best way to aim the motion.
A:

**138. Describe the feeling of opening Gitara in three words.** (e.g. calm studio, late-night jam, stage-lit.)
A:

**139. Glass only on the floating layer (tab bar, player bar, sheets, menus), solid tone steps for chord charts and lists?** Reason: Apple's own guidelines warn against glass in the content layer, and the chart must stay readable on a music stand.
Suggested: yes.
A:

**140. Wide-tracked capitals only for the wordmark and screen titles, sentence case everywhere else?** Your reference uses them for one big word; scattered tiny tracked labels are a top "AI tell".
Suggested: yes.
A:

**141. How should "heat = progress" (Planning → Learning → Performing) be drawn?** Not as colored left bars (a common tell). Options: (a) temperature-tinted section titles plus a small drawn mark; (b) a drawn glyph that "warms up" in three stages (like a string vibrating more); (c) a gentle whole-section tint. I can sketch all three.
Suggested: sketch all three, you pick.
A:

**142. Signature motion: "the light follows the music."** The ambient glow breathes with the song's BPM and moves to the playing chord; everything else stays quiet. Does that feel like the one thing you'd describe to a friend, or is there a different idea?
A:

**143. Motion personality:** precise and snappy (like Linear), fluid and springy (like Apple), or a mix?
Suggested: precise ease-out for everyday UI; springs only for dragging and sheets.
A:

**144. Haptics (taps you can feel on iPhone):** how much do they matter? A browser app on iPhone can do very little; a native wrapper (Capacitor) can do full haptics later.
Suggested: nice-to-have; add when we wrap it for the App Store.
A:

**145. UI sounds** (soft clicks, count-in ticks beyond the metronome)? In a music app they can clash with what you're playing.
Suggested: off by default; only the metronome and chord previews make sound.
A:

**146. Desktop layout for the track editor:** a DAW-like layout (tracks on the left, canvas in the middle, inspector on the right) or a simpler single-canvas layout?
Suggested: decide when we reach Phase 4; sketch both.
A:

**147. Wordmark:** should I explore a Gitara wordmark in the wide-tracked style (with a custom mark, not a letter in a box)? When?
Suggested: after the design system, before launch.
A:
