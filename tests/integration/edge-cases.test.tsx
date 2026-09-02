/**
 * T058 — the edge-case table from quickstart.md, as executable assertions.
 *
 * quickstart.md lists these as a manual pass. Encoding them keeps them honest:
 * several describe behaviour that is correct precisely because nothing
 * happens, which is exactly the kind of thing a later "improvement" silently
 * removes.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree, findNode, getParentId, moveNode } from '@/domain/canvas-tree';
import { evaluate } from '@/domain/evaluator';
import type { CanvasTree, NodeId } from '@/domain/types';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

// Predates routing: <App /> used to render Challenge #1's Task Page directly.
// '/' now renders the Catalog Page instead, so every test here points the
// route at Challenge #1's Task Page explicitly.
beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

function tree() {
  let t: CanvasTree = emptyTree();
  return {
    add(serviceId: string, parentId: NodeId | null = null): NodeId {
      const r = addNode(t, serviceId, parentId);
      t = r.tree;
      return r.nodeId;
    },
    get value() {
      return t;
    },
    state(): SessionState {
      return { ...initialSessionState(), canvasTree: t };
    },
  };
}

const ruleOf = (r: ReturnType<typeof evaluate>, id: string) =>
  r.results.find((x) => x.ruleId === id)?.passed;

describe('submitting an untouched Canvas', () => {
  it('scores 0 with 11 Recommendations, and was never blocked (FR-025, SC-007)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    const region = screen.getByRole('region', { name: 'Evaluation' });
    expect(within(region).getByText(/0 of 11 requirements met/)).toBeInTheDocument();
    for (const rule of challenge01.rules) {
      expect(within(region).getByText(rule.recommendation)).toBeInTheDocument();
    }
  });
});

describe('duplicate Nodes', () => {
  it('two VPCs with one correct arrangement still passes (FR-022)', () => {
    const t = tree();
    t.add('vpc'); // stray duplicate
    const vpc = t.add('vpc');
    const priv = t.add('private-subnet', vpc);
    t.add('rds', priv);

    const result = evaluate(t.value, challenge01.rules);
    expect(ruleOf(result, 'vpc-exists')).toBe(true);
    expect(ruleOf(result, 'rds-in-private-subnet')).toBe(true);
  });

  it('duplicates neither raise nor lower the Score', () => {
    const single = tree();
    const v1 = single.add('vpc');
    single.add('private-subnet', v1);

    const duped = tree();
    const v2 = duped.add('vpc');
    duped.add('private-subnet', v2);
    duped.add('vpc');
    duped.add('vpc');

    expect(evaluate(duped.value, challenge01.rules).score).toBe(
      evaluate(single.value, challenge01.rules).score,
    );
  });
});

describe('over-nesting', () => {
  it('one level too deep fails containment (FR-021)', () => {
    const t = tree();
    const vpc = t.add('vpc');
    const priv = t.add('private-subnet', vpc);
    const extra = t.add('vpc', priv); // an unexpected wrapper
    t.add('ec2-backend', extra);

    const result = evaluate(t.value, challenge01.rules);
    expect(ruleOf(result, 'ec2-backend-present')).toBe(true);
    expect(ruleOf(result, 'ec2-backend-in-private-subnet')).toBe(false);
  });
});

describe('structurally absurd placement is allowed (FR-012)', () => {
  it('accepts a VPC inside an RDS and judges it rather than blocking it', () => {
    const t = tree();
    const rds = t.add('rds');
    const vpc = t.add('vpc', rds);

    expect(getParentId(t.value, vpc)).toBe(rds);
    expect(() => evaluate(t.value, challenge01.rules)).not.toThrow();
    expect(ruleOf(evaluate(t.value, challenge01.rules), 'vpc-exists')).toBe(true);
  });
});

describe('the cycle guard is the only rejected placement (research R-02)', () => {
  it('refuses to move a container into its own child, leaving the tree untouched', () => {
    const t = tree();
    const vpc = t.add('vpc');
    const pub = t.add('public-subnet', vpc);

    const after = moveNode(t.value, vpc, pub);
    expect(after).toBe(t.value);
    expect(getParentId(after, vpc)).toBeNull();
  });
});

describe('deleting Nodes', () => {
  it('prompts before removing a populated container, then cascades (FR-016, FR-017)', async () => {
    const user = userEvent.setup();
    const t = tree();
    const vpc = t.add('vpc');
    const pub = t.add('public-subnet', vpc);
    t.add('nat-gateway', pub);
    t.add('ec2-frontend', pub);

    render(<App initialState={t.state()} />);

    await user.click(screen.getByRole('button', { name: 'Remove Public Subnet' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/2 nested services/i)).toBeInTheDocument();
    // Nothing removed while the prompt is open.
    expect(screen.getByRole('button', { name: 'Remove NAT Gateway' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByRole('button', { name: 'Remove Public Subnet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove NAT Gateway' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove EC2 (Frontend)' })).not.toBeInTheDocument();
    // The parent survives.
    expect(screen.getByRole('button', { name: 'Remove VPC' })).toBeInTheDocument();
  });

  it('cancelling the prompt keeps the whole subtree', async () => {
    const user = userEvent.setup();
    const t = tree();
    const vpc = t.add('vpc');
    t.add('rds', vpc);

    render(<App initialState={t.state()} />);
    await user.click(screen.getByRole('button', { name: 'Remove VPC' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Remove VPC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove RDS' })).toBeInTheDocument();
  });

  it('removes an empty Node immediately, with no prompt', async () => {
    const user = userEvent.setup();
    const t = tree();
    t.add('rds');

    render(<App initialState={t.state()} />);
    await user.click(screen.getByRole('button', { name: 'Remove RDS' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove RDS' })).not.toBeInTheDocument();
  });
});

describe('a Service dropped at Canvas root', () => {
  it('is valid to place but fails any containment Rule', () => {
    const t = tree();
    const rds = t.add('rds');
    expect(findNode(t.value, rds)).not.toBeNull();

    const result = evaluate(t.value, challenge01.rules);
    expect(ruleOf(result, 'rds-present')).toBe(true);
    expect(ruleOf(result, 'rds-in-private-subnet')).toBe(false);
  });
});

describe('revealing every Category', () => {
  it('leaves the Score untouched (FR-007)', async () => {
    const user = userEvent.setup();
    const t = tree();
    t.add('vpc');

    render(<App initialState={t.state()} />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    const before = within(screen.getByRole('region', { name: 'Evaluation' })).getByText(
      /of 11 requirements met/,
    ).textContent;

    const panel = screen.getByRole('region', { name: 'Requirements' });
    for (const category of challenge01.hiddenRequirementCategories) {
      const matcher = new RegExp(category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      await user.click(within(panel).getByRole('button', { name: matcher }));
    }
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(
      within(screen.getByRole('region', { name: 'Evaluation' })).getByText(
        /of 11 requirements met/,
      ).textContent,
    ).toBe(before);
  });
});
