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

import type { Node, NodeId, RenderKind, ServiceId } from '@/domain/types';

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
export const CARD_SIZE: Size = { width: 160, height: 96 };
export const MIN_FRAME_SIZE: Size = { width: 220, height: 160 };
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

/**
 * The n-th (0-indexed) Node placed via keyboard into a given parent lands on
 * a deterministic diagonal cascade — never pixel-identical to the previous
 * one, with no collision check needed since overlap is already permitted.
 */
export function defaultPositionForKeyboardPlacement(childCount: number): Layout {
  const offset = childCount * (2 * GRID_SNAP);
  return { x: FRAME_PADDING + offset, y: FRAME_PADDING + offset };
}
