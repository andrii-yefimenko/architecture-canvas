/**
 * US1 — place Services as Frames and Cards in free 2D space.
 * Covers spec Acceptance Scenarios 1-4.
 *
 * As in the MVP, no real pointer drag is simulated — jsdom cannot measure
 * layout (see MVP.md's documented caveat). Sessions are seeded directly with
 * a Canvas Tree and matching Layout, and rendering is asserted against. The
 * drop -> position computation itself is covered at the pure-function level
 * in src/state/layout.test.ts (computeDropPosition).
 */

import { render, screen } from '@testing-library/react';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { CARD_SIZE, MIN_FRAME_SIZE } from '@/state/layout';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

function styleSize(el: HTMLElement) {
  return { width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
}

describe('Scenario 1: a Frame-kind and a Card-kind Service render distinctly (AS1, AS2)', () => {
  it('renders a childless VPC as a Frame, at least MIN_FRAME_SIZE, at its Layout position', () => {
    let tree: CanvasTree = emptyTree();
    const vpc = addNode(tree, 'vpc', null);
    tree = vpc.tree;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpc.nodeId]: { x: 40, y: 40 } },
    };

    render(<App initialState={state} />);
    const node = screen.getByTestId(`node-${vpc.nodeId}`);
    expect(node).toHaveAttribute('data-render-kind', 'frame');
    const size = styleSize(node);
    expect(size.width).toBeGreaterThanOrEqual(MIN_FRAME_SIZE.width);
    expect(size.height).toBeGreaterThanOrEqual(MIN_FRAME_SIZE.height);
    expect(node.style.left).toBe('40px');
    expect(node.style.top).toBe('40px');
  });

  it('renders a childless EC2 as a fixed-size Card', () => {
    let tree: CanvasTree = emptyTree();
    const ec2 = addNode(tree, 'ec2-frontend', null);
    tree = ec2.tree;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [ec2.nodeId]: { x: 10, y: 10 } },
    };

    render(<App initialState={state} />);
    const node = screen.getByTestId(`node-${ec2.nodeId}`);
    expect(node).toHaveAttribute('data-render-kind', 'card');
    expect(styleSize(node)).toEqual(CARD_SIZE);
  });
});

describe('Scenario 2: a Frame auto-sizes to enclose its children (AS3)', () => {
  it('grows past MIN_FRAME_SIZE once it has a far-positioned child', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'ec2-frontend', vpcId);
    tree = r.tree;
    const childId = r.nodeId;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 0, y: 0 }, [childId]: { x: 400, y: 300 } },
    };

    render(<App initialState={state} />);
    const size = styleSize(screen.getByTestId(`node-${vpcId}`));
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(300);
  });
});

describe('Scenario 3: a Card-kind Node promotes to a Frame once it gains a child (AS4, FR-002)', () => {
  it('renders with data-render-kind="frame", not "card", despite its Service default', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'ec2-frontend', null);
    tree = r.tree;
    const parentId = r.nodeId;
    r = addNode(tree, 'rds', parentId);
    tree = r.tree;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [parentId]: { x: 0, y: 0 }, [r.nodeId]: { x: 0, y: 0 } },
    };

    render(<App initialState={state} />);
    expect(screen.getByTestId(`node-${parentId}`)).toHaveAttribute('data-render-kind', 'frame');
  });
});

describe('Scenario 4: the Canvas root sizes to its full content extent (FR-020, SC-007)', () => {
  it('grows large enough to require scrolling when Nodes are placed far apart', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'ec2-frontend', null);
    tree = r.tree;
    const a = r.nodeId;
    r = addNode(tree, 'rds', null);
    tree = r.tree;
    const b = r.nodeId;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [a]: { x: 0, y: 0 }, [b]: { x: 2000, y: 1500 } },
    };

    render(<App initialState={state} />);
    const size = styleSize(screen.getByTestId('canvas-root'));
    expect(size.width).toBeGreaterThan(2000);
    expect(size.height).toBeGreaterThan(1500);

    // The scroll container itself is unchanged from the MVP.
    const canvasRegion = screen.getByRole('main', { name: 'Canvas' });
    expect(canvasRegion.className).toMatch(/overflow-auto/);
  });
});
