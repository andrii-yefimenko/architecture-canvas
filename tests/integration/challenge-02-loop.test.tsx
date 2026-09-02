/**
 * US2 — complete Challenge #2 (Containerized Microservice) end to end.
 * Covers spec Acceptance Scenarios 1-4 in
 * specs/002-multi-challenge-catalog/spec.md.
 *
 * Mirrors design-and-evaluate.test.tsx's structure for Challenge #1: content
 * checks render through <App />, full-marks/failure checks call evaluate()
 * directly (drag simulation is infeasible in jsdom — see that file's header
 * comment). What's new here is proving the generic Task Page/Registry wiring
 * actually generalizes to a second Challenge, not new application code.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { challenge02 } from '@/challenges/challenge-02';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { evaluate } from '@/domain/evaluator';
import type { CanvasTree, NodeId } from '@/domain/types';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-02');
});

function buildRequiredArchitecture(): CanvasTree {
  let tree: CanvasTree = emptyTree();
  const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
    const r = addNode(tree, serviceId, parentId);
    tree = r.tree;
    return r.nodeId;
  };

  const vpc = add('vpc');
  add('internet-gateway', vpc);
  const pub = add('public-subnet', vpc);
  add('application-load-balancer', pub);
  add('nat-gateway', pub);
  const priv = add('private-subnet', vpc);
  const ecsCluster = add('ecs-cluster', priv);
  add('fargate-task', ecsCluster);
  add('rds', priv);
  return tree;
}

describe('Scenario 1: Challenge #2 is presented on load, not Challenge #1', () => {
  it('shows its own title, description, and Visible Requirements', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Requirements' });

    expect(within(panel).getByText(challenge02.title)).toBeInTheDocument();
    expect(within(panel).getByText(challenge02.description)).toBeInTheDocument();
    for (const requirement of challenge02.visibleRequirements) {
      expect(within(panel).getByText(requirement)).toBeInTheDocument();
    }
    expect(within(panel).queryByText(challenge01.title)).not.toBeInTheDocument();
  });

  it('presents its four Hidden Requirement Categories', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Requirements' });
    for (const category of challenge02.hiddenRequirementCategories) {
      const nameMatcher = new RegExp(category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      expect(within(panel).getByRole('button', { name: nameMatcher })).toBeInTheDocument();
    }
  });
});

describe('Scenario 2: only Challenge #2\'s Service catalog is listed', () => {
  it('lists every Challenge #2 Service under its category', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });

    for (const service of challenge02.services) {
      expect(within(panel).getByRole('button', { name: service.name })).toBeInTheDocument();
    }
  });

  it('does not list a Service unique to Challenge #1\'s catalog', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });
    // "S3 Glacier" and "EBS" are Challenge #1-only distractors.
    expect(within(panel).queryByRole('button', { name: 'S3 Glacier' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'EBS' })).not.toBeInTheDocument();
  });
});

describe('Scenario 3: a correct architecture scores exactly 100', () => {
  it('passes all 9 Rules', () => {
    const result = evaluate(buildRequiredArchitecture(), challenge02.rules);
    expect(result.score).toBe(100);
    expect(result.passedCount).toBe(9);
    expect(result.totalCount).toBe(9);
  });

  it('submitted through the Task Page shows the same result', async () => {
    const user = userEvent.setup();
    const seeded: SessionState = { ...initialSessionState(), canvasTree: buildRequiredArchitecture() };
    render(<App initialState={seeded} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const evaluation = screen.getByRole('region', { name: 'Evaluation' });
    expect(within(evaluation).getByText('100')).toBeInTheDocument();
    expect(within(evaluation).getByText(/9 of 9 requirements met/)).toBeInTheDocument();
  });
});

describe('Scenario 4: a misplaced Node fails with a Recommendation', () => {
  it('reports the specific Rule and its corrective action when the ECS Cluster is in the wrong subnet', () => {
    let tree: CanvasTree = emptyTree();
    const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
      const r = addNode(tree, serviceId, parentId);
      tree = r.tree;
      return r.nodeId;
    };
    const vpc = add('vpc');
    const pub = add('public-subnet', vpc);
    add('ecs-cluster', pub); // wrong subnet — must be private

    const result = evaluate(tree, challenge02.rules);
    const clusterRule = result.results.find((r) => r.ruleId === 'ecs-cluster-in-private-subnet');

    expect(clusterRule?.passed).toBe(false);
    const rule = challenge02.rules.find((r) => r.id === 'ecs-cluster-in-private-subnet');
    expect(rule?.recommendation).toMatch(/private subnet/i);
  });
});
