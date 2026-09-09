# Contract: Canvas Layout

**Module**: `src/state/layout.ts` (new), `src/state/session-reducer.ts` (changed), `src/domain/canvas-tree.ts` (one addition), `src/components/canvas/collision.ts` (unchanged) | **Covers**: FR-001–FR-011, FR-020

## Types and constants

```ts
interface Layout { readonly x: number; readonly y: number }
type LayoutMap = Readonly<Record<NodeId, Layout>>;

const GRID_SNAP = 8;                                  // px
const CARD_SIZE = { width: 160, height: 96 };          // px
const MIN_FRAME_SIZE = { width: 220, height: 160 };    // px
const FRAME_PADDING = 16;                              // px
```

Coordinates are **local to the Node's own parent**; the Canvas root is the origin for root-level Nodes. A Node's rendered size is **never stored** — see `data-model.md`'s Layout entry.

## Rendering derivation

For a given Node:

1. If it has **at least one child**: render as a **Frame**, sized by `computeContentSize` over its children's positions and rendered sizes, plus `FRAME_PADDING`, floored at `MIN_FRAME_SIZE`. Applies **regardless of the Node's Service's `renderKind`** (FR-002).
2. Otherwise (no children): render per its Service's `renderKind` —
   - `'card'` → fixed `CARD_SIZE` (FR-005).
   - `'frame'` → `MIN_FRAME_SIZE` (FR-004).

The Canvas root itself uses the same `computeContentSize` over its root-level Nodes to size its rendered content wrapper — not a Frame in the domain sense (it has no Service, no Node id), but sized by the identical rule, which is what gives the Canvas panel's existing `overflow-auto` (`TaskPage.tsx`) real content to scroll to (FR-020).

## Drop resolution (unchanged from today)

`src/components/canvas/collision.ts`'s `deepestDroppableFirst` requires **no code change**. It already resolves overlapping nested droppables — the normal case for nested containers — via `pointerWithin` (falling back to `rectIntersection`) with a depth-sorted tiebreak. Nested Frames still render as nested DOM elements under this contract (children are real DOM descendants of their parent Frame's `position: relative` box), so their rendered rects still nest exactly as today's indented divs do. See `research.md`'s "Collision detection: reuse, not rewrite" for the full reasoning — this corrects, but does not contradict, ADR-0002's prediction that this module "needs a full rewrite."

Every Node stays both draggable and droppable, unconditionally (`FR-006`, `FR-007`, `FR-011` — unchanged from spec 001's FR-012, no new placement restriction). A Card-kind Node accepts a drop exactly like a Frame; it promotes to a Frame per the rendering derivation above rather than rejecting the drop.

## Drop-position computation

On `DragEndEvent`:

```
localPosition = {
  x: snapToGrid(active.rect.current.translated.left - over.rect.left),
  y: snapToGrid(active.rect.current.translated.top  - over.rect.top),
}
```

Both rects are dnd-kit-measured in the same viewport-relative space, so this needs no separate scroll-offset correction even though the Canvas panel scrolls (FR-020). This `localPosition` is what `ADD_NODE`/`MOVE_NODE` dispatch as `position` (`data-model.md`).

## Overlap policy

Snapping to `GRID_SNAP` is the **only** placement adjustment ever applied. The system never blocks, rejects, or auto-rearranges a Node's position because it overlaps another Node — whether the overlap comes from a direct drop (FR-010) or from a Frame's own auto-resize newly overlapping a sibling (resolved via `/speckit-clarify`, `spec.md` Clarifications session 2026-09-08). No collision-avoidance algorithm exists anywhere in this contract.

## Keyboard placement (FR-016, FR-017)

The *n*-th Node placed via keyboard into a given parent (0-indexed) lands at:

```
{ x: FRAME_PADDING + n * (2 * GRID_SNAP), y: FRAME_PADDING + n * (2 * GRID_SNAP) }
```

Deterministic and collision-free by construction (no check against existing positions is needed, since overlap is permitted). Fine-grained keyboard repositioning after placement is out of scope (`docs/03-BACKLOG.md`).

## Reducer changes

See `data-model.md`'s Actions table for the full per-action effect on `layout`. Summary:

- `ADD_NODE` / `MOVE_NODE` gain a `position: Layout` field; the reducer sets `layout[nodeId] = position`.
- `REQUEST_DELETE` (immediate) / `CONFIRM_DELETE` remove `layout` entries for the deleted Node and, for a cascade, every descendant — via the new `subtreeIds(tree, nodeId)` helper in `canvas-tree.ts`, called **before** `removeNode`.
- `RESTORE` gains a `layout: LayoutMap` field, set directly from the restored envelope.
- Moving a Node never touches its descendants' `layout` entries — they stay correct automatically because positions are parent-relative (`research.md`).

## Required test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Drop a `'card'`-kind Service onto an empty Canvas | Renders at `CARD_SIZE`, positioned at the (snapped) drop point |
| 2 | Drop a `'frame'`-kind Service onto an empty Canvas | Renders at `MIN_FRAME_SIZE` |
| 3 | Drop a Service into a Card-kind, childless Node | Accepted; that Node now renders as a Frame sized to enclose the new child, regardless of its Service's `renderKind` |
| 4 | Add a second child to an existing Frame | Frame's rendered size recomputes to enclose both children |
| 5 | Remove a Frame's only child | Frame's rendered size returns to its `renderKind`-driven empty-state size |
| 6 | Drag an existing Node to a new position within its current parent | `layout[nodeId]` updates; Canvas Tree structure (`MOVE_NODE`'s effect on `canvasTree`) is unchanged |
| 7 | Drag a Node from Frame A into Frame B, released at a specific point | Node reparents (as today's `MOVE_NODE`); `layout[nodeId]` is the drop point translated into Frame B's local coordinates |
| 8 | Drag a Frame containing several Nodes to a new position | Only the dragged Frame's own `layout` entry changes; every descendant's `layout` entry is untouched, and all render at the same position relative to the moved Frame |
| 9 | Drag one Card to overlap a sibling Card | Drop accepted; both remain visible, neither is nudged |
| 10 | A Frame's auto-resize (new child added) newly overlaps a sibling | Overlap accepted; the sibling is never nudged or rearranged |
| 11 | Delete a childless Node | Its `layout` entry is removed |
| 12 | Cascade-delete a Frame with several descendants | Every descendant's `layout` entry is removed, none orphaned |
| 13 | Place several Nodes exceeding the Canvas panel's visible area | The Canvas panel becomes scrollable; every Node remains reachable |
| 14 | Keyboard-assign three Services in sequence into the same empty Frame | Each lands at a distinct, deterministic position — never pixel-identical to the previous one |
| 15 | Drag a Node into a nested Frame (inside another Frame) | `deepestDroppableFirst` resolves to the innermost Frame under the pointer, not an ancestor — unchanged behavior from today |
