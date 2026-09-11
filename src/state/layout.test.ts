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
  computePushDisplacements,
  computeRootContentSize,
  effectiveRenderKind,
  findFreePosition,
  hasClearance,
  hasSignificantOverlap,
  meetsNestingThreshold,
  rectsOverlap,
  resolveDropPlacement,
  siblingRectsFor,
  snapToGrid,
  type PositionedRect,
  type SiblingRect,
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

describe('meetsNestingThreshold (v0.3.6)', () => {
  function rect(left: number, top: number, width: number, height: number) {
    return { left, top, right: left + width, bottom: top + height };
  }

  it('is true when the dragged rect is fully inside the target', () => {
    const dragged = rect(110, 110, 64, 64);
    const target = rect(100, 100, 300, 300);
    expect(meetsNestingThreshold(dragged, target)).toBe(true);
  });

  it('is true when the center is inside even though well under half the area overlaps — the case the area check alone would miss', () => {
    // A large dragged rect (300x300, area 90000) mostly hangs off the
    // target's edges; only a 160x200 corner (32000, ~35.5%) overlaps, but
    // its center at (210, 250) still falls just inside the target.
    const dragged = rect(60, 100, 300, 300);
    const target = rect(200, 0, 300, 300);
    expect(meetsNestingThreshold(dragged, target)).toBe(true);
  });

  it('is true when overlap area is exactly 50% and the center sits right on the boundary', () => {
    const dragged = rect(0, 0, 64, 64); // spans x:[0,64), y:[0,64)
    const target = rect(32, 0, 300, 300); // overlap x:[32,64) = half the width, full height = 50% area
    expect(meetsNestingThreshold(dragged, target)).toBe(true);
  });

  it('is false when neither the center is inside nor overlap reaches 50%', () => {
    const dragged = rect(0, 0, 64, 64);
    const target = rect(50, 50, 300, 300); // small corner overlap only, center well outside
    expect(meetsNestingThreshold(dragged, target)).toBe(false);
  });

  it('is false with no overlap at all', () => {
    const dragged = rect(0, 0, 64, 64);
    const target = rect(500, 500, 300, 300);
    expect(meetsNestingThreshold(dragged, target)).toBe(false);
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

describe('hasSignificantOverlap (v0.3.7 revision)', () => {
  it('is false with no geometric overlap at all, even inside the gutter zone', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    // 15px away — inside FRAME_PADDING's 16px gutter, but not touching.
    const b: PositionedRect = { position: { x: CARD_SIZE.width + 15, y: 0 }, size: CARD_SIZE };
    expect(rectsOverlap(a, b)).toBe(false);
    expect(hasSignificantOverlap(a, b)).toBe(false);
  });

  it('is false for a negligible 1px real overlap', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = { position: { x: CARD_SIZE.width - 1, y: 0 }, size: CARD_SIZE };
    expect(hasSignificantOverlap(a, b)).toBe(false);
  });

  it('is true once a full-height touch between two same-sized Cards reaches 25% of their area (a 16px-deep touch, incidentally)', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const b: PositionedRect = { position: { x: CARD_SIZE.width - 16, y: 0 }, size: CARD_SIZE };
    expect(hasSignificantOverlap(a, b)).toBe(true);
  });

  it('is true for two fully-coincident rects', () => {
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    expect(hasSignificantOverlap(a, { ...a })).toBe(true);
  });

  it("is false for a shallow edge touch between two large Frame-sized rects — the exact reported regression (a fixed-pixel threshold treated a trivial touch on a 240px Frame the same as on a 64px Card)", () => {
    const frameSize = { width: 240, height: 170 };
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: frameSize };
    // 20px penetration on X, full height on Y — 20*170=3400, 3400/40800 ≈ 8.3%.
    const b: PositionedRect = { position: { x: frameSize.width - 20, y: 0 }, size: frameSize };
    expect(hasSignificantOverlap(a, b)).toBe(false);
  });

  it('is true for a substantial overlap between two large Frame-sized rects', () => {
    const frameSize = { width: 240, height: 170 };
    const a: PositionedRect = { position: { x: 0, y: 0 }, size: frameSize };
    // 70px penetration on X, full height — 70*170=11900, 11900/40800 ≈ 29.2%.
    const b: PositionedRect = { position: { x: frameSize.width - 70, y: 0 }, size: frameSize };
    expect(hasSignificantOverlap(a, b)).toBe(true);
  });

  it('is true when a small Card is entirely engulfed by a much larger dragged Frame, even though that\'s a tiny fraction of the Frame\'s own area', () => {
    const bigFrame: PositionedRect = { position: { x: 0, y: 0 }, size: { width: 500, height: 400 } };
    const smallCard: PositionedRect = { position: { x: 100, y: 100 }, size: CARD_SIZE }; // fully inside bigFrame
    // Overlap = the Card's entire area, only ~2% of the Frame's own area —
    // the denominator uses the SMALLER of the two areas (the Card's), so
    // this correctly registers as a complete (100%) overlap.
    expect(hasSignificantOverlap(bigFrame, smallCard)).toBe(true);
  });
});

describe('computePushDisplacements (v0.3.6/ADR-0005, sensitivity narrowed in v0.3.7)', () => {
  function sibling(id: string, x: number, y: number, size: { width: number; height: number } = CARD_SIZE): SiblingRect {
    return { id, position: { x, y }, size };
  }

  it('returns {} when the dropped rect has clearance from every sibling', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 500, 500)];
    expect(computePushDisplacements(droppedRect, siblings)).toEqual({});
  });

  it('returns {} for a gutter-only graze — no genuine geometric overlap at all', () => {
    // Sibling sits 15px away — inside the FRAME_PADDING (16px) gutter zone,
    // but the two rects never actually touch. Under v0.3.6/ADR-0005 this
    // triggered a full push (hasClearance is gutter-aware); this revision tolerates it.
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', CARD_SIZE.width + 15, 0)];

    expect(computePushDisplacements(droppedRect, siblings)).toEqual({});
  });

  it('returns {} for a negligible 1px real overlap', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', CARD_SIZE.width - 1, 0)]; // 1px genuine overlap

    expect(computePushDisplacements(droppedRect, siblings)).toEqual({});
  });

  it('still returns {} for a small but real overlap below both the penetration and area thresholds', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    // 10px penetration on X (< 16px), full 64px on Y — area = 10*64 = 640,
    // 640/4096 ≈ 15.6% (< 25%) — fails both checks.
    const siblings = [sibling('a', CARD_SIZE.width - 10, 0)];

    expect(computePushDisplacements(droppedRect, siblings)).toEqual({});
  });

  it('triggers a push once a full-height touch between two same-sized Cards reaches 25% area', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', CARD_SIZE.width - 16, 0)]; // 16px penetration on X = 25% for a 64px Card

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']).toBeDefined();
  });

  it('does NOT push on a shallow edge touch between two Frame-sized siblings — the exact reported regression', () => {
    const frameSize = { width: 240, height: 170 };
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: frameSize };
    // 20px penetration, full height — ~8.3% of either Frame's area. A flat
    // 16px-penetration rule would have fired here regardless of size;
    // dragging a Frame slightly past a sibling Frame's edge must not.
    const siblings = [sibling('a', frameSize.width - 20, 0, frameSize)];

    expect(computePushDisplacements(droppedRect, siblings)).toEqual({});
  });

  it('still pushes on a substantial overlap between two Frame-sized siblings', () => {
    const frameSize = { width: 240, height: 170 };
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: frameSize };
    const siblings = [sibling('a', frameSize.width - 70, 0, frameSize)]; // ~29.2% overlap

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']).toBeDefined();
  });

  it('triggers a push via the area threshold even when penetration alone falls short', () => {
    // For a square 64x64 dragged rect, 16px penetration is exactly 25% of
    // its own side — the two thresholds coincide, so isolating the area
    // path needs a smaller dragged rect (32x32): 15px penetration on X
    // (just under the 16px floor) with full 32px overlap on Y gives an area
    // of 15*32=480, or 480/1024 ≈ 46.9% of the dragged rect's own area —
    // comfortably over 25% despite the shallow, sub-threshold X penetration.
    const smallDragged: PositionedRect = { position: { x: 0, y: 0 }, size: { width: 32, height: 32 } };
    const siblings = [sibling('a', 32 - 15, 0, { width: 32, height: 32 })];

    const result = computePushDisplacements(smallDragged, siblings);

    expect(result['a']).toBeDefined();
  });

  it('pushes the single overlapping sibling right when X has the smaller penetration', () => {
    // Dropped rect spans x:[0,64), y:[0,64); sibling at (8,0) — deep Y overlap
    // (full 64px) but shallow X overlap (56px < 64px), so X is the push axis.
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 8, 0)];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']).toEqual({ x: 0 + CARD_SIZE.width + FRAME_PADDING, y: 0 }); // y unchanged
  });

  it('pushes down when Y has the smaller penetration', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 0, 8)]; // shallow Y overlap, full X overlap

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']).toEqual({ x: 0, y: 0 + CARD_SIZE.height + FRAME_PADDING });
  });

  it('defaults to push-down on an exact penetration tie', () => {
    // Dropped rect exactly coincides with the sibling — equal penetration on both axes.
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 0, 0)];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']!.x).toBe(0); // x unchanged
    expect(result['a']!.y).toBeGreaterThan(0); // pushed down
  });

  it('grid-aligns the computed offset', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 8, 0)];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']!.x % FRAME_PADDING).toBe(0);
  });

  it('cascades: a push that newly overlaps a further sibling pushes that one too, along the same axis', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [
      sibling('a', 8, 0), // pushed right by the drop
      sibling('b', CARD_SIZE.width + FRAME_PADDING, 0), // sits exactly where 'a' would land — must cascade
    ];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['a']).toBeDefined();
    expect(result['b']).toBeDefined();
    expect(result['a']!.y).toBe(0);
    expect(result['b']!.y).toBe(0);
    expect(result['b']!.x).toBeGreaterThan(result['a']!.x);
    // Every final position keeps clearance from the dropped rect and from each other.
    const finalA: SiblingRect = { id: 'a', position: result['a']!, size: CARD_SIZE };
    const finalB: SiblingRect = { id: 'b', position: result['b']!, size: CARD_SIZE };
    expect(hasClearance(droppedRect, [finalA, finalB])).toBe(true);
    expect(hasClearance({ position: finalA.position, size: CARD_SIZE }, [finalB])).toBe(true);
  });

  it('leaves an unrelated, non-overlapping sibling untouched', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const siblings = [sibling('a', 8, 0), sibling('far', 2000, 2000)];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['far']).toBeUndefined();
  });

  it('picks the sibling with the largest overlap area as the primary target when the drop hits a seam between two', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    // 'small' barely clips the dropped rect's corner; 'big' overlaps it almost entirely.
    const siblings = [sibling('small', 60, 60), sibling('big', 4, 4)];

    const result = computePushDisplacements(droppedRect, siblings);

    expect(result['big']).toBeDefined();
  });

  it('gives up gracefully at MAX_PUSH_CASCADE_DEPTH rather than cascading forever, matching findFreePosition-style degradation', () => {
    const droppedRect: PositionedRect = { position: { x: 0, y: 0 }, size: CARD_SIZE };
    const step = CARD_SIZE.width + FRAME_PADDING;
    // A long unbroken chain of siblings, each exactly abutting the next —
    // every push cascades into the next one, well past any reasonable cap.
    const siblings = Array.from({ length: 60 }, (_, i) => sibling(`s${i}`, 8 + i * step, 0));

    expect(() => computePushDisplacements(droppedRect, siblings)).not.toThrow();
    const result = computePushDisplacements(droppedRect, siblings);
    // Bounded: not every sibling in a 60-long chain gets an update.
    expect(Object.keys(result).length).toBeLessThan(60);
  });
});

describe('resolveDropPlacement (v0.3.5, superseded shape in v0.3.6)', () => {
  it('is the raw, clamped position when dropping on the Canvas root with no siblings, nothing displaced', () => {
    const activeRect = { left: 130, top: 84 };
    const overRect = { left: 100, top: 60 };

    const { position, displaced } = resolveDropPlacement({ roots: [] }, {}, renderKindOf, activeRect, overRect, null, CARD_SIZE, null);

    expect(position).toEqual(computeDropPosition(activeRect, overRect));
    expect(displaced).toEqual({});
  });

  it('floors to {0, 0} on the Canvas root even if the raw position is negative', () => {
    const activeRect = { left: 50, top: 50 };
    const overRect = { left: 100, top: 100 };

    const { position } = resolveDropPlacement({ roots: [] }, {}, renderKindOf, activeRect, overRect, null, CARD_SIZE, null);

    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);
  });

  it('floors to {FRAME_PADDING, FRAME_PADDING} when the parent is a real Frame', () => {
    const frame = node('vpc', 'vpc');
    const activeRect = { left: 100, top: 100 };
    const overRect = { left: 100, top: 100 }; // raw position would be {0, 0}

    const { position } = resolveDropPlacement({ roots: [frame] }, {}, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, null);

    expect(position).toEqual({ x: FRAME_PADDING, y: FRAME_PADDING });
  });

  it('lands exactly where dropped and pushes the occupying sibling aside instead (v0.3.6 — no more findFreePosition here)', () => {
    const existingCard = node('existing', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [existingCard]);
    const layout = { existing: { x: 16, y: 16 } };
    const activeRect = { left: 116, top: 116 };
    const overRect = { left: 100, top: 100 }; // raw position {16, 16} — right on the existing Card

    const { position, displaced } = resolveDropPlacement({ roots: [frame] }, layout, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, null);

    expect(position).toEqual({ x: 16, y: 16 }); // dropped item lands exactly here now
    expect(displaced['existing']).toBeDefined(); // the sibling moved instead
    expect(hasClearance({ position, size: CARD_SIZE }, [{ position: displaced['existing']!, size: CARD_SIZE }])).toBe(true);
  });

  it('excludes the dragged Node itself from the sibling/push check, e.g. a small in-place move', () => {
    const dragged = node('self', 'ec2-frontend');
    const frame = node('vpc', 'vpc', [dragged]);
    const layout = { self: { x: 16, y: 16 } };
    const activeRect = { left: 116, top: 116 };
    const overRect = { left: 100, top: 100 }; // raw position {16, 16} — the dragged Node's own current spot

    const { position, displaced } = resolveDropPlacement({ roots: [frame] }, layout, renderKindOf, activeRect, overRect, 'vpc', CARD_SIZE, 'self');

    expect(position).toEqual({ x: 16, y: 16 });
    expect(displaced).toEqual({});
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
