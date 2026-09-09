/**
 * US3 — Layout survives a reload, scoped per Challenge.
 * Covers spec Acceptance Scenarios 1-3.
 *
 * Reload is simulated the same way session-resume.test.tsx already
 * establishes: unmount, then render a fresh <App />.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { storageKey } from '@/state/persistence';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

function goTo(path: string) {
  window.history.pushState(null, '', path);
}

describe('Scenario: a spatial arrangement is restored exactly after a reload (AS1)', () => {
  it('restores a Node at the same position and size it was left at', async () => {
    const user = userEvent.setup();
    goTo('/challenge/challenge-01');

    let tree: CanvasTree = emptyTree();
    let r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;
    r = addNode(tree, 'rds', vpcId);
    tree = r.tree;
    const rdsId = r.nodeId;

    const seeded: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 77, y: 55 }, [rdsId]: { x: 12, y: 34 } },
    };

    const first = render(<App initialState={seeded} />);
    // Force the persistence-writing effect to fire at least once — the very
    // first render after mount is always skipped (SessionProvider.tsx's
    // `hydrated` ref), same technique session-resume.test.tsx uses.
    await user.click(screen.getByRole('button', { name: 'Remove RDS' }));
    first.unmount();

    render(<App />);
    const vpc = screen.getByTestId(`node-${vpcId}`);
    expect(vpc.style.left).toBe('77px');
    expect(vpc.style.top).toBe('55px');
  });
});

describe('Scenario: a stale schema is discarded, not partially restored (AS2)', () => {
  it('starts clean when the stored session predates Layout', () => {
    goTo('/challenge/challenge-01');
    localStorage.setItem(
      storageKey('challenge-01'),
      JSON.stringify({
        version: 1, // pre-Layout shape
        challengeId: 'challenge-01',
        canvasTree: emptyTree(),
        revealedCategories: [],
      }),
    );

    render(<App />);
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });
});

describe('Scenario: visiting a different Challenge shows no carried-over arrangement (AS3)', () => {
  it('Challenge #2 starts with no Nodes or Layout from Challenge #1', async () => {
    const user = userEvent.setup();
    goTo('/challenge/challenge-01');

    let tree: CanvasTree = emptyTree();
    const r = addNode(tree, 'vpc', null);
    tree = r.tree;

    const seeded: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [r.nodeId]: { x: 10, y: 10 } },
    };

    const first = render(<App initialState={seeded} />);
    // Force a save without altering the tree (same technique
    // session-isolation.test.tsx uses).
    const panel = screen.getByRole('region', { name: 'Requirements' });
    await user.click(within(panel).getByRole('button', { name: /infrastructure/i }));
    expect(screen.getByTestId(`node-${r.nodeId}`)).toBeInTheDocument();
    first.unmount();

    goTo('/challenge/challenge-02');
    render(<App />);
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
    expect(screen.queryByTestId(`node-${r.nodeId}`)).not.toBeInTheDocument();
  });
});
