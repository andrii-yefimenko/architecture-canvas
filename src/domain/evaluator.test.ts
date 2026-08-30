/**
 * The 11 evaluator contract cases from contracts/evaluator.md.
 *
 * These are the behaviours a change must not break. The evaluator silently
 * returning a wrong Score is the one defect users will not report — they will
 * just stop trusting the product — so this file is exhaustive by design.
 */

import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree } from './canvas-tree';
import { evaluate } from './evaluator';
import type { CanvasTree, NodeId, Rule } from './types';

const rules = challenge01.rules;

/** Fluent tree builder: add(serviceId, parentId?) returns the new Node's id. */
function builder() {
  let tree: CanvasTree = emptyTree();
  return {
    add(serviceId: string, parentId: NodeId | null = null): NodeId {
      const result = addNode(tree, serviceId, parentId);
      tree = result.tree;
      return result.nodeId;
    },
    get tree() {
      return tree;
    },
  };
}

/** The Required Architecture from MVP.md. */
function correctTree(): CanvasTree {
  const b = builder();
  const vpc = b.add('vpc');
  b.add('internet-gateway', vpc);
  const pub = b.add('public-subnet', vpc);
  b.add('nat-gateway', pub);
  b.add('ec2-frontend', pub);
  const priv = b.add('private-subnet', vpc);
  b.add('ec2-backend', priv);
  b.add('rds', priv);
  return b.tree;
}

const passed = (r: ReturnType<typeof evaluate>, id: string) =>
  r.results.find((x) => x.ruleId === id)?.passed;

describe('contract guarantees', () => {
  it('reports every Rule, passing or failing (FR-023)', () => {
    const result = evaluate(correctTree(), rules);
    expect(result.results).toHaveLength(rules.length);
    expect(result.totalCount).toBe(rules.length);
  });

  it('preserves Rule order so the checklist is stable', () => {
    const result = evaluate(emptyTree(), rules);
    expect(result.results.map((r) => r.ruleId)).toEqual(rules.map((r) => r.id));
  });
});

// --- Case 1 ----------------------------------------------------------------
describe('case 1: empty tree', () => {
  it('fails every Rule and scores 0 (FR-025)', () => {
    const result = evaluate(emptyTree(), rules);
    expect(result.results.every((r) => !r.passed)).toBe(true);
    expect(result.passedCount).toBe(0);
    expect(result.score).toBe(0);
  });
});

// --- Case 2 ----------------------------------------------------------------
describe('case 2: the Required Architecture', () => {
  it('passes every Rule and scores exactly 100 (SC-002)', () => {
    const result = evaluate(correctTree(), rules);
    expect(result.results.filter((r) => !r.passed)).toEqual([]);
    expect(result.passedCount).toBe(11);
    expect(result.score).toBe(100);
  });
});

// --- Case 3 ----------------------------------------------------------------
describe('case 3: empty rule set', () => {
  it('returns no results and scores 0 without throwing', () => {
    const result = evaluate(correctTree(), []);
    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.score).toBe(0);
  });
});

// --- Case 4 ----------------------------------------------------------------
describe('case 4: an extra wrapper level', () => {
  it('fails containment, because only a DIRECT parent counts (FR-021)', () => {
    const b = builder();
    const vpc = b.add('vpc');
    const pub = b.add('public-subnet', vpc);
    // One level too deep: frontend sits inside a nested VPC, not the subnet.
    const wrapper = b.add('vpc', pub);
    b.add('ec2-frontend', wrapper);

    const result = evaluate(b.tree, rules);
    expect(passed(result, 'ec2-frontend-present')).toBe(true);
    expect(passed(result, 'ec2-frontend-in-public-subnet')).toBe(false);
  });
});

// --- Case 5 ----------------------------------------------------------------
describe('case 5: a root-level Node', () => {
  it('fails any containment Rule, since roots have no parent', () => {
    const b = builder();
    b.add('rds');
    const result = evaluate(b.tree, rules);
    expect(passed(result, 'rds-present')).toBe(true);
    expect(passed(result, 'rds-in-private-subnet')).toBe(false);
  });
});

// --- Case 6 ----------------------------------------------------------------
describe('case 6: duplicates with one placed correctly', () => {
  it('passes — Rules are existential (FR-022)', () => {
    const b = builder();
    const vpc = b.add('vpc');
    const priv = b.add('private-subnet', vpc);
    b.add('rds'); // misplaced at root
    b.add('rds', priv); // correctly placed
    b.add('rds', vpc); // misplaced again

    expect(passed(evaluate(b.tree, rules), 'rds-in-private-subnet')).toBe(true);
  });
});

// --- Case 7 ----------------------------------------------------------------
describe('case 7: duplicates all misplaced', () => {
  it('fails the containment Rule', () => {
    const b = builder();
    const vpc = b.add('vpc');
    b.add('rds', vpc);
    b.add('rds');
    expect(passed(evaluate(b.tree, rules), 'rds-in-private-subnet')).toBe(false);
  });
});

// --- Case 8 ----------------------------------------------------------------
describe('case 8: correct tree plus unrelated extras', () => {
  it('still passes everything — extras are inert (FR-022)', () => {
    const b = builder();
    const vpc = b.add('vpc');
    b.add('internet-gateway', vpc);
    const pub = b.add('public-subnet', vpc);
    b.add('nat-gateway', pub);
    b.add('ec2-frontend', pub);
    const priv = b.add('private-subnet', vpc);
    b.add('ec2-backend', priv);
    b.add('rds', priv);
    // Distractors scattered around.
    b.add('lambda', pub);
    b.add('dynamodb', priv);
    b.add('s3');
    b.add('cloudfront', vpc);

    const result = evaluate(b.tree, rules);
    expect(result.passedCount).toBe(11);
    expect(result.score).toBe(100);
  });
});

// --- Case 9 ----------------------------------------------------------------
describe('case 9: structurally absurd nesting', () => {
  it('does not throw and judges Rules normally', () => {
    const b = builder();
    const rds = b.add('rds');
    const vpc = b.add('vpc', rds); // a VPC inside a database
    const pub = b.add('public-subnet', vpc);
    b.add('ec2-frontend', pub);

    expect(() => evaluate(b.tree, rules)).not.toThrow();
    const result = evaluate(b.tree, rules);
    expect(passed(result, 'ec2-frontend-in-public-subnet')).toBe(true);
    expect(passed(result, 'rds-in-private-subnet')).toBe(false);
  });

  it('handles a deep chain without throwing', () => {
    const b = builder();
    let parent: NodeId | null = null;
    for (let i = 0; i < 40; i += 1) parent = b.add('vpc', parent);
    expect(() => evaluate(b.tree, rules)).not.toThrow();
  });
});

// --- Case 10 ---------------------------------------------------------------
describe('case 10: determinism', () => {
  it('produces identical results for the same tree', () => {
    const tree = correctTree();
    expect(evaluate(tree, rules)).toEqual(evaluate(tree, rules));
  });
});

// --- Case 11 ---------------------------------------------------------------
describe('case 11: purity', () => {
  it('does not mutate its inputs', () => {
    const tree = correctTree();
    const treeBefore = JSON.stringify(tree);
    const rulesBefore = JSON.stringify(rules);

    evaluate(tree, rules);

    expect(JSON.stringify(tree)).toBe(treeBefore);
    expect(JSON.stringify(rules)).toBe(rulesBefore);
  });
});

describe('per-Rule semantics', () => {
  it('a presence Rule passes on a Node anywhere in the tree', () => {
    const b = builder();
    const vpc = b.add('vpc');
    const pub = b.add('public-subnet', vpc);
    b.add('ec2-backend', pub); // present, wrong subnet
    const result = evaluate(b.tree, rules);
    expect(passed(result, 'ec2-backend-present')).toBe(true);
    expect(passed(result, 'ec2-backend-in-private-subnet')).toBe(false);
  });

  it('scores partial credit proportionally', () => {
    const b = builder();
    b.add('vpc'); // only Rule 1 passes
    const result = evaluate(b.tree, rules);
    expect(result.passedCount).toBe(1);
    expect(result.score).toBeCloseTo(9.0909, 3);
  });

  it('handles an unknown serviceId in a Rule as a failure, not a crash', () => {
    const rogue: Rule[] = [
      {
        id: 'rogue',
        kind: 'presence',
        serviceId: 'does-not-exist',
        description: 'x',
        recommendation: 'y',
      },
    ];
    expect(evaluate(correctTree(), rogue).results[0]?.passed).toBe(false);
  });
});
