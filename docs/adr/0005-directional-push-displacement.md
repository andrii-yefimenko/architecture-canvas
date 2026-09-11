# 0005 — Directional push displacement and nesting intent threshold

**Status:** Accepted
**Date:** 2026-09-11

## Context

Since v0.3.1 (ADR-0003) and its generalization in v0.3.4 (ADR-0004), overlap on drop was resolved by moving the **dragged** item to the nearest free grid slot (`findFreePosition`) — the dropped item's own position shifted away from whatever it would have overlapped, and every already-placed sibling stayed exactly where it was.

A follow-up request asked for the opposite model, specifically for direct pointer drag-and-drop: the dragged item lands **exactly** where released, and whichever sibling it would overlap gets **pushed aside** instead — cascading further if that push causes a secondary overlap. It also asked to tighten what counts as dropping "into" a Frame at all: today's collision detection (v0.3.5) registers a Frame the instant the dragged item's bounding box touches it at all, which is the right signal for *proximity* but not necessarily *intent* — a drag that merely grazes a Frame's edge shouldn't commit to nesting inside it.

Two designs were on the table and grilled with the user:

- Keep `findFreePosition` for direct drags, and add push-displacement only as a *reactive* fallback in some narrower circumstance.
- Replace `findFreePosition` entirely for drag-and-drop with push-displacement, since the two express genuinely different intents about what should move.

## Decision

**Directional push replaces `findFreePosition` entirely for drag-and-drop.** `findFreePosition`'s ring-search itself is unchanged and still exported — `KeyboardPlacement.tsx` still uses it, since keyboard assignment has no drop-position/directional intent to push *from*. This is a deliberate scope boundary, not an oversight.

- **Push trigger and direction**: on drop, any existing sibling `hasClearance` (v0.3.4's gutter test, unchanged) rejects against the dropped rect gets pushed. Direction is the axis of **minimum penetration** — the shorter distance needed to separate the dropped rect from that sibling — with an exact tie defaulting to push-down. A pushed sibling's new position is its mover's trailing edge (along the push axis) plus `FRAME_PADDING`, `snapToGrid`-aligned; the cross-axis position never changes.
- **Cascade**: if a push causes the moved sibling to newly overlap a *further* sibling, that one is pushed too, along the same axis — chained until nothing new collides, or `MAX_PUSH_CASCADE_DEPTH` (50, mirroring `MAX_FREE_SEARCH_RINGS`'s existing precedent) is reached, at which point the last sibling in the chain simply keeps its old, now-overlapping position — the same graceful-degradation philosophy `findFreePosition` already used rather than search/cascade forever.
- **Multiple siblings directly overlapped by one drop** (rare — landing exactly on the seam between two): the one with the largest overlap area is the primary push target; its own cascade may still reach the other one.
- **Nesting intent threshold**: a non-root candidate (`collision.ts`'s `deepestDroppableFirst`) must clear `meetsNestingThreshold` — the dragged rect's center falls inside it, **or** at least half of the *dragged item's own area* overlaps it (half of the dragged item's area, not the target's — a small Card against a large Frame could otherwise never reach half of the Frame's own, much bigger, area). A candidate that fails is filtered out before the existing depth-sort runs, so resolution falls through to whichever shallower candidate — eventually the Canvas root, always exempt — does qualify. No separate "walk up a level" logic is needed: a shallower, larger ancestor almost always independently clears the threshold on its own once a deeper, smaller one fails.
- **The threshold governs the live ghost preview too**, not just the final drop — `handleDragOver` and `handleDragEnd` resolve `over` through the same `deepestDroppableFirst`, continuing v0.3.5's "hover and drop can never disagree" principle. The live preview's projected Frame growth also accounts for any siblings that would be pushed, by merging `computePushDisplacements`'s output into the layout map fed to `computeDragPreviewSize` — otherwise the ghost could under-project a Frame that needs to grow to fit a pushed child at its new spot, not just the dropped item.

**Two interpretation calls made without a separate grilling round**, both easily revisited later if wrong:
- "Intersection area ≥ 50%" is 50% of the dragged item's area (see above).
- Multiple simultaneously-overlapped siblings: largest-overlap-area wins as the primary target.

**No live preview of which sibling moves where** was added — the ghost outline still shows accurate Frame growth (see above), but the specific sibling doesn't visually shift until the actual drop. Deferred to `docs/03-BACKLOG.md`, matching the existing precedent for live snap-target preview from v0.3.1's backlog.

## Consequences

**The reducer gained its first multi-key layout *write*.** `ADD_NODE`/`MOVE_NODE` actions gained an optional `displacedPositions?: Record<NodeId, Layout>`, merged into `state.layout` in the same spread as the primary position — one atomic update per dispatch. (`RESTORE` already replaced the whole map, and deletion already removed multiple keys at once via `omitLayoutEntries`; this is the first case of writing more than one key.)

**Dropping a new item can now silently relocate an already-placed, unrelated sibling.** This is the entire point of the feature, but it's a real UX property worth naming plainly: a single drop's blast radius is no longer "this one Node's position," it can include others. No undo mechanism exists yet (`docs/03-BACKLOG.md`'s existing "Undo/redo for canvas operations" entry already covers this general risk) — accepted as-is, matching how that same gap was already accepted for the cascade-delete confirmation.

**`siblingRectsFor` now returns `SiblingRect[]` (`PositionedRect & {id}`)** instead of bare `PositionedRect[]` — needed so push output can be attributed back to specific Nodes. `PositionedRect` itself is unchanged; `SiblingRect[]` is a structural superset, so every existing consumer (`findFreePosition`) is unaffected.

**No new dependency, no new page or layer.** `meetsNestingThreshold`, `computePushDisplacements`, and `resolveDropPlacement` (superseding v0.3.5's `resolveDropPosition`) are pure additions/replacements in `src/state/layout.ts`; the threshold filter is a small addition to `collision.ts`'s existing `deepestDroppableFirst`, exercised from the same call sites (`TaskPage.tsx`'s `handleDragOver`/`handleDragEnd`) that already existed.
