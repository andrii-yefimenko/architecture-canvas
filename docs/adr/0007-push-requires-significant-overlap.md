# 0007 — Directional push requires significant, size-relative overlap

**Status:** Accepted
**Date:** 2026-09-11

## Context

ADR-0005 (v0.3.6) introduced directional push displacement: a drop that would fail `hasClearance` against a sibling — gutter-inflated, i.e. anything closer than `FRAME_PADDING` (16px), including cases with **zero actual geometric overlap** — pushed that sibling aside by a full offset.

Hands-on testing after v0.3.7's nesting-threshold fix (which made dropping into narrow Frame margins possible again) surfaced two compounding regressions in push itself, found in the same pass:

1. **Over-sensitive to grazes.** A drop that only grazed a sibling's edge, or merely intruded into its gutter zone by a pixel or two, triggered the *same* full-offset jump as a drop that landed squarely on top of it — jarring and disproportionate for what was often a 1px graze.
2. **Not scaled to object size.** The first fix for (1) added a flat "≥16px penetration on the shallower axis OR ≥25% overlap area" test. That flat 16px branch is a meaningful quarter of a 64px Card's own width, but barely a twentieth of a 240px+ Frame's — so dragging one large Frame slightly past a sibling Frame's edge still triggered the same erratic full jump the fix was meant to prevent, just for Frames instead of Cards.

## Decision

**Push requires overlap area of at least `MIN_PUSH_OVERLAP_RATIO` (25%) of the *smaller* of the two rects' own areas — no flat pixel threshold at all.** New `hasSignificantOverlap(a, b)` in `src/state/layout.ts`, checked against the **raw** rects (never `hasClearance`'s gutter-inflated ones): true if there's real geometric overlap (`rectsOverlap`) *and* the overlap area is at least 25% of `min(areaOf(a), areaOf(b))`.

Two things this single test achieves that the interim flat-16px version didn't:

- **Scales with object size automatically**, because it was always a percentage, never tuned per shape. Confirmed by hand: a 16px-deep, full-height touch between two 64px Cards is exactly 25% of either one's area (so today's Card-vs-Card behavior is unchanged) — the *same* 16px touch between two 240px Frames is under 9%, correctly falling short. The flat penetration branch added nothing a well-scaled area test didn't already cover for Cards, and it's exactly what broke Frame-vs-Frame — it was removed rather than tuned further.
- **Uses the smaller of the two areas, not just the dragged rect's.** Had the denominator stayed "the dragged rect's own area" (as an earlier draft did), a small Card fully engulfed by a much larger dragged Frame would register as only a tiny fraction of the *Frame's* area and fail to trigger, even though the Card is 100% overlapped. Using `min(areaA, areaB)` means whichever object is smaller sets the bar, so a full engulfment always reads as a complete overlap regardless of which side is dragging.

`computePushDisplacements` uses this test for both the initial trigger (does this drop push anything at all) and every cascade step (does a just-moved sibling now warrant pushing a further one) — a drop or cascaded shift that only grazes the next sibling, at any object size, is tolerated rather than propagating another jump.

**The push's own *output* is unchanged** — once a push does trigger, the pushed sibling still lands with a full, clean `FRAME_PADDING` gutter from whatever it was pushed away from (`snapToGrid`-aligned, per ADR-0005). Only the *decision to push at all* got more lenient. A practical consequence: the *final* on-canvas gap between two Nodes can now be anywhere from a hair's width up to `FRAME_PADDING` when a drop's overlap was tolerated rather than acted on — the gutter guarantee (ADR-0004) is a floor enforced by an *active* push or by `findFreePosition`'s search, not an invariant re-checked continuously across every arrangement a user assembles by hand.

## Consequences

**No change to `meetsNestingThreshold`, the reducer, or anything in `TaskPage.tsx`.** This is confined entirely to `computePushDisplacements`'s trigger condition in `src/state/layout.ts`.

**`hasClearance` is untouched and still used elsewhere** — `findFreePosition`'s own gutter guarantee (serving `KeyboardPlacement.tsx`) is a different call site with a different job (finding a fully clear slot, not deciding whether an existing overlap is worth acting on) and keeps its stricter, gutter-aware test.

**No separate rule for Frames vs. Cards was introduced.** An alternative considered was gating Frame-vs-Frame pushes on a stricter, `meetsNestingThreshold`-style bar (center-inside or ≥50% area) while leaving Card-involved pushes on a looser rule — this would have required threading `renderKind` into `computePushDisplacements`, which today is deliberately a pure, kind-agnostic geometry function. The single size-relative percentage test achieves the same practical outcome without that added surface.
