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

// A compact, fixed-size square (CONTEXT.md's Card definition).
export const CARD_SIZE: Size = { width: 64, height: 64 };
export const MIN_FRAME_SIZE: Size = { width: 224, height: 160 };
// The canvas's one spacing constant: a Frame's inset from its own border to
// its children, AND the minimum clearance required between sibling Nodes
// (v0.3.4's gutter guarantee) — one number, two uses.
export const FRAME_PADDING = 16;

/**
 * Rounds to the nearest FRAME_PADDING increment — the only placement
 * adjustment ever applied. Deliberately decoupled from the gutter guarantee
 * (`hasClearance`, below): this step is purely how fine the placement grid
 * feels, not a promise about spacing between elements — a finer step here
 * doesn't relax the gutter, and a coarser one wouldn't tighten it (v0.3.4
 * revision — an earlier version conflated the two via a single `MODULE_STEP`
 * derived from `CARD_SIZE`, which felt too rigid in practice).
 */
export function snapToGrid(value: number): number {
  // `+ 0` normalizes a `-0` result (e.g. snapToGrid(-3)) to plain `0`.
  return Math.round(value / FRAME_PADDING) * FRAME_PADDING + 0;
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

/**
 * Whether placing `candidate` keeps at least FRAME_PADDING of clear space
 * from every rect in `siblingRects` — v0.3.4's gutter guarantee. A literal-
 * overlap test (`rectsOverlap`) against `candidate` inflated by the gutter
 * on all four sides.
 */
export function hasClearance(candidate: PositionedRect, siblingRects: readonly PositionedRect[]): boolean {
  const inflated: PositionedRect = {
    position: { x: candidate.position.x - FRAME_PADDING, y: candidate.position.y - FRAME_PADDING },
    size: { width: candidate.size.width + FRAME_PADDING * 2, height: candidate.size.height + FRAME_PADDING * 2 },
  };
  return !siblingRects.some((sibling) => rectsOverlap(inflated, sibling));
}

const MAX_FREE_SEARCH_RINGS = 50;

/** Every grid-aligned point on the square ring at `offset` around `center`, in perimeter order. */
function* ringCandidates(center: Layout, offset: number): Generator<Layout> {
  for (let x = center.x - offset; x <= center.x + offset; x += FRAME_PADDING) {
    yield { x, y: center.y - offset };
    yield { x, y: center.y + offset };
  }
  for (let y = center.y - offset + FRAME_PADDING; y <= center.y + offset - FRAME_PADDING; y += FRAME_PADDING) {
    yield { x: center.x - offset, y };
    yield { x: center.x + offset, y };
  }
}

/**
 * If `desired` (clamped to `minPosition`) already keeps clearance from every
 * `siblingRects` entry (`hasClearance`), returns it unchanged. Otherwise
 * searches outward in `FRAME_PADDING` increments (an expanding square ring)
 * for the nearest grid-aligned position that does. A candidate below
 * `minPosition` on either axis is never returned — defaults to `{0, 0}` (a
 * Node can't be dropped above/left of the Canvas origin); pass
 * `{x: FRAME_PADDING, y: FRAME_PADDING}` when placing into a Frame so a
 * child never lands flush against the Frame's own border/badge (v0.3.4
 * revision).
 *
 * Direct placement only (v0.3.1/ADR-0003, generalized in v0.3.4) — a Frame's
 * own auto-resize growing into a sibling is unaffected; see
 * docs/adr/0004-modular-placement-grid-and-gutters.md.
 *
 * If nothing is free within the search bound (50 rings × 16px), returns the
 * clamped `desired` unperturbed rather than searching forever — accepting
 * the closeness beats a stuck drag.
 */
export function findFreePosition(
  desired: Layout,
  size: Size,
  siblingRects: readonly PositionedRect[],
  minPosition: Layout = { x: 0, y: 0 },
): Layout {
  const clampedDesired: Layout = {
    x: Math.max(desired.x, minPosition.x),
    y: Math.max(desired.y, minPosition.y),
  };
  const isClear = (position: Layout) => hasClearance({ position, size }, siblingRects);

  if (isClear(clampedDesired)) return clampedDesired;

  for (let ring = 1; ring <= MAX_FREE_SEARCH_RINGS; ring++) {
    for (const candidate of ringCandidates(clampedDesired, ring * FRAME_PADDING)) {
      if (candidate.x < minPosition.x || candidate.y < minPosition.y) continue;
      if (isClear(candidate)) return candidate;
    }
  }

  return clampedDesired;
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
 * The position a drop at (`activeRect`, `overRect`) actually resolves to,
 * once clamped to the right `minPosition` floor and checked for sibling
 * clearance — the exact pipeline a real drop runs. Used by both the real
 * drop (`handleDragEnd`) and the live ghost preview (`handleDragOver`,
 * v0.3.5), so the two can never diverge: the preview always shows exactly
 * where the item will land, floor and gutter-search included.
 */
export function resolveDropPosition(
  tree: CanvasTree,
  layout: LayoutMap,
  renderKindOf: (serviceId: ServiceId) => RenderKind,
  activeRect: { readonly left: number; readonly top: number },
  overRect: { readonly left: number; readonly top: number },
  parentId: NodeId | null,
  size: Size,
  excludeNodeId: NodeId | null,
): Layout {
  const minPosition: Layout = parentId === null ? { x: 0, y: 0 } : { x: FRAME_PADDING, y: FRAME_PADDING };
  const raw = computeDropPosition(activeRect, overRect);
  const siblings = siblingRectsFor(tree, layout, renderKindOf, parentId, excludeNodeId);
  return findFreePosition(raw, size, siblings, minPosition);
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
