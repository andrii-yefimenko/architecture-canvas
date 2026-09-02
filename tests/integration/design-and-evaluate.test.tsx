/**
 * US1 — design an architecture and receive an Evaluation.
 * Covers spec Acceptance Scenarios 1-6.
 *
 * Drag-and-drop itself is exercised through the reducer rather than simulated
 * pointer events: dnd-kit drags depend on layout measurements that jsdom does
 * not produce, so simulating them tests the mock, not the app. The drop ->
 * action translation is covered here; the drag gesture is verified manually
 * per quickstart.md.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { evaluate } from '@/domain/evaluator';
import type { CanvasTree, NodeId } from '@/domain/types';

// Predates routing: <App /> used to render Challenge #1's Task Page directly.
// '/' now renders the Catalog Page instead, so every test here points the
// route at Challenge #1's Task Page explicitly.
beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
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
  add('nat-gateway', pub);
  add('ec2-frontend', pub);
  const priv = add('private-subnet', vpc);
  add('ec2-backend', priv);
  add('rds', priv);
  return tree;
}

describe('Scenario 1: the Challenge is presented on load', () => {
  it('shows the title, description, and all Visible Requirements', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Requirements' });

    expect(within(panel).getByText(challenge01.title)).toBeInTheDocument();
    expect(within(panel).getByText(challenge01.description)).toBeInTheDocument();
    for (const requirement of challenge01.visibleRequirements) {
      expect(within(panel).getByText(requirement)).toBeInTheDocument();
    }
  });
});

describe('Scenario 2: the Service catalog is listed and grouped', () => {
  it('lists every Service under its category', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });

    for (const service of challenge01.services) {
      expect(within(panel).getByRole('button', { name: service.name })).toBeInTheDocument();
    }
    for (const category of new Set(challenge01.services.map((s) => s.category))) {
      expect(within(panel).getByText(category)).toBeInTheDocument();
    }
  });

  it('offers the two EC2 roles as separate entries (FR-010)', () => {
    render(<App />);
    const panel = screen.getByRole('region', { name: 'Services' });
    expect(within(panel).getByRole('button', { name: 'EC2 (Frontend)' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'EC2 (Backend)' })).toBeInTheDocument();
  });
});

describe('Scenarios 3-4: Nodes appear on the Canvas and nest', () => {
  it('starts with an empty Canvas', () => {
    render(<App />);
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });
});

describe('Scenario 5: a correct architecture scores exactly 100', () => {
  it('passes all 11 Rules (SC-002)', () => {
    const result = evaluate(buildRequiredArchitecture(), challenge01.rules);
    expect(result.score).toBe(100);
    expect(result.passedCount).toBe(11);
  });
});

describe('Scenario 6: a misplaced Node fails with a Recommendation', () => {
  it('reports the specific Rule and its corrective action', () => {
    let tree: CanvasTree = emptyTree();
    const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
      const r = addNode(tree, serviceId, parentId);
      tree = r.tree;
      return r.nodeId;
    };
    const vpc = add('vpc');
    const pub = add('public-subnet', vpc);
    add('ec2-backend', pub); // wrong subnet

    const result = evaluate(tree, challenge01.rules);
    const backendRule = result.results.find((r) => r.ruleId === 'ec2-backend-in-private-subnet');

    expect(backendRule?.passed).toBe(false);
    const rule = challenge01.rules.find((r) => r.id === 'ec2-backend-in-private-subnet');
    expect(rule?.recommendation).toMatch(/private subnet/i);
  });
});

describe('submission', () => {
  it('submit is always enabled, even with an empty Canvas (FR-019)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });

  it('an empty Canvas scores 0 and lists every Rule as failed (FR-025, SC-007)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const evaluation = screen.getByRole('region', { name: 'Evaluation' });
    expect(within(evaluation).getByText('0')).toBeInTheDocument();
    expect(within(evaluation).getByText(/0 of 11 requirements met/)).toBeInTheDocument();

    // Every Rule is shown, not only failures (FR-023).
    for (const rule of challenge01.rules) {
      expect(within(evaluation).getByText(rule.description)).toBeInTheDocument();
    }
    // Each failure carries its Recommendation (FR-024).
    for (const rule of challenge01.rules) {
      expect(within(evaluation).getByText(rule.recommendation)).toBeInTheDocument();
    }
  });

  it('accepts repeated submissions without locking the Canvas (FR-029)', async () => {
    const user = userEvent.setup();
    render(<App />);
    const submit = screen.getByRole('button', { name: 'Submit' });

    for (let i = 0; i < 3; i += 1) {
      await user.click(submit);
      expect(submit).toBeEnabled();
    }
    expect(screen.getByRole('region', { name: 'Evaluation' })).toBeInTheDocument();
  });

  it('shows no Evaluation before the first submission', () => {
    render(<App />);
    expect(screen.queryByRole('region', { name: 'Evaluation' })).not.toBeInTheDocument();
  });
});
