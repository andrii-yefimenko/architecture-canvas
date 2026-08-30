import { countNodes, findNode, getParentId } from '@/domain/canvas-tree';
import type { Evaluation } from '@/domain/types';
import { initialSessionState, sessionReducer, type SessionState } from './session-reducer';

const anEvaluation: Evaluation = {
  results: [{ ruleId: 'vpc-exists', passed: true }],
  passedCount: 1,
  totalCount: 1,
  score: 100,
};

/** Root VPC containing a Public Subnet which contains an EC2 Frontend. */
function seeded() {
  let state = sessionReducer(initialSessionState(), {
    type: 'ADD_NODE',
    serviceId: 'vpc',
    parentId: null,
  });
  const vpcId = state.canvasTree.roots[0]!.id;

  state = sessionReducer(state, { type: 'ADD_NODE', serviceId: 'public-subnet', parentId: vpcId });
  const publicId = findNode(state.canvasTree, vpcId)!.children[0]!.id;

  state = sessionReducer(state, {
    type: 'ADD_NODE',
    serviceId: 'ec2-frontend',
    parentId: publicId,
  });
  const frontendId = findNode(state.canvasTree, publicId)!.children[0]!.id;

  return { state, vpcId, publicId, frontendId };
}

/** Same tree, but with an Evaluation already present and fresh. */
function withEvaluation(): SessionState {
  const { state } = seeded();
  return sessionReducer(state, { type: 'SUBMIT', evaluation: anEvaluation });
}

describe('initialSessionState', () => {
  it('starts empty with no Evaluation', () => {
    const state = initialSessionState();
    expect(state.canvasTree.roots).toEqual([]);
    expect(state.revealedCategories).toEqual([]);
    expect(state.evaluation).toBeNull();
    expect(state.evaluationStale).toBe(false);
    expect(state.pendingDeletion).toBeNull();
  });
});

describe('ADD_NODE', () => {
  it('adds a Node at root', () => {
    const state = sessionReducer(initialSessionState(), {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: null,
    });
    expect(state.canvasTree.roots).toHaveLength(1);
  });

  it('adds a Node inside a parent', () => {
    const { state, vpcId, publicId } = seeded();
    expect(getParentId(state.canvasTree, publicId)).toBe(vpcId);
  });

  it('returns the same state when the parent does not exist', () => {
    const before = initialSessionState();
    const after = sessionReducer(before, {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: 'missing',
    });
    expect(after).toBe(before);
  });
});

describe('MOVE_NODE', () => {
  it('re-parents a Node with its subtree', () => {
    const { state, vpcId, publicId } = seeded();
    const moved = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: publicId,
      newParentId: null,
    });
    expect(getParentId(moved.canvasTree, publicId)).toBeNull();
    expect(countNodes(moved.canvasTree)).toBe(countNodes(state.canvasTree));
    expect(vpcId).toBeTruthy();
  });

  it('returns the same state when the cycle guard rejects the move', () => {
    const { state, vpcId, frontendId } = seeded();
    const after = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: vpcId,
      newParentId: frontendId,
    });
    expect(after).toBe(state);
  });
});

describe('deletion', () => {
  it('deletes a childless Node immediately, with no confirmation', () => {
    const { state, frontendId } = seeded();
    const after = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: frontendId });
    expect(after.pendingDeletion).toBeNull();
    expect(findNode(after.canvasTree, frontendId)).toBeNull();
  });

  it('defers deletion of a populated container pending confirmation', () => {
    const { state, publicId } = seeded();
    const after = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    expect(after.pendingDeletion).toBe(publicId);
    // Nothing removed yet.
    expect(findNode(after.canvasTree, publicId)).not.toBeNull();
  });

  it('CONFIRM_DELETE cascades to the whole subtree', () => {
    const { state, publicId, frontendId } = seeded();
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    const after = sessionReducer(pending, { type: 'CONFIRM_DELETE' });
    expect(findNode(after.canvasTree, publicId)).toBeNull();
    expect(findNode(after.canvasTree, frontendId)).toBeNull();
    expect(after.pendingDeletion).toBeNull();
  });

  it('CANCEL_DELETE clears the prompt and keeps the Node', () => {
    const { state, publicId } = seeded();
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    const after = sessionReducer(pending, { type: 'CANCEL_DELETE' });
    expect(after.pendingDeletion).toBeNull();
    expect(findNode(after.canvasTree, publicId)).not.toBeNull();
  });

  it('CONFIRM_DELETE with nothing pending is a no-op', () => {
    const { state } = seeded();
    expect(sessionReducer(state, { type: 'CONFIRM_DELETE' })).toBe(state);
  });
});

describe('REVEAL_CATEGORY', () => {
  it('records a revealed Category', () => {
    const after = sessionReducer(initialSessionState(), {
      type: 'REVEAL_CATEGORY',
      categoryId: 'data-tier',
    });
    expect(after.revealedCategories).toEqual(['data-tier']);
  });

  it('is idempotent', () => {
    const once = sessionReducer(initialSessionState(), {
      type: 'REVEAL_CATEGORY',
      categoryId: 'data-tier',
    });
    expect(sessionReducer(once, { type: 'REVEAL_CATEGORY', categoryId: 'data-tier' })).toBe(once);
  });

  it('never touches the Evaluation or mark it stale (FR-007)', () => {
    const state = withEvaluation();
    const after = sessionReducer(state, { type: 'REVEAL_CATEGORY', categoryId: 'data-tier' });
    expect(after.evaluation).toBe(state.evaluation);
    expect(after.evaluationStale).toBe(false);
  });
});

describe('staleness (FR-030, FR-031)', () => {
  it('ADD_NODE marks an existing Evaluation stale but keeps it visible', () => {
    const state = withEvaluation();
    const after = sessionReducer(state, { type: 'ADD_NODE', serviceId: 'rds', parentId: null });
    expect(after.evaluationStale).toBe(true);
    expect(after.evaluation).toBe(anEvaluation);
  });

  it('MOVE_NODE marks stale', () => {
    const state = withEvaluation();
    const publicId = state.canvasTree.roots[0]!.children[0]!.id;
    const after = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: publicId,
      newParentId: null,
    });
    expect(after.evaluationStale).toBe(true);
  });

  it('CONFIRM_DELETE marks stale', () => {
    const state = withEvaluation();
    const publicId = state.canvasTree.roots[0]!.children[0]!.id;
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    expect(sessionReducer(pending, { type: 'CONFIRM_DELETE' }).evaluationStale).toBe(true);
  });

  it('does not mark stale when no Evaluation exists yet', () => {
    const { state } = seeded();
    expect(state.evaluation).toBeNull();
    expect(state.evaluationStale).toBe(false);
  });

  it('a rejected move does not mark stale', () => {
    const state = withEvaluation();
    const vpcId = state.canvasTree.roots[0]!.id;
    const frontendId = state.canvasTree.roots[0]!.children[0]!.children[0]!.id;
    const after = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: vpcId,
      newParentId: frontendId,
    });
    expect(after.evaluationStale).toBe(false);
  });

  it('SUBMIT replaces the Evaluation and clears staleness', () => {
    const stale = sessionReducer(withEvaluation(), {
      type: 'ADD_NODE',
      serviceId: 'rds',
      parentId: null,
    });
    expect(stale.evaluationStale).toBe(true);

    const fresh: Evaluation = { ...anEvaluation, score: 50, passedCount: 0 };
    const after = sessionReducer(stale, { type: 'SUBMIT', evaluation: fresh });
    expect(after.evaluation).toBe(fresh);
    expect(after.evaluationStale).toBe(false);
  });
});

describe('RESTORE', () => {
  it('restores the tree and revealed Categories', () => {
    const { state } = seeded();
    const after = sessionReducer(initialSessionState(), {
      type: 'RESTORE',
      canvasTree: state.canvasTree,
      revealedCategories: ['infrastructure', 'data-tier'],
    });
    expect(countNodes(after.canvasTree)).toBe(3);
    expect(after.revealedCategories).toEqual(['infrastructure', 'data-tier']);
  });

  it('leaves the Evaluation null (FR-034)', () => {
    const state = withEvaluation();
    const after = sessionReducer(state, {
      type: 'RESTORE',
      canvasTree: state.canvasTree,
      revealedCategories: [],
    });
    expect(after.evaluation).toBeNull();
    expect(after.evaluationStale).toBe(false);
  });
});
