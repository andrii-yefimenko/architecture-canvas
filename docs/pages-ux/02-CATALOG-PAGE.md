# Catalog Page — Product & UX

The landing page for a multi-Challenge build: a browsable list of every Challenge in the Challenge Registry, from which the user picks one to work on the Task Page (`docs/pages-ux/01-TASK-PAGE.md`).

Ground truth: `PROJECT.md`, `MVP.md`, `CONTEXT.md`. This page did not exist for the single-Challenge MVP; it is the entry point once a second Challenge is added.

## Purpose

Before this page existed, the single MVP Challenge *was* the app's main window (`MVP.md`: "In the beginning it's going to be only 1 challenge that will be the main window"). Once the Challenge Registry holds more than one Challenge, something has to list them — that's this page.

## Layout

A single scrollable page of Challenge cards, one per entry in the Challenge Registry.

**Each card shows:**
- **Title** — the Challenge's name.
- **Difficulty** — a short label (e.g. Beginner / Intermediate / Advanced), set per Challenge.
- **Short description** — one or two sentences, distinct from the full Challenge description shown on the Task Page.
- **Tags** — free-form labels for topic or scope (e.g. "Networking", "Single VPC", "Serverless"), letting a user scan for a Challenge matching what they want to practice.
- **Start Challenge button** — routes to `/challenge/:id`, where `:id` is the Challenge's Challenge ID.

## Routing

`/` renders the Catalog Page; `/challenge/:id` opens the Task Page for the Challenge whose Challenge ID matches `:id`, looked up in the Challenge Registry via `getChallengeById`. Routing is a small hand-rolled client-side router — a `useRoute()` hook reading `window.location.pathname`, navigating via `history.pushState`, and listening for `popstate` — not a routing library. This matches the project's existing pattern of not reaching for a dependency until the built-in tools stop being enough (the same reasoning behind `useReducer` over an external state library), and the app has exactly two page shapes to route between.

An unknown or missing Challenge ID is not a dedicated 404 — it falls back to the Catalog Page.

## Ordering

Registry order is authorial: Challenges appear in the order they're defined in the Challenge Registry, not sorted by difficulty or alphabetically. This keeps ordering a deliberate content decision rather than an emergent one.

## Progress and state

Out of scope for the MVP: per-Challenge completion badges, best-score display on the card, or a "continue where you left off" indicator. This isn't just an unsurfaced-on-the-card gap — it's structurally true, because a Challenge's session is cleared the moment the user returns here via the Header's Back to Catalog control (see `01-TASK-PAGE.md`'s Persistence section). Starting a Challenge from this page always starts clean, whether it's the user's first visit or fifth. The per-Challenge-ID storage key exists only to survive an accidental refresh *while on that Challenge's Task Page* — a real resume-later feature (score history, saved-in-progress state) is tracked in `docs/03-BACKLOG.md` if it proves valuable, not an MVP behavior.

## Out of scope

- Filtering or search across Challenges (only relevant once the Registry is large enough to need it).
- Difficulty-based sorting or recommended-next-Challenge logic.
- Any AI-driven Challenge recommendation (see `PROJECT.md`'s future-product vision).
