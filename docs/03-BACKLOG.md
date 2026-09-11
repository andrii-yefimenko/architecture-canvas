# Backlog — Post-MVP & Out of Scope

Ideas deliberately deferred, kept so they aren't lost. Nothing here is rejected on merit unless noted; most are simply larger than the MVP should carry.

See `docs/pages-ux/01-TASK-PAGE.md` for what was decided instead, and `MVP.md` for the MVP boundary. `MVP.md` is frozen as the v0.1.0 record — this doc is also where scope statements that have since moved on from it now live.

## Active scope beyond the frozen MVP

**Multi-Challenge Catalog & Challenge #2 (v0.2.0, in progress).**
`MVP.md` is frozen as the v0.1.0 record and still lists "Multiple challenges" under its Out of Scope — that was accurate for v0.1.0, not now. The next release adds the Challenge Registry, the Catalog Page (`docs/pages-ux/02-CATALOG-PAGE.md`), and Challenge #2 (`docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`). This supersedes that line for `MVP.md` without editing the frozen document itself.

## Deferred during the UX review (2026-08-29)

**Penalize duplicate / redundant services.**
Currently rules are existential — extra VPCs or frontends are ignored. Docking points for redundancy would teach real architectural discipline, but requires evaluation rules beyond the 11 specified in `MVP.md`.

**Generic service blocks with configure-on-drop role assignment.**
Instead of fixed "EC2 (Frontend)" / "EC2 (Backend)" catalog items, drop a generic EC2 and assign its role afterward. Scales far better as the catalog grows, but needs a real node-configuration UI.

**Tolerate any-descendant nesting rather than strict direct-child matching.**
Would let a correct-in-spirit architecture pass even with an extra wrapper layer. Only becomes relevant once the catalog includes legitimate intermediate containers (security groups, auto-scaling groups, etc.).

**Finer-grained requirement reveal.**
One button per individual bullet, or a single "ask the client a question" button that reveals the next hidden item on each click. Closer to a real client interview than the current four category buttons.

**Canvas snapshot at submit time, as a checkpoint.**
Save the exact tree that produced each score so the user can compare attempts or roll back to a previous one. Pairs naturally with score history below.

**Undo/redo for canvas operations.**
Would also soften the cascade-delete confirmation prompt, which currently exists only because there's no undo.

**Score history across attempts.**
Show progression over multiple submissions rather than only the latest result.

**Unified scoring logic across challenges.**
The current formula (100 / rule count) makes scores incomparable between challenges, because rule granularity varies. In Challenge #1, three "must be present" rules are strictly implied by their placement rules (7→6, 10→9, 11→8), so correctly placing the frontend is worth 18.2 points while correctly placing the Internet Gateway is worth 9.1. A future scheme should normalize weighting — by rule category, by architectural significance, or by deduplicating implied rules — so a 75 on one challenge means roughly what a 75 means on another. Accepted as-is for the MVP, where there is only one challenge and nothing to compare against.

## Deferred during the v0.3.0 Canvas Grill session (2026-09-08)

Scoped out of [ADR-0002](adr/0002-2d-spatial-canvas-blocks.md)'s 2D spatial canvas redesign, kept for later.

**Pan & zoom for the Canvas, with a minimap.** Closer to Application Composer's full spatial workspace, but adds viewport-transform math and zoom-aware pointer-to-canvas coordinate translation. v0.3.0 stays a fixed viewport.

**Manual Frame resize.** Frames auto-size to their children in v0.3.0; letting a user drag a resize handle to set explicit bounds is a separate interaction (drag affordance, overflow handling when a resize shrinks below the contents) left for later.

**Full keyboard-driven fine-grained repositioning.** v0.3.0 keeps keyboard support coarse — select a Service and assign it into a Frame at a default position. Arrow-key nudging or similar for pixel-level keyboard placement in a free-form 2D layout is deferred.

**Collision / overlap-avoidance on Frame auto-resize.** v0.3.1 ([ADR-0003](adr/0003-auto-snap-overlap-on-drop.md)) added overlap-avoidance for direct drag-and-drop, generalized by v0.3.4 ([ADR-0004](adr/0004-modular-placement-grid-and-gutters.md)) into a real modular lattice + gutter guarantee — a drop that would overlap or crowd a sibling now snaps to the nearest lattice slot with clearance. What remains deferred is the other half: a Frame auto-resizing to fit a new child in a way that newly overlaps *or* closes the gutter against a sibling still isn't nudged aside — resize-triggered growth is accepted exactly as the v0.3.0 `/speckit-clarify` session decided. Making resize-triggered growth also respect gutters means re-running the same search reactively on every tree change, not just on drop — closer to a polished diagramming tool, and a materially bigger scope than direct placement.

## Deferred during the v0.3.1 Canvas Polish pass (2026-09-09)

Scoped out of [ADR-0003](adr/0003-auto-snap-overlap-on-drop.md)'s auto-snap decision, kept for later.

**Manual/live re-preview during the auto-snap search itself.** The ghost outline preview (v0.3.1) shows a Frame's projected *growth*, not where an overlapping Card will actually auto-snap to — a user only sees the final resting position once they release. Previewing the snap target live, mid-drag, is a further refinement not built in this pass.

## Deferred during the v0.3.6 Directional Push pass (2026-09-11)

Scoped out of [ADR-0005](adr/0005-directional-push-displacement.md)'s push-displacement decision, kept for later.

**Live preview of which sibling gets pushed, and to where.** The ghost outline (v0.3.1) correctly shows a Frame's projected growth accounting for a push (v0.3.6), but the specific sibling that would move doesn't visually shift until the actual drop — a user only sees which sibling moved, and to where, once they release. Same shape of gap as the auto-snap-era item above, just for the newer push mechanism.

## Already out of scope per `MVP.md`

Restated here for one consolidated view of everything not in the MVP.

- **AI assistant / AI chat** simulating the client conversation behind hidden requirements — the core of the future-product vision in `PROJECT.md`.
- **AI-driven architecture review** with best-practice suggestions and explanations of *why* a decision is wrong.
- **Dynamic challenge generation.**
- **Multiple cloud providers** (MVP is AWS-only).
- **Advanced architecture validation** beyond hardcoded parent-child rules.

## From `docs/01-RESEARCH.md`

**Freemium paid tier** — gating the full challenge library and AI features behind a subscription. Deferred until the AI layer exists and the challenge library is large enough (~5–10 challenges) to be worth paying for; that same milestone is the trigger for widening distribution beyond build-in-public.
