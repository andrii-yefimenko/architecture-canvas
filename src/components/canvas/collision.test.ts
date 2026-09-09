/**
 * `deepestDroppableFirst` had no dedicated unit test before the v0.3.1 polish
 * pass — its depth-tiebreak behavior was only exercised indirectly through
 * integration tests. This file covers it directly, including the
 * self-collision exclusion fix (v0.3.1): a Node's own droppable must never
 * resolve as `over` for its own drag, which is what let a small drag get
 * silently rejected by `moveNode`'s cycle guard.
 */

import type { ClientRect, DroppableContainer } from '@dnd-kit/core';
import { deepestDroppableFirst } from './collision';

function rect(left: number, top: number, size = 100): ClientRect {
  return { left, top, right: left + size, bottom: top + size, width: size, height: size };
}

function container(id: string, r: ClientRect, depth: number): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: { depth } },
    disabled: false,
    node: { current: null },
    rect: { current: r },
  } as unknown as DroppableContainer;
}

function activeArgs(
  activeId: string,
  droppableContainers: DroppableContainer[],
  pointerCoordinates: { x: number; y: number },
  collisionRect: ClientRect,
) {
  return {
    active: { id: activeId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    collisionRect,
    droppableRects: new Map(droppableContainers.map((c) => [c.id, c.rect.current!])),
    droppableContainers,
    pointerCoordinates,
  } as Parameters<typeof deepestDroppableFirst>[0];
}

describe('deepestDroppableFirst — self-collision exclusion (v0.3.1)', () => {
  it('never resolves a Node as `over` for its own drag', () => {
    const own = container('n1', rect(0, 0), 0);
    const args = activeArgs('n1', [own], { x: 50, y: 50 }, rect(0, 0));

    const collisions = deepestDroppableFirst(args);

    expect(collisions.find((c) => c.id === 'n1')).toBeUndefined();
  });

  it('still resolves normally to a different droppable the pointer is also inside', () => {
    const own = container('n1', rect(0, 0), 1); // deeper, but it's the active Node
    const root = container('canvas-root', rect(-50, -50, 400), -1); // shallower, encloses everything
    const args = activeArgs('n1', [own, root], { x: 50, y: 50 }, rect(0, 0));

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('canvas-root');
    expect(collisions.find((c) => c.id === 'n1')).toBeUndefined();
  });
});

describe('deepestDroppableFirst — depth tiebreak (pre-existing behavior, research R-01)', () => {
  it('resolves to the deepest of several overlapping droppables the pointer sits inside', () => {
    const vpc = container('vpc', rect(0, 0, 300), 0);
    const subnet = container('subnet', rect(20, 20, 200), 1);
    // Neither is the dragged Node — a different Node is being dragged into them.
    const args = activeArgs('dragged', [vpc, subnet], { x: 100, y: 100 }, rect(80, 80, 40));

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('subnet');
  });

  it('falls back to rectIntersection when there are no pointer coordinates (keyboard drag)', () => {
    const vpc = container('vpc', rect(0, 0, 300), 0);
    const args = activeArgs('dragged', [vpc], { x: NaN, y: NaN }, rect(50, 50, 40));
    args.pointerCoordinates = null;

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('vpc');
  });
});
