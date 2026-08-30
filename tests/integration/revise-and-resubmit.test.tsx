/**
 * US3 — revise and resubmit.
 * Covers spec Acceptance Scenarios 1-4.
 *
 * The load-bearing behaviour here is FR-030: after the Canvas changes, the
 * previous Evaluation must STAY on screen, marked stale. Clearing it would
 * destroy the Recommendations the user is reading *while* they fix the
 * problem — the single most useful thing on screen mid-revision.
 *
 * Revision is driven through the remove control rather than simulated drags,
 * which jsdom cannot measure. The move path is covered in
 * src/state/session-reducer.test.ts.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { evaluate } from '@/domain/evaluator';
import type { CanvasTree, NodeId } from '@/domain/types';
import { initialSessionState, sessionReducer, type SessionState } from '@/state/session-reducer';

/** VPC > [Public Subnet > [EC2 Backend — wrong tier], Private Subnet]. */
function flawedState(): SessionState {
  let tree: CanvasTree = emptyTree();
  const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
    const r = addNode(tree, serviceId, parentId);
    tree = r.tree;
    return r.nodeId;
  };
  const vpc = add('vpc');
  const pub = add('public-subnet', vpc);
  add('ec2-backend', pub); // belongs in the private subnet
  add('private-subnet', vpc);

  return { ...initialSessionState(), canvasTree: tree };
}

const BACKEND_RULE = 'ec2-backend-in-private-subnet';
const backendRule = challenge01.rules.find((r) => r.id === BACKEND_RULE)!;

function evaluationRegion() {
  return screen.getByRole('region', { name: 'Evaluation' });
}

/**
 * The stale banner, scoped to the Evaluation region.
 *
 * dnd-kit renders its own `role="status"` live region for drag announcements,
 * so an unscoped getByRole('status') matches two elements.
 */
function staleBanner() {
  return within(evaluationRegion()).queryByRole('status');
}

describe('Scenario 1: the Evaluation survives a Canvas edit', () => {
  it('stays visible and is marked as describing the previous submission (FR-030)', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(within(evaluationRegion()).getByText(backendRule.description)).toBeInTheDocument();
    expect(staleBanner()).not.toBeInTheDocument();

    // Edit the Canvas: remove the misplaced backend (a leaf, so no confirmation).
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Backend)' }));

    // The Evaluation must NOT disappear.
    expect(evaluationRegion()).toBeInTheDocument();
    expect(staleBanner()).toHaveTextContent(/previous submission/i);
    // Its Recommendations are still readable while fixing.
    expect(within(evaluationRegion()).getByText(backendRule.recommendation)).toBeInTheDocument();
  });

  it('shows no stale marker before any edit', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(staleBanner()).not.toBeInTheDocument();
  });
});

describe('Scenario 2: resubmitting refreshes the results', () => {
  it('replaces the Evaluation and clears the stale marker (FR-031)', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Backend)' }));
    expect(staleBanner()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(staleBanner()).not.toBeInTheDocument();
    expect(evaluationRegion()).toBeInTheDocument();
  });

  it('reflects the changed Canvas in the new Score', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    const before = within(evaluationRegion()).getByText(/of 11 requirements met/).textContent;

    // Removing the backend loses its presence Rule too.
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Backend)' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const after = within(evaluationRegion()).getByText(/of 11 requirements met/).textContent;
    expect(after).not.toBe(before);
  });
});

describe('Scenario 3: the Canvas never locks (FR-029)', () => {
  it('accepts many submissions in a row', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);
    const submit = screen.getByRole('button', { name: 'Submit' });

    for (let i = 0; i < 6; i += 1) {
      await user.click(submit);
      expect(submit).toBeEnabled();
    }
    expect(evaluationRegion()).toBeInTheDocument();
  });

  it('keeps the Canvas editable after submitting', async () => {
    const user = userEvent.setup();
    render(<App initialState={flawedState()} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Backend)' }));

    expect(screen.queryByRole('button', { name: 'Remove EC2 (Backend)' })).not.toBeInTheDocument();
  });
});

describe('Scenario 4: applying a Recommendation raises the Score (SC-008)', () => {
  it('passes the Rule once the backend sits in the private subnet', () => {
    // The fix is a move, so it is asserted at the domain level: the same tree
    // with the backend re-parented passes the Rule that previously failed.
    const flawed = flawedState().canvasTree;
    const before = evaluate(flawed, challenge01.rules);
    expect(before.results.find((r) => r.ruleId === BACKEND_RULE)?.passed).toBe(false);

    const moved = sessionReducer(
      { ...initialSessionState(), canvasTree: flawed },
      {
        type: 'MOVE_NODE',
        nodeId: flawed.roots[0]!.children[0]!.children[0]!.id, // the backend
        newParentId: flawed.roots[0]!.children[1]!.id, // the private subnet
      },
    ).canvasTree;

    const after = evaluate(moved, challenge01.rules);
    expect(after.results.find((r) => r.ruleId === BACKEND_RULE)?.passed).toBe(true);
    expect(after.score).toBeGreaterThan(before.score);
  });
});
