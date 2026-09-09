import type { Node } from '@/domain/types';
import {
  CARD_SIZE,
  FRAME_PADDING,
  GRID_SNAP,
  MIN_FRAME_SIZE,
  computeContentSize,
  computeDropPosition,
  computeNodeSize,
  computeRootContentSize,
  defaultPositionForKeyboardPlacement,
  effectiveRenderKind,
  snapToGrid,
} from './layout';

const renderKindOf = (serviceId: string) => (serviceId === 'vpc' ? 'frame' : 'card');

function node(id: string, serviceId: string, children: Node[] = []): Node {
  return { id, serviceId, children };
}

describe('snapToGrid', () => {
  it('rounds to the nearest GRID_SNAP increment', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(3)).toBe(0);
    expect(snapToGrid(5)).toBe(8);
    expect(snapToGrid(10)).toBe(8);
    expect(snapToGrid(13)).toBe(16);
  });

  it('handles negative values', () => {
    expect(snapToGrid(-3)).toBe(0);
    expect(snapToGrid(-5)).toBe(-8);
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
  it('is the difference between the dragged and target rects, snapped to grid', () => {
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

describe('defaultPositionForKeyboardPlacement', () => {
  it('starts at the padding offset for the first Node', () => {
    expect(defaultPositionForKeyboardPlacement(0)).toEqual({ x: FRAME_PADDING, y: FRAME_PADDING });
  });

  it('cascades diagonally so successive placements are never pixel-identical', () => {
    const first = defaultPositionForKeyboardPlacement(0);
    const second = defaultPositionForKeyboardPlacement(1);
    const third = defaultPositionForKeyboardPlacement(2);

    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
    expect(third.x).toBeGreaterThan(second.x);
    expect(third.y).toBeGreaterThan(second.y);
  });

  it('offsets by a multiple of GRID_SNAP', () => {
    const position = defaultPositionForKeyboardPlacement(3);
    expect((position.x - FRAME_PADDING) % GRID_SNAP).toBe(0);
  });
});
