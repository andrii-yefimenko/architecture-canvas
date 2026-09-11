import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';
import { meetsNestingThreshold } from '@/state/layout';

/**
 * Collision detection for arbitrarily nested droppable containers.
 *
 * `rectIntersection` first (v0.3.5): a Frame must register as a collision
 * the moment the *dragged Node's own bounding box* touches it, not only once
 * the pointer tip itself crosses the border. `pointerWithin`-first (the
 * v0.3.0–v0.3.4 behavior) never actually achieved that: the Canvas root's
 * droppable covers essentially the whole panel, so `pointerWithin` almost
 * always found *something* (the root, if nothing more specific) the instant
 * the pointer was anywhere inside the canvas — meaning the code's own
 * fallback to `rectIntersection` essentially never ran, and a Card dragged
 * by its center or right edge wouldn't register a Frame collision until the
 * pointer itself physically entered the Frame, well after the Card's
 * leading edge already had. `pointerWithin` now only matters as the
 * fallback for the rare case `rectIntersection` finds nothing at all (e.g.
 * a drag that has left every droppable's bounds).
 *
 * Nested Nodes produce overlapping droppables, so a dragged Node's rect can
 * legitimately intersect several at once. **Greatest tree depth wins**: a
 * user dragging into a Subnet that sits inside a VPC means the Subnet,
 * never the VPC. dnd-kit's default `closestCenter` gets this backwards —
 * for a small Node inside a large container, the parent's centre is often
 * nearer.
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
 *
 * A non-root candidate must also clear `meetsNestingThreshold` (v0.3.6): the
 * dragged rect's center inside it, or at least half the dragged rect's own
 * area overlapping it. Merely touching a Frame's edge (what `rectIntersection`
 * alone tests) isn't real containment intent — a candidate that fails this
 * is filtered out, so resolution falls through to whichever shallower
 * candidate (eventually the Canvas root, always exempt) does qualify. This
 * governs the live ghost preview too, since `handleDragOver` and
 * `handleDragEnd` both resolve `over` through this same function — hover
 * and the real drop can never disagree about which Frame is the target. See
 * docs/adr/0005-directional-push-displacement.md.
 */
export const deepestDroppableFirst: CollisionDetection = (args) => {
  const candidates = {
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.id !== args.active.id),
  };

  const rectCollisions = rectIntersection(candidates);
  const collisions = rectCollisions.length > 0 ? rectCollisions : pointerWithin(candidates);

  const depthOf = (id: string | number): number => {
    const container = candidates.droppableContainers.find((c) => c.id === id);
    const depth = container?.data.current?.['depth'];
    return typeof depth === 'number' ? depth : -1;
  };

  const qualifies = (id: string | number): boolean => {
    if (depthOf(id) < 0) return true; // Canvas root: always a valid fallback, no threshold.
    const targetRect = candidates.droppableContainers.find((c) => c.id === id)?.rect.current;
    if (!targetRect || !args.collisionRect) return false;
    return meetsNestingThreshold(args.collisionRect, targetRect);
  };

  const qualified = collisions.filter((c) => qualifies(c.id));
  const resolved = qualified.length > 0 ? qualified : collisions;

  return [...resolved].sort((a, b) => depthOf(b.id) - depthOf(a.id));
};
