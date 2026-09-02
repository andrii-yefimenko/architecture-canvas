/**
 * T055 — keyboard operability of drag and drop.
 *
 * dnd-kit ships a KeyboardSensor, but it only helps if the draggable elements
 * are actually focusable and announced. A <span> drag handle that never
 * receives focus makes the sensor unreachable, and nothing else in the suite
 * would catch that.
 */

import { render, screen, within } from '@testing-library/react';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree, NodeId } from '@/domain/types';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

// Predates routing: <App /> used to render Challenge #1's Task Page directly.
// '/' now renders the Catalog Page instead, so every test here points the
// route at Challenge #1's Task Page explicitly.
beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

function seeded(): SessionState {
  let tree: CanvasTree = emptyTree();
  const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
    const r = addNode(tree, serviceId, parentId);
    tree = r.tree;
    return r.nodeId;
  };
  const vpc = add('vpc');
  add('ec2-frontend', vpc);
  return { ...initialSessionState(), canvasTree: tree };
}

describe('catalog Services are keyboard reachable', () => {
  it('exposes each Service as a focusable button', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });
    const vpc = within(panel).getByRole('button', { name: 'VPC' });

    vpc.focus();
    expect(vpc).toHaveFocus();
    expect(vpc.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('gives dnd-kit a described-by hint for screen readers', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });
    const vpc = within(panel).getByRole('button', { name: 'VPC' });
    expect(vpc).toHaveAttribute('aria-describedby');
  });
});

describe('placed Nodes are keyboard reachable', () => {
  it('makes each Node drag handle focusable and button-roled', () => {
    render(<App initialState={seeded()} />);

    // Scoped to the Canvas: "VPC" also exists as a catalog entry.
    // The handle is a <span> carrying dnd-kit's attributes, which supply
    // role="button" and tabIndex — that is what makes it keyboard reachable.
    const canvas = screen.getByRole('main', { name: 'Canvas' });
    const handle = within(canvas).getByRole('button', { name: 'VPC' });
    handle.focus();
    expect(handle).toHaveFocus();
    expect(handle.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('exposes the remove control to keyboard users with an accessible name', () => {
    render(<App initialState={seeded()} />);
    const remove = screen.getByRole('button', { name: 'Remove EC2 (Frontend)' });
    remove.focus();
    expect(remove).toHaveFocus();
  });
});

describe('the KeyboardSensor is registered', () => {
  it('renders dnd-kit accessibility instructions for keyboard users', () => {
    render(<App initialState={seeded()} />);
    // dnd-kit injects a hidden instructions node consumed via aria-describedby;
    // its presence confirms the DndContext accessibility layer is active.
    const canvas = screen.getByRole('main', { name: 'Canvas' });
    const handle = within(canvas).getByRole('button', { name: 'VPC' });
    const describedBy = handle.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toBeInTheDocument();
  });
});

describe('primary controls are reachable', () => {
  it('keeps the submit control focusable', () => {
    render(<App />);
    const submit = screen.getByRole('button', { name: 'Submit' });
    submit.focus();
    expect(submit).toHaveFocus();
  });

  it('keeps Category reveal controls focusable', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Requirements' });
    const reveal = within(panel).getByRole('button', { name: /Infrastructure/i });
    reveal.focus();
    expect(reveal).toHaveFocus();
  });
});
