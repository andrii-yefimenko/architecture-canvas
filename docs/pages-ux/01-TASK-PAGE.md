# Task Page — Product & UX Template

The reusable layout and interaction contract for the page where a user actually works a Challenge (`/challenge/:id`). Originally settled for Challenge #1 in a two-round design review on 2026-08-29; generalized here so every Challenge in the Challenge Registry uses the same mechanics. Challenge-specific content (rule count, service catalog, category names) lives in that Challenge's file under `docs/challenges/`, not here.

Ground truth: `PROJECT.md`, `MVP.md`, `README.md`, `docs/01-RESEARCH.md`, `CONTEXT.md`. This document layers decisions on top of them without editing them. Ideas rejected here are logged in `docs/03-BACKLOG.md` rather than discarded.

## Layout

Three vertical panels plus a Header, per `MVP.md`'s General Design:

- **Requirements** (left) — Challenge title and description, Visible Requirements, Hidden Requirement Category reveal buttons, Score, Evaluation.
- **Canvas** (center, largest) — the Canvas Tree the user builds.
- **Services** (right) — the active Challenge's Service catalog, grouped by category.
- **Header** — Submit button, and a Back to Catalog control. Returning to the Catalog Page (see `02-CATALOG-PAGE.md`) clears the current Challenge's in-progress session — see Persistence.

This layout is the template for *any* Challenge. A Challenge supplies its own title, description, requirements, categories, catalog, and Rules; the page mechanics below do not change.

## Requirements Discovery UX

**One reveal button per Hidden Requirement Category.**
Each Challenge defines its own set of categories (Challenge #1 uses four: Infrastructure, Presentation Tier, Application Tier, Data Tier). Each button reveals all bullets in that category at once. This trains the "which area do I need to clarify?" instinct regardless of how many categories a given Challenge has.

**Revealing requirements carries no score penalty.**
Score is purely structural (100 / Rule count) with no reveal term. *Implied by `MVP.md`'s Score formula — recorded here for clarity, not a new decision.*

**Revealed state survives reload.** See Persistence.

## Canvas Interaction & Tree Structure

**Free-form dropping, zero restriction.**
Any Service may be dropped inside any other Node or at the Canvas root. There is no drag-time blocking of invalid targets and no highlighting of valid parent containers. Correctness is evaluated *only* at Submit. This keeps the Canvas Tree evaluator the single source of truth and avoids leaking the answer through what the UI permits. Holds for every Challenge, regardless of catalog size or Rule count.

**Distinct catalog entries carry fixed roles.**
Where a Challenge's catalog needs role-specific variants of the same underlying resource (e.g. "EC2 (Frontend)" vs. "EC2 (Backend)" in Challenge #1), those are separate Services with fixed roles, not one Service with a configurable role. A Node's type *is* its role — there is no post-drop configuration step.

**Moving a container drags its whole subtree.** Plain tree semantics.

**Deleting a container cascades to its subtree, with confirmation when non-empty.**
Deleting a Node removes everything beneath it. Because the MVP has no undo, a confirmation prompt appears whenever the target container has children — a cheap guard against losing several minutes of work to a mis-click.

## Evaluation Semantics

The contract the evaluator must implement, for any Challenge. Both items below resolve ambiguities that `MVP.md` leaves open once free-form dropping is allowed.

**"Inside" means direct child only.**
For a Rule like "X must be inside Y," the Node's *immediate* parent must be the required container. Nesting it one level deeper does not satisfy the Rule. This is a fixed evaluation semantic, not something an individual Challenge can override.

**Rules are existential; duplicates are ignored.**
A Rule passes if at least one Node satisfies it. Placing extra copies of a Service neither helps nor hurts the score. Penalizing redundancy is tracked as a backlog item, not a per-Challenge option.

## Feedback & Evaluation UX

**Submit is always enabled.**
An empty or near-empty Canvas is scored by the Challenge's Rules the same as any other, yielding 0 plus a full "requirement not met" list with clear messages. No artificial gating — a 0-score Evaluation is itself useful feedback, and it avoids special-casing the empty state.

**The results panel shows every Rule as a pass/fail checklist**, not failures alone. `MVP.md`'s acceptance criteria require that the user "can see which requirements passed or failed." Each failure carries a Recommendation. *Implied by ground truth — recorded for clarity.*

**Unlimited iterative resubmission.**
The Canvas never locks after submitting. The goal is developing architectural thinking, not test-taking, and the Score formula implies a live, re-checkable state.

**Score is summed exactly, rounded only for display, and shown with its Rule count.**
Each Rule is worth `100 / total Rule count` points — a value that varies by Challenge. Points are summed at full precision and rounded once for display, so a perfect solution reads exactly 100 regardless of how many Rules the Challenge has. The passed-Rule count appears alongside the number (e.g. "91 — 10 of 11 requirements met"), which keeps the per-Rule weighting visible rather than hidden behind a single figure. (A future cross-Challenge normalization scheme is tracked in `docs/03-BACKLOG.md`.)

**Stale results stay visible, clearly marked.**
The moment the Canvas is edited after a submit, results remain on screen behind a badge such as "Results are from your previous submission." Clearing them on first edit would destroy the Recommendations the user is reading *while* they fix things — the panel is the guidance they're acting on, so it must outlive the first drag.

## Persistence

**Canvas Tree and revealed-Category state persist via `localStorage`, scoped per Challenge ID — but only as an in-progress safety net against an accidental refresh, not as a resumable save.** Losing a half-built architecture to a reload while actively working a Challenge is a real frustration and cheap to avoid; losing it because the user deliberately left the Challenge is not the problem this solves. No backend involved.

**One versioned storage key per Challenge, keyed by Challenge ID.** State is stored under `` `architecture-canvas:session:${challengeId}` ``, holding `{ version, challengeId, canvasTree, revealedCategories }`. The `challengeId` field is validated against the key on load rather than trusted implicitly — this is what stops one Challenge's stored Canvas Tree from being silently accepted as another Challenge's session merely because they happen to share Service ids (a real risk once two Challenges reuse names like `vpc` or `rds`). On load, a mismatched `version` discards the stored state and starts clean, so a change to the Node or Challenge schema can never crash the app on stale data.

**Leaving a Challenge clears its session.** Navigating back to the Catalog Page via the Header's Back to Catalog control clears that Challenge's storage key. Returning to the same Challenge later starts from empty, the same as visiting it for the first time — there is no cross-visit resume (see the Catalog Page's Progress and state section). Persistence exists solely to survive the browser tab, not the user's decision to leave.

**Node instance identity.** Each Node gets a `crypto.randomUUID()` id at drop time. Free-form dropping plus existential Rules means the Canvas may legitimately hold several Nodes of the same Service type, so move, delete, and re-parent operations all target the instance id rather than the Service type.
