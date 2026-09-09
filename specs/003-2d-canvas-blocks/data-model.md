# Phase 1 Data Model: 2D Spatial Canvas Blocks

**Date**: 2026-09-08 | **Plan**: [plan.md](./plan.md)

Extends `specs/001-architecture-canvas-mvp/data-model.md` and `specs/002-multi-challenge-catalog/`'s (which added no data model of its own beyond the Challenge Registry). Type names follow `CONTEXT.md`. **`src/domain/types.ts` gains one field** (`Service.renderKind`); everything else new lives in `src/state/`, per [research.md](./research.md)'s module-placement decision.

## Service *(extended)*

| Field | Type | Notes |
|---|---|---|
| `id` | `ServiceId` | Unchanged |
| `name` | `string` | Unchanged |
| `category` | `string` | Unchanged — Services panel grouping, unrelated to rendering |
| `renderKind` | `'frame' \| 'card'` | **New.** The Service's default, empty-state on-canvas appearance. See [contracts/challenge.md](./contracts/challenge.md) for the assignment rule and per-Challenge values. |

```ts
export type RenderKind = 'frame' | 'card';

export interface Service {
  readonly id: ServiceId;
  readonly name: string;
  readonly category: string;
  readonly renderKind: RenderKind;
}
```

`Node`, `CanvasTree`, `Challenge`, `HiddenRequirementCategory`, `Rule`, `Evaluation` are **entirely unchanged** — see `specs/001-architecture-canvas-mvp/data-model.md`. This feature adds no new Rule kind and does not touch `src/domain/evaluator.ts` (`FR-018`, `FR-019`).

## Layout *(new)*

A Node's position on the Canvas, local to its parent (Canvas root is the origin for root-level Nodes). Lives in `src/state/layout.ts`.

```ts
export interface Layout {
  readonly x: number;
  readonly y: number;
}

export type LayoutMap = Readonly<Record<NodeId, Layout>>;
```

Only `{x, y}` — a Node's rendered *size* is never stored. See [research.md](./research.md)'s "Coordinate space and storage shape" decision for why: a Card's size is a fixed constant, and a Frame's size is always derived (below), so storing it would only ever be a stale cache.

### Rendered size (derived, not stored)

```ts
export const CARD_SIZE = { width: 160, height: 96 } as const;
export const MIN_FRAME_SIZE = { width: 220, height: 160 } as const;
export const FRAME_PADDING = 16;
export const GRID_SNAP = 8;

export function snapToGrid(value: number): number; // rounds to the nearest GRID_SNAP

/** Bounding box of `children`'s positions + rendered sizes, plus FRAME_PADDING, floored at MIN_FRAME_SIZE. */
export function computeContentSize(
  children: readonly { position: Layout; size: { width: number; height: number } }[],
): { width: number; height: number };
```

- A Node with no children renders at `CARD_SIZE` if its Service's `renderKind` is `'card'`, or `MIN_FRAME_SIZE` if `'frame'` (`FR-001`, `FR-004`, `FR-005`).
- A Node with **any** children always renders at `computeContentSize(...)` of those children, regardless of its Service's `renderKind` (`FR-002`, `FR-003`) — the Card→Frame promotion from the spec's User Story 1 Acceptance Scenario 4 falls out of this rule with no separate branch.
- The Canvas root's own rendered content size uses the same `computeContentSize` over its root-level Nodes, which is what gives the already-`overflow-auto` Canvas panel something real to scroll to (`FR-020`).

## SessionState *(extended)*

Extends `specs/001-architecture-canvas-mvp/data-model.md`'s table with one new field:

| Field | Type | Notes |
|---|---|---|
| `canvasTree` | `CanvasTree` | Unchanged |
| `revealedCategories` | `CategoryId[]` | Unchanged |
| `evaluation` | `Evaluation \| null` | Unchanged |
| `evaluationStale` | `boolean` | Unchanged |
| `pendingDeletion` | `NodeId \| null` | Unchanged |
| `layout` | `LayoutMap` | **New.** Persisted alongside `canvasTree` (`FR-012`, `FR-013`). Every key present in `canvasTree` has a corresponding entry; no orphaned entries for Nodes that no longer exist. |

### Actions *(changed)*

```ts
export type SessionAction =
  | { type: 'ADD_NODE'; serviceId: ServiceId; parentId: NodeId | null; position: Layout }   // CHANGED — gains `position`
  | { type: 'MOVE_NODE'; nodeId: NodeId; newParentId: NodeId | null; position: Layout }      // CHANGED — gains `position`
  | { type: 'REQUEST_DELETE'; nodeId: NodeId }        // unchanged signature; effect extended (below)
  | { type: 'CANCEL_DELETE' }                          // unchanged
  | { type: 'CONFIRM_DELETE' }                          // unchanged signature; effect extended (below)
  | { type: 'REVEAL_CATEGORY'; categoryId: CategoryId } // unchanged
  | { type: 'SUBMIT'; evaluation: Evaluation }          // unchanged
  | { type: 'RESTORE'; canvasTree: CanvasTree; revealedCategories: readonly CategoryId[]; layout: LayoutMap }; // CHANGED — gains `layout`
```

| Action | Effect on `layout` |
|---|---|
| `ADD_NODE` | Sets `layout[newNodeId] = position` (the id `addNode` in `canvas-tree.ts` generates). |
| `MOVE_NODE` | Sets `layout[nodeId] = position`. **No other entry changes** — descendants keep their existing parent-relative positions unchanged, so a dragged Frame visually carries its contents for free (`FR-008`, User Story 2 AS4). |
| `REQUEST_DELETE` (immediate, no children) | Removes `layout[nodeId]`. |
| `CONFIRM_DELETE` (cascading) | Removes `layout` entries for `nodeId` **and every descendant**, computed via the new `subtreeIds(tree, nodeId)` helper against the tree *before* `removeNode` runs (`FR-015`). |
| `CANCEL_DELETE`, `REVEAL_CATEGORY`, `SUBMIT` | Unchanged — `layout` untouched. |
| `RESTORE` | Sets `layout` from the restored envelope, matching how `canvasTree`/`revealedCategories` are already restored. |

## Canvas Tree operations *(one addition)*

`src/domain/canvas-tree.ts` gains one pure helper, alongside `findNode`/`isDescendant`/`countNodes`:

```ts
/** Every NodeId in nodeId's subtree, nodeId included. Depth-first, order not significant. */
export function subtreeIds(tree: CanvasTree, nodeId: NodeId): NodeId[];
```

Generic tree math with no knowledge of `Layout` — it exists so the reducer can capture "what's about to be removed" from the current tree before calling the existing `removeNode`, which returns a tree that no longer contains it. Framework-free, inside the existing domain-purity boundary (`eslint.config.js`) unchanged.

## Persisted envelope *(extended)*

Full contract in [contracts/persistence.md](./contracts/persistence.md), which supersedes `specs/002-multi-challenge-catalog/contracts/persistence.md`.

```ts
export interface PersistedSession {
  readonly canvasTree: CanvasTree;
  readonly revealedCategories: readonly CategoryId[];
  readonly layout: LayoutMap; // NEW
}
```

`SESSION_VERSION` bumps `1` → `2`. One key per Challenge, unchanged key format (`architecture-canvas:session:${challengeId}`). A version mismatch, a `challengeId` mismatch, a structurally invalid `canvasTree`/`revealedCategories`, **or** a `layout` entry not matching a Node present in `canvasTree` discards the entire envelope — the same all-or-nothing rule, one more check.
