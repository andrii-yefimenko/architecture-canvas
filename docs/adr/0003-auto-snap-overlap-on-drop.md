# 0003 — Auto-snap to nearest free slot on overlap (direct drags)

**Status:** Accepted
**Date:** 2026-09-09

## Context

v0.3.0 shipped the 2D spatial Canvas with an explicit, deliberate rule (ADR-0002 decision 4, `FR-010` in `specs/003-2d-canvas-blocks/spec.md`): the system never blocks, rejects, or auto-rearranges a drop solely because it overlaps another Node — confirmed again during that milestone's `/speckit-clarify` session for the resize-triggered case specifically.

Hands-on browser testing after shipping surfaced this as real friction rather than an accepted trade-off: uncontrolled overlap from a direct manual drag makes the Canvas read as messy, not intentional. Two related but separate bugs were investigated alongside it as part of the same v0.3.1 polish pass:

- A micro-repositioning bug — small drags within a Node's current parent were silently rejected, because every Node is both draggable and droppable on the same id, and dnd-kit doesn't reflow the DOM during a drag, so a small drag never left the dragged Node's own stationary droppable rect, resolving `over.id === active.id`. `moveNode`'s cycle guard then rejected the whole move, position update included. Fixed in `collision.ts` by excluding the active draggable's own id from candidate droppables — not an ADR-level decision, a straightforward bug fix with no trade-off.
- A live "ghost outline" preview on Frame hover during a drag — new UI feedback, not a reversal of anything decided before, and easily changed later — also not ADR-level.

Only the overlap-on-drop question below clears the three-part bar (hard to reverse, surprising without context, a real trade-off between genuine alternatives).

## Decision

**Direct drags now auto-snap to the nearest free grid slot on overlap.** When a drop's desired position would overlap an existing sibling in the same parent, the system searches outward from that position in grid-snap increments (an expanding square ring) for the nearest non-overlapping, grid-aligned spot, and places the Node there instead. The drop is still never *rejected* — `FR-010`'s "never blocks a drop" spirit holds — but the exact release point is no longer guaranteed to be the final rest position.

**Scope is deliberately narrow — direct drags only.** A Frame's own auto-resize growing into a sibling is explicitly **excluded** and behaves exactly as ADR-0002 and the v0.3.0 `/speckit-clarify` session left it: accepted, never nudged. Extending auto-snap to the resize-triggered case would mean re-running the search reactively on every tree change, not just on drop — a materially bigger scope not justified by the reported friction, which was specifically about direct manual drags.

**Algorithm**: `findFreePosition` in `src/state/layout.ts` — bounded expanding-ring search (capped at 50 rings, i.e. up to 400px), returning the original desired position unperturbed if nothing is found within that bound. Fed by `siblingRectsFor`, which gathers the target parent's current children (excluding the dragged Node itself, for a reposition) with their live positions and rendered sizes.

## Consequences

**`FR-010` as written in `specs/003-2d-canvas-blocks/spec.md` is superseded for the direct-drag case.** That spec is left as the frozen v0.3.0 record and is not edited in place — the same convention already established for `MVP.md` staying frozen while `docs/03-BACKLOG.md` and later specs supersede specific lines via pointer rather than in-place edits.

**A bounded search, not a full auto-arrange algorithm.** `findFreePosition` only ever runs once, at drop time, for the single dropped/moved Node — it never repositions anything else, and it degrades to accepting the overlap rather than searching forever or throwing.

**No new dependency, no new page or layer.** `rectsOverlap`, `findFreePosition`, and `siblingRectsFor` are pure additions to `src/state/layout.ts`, exercised from `TaskPage.tsx`'s existing `handleDragEnd`.

**The two co-shipped bug/polish items** (self-collision exclusion in `collision.ts`; the ghost-preview `DragPreviewContext`) are recorded in `docs/02-PLAN.md`'s Decision Log alongside this ADR for traceability, but neither required its own ADR — see Context above.
