# Architecture Canvas — Product & UX Decisions

Settled UX mechanics for the MVP, from a two-round design review on 2026-08-29.

Ground truth: `PROJECT.md`, `MVP.md`, `README.md`, `docs/01-RESEARCH.md`. This document layers decisions on top of them without editing them. Where it resolves an ambiguity in `MVP.md`, it says so explicitly. Ideas rejected here are logged in `docs/03-BACKLOG.md` rather than discarded.

## Requirements Discovery UX

**One reveal button per hidden-requirement category — four buttons total.**
The categories are Infrastructure, Presentation Tier, Application Tier, and Data Tier; each button reveals all bullets beneath it at once. This mirrors `MVP.md`'s existing grouping and keeps the panel to 4 controls rather than 11, while still training the "which area do I need to clarify?" instinct.

**Revealing requirements carries no score penalty.**
Score is purely structural (100 / rule count) with no reveal term. *Implied by `MVP.md`'s Score formula — recorded here for clarity, not a new decision.*

**Revealed state survives reload.** See Persistence.

## Canvas Interaction & Tree Structure

**Free-form dropping, zero restriction.**
Any service may be dropped inside any other service or at the canvas root. There is no drag-time blocking of invalid targets and no highlighting of valid parent containers. Correctness is evaluated *only* at Submit. This keeps the JSON-tree evaluator the single source of truth and avoids leaking the answer through what the UI permits.

**Two distinct catalog items for EC2.**
"EC2 (Frontend)" and "EC2 (Backend)" are separate draggable blocks with fixed roles, matching `MVP.md`'s service list and its evaluation rules. A node's type *is* its role — there is no post-drop configuration step.

**Moving a container drags its whole subtree.** Plain tree semantics.

**Deleting a container cascades to its subtree, with confirmation when non-empty.**
Deleting a node removes everything beneath it. Because the MVP has no undo, a confirmation prompt appears whenever the target container has children — a cheap guard against losing several minutes of work to a mis-click.

## Evaluation Semantics

The contract the evaluator must implement. Both items below resolve ambiguities that `MVP.md` leaves open once free-form dropping is allowed.

**"Inside" means direct child only.**
For a rule like "EC2 (Frontend) must be inside a Public Subnet," the node's *immediate* parent must be the required container. Nesting it one level deeper does not satisfy the rule. Every relationship in `MVP.md`'s Required Architecture is a direct parent-child link, and the MVP catalog contains no legitimate intermediate containers, so strict matching costs nothing and keeps the evaluator trivial.

**Rules are existential; duplicates are ignored.**
A rule passes if at least one node satisfies it. Placing two VPCs or three frontends neither helps nor hurts the score. This matches how all 11 rules in `MVP.md` are literally worded ("must exist" / "must be inside"); penalizing redundancy would require inventing rules that don't exist yet.

## Feedback & Evaluation UX

**Submit is always enabled.**
An empty or near-empty canvas is scored by the same 11 rules, yielding 0 plus a full "requirement not met" list with clear messages. No artificial gating — a 0-score evaluation is itself useful feedback, and it avoids special-casing the empty state.

**The results panel shows all 11 rules as a pass/fail checklist**, not failures alone. `MVP.md`'s acceptance criteria require that the user "can see which requirements passed or failed." Each failure carries a recommendation in `MVP.md`'s Requirement / Result / Recommendation format. *Implied by ground truth — recorded for clarity.*

**Unlimited iterative resubmission.**
The canvas never locks after submitting. The goal is developing architectural thinking, not test-taking, and the Score formula implies a live, re-checkable state.

**Score is summed exactly, rounded only for display, and shown with its rule count.**
Each rule is worth 100 / 11 = 9.0909… points. Points are summed at full precision and rounded once for display, so a perfect solution reads exactly 100. The passed-rule count appears alongside the number ("91 — 10 of 11 requirements met"), which keeps the uneven per-rule weighting visible rather than hidden behind a single figure.

**Stale results stay visible, clearly marked.**
The moment the canvas is edited after a submit, results remain on screen behind a badge such as "Results are from your previous submission." Clearing them on first edit would destroy the recommendations the user is reading *while* they fix things — the panel is the guidance they're acting on, so it must outlive the first drag.

## Persistence

**Canvas tree and revealed-requirement state persist via `localStorage`**, restored on load. Losing a half-built architecture to an accidental refresh is a real frustration and cheap to avoid. No backend involved — this stays within the MVP's "no AI, no additional features" boundary.

**One versioned storage key.** State is stored under a single key holding `{ version, canvasTree, revealedCategories }`. On load, a mismatched `version` discards the stored state and starts clean, so a change to the node or challenge schema can never crash the app on stale data.

**Node instance identity.** Each node gets a `crypto.randomUUID()` id at drop time. Free-form dropping plus existential rules means the canvas may legitimately hold several nodes of the same service type, so move, delete, and re-parent operations all target the instance id rather than the service type.
