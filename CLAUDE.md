# Gitara: working notes for Claude

- **Never commit, push or touch git/GitHub.** The owner reviews everything and commits and pushes himself.
- Read `docs/aboutproject.md` first: it is the source of truth for features and decisions. Update it when something is added, changed or dropped. Open questions live in `docs/questions.md`.
- **Design standards are in `docs/aboutproject.md` §5.16 and are mandatory** for any UI, UX or motion work: research current references first, consult the owner's three reference repos (Emil Kowalski's skills, Taste Skill, Impeccable), avoid AI-slop tells, and **ask the owner when intent is unclear** (list all questions needed).
- Don't install packages from a Linux sandbox into this Windows folder (native binaries differ). The owner runs `npm install` on Windows.
- Guitar first. Free, no ads. Phone first, with a desktop layout for every major feature.
- Windows ignores letter case in file names: never have two files whose names differ only by case (e.g. `Art.tsx` and `art.ts`). It broke the app once.
