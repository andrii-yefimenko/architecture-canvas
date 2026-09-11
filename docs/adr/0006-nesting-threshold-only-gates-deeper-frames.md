# 0006 — Nesting threshold only gates deeper-vs-shallower Frame pairs

**Status:** Accepted
**Date:** 2026-09-11

## Context

ADR-0005 (v0.3.6) introduced `meetsNestingThreshold` — a Frame candidate needed the dragged rect's center inside it, or ≥50% of the dragged item's own area overlapping it, to become the real drop target. It applied this test to **every** non-root candidate uniformly.

Hands-on testing surfaced a major regression: it became nearly impossible to drop items into a Frame's own narrow margins — e.g. the perimeter of a VPC once a Public Subnet already fills most of its interior. Root cause: a Frame's rendered box auto-sizes tightly around its children (FR-003, unchanged since v0.3.0) — it carries no extra buffer beyond `FRAME_PADDING`. So a Frame's *unoccupied* margin is routinely narrower than a dragged 64×64 Card. Any drop positioned "in the margin" necessarily straddles the Frame's own edge, since there's no room for the whole Card to sit fully inside the current (pre-drop) box. That drop would then fail the 50%/center test against the Frame itself and fall through to the Canvas root — even though the Frame was obviously the intended target and the only sensible outcome was for it to expand and push its existing child aside.

The threshold's actual purpose was narrower than how it got implemented: preventing a **deeper** Frame from "swallowing" a drop that only touches it because it happens to sit inside a much larger enclosing Frame the drop was really meant for (e.g. a Subnet grabbing a drop meant for its enclosing VPC). It was never meant to gate whether the **outermost** real Frame — the one with nothing but the Canvas root beneath it — deserves the drop at all.

## Decision

**The threshold only gates a candidate against a shallower non-root candidate, never against the Canvas root.** `collision.ts`'s `deepestDroppableFirst` now walks the depth-sorted candidate list from deepest to shallowest, dropping a candidate that fails `meetsNestingThreshold` only while there remains a shallower *non-root* candidate to fall back to. The moment the front of the list is either the sole surviving non-root candidate or the root itself, it wins unconditionally — no threshold check at all, just the touch/overlap `rectIntersection`/`pointerWithin` already established (v0.3.5's original rule).

Concretely, for a three-level chain (Subnet inside VPC inside the Canvas root): the Subnet must prove itself against the threshold to beat VPC; if it fails, VPC is checked next — but VPC is compared only against the *root*, so it wins outright, matching the expected "drop lands in the VPC's margin, pushing the Subnet aside" behavior.

`meetsNestingThreshold`'s own geometry (center-inside or ≥50%-of-dragged-area) is unchanged — only *which pairs of candidates it's applied to* changed.

## Consequences

**Dropping in a Frame's own margin works again**, including cases where the margin is narrower than the dragged item itself — the exact regression reported. The Frame expands (via the existing derived-size mechanism, unchanged) and directional push (ADR-0005) moves its existing child aside as needed.

**The threshold still does real work between nested Frames.** A drop genuinely aimed at a Subnet (clearing the threshold against it) still nests into the Subnet, not the VPC — ADR-0005's original motivating case is untouched.

**No change to `meetsNestingThreshold`, `computePushDisplacements`, or any other push/placement logic** — this is confined entirely to `collision.ts`'s candidate-selection walk. `src/state/layout.ts` needed no changes.
