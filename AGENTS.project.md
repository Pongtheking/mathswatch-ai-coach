# MathsWatch AI Coach — project instructions

Authoritative product context. Same priority as `AGENTS.md` for this app.

The attached `mathswatch-app-skill.md` was not present in the workspace at
resume; this file reconstructs the original product spec plus the resume
constraints. Do not replace it with a generic app.

## Product

An iPad-first GCSE Maths intelligence layer that works **alongside** MathsWatch.
The student still does school assignments on MathsWatch. This app captures
questions, analyses attempts, tracks mastery, plans revision, and marks papers.

Closed loop: capture → understand → attempt → analyse → fix → track → adapt →
practise → test → improve.

Target: help the student reach Grade 9. **Never** present an official GCSE grade
prediction. Any number is an internal learning estimate and must be labelled as
such.

## Hard constraints

- Do **not** bypass MathsWatch authentication or store MathsWatch passwords.
- When a live MathsWatch integration is not legitimate, use the manual /
  screenshot / PDF workflow and leave a clean provider interface for later.
- Seeded curriculum ≠ student performance. Never invent attempt history.
- Mathematical correctness over sounding confident. If uncertain, ask.
- Do **not** touch or build on `src/lib/multiplayer/` — unused scaffolding.
- Do **not** refactor `src/lib/server/fns.ts` or `src/lib/curriculum/questions.ts`
  unless explicitly asked. Flag issues; don't "clean them up".
- Do **not** change the preview auth-secret fallback in `src/lib/auth/` — it is
  intentional, not a bug.
- Keep `traceDeps: ["@electric-sql/pglite*"]` on the nitro plugin in
  `vite.config.ts`. Removing it causes a real ENOENT crash on Vercel.

## Stack (already chosen)

TanStack Start (Vite) · Postgres / PGLite · Better Auth (email + Grok providers)
· Gemini Flash for vision/LLM · KaTeX · iPad-first dark academic UI.

Auth and the database are **on**. Every per-user server function uses
`authMiddleware` and scopes by `context.userId`.

## Core surfaces

| Route | Job |
| --- | --- |
| `/` | Dashboard: estimate, today's priority, weaknesses, streak |
| `/capture` | Screenshot / paste / type a question. Do not reveal the answer yet |
| `/q/$id` | Attempt, working analysis, tutor modes |
| `/practice` | Adaptive practice from mastery + question bank |
| `/plan` | Today / week / next-week revision |
| `/progress` | Mastery by topic |
| `/tests` | Diagnostics + exam simulator |
| `/marker` | AI paper marker (completed script + official mark scheme) |
| `/marker/$id` | Per-question mark report |
| `/grade-9` | Gap analysis vs Grade 9 (internal estimate only) |
| `/mistakes` | Mistake patterns |
| `/settings` | Profile, exam board, weekly minutes |
| `/login` | Sign in / sign up |

Phone bottom nav: Home, Practice, Capture, **Marker**, Tests, More.

## AI paper marker

Two uploads: the student's **completed paper** and the **official mark scheme**
(PDFs or photos). Optional combined drop that auto-classifies.

Pipeline (server, user-initiated only):

1. Parse the mark scheme (M1/A1/B1, ft, oe, cao, dep, SC, alternatives).
2. Parse paper structure if the scheme does not yield questions.
3. Mark the script strictly against the scheme. Follow-through. Never invent
   extra marks. Flag unreadable working as needs-review.

Persist results on `papers` / `paper_questions` / `paper_mark_points` /
`paper_question_marks`. Feed mistakes into mastery. If `GEMINI_API_KEY` is missing,
show a clean "AI is not available" state — never crash, never fake marks.

Require a rights/copyright confirmation before marking.

## Curriculum and engines

Seed real GCSE skill structures (Number, Algebra, Ratio, Geometry, Probability,
Statistics, Graphs) with prerequisites, difficulty, exam frequency. Question
bank is seeded separately from student attempts.

Mastery is computed from evidence (recent accuracy, difficulty, retention,
mistake frequency). Priority = weakness × GCSE importance × target relevance ×
mistake frequency × prerequisite blocking. Spaced review lives on mastery rows.

## UI

iPad-first, large tap targets (≥44px), bottom nav on phone, sidebar from `md`.
Academic dark ink/teal palette, Newsreader + Figtree. No gamification chrome,
no fake social features, no official-grade theatre.

## Quality bar

Working end-to-end product over extra features. `npm run build` and
`npm run typecheck` must pass. Smoke desktop and mobile. Protected routes must
gate signed-out visitors to `/login`.
