# Phase 0 Research: Architecture Canvas MVP

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md)

## Status of unknowns

The feature specification carries **zero `[NEEDS CLARIFICATION]` markers**. The ambiguities that would ordinarily surface here — where validation runs, what "inside" means, how duplicates score, rounding, resubmission, persistence — were resolved in the grilling sessions recorded in `docs/02-PRODUCT-UX.md` and `docs/04-TECH-STACK.md` before the spec was written.

This document therefore serves two purposes: it records the pre-settled decisions in Decision/Rationale/Alternatives form so the reasoning travels with the plan, and it resolves the **two genuinely open technical questions** that only surfaced once the architecture was being designed.

---

## Newly researched

### R-01: Nested droppable resolution in dnd-kit

**Decision**: One `DndContext` at `App` level. Collision detection composes `pointerWithin` with a `rectIntersection` fallback. Where the pointer sits inside several overlapping droppables — which is the normal case for nested containers — the collision with the **greatest tree depth wins**.

**Rationale**: dnd-kit's own guidance is that `pointerWithin` suits high-precision interfaces, that it should be composed with a fallback (a bare `pointerWithin` returns nothing once the pointer leaves every rect, and the keyboard sensor needs the fallback), and that overlapping droppables in nested containers need an explicit priority rule. Depth-wins is the only priority consistent with the product intent: a user who drags a Node into a Subnet that sits inside a VPC means the Subnet, never the VPC.

**Alternatives considered**:
- `closestCenter` (dnd-kit's default) — resolves to whichever container's centre is nearest, which for a small Node inside a large container frequently selects the *parent*. Wrong for nesting.
- `rectIntersection` alone — a dragged Node overlaps parent and child rects simultaneously, so it cannot disambiguate depth without the same tie-break anyway.
- Nested `DndContext` per container — dnd-kit supports it, but it fragments drag state and complicates moving a Node between distant branches.

**Sources**: [dnd-kit collision detection guide](https://dndkit.com/react/guides/collision-detection/), [droppable core concepts](https://dndkit.com/concepts/droppable/), [legacy algorithms reference](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms)

---

### R-02: The cycle invariant

**Decision**: `moveNode` rejects any move that would place a Node inside its own subtree, leaving the Canvas Tree unchanged. This is the **only** rejected placement in the entire application.

**Rationale**: This constraint was not present in any ground-truth document — it emerged from designing the tree operations. FR-012 requires that any Node may be placed inside any other, and FR-015 requires descendants to move with their parent. Together those make a self-nesting drop logically impossible rather than merely undesirable: the Node would be simultaneously its own ancestor and descendant, corrupting the structure and hanging any recursive traversal.

It is worth distinguishing this from the guardrails FR-013 forbids. Those forbidden guardrails are *semantic* — refusing a database inside a VPC because it is bad architecture. This one is *structural*, and refusing it teaches the user nothing about architecture because there is nothing to learn. Structurally absurd but representable placements remain fully allowed and are judged by the Evaluation, exactly as intended.

**Alternatives considered**:
- Allow the drop and repair the tree afterwards (e.g. re-parent the subtree to root) — silently restructures work the user did not ask to change.
- Prevent the drag from starting over invalid targets — violates FR-013's prohibition on drag-time validity signalling, and would leak structural hints into the interaction.

**Consequence for the spec**: the specification's FR-012 should be read as constrained by this invariant. Flagged for the user rather than silently absorbed.

---

## Pre-settled decisions (recorded for traceability)

### R-03: Client-side evaluation, no backend

**Decision**: The Evaluation runs in the browser against Rules bundled with the application.

**Rationale**: Recorded in full in [ADR 0001](../../docs/adr/0001-client-side-validation-engine.md). Radically simpler to build and deploy; makes the evaluator a pure function and therefore cheap to test exhaustively; static hosting is nearly free during the build-in-public phase.

**Alternatives considered**: A thin validation API, which would keep Rules out of the shipped bundle and pre-build the seam for the future AI reviewer — rejected as real scope for no present benefit. The accepted cost is that a determined user can read the Rules in developer tools; acceptable because no credential or ranking attaches to a Score.

### R-04: Nested tree over flat node map

**Decision**: The Canvas Tree is a nested structure, each Node holding a `children` array.

**Rationale**: Matches the "Canvas JSON tree structure" `MVP.md` describes, is the shape persisted to storage, and renders directly via a recursive component. At 5–20 Nodes the traversal cost of move and delete is irrelevant.

**Alternatives considered**: A flat `Record<NodeId, { serviceId, parentId }>` gives O(1) lookup and trivial re-parenting, and is the right choice at scale — but it needs derivation logic to render and diverges from the documented persisted shape. Rejected as premature optimisation.

### R-05: Direct-child-only containment

**Decision**: A containment Rule passes only when the required container is the Node's immediate parent.

**Rationale**: Every relationship in `MVP.md`'s expected architecture is a direct parent-child link, and Challenge #1's catalog contains no legitimate intermediate containers, so strict matching costs nothing and keeps the evaluator trivial. Recorded in `docs/02-PRODUCT-UX.md`.

**Alternatives considered**: Any-descendant matching, which tolerates an extra wrapper layer. Deferred to `docs/03-BACKLOG.md` — it becomes relevant only once the catalog gains real intermediate containers such as security groups.

### R-06: Existential Rule semantics

**Decision**: A Rule passes if at least one Node satisfies it; duplicates neither help nor hurt.

**Rationale**: All 11 Rules in `MVP.md` are literally worded as existence or containment assertions. Penalising redundancy would require inventing Rules that do not exist.

**Alternatives considered**: Docking points for redundant Services — deferred to backlog, as it needs evaluation rules beyond the specified 11.

### R-07: Score precision

**Decision**: Each Rule contributes `100 / totalRules` at full float precision; the sum is rounded once for display, and shown beside a passed-count.

**Rationale**: Rounding per-Rule to 9 points makes a perfect solution score 99, contradicting `MVP.md`'s formula. Rounding once at the end preserves exactly 100. The passed-count keeps the uneven per-Rule weighting visible rather than hiding it behind a single number.

**Alternatives considered**: One decimal place — precise but reads oddly for a percentage-style result.

### R-08: Versioned single-key persistence

**Decision**: One storage key holds `{ version, canvasTree, revealedCategories }`. A version mismatch, or a reference to a Service absent from the current Challenge, discards the stored state entirely.

**Rationale**: Satisfies FR-033 without migration machinery. Every read and write is wrapped so that unavailable storage (private browsing, disabled site data) degrades persistence only, never core function — FR-034 and SC-009.

**Alternatives considered**: Per-concern keys, which multiply the partial-restore failure modes; schema migrations, unjustifiable for an MVP with one Challenge.

### R-09: Challenge as a typed module

**Decision**: `src/challenges/challenge-01.ts` exports a typed `Challenge` object, bundled at build time.

**Rationale**: Gives compile-time safety on the Rule → Service id references — precisely the class of defect the `"Backend EC2"` / `"EC2 (Backend)"` drift found during the documentation audit represents. The object shape is unchanged if Challenges are later fetched as JSON, so this does not foreclose the multi-Challenge backlog item.

**Alternatives considered**: A JSON file with types applied at the boundary — more future-proof for dynamic loading, but id typos become runtime bugs without added schema validation.

### R-10: No state library

**Decision**: `useReducer` plus Context.

**Rationale**: One screen, and every Canvas mutation (add, move subtree, cascade delete) is naturally a reducer action over a single tree. A pure reducer is also directly unit-testable without rendering.

**Alternatives considered**: Zustand or Redux Toolkit — unearned weight at this size, and neither improves the testability that already comes free from a pure reducer.

---

## Open items carried forward

None blocking. One item needs the user's acknowledgement rather than research:

- **R-02's cycle invariant qualifies FR-012.** The specification states placement is unrestricted; the implementation must reject self-nesting. The plan treats this as a structural necessity, not a design change, but it is a deviation from the letter of the spec and is surfaced rather than absorbed.
