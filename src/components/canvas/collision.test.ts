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

  it('resolves via rectIntersection even with no pointer coordinates at all (keyboard drag)', () => {
    const vpc = container('vpc', rect(0, 0, 300), 0);
    const args = activeArgs('dragged', [vpc], { x: NaN, y: NaN }, rect(50, 50, 40));
    args.pointerCoordinates = null;

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('vpc');
  });
});

describe('deepestDroppableFirst — dragged-bounds-first collision (v0.3.5)', () => {
  it("registers a Frame collision as soon as the dragged Node's rect touches it, before the pointer itself crosses the border", () => {
    // A user grabbing a Card by its center/right side drags its LEFT edge
    // into a Frame well before the pointer tip does. The Frame spans
    // x:[100,300); the dragged Card's rect already overlaps it (x:[80,144)),
    // but the pointer itself is still outside, at x:90 — the exact scenario
    // that silently failed to register under pointerWithin-first detection.
    const frame = container('vpc', rect(100, 100, 200), 0);
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    const args = activeArgs('dragged', [root, frame], { x: 90, y: 120 }, {
      left: 80,
      top: 100,
      right: 144,
      bottom: 164,
      width: 64,
      height: 64,
    });

    const collisions = deepestDroppableFirst(args);

    expect(collisions.find((c) => c.id === 'vpc')).toBeDefined();
    expect(collisions[0]?.id).toBe('vpc'); // deepest match wins over the root
  });

  it("does not register a Frame collision when the dragged Node's rect hasn't reached it yet", () => {
    const frame = container('vpc', rect(100, 100, 200), 0);
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    // The Card's rect ends at x:96 — still short of the Frame's x:100 start.
    const args = activeArgs('dragged', [root, frame], { x: 80, y: 120 }, {
      left: 32,
      top: 100,
      right: 96,
      bottom: 164,
      width: 64,
      height: 64,
    });

    const collisions = deepestDroppableFirst(args);

    expect(collisions.find((c) => c.id === 'vpc')).toBeUndefined();
    expect(collisions[0]?.id).toBe('canvas-root');
  });
});

describe('deepestDroppableFirst — nesting intent threshold (v0.3.6, ADR-0005)', () => {
  it('a Frame that clears the threshold (center inside) wins over the root', () => {
    const frame = container('vpc', rect(0, 0, 300), 0);
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    // Dragged rect's center (32,32) is inside the Frame.
    const collisionRect: ClientRect = { left: 0, top: 0, right: 64, bottom: 64, width: 64, height: 64 };
    const args = activeArgs('dragged', [root, frame], { x: 32, y: 32 }, collisionRect);

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('vpc');
  });

  it("a Frame that merely touches the dragged rect's edge (below threshold) falls back to the root", () => {
    const frame = container('vpc', rect(100, 100, 300), 0);
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    // Dragged rect only clips the Frame's corner: small overlap, center well outside.
    const collisionRect: ClientRect = { left: 50, top: 50, right: 114, bottom: 114, width: 64, height: 64 };
    const args = activeArgs('dragged', [root, frame], { x: 82, y: 82 }, collisionRect);

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('canvas-root');
  });

  it('a non-qualifying Subnet falls back to its qualifying parent VPC, not straight to the root', () => {
    const vpc = container('vpc', rect(0, 0, 400), 0);
    // Subnet occupies a corner of the VPC; the dragged rect only clips the Subnet's edge.
    const subnet = container('subnet', rect(300, 300, 100), 1); // spans (300,300)-(400,400)
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    // Dragged rect (64x64) spans (250,250)-(314,314), center at (282,282):
    // outside the Subnet (which starts at 300), with only a 14x14 corner
    // (196 / 4096 ≈ 4.8%) overlapping it — doesn't qualify. Its center is
    // comfortably inside the much larger VPC, which does.
    const collisionRect: ClientRect = { left: 250, top: 250, right: 314, bottom: 314, width: 64, height: 64 };
    const args = activeArgs('dragged', [root, vpc, subnet], { x: 282, y: 282 }, collisionRect);

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('vpc');
  });

  it('the Canvas root is always a valid fallback, exempt from the threshold', () => {
    const root = container('canvas-root', rect(-500, -500, 2000), -1);
    const collisionRect: ClientRect = { left: 0, top: 0, right: 64, bottom: 64, width: 64, height: 64 };
    const args = activeArgs('dragged', [root], { x: 32, y: 32 }, collisionRect);

    const collisions = deepestDroppableFirst(args);

    expect(collisions[0]?.id).toBe('canvas-root');
  });
});
