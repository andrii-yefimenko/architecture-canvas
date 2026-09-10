# 0004 — Modular placement grid and gutters

**Status:** Accepted
**Date:** 2026-09-09

## Context

v0.3.1 (ADR-0003) added auto-snap-on-overlap: a direct drop only nudged to the nearest free position when it *would* overlap a sibling, searching outward on an 8px (`GRID_SNAP`) step, with zero minimum spacing — siblings were free to sit flush/touching. Free placement elsewhere on the Canvas landed at the exact release pixel, snapped only to the fine 8px grid.

A follow-up request asked for something closer to a real modular layout system: predictable alignment for every placement, not just overlap recovery, and a guaranteed minimum gutter between adjacent elements so the Canvas never reads as elements crammed together. Two genuinely different designs were on the table and put to the user directly:

- Keep free-form 8px placement as the default, and only engage a coarser lattice + gutter reactively, the moment a drop would overlap a sibling (a direct extension of ADR-0003's own trigger).
- Make *every* placement — regardless of whether anything is nearby — land on the coarser lattice, so the whole Canvas reads as one consistent grid.

The user chose the second option. Hands-on browser testing of that first implementation then surfaced two real problems, addressed by revising this same decision before anything was committed (not a new ADR — this document reflects the corrected design throughout):

1. The initial version derived the placement-snap step from `CARD_SIZE` (`MODULE_STEP = CARD_SIZE.width + FRAME_PADDING` = 80px), coupling two unrelated concerns — how far apart siblings must stay, and how coarse the position grid feels. 80px felt rigid, closer to a spreadsheet than free placement.
2. Nothing kept a child clear of a Frame's own top-left border — `(0, 0)` was a legal drop position relative to a Frame's droppable rect, so new Nodes could land flush against (and visually overlap) the Frame's border and v0.3.3's corner badge.

## Decision

**Every placement snaps to a fine grid, a minimum gutter is enforced between siblings, and a Frame's own interior padding keeps children off its border — for both pointer drags and keyboard placement.**

- **Placement grid**: `snapToGrid` rounds every drop's raw pixel position to the nearest `FRAME_PADDING` (16px) increment, unconditionally — not only when avoiding overlap. Deliberately *not* derived from `CARD_SIZE`: this step is purely how fine the grid feels, independent of the gutter guarantee below, so tuning one never silently tunes the other.
- **Gutter**: reuses `FRAME_PADDING`'s value (16px) as a second role — a Frame's own inset from its border to its children, *and* the minimum clearance required between sibling Nodes — rather than a separate, coincidentally-equal constant. New `hasClearance` tests a candidate rect (inflated by the gutter on all sides) against every sibling rect via the existing `rectsOverlap`. This guarantee is independent of the placement-grid step size — a finer or coarser grid never relaxes or tightens it.
- **`findFreePosition`'s ring search** (unchanged shape, from ADR-0003) steps in `FRAME_PADDING` increments and accepts a candidate only when `hasClearance` holds, replacing the old bare `rectsOverlap` check — so a nudged position is both grid-aligned and gutter-respecting, not merely non-overlapping.
- **Frame interior floor**: `findFreePosition` gained a `minPosition` parameter (default `{0, 0}`, matching the Canvas root's own unbordered origin) that both clamps the desired position and bounds the ring search, so a candidate below the floor on either axis is never returned — generalizing the function's pre-existing "never negative" rule from a hardcoded `0` to a caller-supplied floor. Placing into a real Frame passes `{x: FRAME_PADDING, y: FRAME_PADDING}`, keeping every child clear of the border and badge; this is a *third* role for the same `FRAME_PADDING` constant — reused deliberately, not by name collision.
- **Keyboard placement** (`KeyboardPlacement.tsx`) is brought onto this same `findFreePosition` call, with the same `minPosition` floor — its previous bespoke diagonal-cascade formula (`defaultPositionForKeyboardPlacement`, now removed) had no collision check at all, by its own documented rationale ("overlap is already permitted"), a premise this decision invalidates. One placement algorithm serves both input methods now, not two.

**Scope stays direct-placement only**, same boundary ADR-0003 already drew: a Frame's own auto-resize growing to fit a new child is not re-checked against its siblings for gutter clearance — that remains deferred (`docs/03-BACKLOG.md`).

**No new landing-slot / drop-target placeholder was added.** The existing v0.3.1 ghost outline (a Frame's own box previewing its projected growth while hovered) stays exactly as it was — a different concept from a landing-slot indicator, not something this decision touches. Feedback for where an item will land stays exactly the cursor-following Drag Overlay from v0.3.2; the user explicitly did not want a second landing-position preview layered on top. The live ghost-preview projection (`computeDragPreviewSize`'s input) deliberately stays unclamped by the interior floor too — it's a soft "this will need to grow" indicator, not a pixel-exact promise, and the resulting deviation is bounded by one `FRAME_PADDING`.

## Consequences

**`GRID_SNAP` and the original `snapToGrid` are removed**, not deprecated-in-place — nothing in `src/` depended on the fine 8px grid once every placement path (drag and keyboard) moved to a `FRAME_PADDING`-based step. Confirmed via grep before removal. (The `snapToGrid` name is reused for the new function — same name, a different, larger step, and no coupling to `CARD_SIZE`.)

**`defaultPositionForKeyboardPlacement` is removed.** Keyboard placement now costs one more `findFreePosition`/`siblingRectsFor` call per assignment — functionally equivalent to what a pointer drop already paid, no new algorithmic complexity introduced.

**One constant, three roles.** `FRAME_PADDING` (16px) now governs a Frame's border-to-child inset, the sibling gutter, and the placement-grid step. Each use is independently named and commented at its call site so a future reader isn't left to guess whether the overlap is deliberate — it is, but nothing prevents splitting them into separate constants later if one ever needs to diverge from the others. `MAX_FREE_SEARCH_RINGS` (50) is unchanged, so the search bound is 50 × 16px = 800px — still bounded, still degrades to accepting the closest available spot rather than searching forever.

**No new dependency, no new page or layer.** `snapToGrid` and `hasClearance` are pure additions/replacements in `src/state/layout.ts`, `findFreePosition` gained one optional parameter, exercised from the same call sites (`TaskPage.tsx`'s `handleDragOver`/`handleDragEnd`, `KeyboardPlacement.tsx`'s `handleAssign`) that already existed.
