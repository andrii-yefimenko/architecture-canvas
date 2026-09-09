/**
 * Canvas layout — a Node's position on the Canvas, and the pure math around it.
 *
 * Lives here rather than in `src/domain/` even though it's framework-free:
 * per CONTEXT.md, Layout is presentation data no Rule ever evaluates, so it
 * stays outside the boundary reserved for what the Evaluation reasons about.
 * See this feature's research.md, "module-placement decision" section.
 *
 * Coordinates are local to a Node's own parent (the Canvas root is the origin
 * for root-level Nodes). A Node's rendered *size* is never stored: a Card is
 * a fixed constant, and a Frame's size is always derived from its children
 * via computeContentSize — see contracts/canvas-layout.md.
 */

import { findNode } from '@/domain/canvas-tree';
import type { CanvasTree, Node, NodeId, RenderKind, ServiceId } from '@/domain/types';

export interface Layout {
  readonly x: number;
  readonly y: number;
}

export type LayoutMap = Readonly<Record<NodeId, Layout>>;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export const GRID_SNAP = 8;
// A compact, fixed-size square (CONTEXT.md's Card definition) — 64 = 8 × GRID_SNAP.
export const CARD_SIZE: Size = { width: 64, height: 64 };
// 224 = 28 × GRID_SNAP (was 220, not grid-aligned).
export const MIN_FRAME_SIZE: Size = { width: 224, height: 160 };
export const FRAME_PADDING = 16;

/** Rounds to the nearest GRID_SNAP increment — the only placement adjustment ever applied. */
export function snapToGrid(value: number): number {
  // `+ 0` normalizes a `-0` result (e.g. snapToGrid(-3)) to plain `0`.
  return Math.round(value / GRID_SNAP) * GRID_SNAP + 0;
}

/**
 * Bounding box of `children`'s positions and rendered sizes, plus
 * FRAME_PADDING, floored at MIN_FRAME_SIZE. The single derivation used both
 * for a Frame's size and for the Canvas root's own rendered content size
 * (FR-003, FR-020).
 */
export function computeContentSize(
  children: readonly { position: Layout; size: Size }[],
): Size {
  if (children.length === 0) return MIN_FRAME_SIZE;

  const maxRight = Math.max(...children.map((c) => c.position.x + c.size.width));
  const maxBottom = Math.max(...children.map((c) => c.position.y + c.size.height));

  return {
    width: Math.max(maxRight + FRAME_PADDING, MIN_FRAME_SIZE.width),
    height: Math.max(maxBottom + FRAME_PADDING, MIN_FRAME_SIZE.height),
  };
}

/**
 * Where a drag ends, in the target's local coordinates: the dragged
 * element's final on-screen position minus the target's own on-screen
 * position — both measured in the same viewport-relative space, so this
 * needs no separate scroll-offset correction (research.md).
 */
export function computeDropPosition(
  activeRect: { readonly left: number; readonly top: number },
  overRect: { readonly left: number; readonly top: number },
): Layout {
  return {
    x: snapToGrid(activeRect.left - overRect.left),
    y: snapToGrid(activeRect.top - overRect.top),
  };
}

/**
 * A Node's on-canvas appearance: a Frame the moment it has at least one
 * child, regardless of its Service's default — its own `renderKind`
 * otherwise (FR-002).
 */
export function effectiveRenderKind(childCount: number, defaultRenderKind: RenderKind): RenderKind {
  return childCount > 0 ? 'frame' : defaultRenderKind;
}

/**
 * A Node's rendered size: recursively derived from its children (any Node
 * with children, regardless of `renderKind`), or its Service's fixed
 * empty-state size otherwise. `renderKindOf` looks up a Service's default
 * appearance by id.
 */
export function computeNodeSize(
  node: Node,
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
): Size {
  if (node.children.length > 0) {
    return computeContentSize(
      node.children.map((child) => ({
        position: layout[child.id] ?? { x: 0, y: 0 },
        size: computeNodeSize(child, layout, renderKindOf),
      })),
    );
  }
  return renderKindOf(node.serviceId) === 'frame' ? MIN_FRAME_SIZE : CARD_SIZE;
}

/** The Canvas root's own rendered content size — the same derivation, one level up (FR-020). */
export function computeRootContentSize(
  roots: readonly Node[],
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
): Size {
  return computeContentSize(
    roots.map((node) => ({
      position: layout[node.id] ?? { x: 0, y: 0 },
      size: computeNodeSize(node, layout, renderKindOf),
    })),
  );
}

export interface PositionedRect {
  readonly position: Layout;
  readonly size: Size;
}

/** Axis-aligned bounding-box overlap test. */
export function rectsOverlap(a: PositionedRect, b: PositionedRect): boolean {
  return (
    a.position.x < b.position.x + b.size.width &&
    a.position.x + a.size.width > b.position.x &&
    a.position.y < b.position.y + b.size.height &&
    a.position.y + a.size.height > b.position.y
  );
}

const MAX_FREE_SEARCH_RINGS = 50;

/** Every grid-aligned point on the square ring at `offset` around `center`, in perimeter order. */
function* ringCandidates(center: Layout, offset: number): Generator<Layout> {
  for (let x = center.x - offset; x <= center.x + offset; x += GRID_SNAP) {
    yield { x, y: center.y - offset };
    yield { x, y: center.y + offset };
  }
  for (let y = center.y - offset + GRID_SNAP; y <= center.y + offset - GRID_SNAP; y += GRID_SNAP) {
    yield { x: center.x - offset, y };
    yield { x: center.x + offset, y };
  }
}

/**
 * If `desired` doesn't overlap any `siblingRects` entry, returns it
 * unchanged. Otherwise searches outward from `desired` in `GRID_SNAP`
 * increments (an expanding square ring) for the nearest non-overlapping,
 * grid-aligned position. Negative coordinates are never returned — a Node
 * can't be dropped above/left of the Canvas origin.
 *
 * Direct drags only (v0.3.1) — a Frame's own auto-resize growing into a
 * sibling is unaffected; see docs/adr/0003-auto-snap-overlap-on-drop.md.
 *
 * If nothing is free within the search bound, returns `desired` unperturbed
 * rather than searching forever — accepting the overlap beats a stuck drag.
 */
export function findFreePosition(
  desired: Layout,
  size: Size,
  siblingRects: readonly PositionedRect[],
): Layout {
  const overlapsAny = (position: Layout) =>
    siblingRects.some((sibling) => rectsOverlap({ position, size }, sibling));

  if (!overlapsAny(desired)) return desired;

  for (let ring = 1; ring <= MAX_FREE_SEARCH_RINGS; ring++) {
    for (const candidate of ringCandidates(desired, ring * GRID_SNAP)) {
      if (candidate.x < 0 || candidate.y < 0) continue;
      if (!overlapsAny(candidate)) return candidate;
    }
  }

  return desired;
}

/**
 * `parentId`'s current children (or the Canvas root's, for `null`), minus
 * `excludeNodeId`, each with its position and rendered size — what a direct
 * drop into that parent must avoid overlapping (v0.3.1, ADR-0003). Feeds
 * `findFreePosition`. `excludeNodeId` matters for a `MOVE_NODE`: a Node being
 * repositioned must never be checked against its own current rect.
 */
export function siblingRectsFor(
  tree: CanvasTree,
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
  parentId: NodeId | null,
  excludeNodeId: NodeId | null,
): PositionedRect[] {
  const siblings: readonly Node[] =
    parentId === null ? tree.roots : (findNode(tree, parentId)?.children ?? []);

  return siblings
    .filter((sibling) => sibling.id !== excludeNodeId)
    .map((sibling) => ({
      position: layout[sibling.id] ?? { x: 0, y: 0 },
      size: computeNodeSize(sibling, layout, renderKindOf),
    }));
}

/**
 * The Frame `targetNode` would become if `draggedSize` were dropped into it
 * at `draggedPosition`, alongside its current children — v0.3.1's ghost
 * preview (docs/adr/0003-auto-snap-overlap-on-drop.md's sibling decision).
 * `excludeNodeId` matters when the dragged item is itself already one of
 * `targetNode`'s children (repositioning within the same parent).
 *
 * Returns `null` when the projection doesn't exceed the target's current
 * rendered size on either axis — nothing to preview. Purely a projection:
 * never reads or writes any persisted state, and computing it never mutates
 * `layout`.
 */
export function computeDragPreviewSize(
  targetNode: Node,
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
  draggedPosition: Layout,
  draggedSize: Size,
  excludeNodeId: NodeId | null,
): Size | null {
  const existingChildren = targetNode.children
    .filter((child) => child.id !== excludeNodeId)
    .map((child) => ({
      position: layout[child.id] ?? { x: 0, y: 0 },
      size: computeNodeSize(child, layout, renderKindOf),
    }));

  const projected = computeContentSize([...existingChildren, { position: draggedPosition, size: draggedSize }]);
  const current = computeNodeSize(targetNode, layout, renderKindOf);

  if (projected.width <= current.width && projected.height <= current.height) return null;
  return projected;
}

/**
 * The size a dragged item should be treated as — for sizing math (auto-snap,
 * the ghost preview, v0.3.2's cursor-following overlay) and nothing else.
 * A `service` drag (new Node, not yet in the tree) has no children yet, so
 * it's always its Service's fixed empty-state size; a `node` drag (an
 * existing, possibly-populated Node) uses its real current rendered size.
 */
export function computeDraggedItemSize(
  dragged: { readonly kind: 'service'; readonly serviceId: ServiceId } | { readonly kind: 'node'; readonly nodeId: NodeId },
  tree: CanvasTree,
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
): Size {
  if (dragged.kind === 'service') {
    return renderKindOf(dragged.serviceId) === 'frame' ? MIN_FRAME_SIZE : CARD_SIZE;
  }
  const movedNode = findNode(tree, dragged.nodeId);
  return movedNode ? computeNodeSize(movedNode, layout, renderKindOf) : CARD_SIZE;
}

/**
 * The n-th (0-indexed) Node placed via keyboard into a given parent lands on
 * a deterministic diagonal cascade — never pixel-identical to the previous
 * one, with no collision check needed since overlap is already permitted.
 */
export function defaultPositionForKeyboardPlacement(childCount: number): Layout {
  const offset = childCount * (2 * GRID_SNAP);
  return { x: FRAME_PADDING + offset, y: FRAME_PADDING + offset };
}
