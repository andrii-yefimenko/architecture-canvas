import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';

/**
 * Collision detection for arbitrarily nested droppable containers.
 *
 * `pointerWithin` first, per dnd-kit's guidance for high-precision interfaces,
 * with `rectIntersection` as the fallback it recommends composing — a bare
 * pointerWithin returns nothing once the pointer leaves every rect, and the
 * keyboard sensor needs the fallback.
 *
 * Nested Nodes produce overlapping droppables, so the pointer is legitimately
 * inside several at once. **Greatest tree depth wins**: a user dragging into a
 * Subnet that sits inside a VPC means the Subnet, never the VPC. dnd-kit's
 * default `closestCenter` gets this backwards — for a small Node inside a large
 * container, the parent's centre is often nearer.
 *
 * Depth is carried in each droppable's `data` (Canvas root is -1, so every real
 * Node outranks it). See research.md R-01.
 *
 * The dragged Node's own droppable is excluded from candidates. Every Node is
 * both draggable and droppable on the same id (CanvasNode.tsx), and dnd-kit
 * doesn't reflow the DOM during a drag — the dragged Node's droppable rect
 * stays at its original position for the whole gesture. Without this
 * exclusion, a small drag that never leaves that original rect resolves
 * `over.id === active.id`, which `moveNode`'s cycle guard then rejects
 * outright — silently discarding the position update along with it. See
 * docs/adr/0003-auto-snap-overlap-on-drop.md's v0.3.1 polish context.
 */
export const deepestDroppableFirst: CollisionDetection = (args) => {
  const candidates = {
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.id !== args.active.id),
  };

  const pointerCollisions = pointerWithin(candidates);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(candidates);

  const depthOf = (id: string | number): number => {
    const container = candidates.droppableContainers.find((c) => c.id === id);
    const depth = container?.data.current?.['depth'];
    return typeof depth === 'number' ? depth : -1;
  };

  return [...collisions].sort((a, b) => depthOf(b.id) - depthOf(a.id));
};
