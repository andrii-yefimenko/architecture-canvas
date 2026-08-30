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
 */
export const deepestDroppableFirst: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

  const depthOf = (id: string | number): number => {
    const container = args.droppableContainers.find((c) => c.id === id);
    const depth = container?.data.current?.['depth'];
    return typeof depth === 'number' ? depth : -1;
  };

  return [...collisions].sort((a, b) => depthOf(b.id) - depthOf(a.id));
};
