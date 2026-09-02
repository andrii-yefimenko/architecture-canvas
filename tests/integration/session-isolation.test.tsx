/**
 * US3 — work stays isolated between Challenges.
 * Covers spec Acceptance Scenarios 1-3 in
 * specs/002-multi-challenge-catalog/spec.md.
 *
 * Canvas Trees are seeded via `initialState` rather than simulated drags,
 * which jsdom cannot measure (see design-and-evaluate.test.tsx). A reveal
 * click after seeding forces the persistence-writing effect to fire at least
 * once, since the very first render after mount is always skipped (see
 * SessionProvider.tsx's `hydrated` ref) — the same technique
 * session-resume.test.tsx uses.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree, NodeId } from '@/domain/types';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

function goTo(path: string) {
  window.history.pushState(null, '', path);
}

function requirementsPanel() {
  return screen.getByRole('region', { name: 'Requirements' });
}

/** A Canvas Tree using only Service ids that exist in BOTH Challenges' catalogs. */
function sharedIdTree(): CanvasTree {
  let tree: CanvasTree = emptyTree();
  const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
    const r = addNode(tree, serviceId, parentId);
    tree = r.tree;
    return r.nodeId;
  };
  const vpc = add('vpc');
  const priv = add('private-subnet', vpc);
  add('rds', priv);
  return tree;
}

async function seedChallenge01AndPersist() {
  const user = userEvent.setup();
  goTo('/challenge/challenge-01');
  const seeded: SessionState = { ...initialSessionState(), canvasTree: sharedIdTree() };
  const rendered = render(<App initialState={seeded} />);

  // Force the persistence-writing effect to fire at least once.
  await user.click(within(requirementsPanel()).getByRole('button', { name: /infrastructure/i }));

  expect(screen.getByRole('button', { name: 'Remove VPC' })).toBeInTheDocument();
  rendered.unmount();
}

describe('Scenario 1: building on one Challenge does not appear on another', () => {
  it('Challenge #2\'s Canvas is empty after building on Challenge #1', async () => {
    await seedChallenge01AndPersist();

    // Navigate directly to Challenge #2 — no VPC/RDS from Challenge #1
    // should appear, even though both ids are valid Services for Challenge #2.
    goTo('/challenge/challenge-02');
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Remove VPC' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove RDS' })).not.toBeInTheDocument();
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });
});

describe('Scenario 2: a reload restores the same Challenge, unaffected by the other', () => {
  it('Challenge #1\'s Nodes survive a reload even after Challenge #2 was visited in between', async () => {
    await seedChallenge01AndPersist();

    // Visit Challenge #2 in between — it must stay empty.
    goTo('/challenge/challenge-02');
    const middle = render(<App />);
    expect(screen.queryByRole('button', { name: 'Remove VPC' })).not.toBeInTheDocument();
    middle.unmount();

    // Back to Challenge #1, no explicit seed this time — restored from storage.
    goTo('/challenge/challenge-01');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Remove VPC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove RDS' })).toBeInTheDocument();
  });
});

describe('Scenario 3: a stored session is never accepted for a different Challenge', () => {
  it('restoring Challenge #2 never uses a tree saved under Challenge #1\'s key, even with fully shared Service ids', async () => {
    // sharedIdTree() uses only 'vpc', 'private-subnet', and 'rds' — all three
    // resolve against BOTH catalogs, so a structural-only check would accept
    // this tree for either Challenge. The challengeId check must be what
    // rejects it for Challenge #2.
    await seedChallenge01AndPersist();

    goTo('/challenge/challenge-02');
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Remove VPC' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove RDS' })).not.toBeInTheDocument();
  });
});
