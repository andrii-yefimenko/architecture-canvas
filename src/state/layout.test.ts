import type { Node } from '@/domain/types';
import {
  CARD_SIZE,
  FRAME_PADDING,
  MIN_FRAME_SIZE,
  computeContentSize,
  computeDraggedItemSize,
  computeDragPreviewSize,
  computeDropPosition,
  computeNodeSize,
  computeRootContentSize,
  effectiveRenderKind,
  findFreePosition,
  hasClearance,
  rectsOverlap,
  resolveDropPosition,
  siblingRectsFor,
  snapToGrid,
  type PositionedRect,
} from './layout';

const renderKindOf = (serviceId: string) => (serviceId === 'vpc' ? 'frame' : 'card');

function node(id: string, serviceId: string, children: Node[] = []): Node {
  return { id, serviceId, children };
}

describe('snapToGrid (v0.3.4 revision — decoupled from the gutter guarantee)', () => {
  it('rounds to the nearest FRAME_PADDING increment', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(6)).toBe(0);
    expect(snapToGrid(10)).toBe(FRAME_PADDING);
    expect(snapToGrid(20)).toBe(FRAME_PADDING);
    expect(snapToGrid(26)).toBe(2 * FRAME_PADDING);
  });

  it('handles negative values', () => {
    expect(snapToGrid(-6)).toBe(0);
    expect(snapToGrid(-10)).toBe(-FRAME_PADDING);
  });
});

describe('computeContentSize', () => {
  it('returns MIN_FRAME_SIZE for no children (contracts/canvas-layout.md case 4)', () => {
    expect(computeContentSize([])).toEqual(MIN_FRAME_SIZE);
  });

  it('wraps a single child in FRAME_PADDING, floored at MIN_FRAME_SIZE', () => {
    const size = computeContentSize([{ position: { x: 0, y: 0 }, size: CARD_SIZE }]);
    // A single Card is smaller than MIN_FRAME_SIZE, so the floor applies.
    expect(size).toEqual(MIN_FRAME_SIZE);
  });

  it('grows to enclose several children plus padding', () => {
    const size = computeContentSize([
      { position: { x: 0, y: 0 }, size: CARD_SIZE },
      { position: { x: 300, y: 300 }, size: CARD_SIZE },
    ]);
    expect(size).toEqual({
      width: 300 + CARD_SIZE.width + FRAME_PADDING,
      height: 300 + CARD_SIZE.height + FRAME_PADDING,
    });
  });

  it('uses the furthest-extending child on each axis independently', () => {
    const size = computeContentSize([
      { position: { x: 500, y: 0 }, size: { width: 50, height: 50 } },
      { position: { x: 0, y: 500 }, size: { width: 50, height: 50 } },
    ]);
    expect(size).toEqual({
      width: 500 + 50 + FRAME_PADDING,
      height: 500 + 50 + FRAME_PADDING,
    });
  });
});

describe('computeDropPosition', () => {
  it('is the difference between the dragged and target rects, snapped to the grid', () => {
    const position = computeDropPosition({ left: 120, top: 84 }, { left: 100, top: 60 });
    expect(position).toEqual({ x: snapToGrid(20), y: snapToGrid(24) });
  });

  it('is zero when the dragged element lands exactly at the target origin', () => {
    expect(computeDropPosition({ left: 50, top: 50 }, { left: 50, top: 50 })).toEqual({ x: 0, y: 0 });
  });
});

describe('effectiveRenderKind', () => {
  it('is the Service default while childless', () => {
    expect(effectiveRenderKind(0, 'card')).toBe('card');
    expect(effectiveRenderKind(0, 'frame')).toBe('frame');
  });

  it('is always frame once there is at least one child, regardless of default (FR-002)', () => {
    expect(effectiveRenderKind(1, 'card')).toBe('frame');
    expect(effectiveRenderKind(3, 'card')).toBe('frame');
  });
});

describe('computeNodeSize', () => {
  it('is CARD_SIZE for a childless card-kind Node', () => {
    expect(computeNodeSize(node('a', 'ec2-frontend'), {}, renderKindOf)).toEqual(CARD_SIZE);
  });

  it('is MIN_FRAME_SIZE for a childless frame-kind Node', () => {
    expect(computeNodeSize(node('a', 'vpc'), {}, renderKindOf)).toEqual(MIN_FRAME_SIZE);
  });

  it('promotes a card-kind Node with a child to an auto-sized Frame (contracts/canvas-layout.md case 3)', () => {
    const child = node('b', 'ec2-frontend');
    const parent = node('a', 'ec2-frontend', [child]);
    const layout = { b: { x: 0, y: 0 } };

    const size = computeNodeSize(parent, layout, renderKindOf);
    expect(size).not.toEqual(CARD_SIZE);
    expect(size).toEqual(computeContentSize([{ position: { x: 0, y: 0 }, size: CARD_SIZE }]));
  });

  it('recurses through nested Frames (contracts/canvas-layout.md case 4)', () => {
    const grandchild = node('c', 'ec2-frontend');
    const child = node('b', 'vpc', [grandchild]);
    const parent = node('a', 'vpc', [child]);
    const layout = { b: { x: 0, y: 0 }, c: { x: 500, y: 500 } };

    const size = computeNodeSize(parent, layout, renderKindOf);
    // The grandchild's far position forces the middle Frame to grow, which
    // in turn forces the outer Frame to grow to enclose it.
    expect(size.width).toBeGreaterThan(MIN_FRAME_SIZE.width);
    expect(size.height).toBeGreaterThan(MIN_FRAME_SIZE.height);
  });

  it('treats a missing layout entry as the origin rather than throwing', () => {
    const child = node('b', 'ec2-frontend');
    const parent = node('a', 'vpc', [child]);
    expect(() => computeNodeSize(parent, {}, renderKindOf)).not.toThrow();
  });
});

describe('computeRootContentSize', () => {
  it('is MIN_FRAME_SIZE for an empty Canvas', () => {
    expect(computeRootContentSize([], {}, renderKindOf)).toEqual(MIN_FRAME_SIZE);
  });

  it('encloses every root Node (FR-020)', () => {
    const roots = [node('a', 'ec2-frontend'), node('b', 'ec2-frontend')];
    const layout = { a: { x: 0, y: 0 }, b: { x: 800, y: 800 } };
    const size = computeRootContentSize(roots, layout, renderKindOf);
    expect(size.width).toBeGreaterThan(800);
    expect(size.height).toBeGreaterThan(800);
  });
});

describe('rectsOverlap', () => {
  it('is true for two identical rects', () => {
    const r: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    expect(rectsOverlap(r, r)).toBe(true);
  });

  it('is true for a partial overlap', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } };
    const b: PositionedRect = { position: { x: 50, y: 50 }, size: { width: 100, height: 100 } };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('is false for rects that only touch at an edge', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } };
    const b: PositionedRect = { position: { x: 100, y: 0 }, size: { width: 100, height: 100 } };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('is false for rects with clear space between them', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: { width: 50, height: 50 } };
    const b: PositionedRect = { position: { x: 200, y: 200 }, size: { width: 50, height: 50 } };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

describe('findFreePosition (v0.3.1/ADR-0003, generalized in v0.3.4/ADR-0004)', () => {
  it('returns the desired position unperturbed when there are no siblings', () => {
    expect(findFreePosition({ x: 40, y: 40 }, CARD_SIZE, [])).toEqual({ x: 40, y: 40 });
  });

  it('returns the desired position unperturbed when it already clears every sibling', () => {
    const siblings: PositionedRect[] = [{ position: { x: 500, y: 500 }, size: CARD_SIZE }];
    expect(findFreePosition({ x: 0, y: 0 }, CARD_SIZE, siblings)).toEqual({ x: 0, y: 0 });
  });

  it('nudges to the nearest grid-aligned slot with clearance when the desired spot is taken', () => {
    // A grid-aligned desired position (FRAME_PADDING itself), so alignment
    // checks below are meaningful.
    const occupied: PositionedRect = { position: { x: FRAME_PADDING, y: FRAME_PADDING }, size: CARD_SIZE };
    const found = findFreePosition({ x: FRAME_PADDING, y: FRAME_PADDING }, CARD_SIZE, [occupied]);

    expect(found).not.toEqual({ x: FRAME_PADDING, y: FRAME_PADDING });
    // Grid-aligned.
    expect(found.x % FRAME_PADDING).toBe(0);
    expect(found.y % FRAME_PADDING).toBe(0);
    // Genuinely clear, gutter included.
    expect(hasClearance({ position: found, size: CARD_SIZE }, [occupied])).toBe(true);
  });

  it('never returns a negative coordinate', () => {
    const occupied: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const found = findFreePosition({ x: 0, y: 0 }, CARD_SIZE, [occupied]);
    expect(found.x).toBeGreaterThanOrEqual(0);
    expect(found.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps the desired position up to minPosition on both axes (v0.3.4 revision)', () => {
    const found = findFreePosition({ x: 0, y: 0 }, CARD_SIZE, [], { x: FRAME_PADDING, y: FRAME_PADDING });
    expect(found).toEqual({ x: FRAME_PADDING, y: FRAME_PADDING });
  });

  it('never returns a candidate below minPosition even when searching for a clear spot', () => {
    const minPosition = { x: FRAME_PADDING, y: FRAME_PADDING };
    // Occupies the clamped desired position itself, forcing the ring search
    // to explore in every direction — including back toward the floor.
    const occupied: PositionedRect = { position: minPosition, size: CARD_SIZE };
    const found = findFreePosition({ x: 0, y: 0 }, CARD_SIZE, [occupied], minPosition);

    expect(found.x).toBeGreaterThanOrEqual(minPosition.x);
    expect(found.y).toBeGreaterThanOrEqual(minPosition.y);
    expect(hasClearance({ position: found, size: CARD_SIZE }, [occupied])).toBe(true);
  });

  it('still finds a free spot among several tightly packed siblings', () => {
    // A tight cluster of Cards around the desired drop point.
    const siblings: PositionedRect[] = [
      { position: { x: 100, y: 100 }, size: CARD_SIZE },
      { position: { x: 260, y: 100 }, size: CARD_SIZE },
      { position: { x: 100, y: 196 }, size: CARD_SIZE },
      { position: { x: 260, y: 196 }, size: CARD_SIZE },
    ];
    const found = findFreePosition({ x: 100, y: 100 }, CARD_SIZE, siblings);

    expect(hasClearance({ position: found, size: CARD_SIZE }, siblings)).toBe(true);
  });

  it('falls back to the desired position if nothing is free within the search bound', () => {
    // Pathological: an enormous single sibling covering the entire search radius.
    const wall: PositionedRect = { position: { x: -100000, y: -100000 }, size: { width: 200000, height: 200000 } };
    expect(findFreePosition({ x: 40, y: 40 }, CARD_SIZE, [wall])).toEqual({ x: 40, y: 40 });
  });
});

describe('computeDragPreviewSize (v0.3.1 ghost preview)', () => {
  it('returns null when the projected size does not exceed the current size', () => {
    const emptyFrame = node('vpc', 'vpc');
    // Dropping a Card near the origin of an empty (MIN_FRAME_SIZE) Frame
    // fits within its existing bounds — nothing to preview.
    const result = computeDragPreviewSize(emptyFrame, {}, renderKindOf, { x: 8, y: 8 }, CARD_SIZE, null);
    expect(result).toBeNull();
  });

  it('returns the projected size when the dragged item would make the Frame grow', () => {
    const frame = node('vpc', 'vpc');
    const projected = computeDragPreviewSize(frame, {}, renderKindOf, { x: 800, y: 600 }, CARD_SIZE, null);

    expect(projected).not.toBeNull();
    expect(projected!.width).toBeGreaterThan(MIN_FRAME_SIZE.width);
    expect(projected!.height).toBeGreaterThan(MIN_FRAME_SIZE.height);
  });

  it('returns null once the target is already at least that large', () => {
    const existingChild = node('big', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [existingChild]);
    const layout = { big: { x: 800, y: 600 } }; // already forces a large Frame

    // Dropping a small Card well within the already-large bounds needs no further growth.
    const result = computeDragPreviewSize(frame, layout, renderKindOf, { x: 8, y: 8 }, CARD_SIZE, null);
    expect(result).toBeNull();
  });

  it('excludes the dragged Node itself from the existing-children bounding box', () => {
    const dragged = node('self', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [dragged]);
    const layout = { self: { x: 800, y: 600 } }; // would force growth if not excluded

    // The Node being repositioned is already inside this Frame at a far
    // position — excluding it means only the new (small) projected position matters.
    const result = computeDragPreviewSize(frame, layout, renderKindOf, { x: 8, y: 8 }, CARD_SIZE, 'self');
    expect(result).toBeNull();
  });
});

describe('siblingRectsFor (v0.3.1, ADR-0003)', () => {
  it('returns root-level Nodes when parentId is null', () => {
    const a = node('a', 'ec2-frontend');
    const b = node('b', 'ec2-frontend');
    const layout = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } };

    const rects = siblingRectsFor({ roots: [a, b] }, layout, renderKindOf, null, null);

    expect(rects).toHaveLength(2);
    expect(rects.map((r) => r.position)).toEqual([layout.a, layout.b]);
  });

  it("returns a Node's children when parentId names it", () => {
    const child = node('child', 'ec2-frontend');
    const parent = node('parent', 'vpc', [child]);
    const layout = { child: { x: 10, y: 10 } };

    const rects = siblingRectsFor({ roots: [parent] }, layout, renderKindOf, 'parent', null);

    expect(rects).toHaveLength(1);
    expect(rects[0]?.position).toEqual({ x: 10, y: 10 });
  });

  it('excludes the given excludeNodeId, e.g. the Node currently being moved', () => {
    const a = node('a', 'ec2-frontend');
    const b = node('b', 'ec2-frontend');
    const layout = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } };

    const rects = siblingRectsFor({ roots: [a, b] }, layout, renderKindOf, null, 'a');

    expect(rects).toHaveLength(1);
    expect(rects[0]?.position).toEqual({ x: 200, y: 0 });
  });

  it('returns an empty array for a parent id not present in the tree', () => {
    expect(siblingRectsFor({ roots: [] }, {}, renderKindOf, 'nope', null)).toEqual([]);
  });

  it('feeds findFreePosition end to end: a drop into a Frame already holding a Card avoids it', () => {
    const existingCard = node('existing', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [existingCard]);
    const layout = { existing: { x: 16, y: 16 } };

    const siblings = siblingRectsFor({ roots: [frame] }, layout, renderKindOf, 'vpc', null);
    const found = findFreePosition({ x: 16, y: 16 }, CARD_SIZE, siblings);

    expect(hasClearance({ position: found, size: CARD_SIZE }, siblings)).toBe(true);
  });
});

describe('resolveDropPosition (v0.3.5)', () => {
  it('is the raw, clamped position when dropping on the Canvas root with no siblings', () => {
    const activeRect = { left: 130, top: 84 };
    const overRect = { left: 100, top: 60 };

    const position = resolveDropPosition({ roots: [] }, {}, renderKindOf, activeRect, overRect, null, CARD_SIZE, null);

    expect(position).toEqual(computeDropPosition(activeRect, overRect));
  });

  it('floors to {0, 0} on the Canvas root even if the raw position is negative', () => {
    const activeRect = { left: 50, top: 50 };
    const overRect = { left: 100, top: 100 };

    const position = resolveDropPosition({ roots: [] }, {}, renderKindOf, activeRect, overRect, null, CARD_SIZE, null);

    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);
  });

  it('floors to {FRAME_PADDING, FRAME_PADDING} when the parent is a real Frame', () => {
    const frame = node('vpc', 'vpc');
    const activeRect = { left: 100, top: 100 };
    const overRect = { left: 100, top: 100 }; // raw position would be {0, 0}

    const position = resolveDropPosition({ roots: [frame] }, {}, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, null);

    expect(position).toEqual({ x: FRAME_PADDING, y: FRAME_PADDING });
  });

  it('matches calling findFreePosition directly with the same inputs (the pipeline handleDragEnd relies on)', () => {
    const existingCard = node('existing', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [existingCard]);
    const layout = { existing: { x: 16, y: 16 } };
    const activeRect = { left: 116, top: 116 };
    const overRect = { left: 100, top: 100 }; // raw position would be {16, 16} — right on the existing Card

    const resolved = resolveDropPosition({ roots: [frame] }, layout, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, null);

    const siblings = siblingRectsFor({ roots: [frame] }, layout, renderKindOf, 'vpc', null);
    const expected = findFreePosition(
      computeDropPosition(activeRect, overRect),
      CARD_SIZE,
      siblings,
      { x: FRAME_PADDING, y: FRAME_PADDING },
    );

    expect(resolved).toEqual(expected);
    expect(resolved).not.toEqual({ x: 16, y: 16 }); // had to move, since that spot is occupied
  });

  it('excludes the dragged Node itself from the sibling check, e.g. a small in-place move', () => {
    const dragged = node('self', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [dragged]);
    const layout = { self: { x: 16, y: 16 } };
    const activeRect = { left: 116, top: 116 };
    const overRect = { left: 100, top: 100 }; // raw position {16, 16} — the dragged Node's own current spot

    const position = resolveDropPosition({ roots: [frame] }, layout, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, 'self');

    expect(position).toEqual({ x: 16, y: 16 });
  });
});

describe('hasClearance (v0.3.4, ADR-0004)', () => {
  it('is true with no siblings at all', () => {
    expect(hasClearance({ position: { x: 0, y: 0 }, size: CARD_SIZE }, [])).toBe(true);
  });

  it('is false for rects that literally overlap', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    expect(hasClearance(a, [a])).toBe(false);
  });

  it('is false for rects that touch edge-to-edge with zero gap', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = { position: { x: CARD_SIZE.width, y: 0 }, size: CARD_SIZE };
    // rectsOverlap alone would call this false (no literal overlap) — hasClearance
    // must still reject it since there is zero gutter between them.
    expect(rectsOverlap(a, b)).toBe(false);
    expect(hasClearance(a, [b])).toBe(false);
  });

  it('is false when the gap is smaller than FRAME_PADDING', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = {
      position: { x: CARD_SIZE.width + FRAME_PADDING / 2, y: 0 },
      size: CARD_SIZE,
    };
    expect(hasClearance(a, [b])).toBe(false);
  });

  it('is true when the gap is exactly FRAME_PADDING', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = { position: { x: CARD_SIZE.width + FRAME_PADDING, y: 0 }, size: CARD_SIZE };
    expect(hasClearance(a, [b])).toBe(true);
  });

  it('is true when the gap comfortably exceeds FRAME_PADDING', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = { position: { x: 1000, y: 1000 }, size: CARD_SIZE };
    expect(hasClearance(a, [b])).toBe(true);
  });
});

describe('computeDraggedItemSize (v0.3.2 drag overlay)', () => {
  it('is CARD_SIZE for a card-kind service drag, regardless of any existing tree', () => {
    const size = computeDraggedItemSize({ kind: 'service', serviceId: 'ec2-frontend' }, { roots: [] }, {}, renderKindOf);
    expect(size).toEqual(CARD_SIZE);
  });

  it('is MIN_FRAME_SIZE for a frame-kind service drag — a new Node has no children yet', () => {
    const size = computeDraggedItemSize({ kind: 'service', serviceId: 'vpc' }, { roots: [] }, {}, renderKindOf);
    expect(size).toEqual(MIN_FRAME_SIZE);
  });

  it("is a Node's real current size for a node drag, including an auto-sized Frame with children", () => {
    const child = node('child', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [child]);
    const layout = { child: { x: 300, y: 300 } };

    const size = computeDraggedItemSize({ kind: 'node', nodeId: 'vpc' }, { roots: [frame] }, layout, renderKindOf);
    expect(size).toEqual(computeNodeSize(frame, layout, renderKindOf));
    expect(size.width).toBeGreaterThan(MIN_FRAME_SIZE.width);
  });

  it('falls back to CARD_SIZE for a node drag naming a Node absent from the tree', () => {
    const size = computeDraggedItemSize({ kind: 'node', nodeId: 'missing' }, { roots: [] }, {}, renderKindOf);
    expect(size).toEqual(CARD_SIZE);
  });
});
