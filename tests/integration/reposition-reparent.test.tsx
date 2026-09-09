/**
 * US2 — reposition and reparent Nodes freely.
 * Covers spec Acceptance Scenarios 1-4.
 *
 * As with US1, no real drag gesture is simulated. MOVE_NODE's tree effect is
 * already covered end-to-end in src/state/session-reducer.test.ts ("updates
 * only the moved Node's own layout entry"); what's asserted here is that the
 * render layer reflects that — a moved Frame's descendants keep their own
 * positions untouched, and overlapping positions render as-is, never nudged.
 */

import { render, screen } from '@testing-library/react';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { initialSessionState, sessionReducer, type SessionState } from '@/state/session-reducer';

beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

describe('Scenario: reparenting lands a Node at the dispatched drop point (AS1, AS2)', () => {
  it('positions the moved Node at the given coordinates, inside its new parent', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'public-subnet', null); // a sibling Frame, unrelated to the VPC
    tree = r.tree;
    const subnetId = r.nodeId;
    r = addNode(tree, 'ec2-frontend', subnetId);
    tree = r.tree;
    const ec2Id = r.nodeId;

    let state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 0, y: 0 }, [subnetId]: { x: 400, y: 0 }, [ec2Id]: { x: 20, y: 20 } },
    };
    // Drag the EC2 out of the Public Subnet, into the VPC, releasing at a specific point.
    state = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: ec2Id,
      newParentId: vpcId,
      position: { x: 88, y: 64 },
    });

    render(<App initialState={state} />);
    const moved = screen.getByTestId(`node-${ec2Id}`);
    expect(moved.style.left).toBe('88px');
    expect(moved.style.top).toBe('64px');
    // It's now rendered inside the VPC's subtree, not the Public Subnet's.
    expect(screen.getByTestId(`node-${vpcId}`)).toContainElement(moved);
  });

  it('positions a Node dragged onto the Canvas root as a positioned root-level Node', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'rds', vpcId);
    tree = r.tree;
    const rdsId = r.nodeId;

    let state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 0, y: 0 }, [rdsId]: { x: 20, y: 20 } },
    };
    state = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: rdsId,
      newParentId: null,
      position: { x: 500, y: 300 },
    });

    render(<App initialState={state} />);
    const moved = screen.getByTestId(`node-${rdsId}`);
    expect(moved.style.left).toBe('500px');
    expect(moved.style.top).toBe('300px');
  });
});

describe('Scenario: dragging a Frame carries its children for free (AS4)', () => {
  it("leaves a descendant's own position untouched when its parent Frame moves", () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'ec2-frontend', vpcId);
    tree = r.tree;
    const childId = r.nodeId;

    let state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 0, y: 0 }, [childId]: { x: 30, y: 30 } },
    };
    state = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: vpcId,
      newParentId: null,
      position: { x: 900, y: 700 },
    });

    render(<App initialState={state} />);
    expect(screen.getByTestId(`node-${vpcId}`).style.left).toBe('900px');
    // The child's own Layout entry — and therefore its rendered position — is untouched.
    const child = screen.getByTestId(`node-${childId}`);
    expect(child.style.left).toBe('30px');
    expect(child.style.top).toBe('30px');
  });
});

describe('Scenario: overlap is accepted, never nudged (AS3; spec.md Clarifications 2026-09-08)', () => {
  it('renders two sibling Cards at the exact same overlapping position', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'ec2-frontend', null);
    tree = r.tree;
    const a = r.nodeId;
    r = addNode(tree, 'ec2-backend', null);
    tree = r.tree;
    const b = r.nodeId;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [a]: { x: 100, y: 100 }, [b]: { x: 100, y: 100 } },
    };

    render(<App initialState={state} />);
    expect(screen.getByTestId(`node-${a}`).style.left).toBe('100px');
    expect(screen.getByTestId(`node-${b}`).style.left).toBe('100px');
  });

  it('accepts a Frame auto-resize that newly overlaps a sibling, without moving either', () => {
    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'rds', vpcId);
    tree = r.tree;
    const rdsId = r.nodeId;
    r = addNode(tree, 'ec2-frontend', null); // sibling that ends up inside the Frame's growth path
    tree = r.tree;
    const siblingId = r.nodeId;

    const state: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: {
        [vpcId]: { x: 0, y: 0 },
        [rdsId]: { x: 300, y: 200 }, // forces the VPC Frame to grow well past its minimum
        [siblingId]: { x: 250, y: 150 }, // sits inside that grown region
      },
    };

    render(<App initialState={state} />);
    const sibling = screen.getByTestId(`node-${siblingId}`);
    expect(sibling.style.left).toBe('250px');
    expect(sibling.style.top).toBe('150px');
  });
});
