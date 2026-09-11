import { countNodes, findNode, getParentId } from '@/domain/canvas-tree';
import type { Evaluation } from '@/domain/types';
import { initialSessionState, sessionReducer, type SessionState } from './session-reducer';

const anEvaluation: Evaluation = {
  results: [{ ruleId: 'vpc-exists', passed: true }],
  passedCount: 1,
  totalCount: 1,
  score: 100,
};

const ORIGIN = { x: 0, y: 0 };

/** Root VPC containing a Public Subnet which contains an EC2 Frontend. */
function seeded() {
  let state = sessionReducer(initialSessionState(), {
    type: 'ADD_NODE',
    serviceId: 'vpc',
    parentId: null,
    position: { x: 10, y: 20 },
  });
  const vpcId = state.canvasTree.roots[0]!.id;

  state = sessionReducer(state, {
    type: 'ADD_NODE',
    serviceId: 'public-subnet',
    parentId: vpcId,
    position: { x: 30, y: 40 },
  });
  const publicId = findNode(state.canvasTree, vpcId)!.children[0]!.id;

  state = sessionReducer(state, {
    type: 'ADD_NODE',
    serviceId: 'ec2-frontend',
    parentId: publicId,
    position: { x: 50, y: 60 },
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
  it('starts empty with no Evaluation and no Layout', () => {
    const state = initialSessionState();
    expect(state.canvasTree.roots).toEqual([]);
    expect(state.revealedCategories).toEqual([]);
    expect(state.evaluation).toBeNull();
    expect(state.evaluationStale).toBe(false);
    expect(state.pendingDeletion).toBeNull();
    expect(state.layout).toEqual({});
  });
});

describe('ADD_NODE', () => {
  it('adds a Node at root', () => {
    const state = sessionReducer(initialSessionState(), {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: null,
      position: ORIGIN,
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
      position: ORIGIN,
    });
    expect(after).toBe(before);
  });

  it('records the new Node at its dispatched position (contracts/canvas-layout.md)', () => {
    const state = sessionReducer(initialSessionState(), {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: null,
      position: { x: 42, y: 84 },
    });
    const nodeId = state.canvasTree.roots[0]!.id;
    expect(state.layout[nodeId]).toEqual({ x: 42, y: 84 });
  });

  it('leaves layout unchanged when the add is rejected', () => {
    const before = initialSessionState();
    const after = sessionReducer(before, {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: 'missing',
      position: { x: 1, y: 1 },
    });
    expect(after.layout).toBe(before.layout);
  });

  it('merges displacedPositions atomically alongside the new Node (v0.3.6, directional push)', () => {
    const { state, vpcId, publicId } = seeded();
    const frontendId = findNode(state.canvasTree, publicId)!.children[0]!.id;

    const after = sessionReducer(state, {
      type: 'ADD_NODE',
      serviceId: 'ec2-backend',
      parentId: publicId,
      position: { x: 5, y: 5 },
      displacedPositions: { [frontendId]: { x: 200, y: 5 } },
    });

    const newNodeId = findNode(after.canvasTree, publicId)!.children.find((c) => c.serviceId === 'ec2-backend')!.id;
    expect(after.layout[newNodeId]).toEqual({ x: 5, y: 5 });
    expect(after.layout[frontendId]).toEqual({ x: 200, y: 5 }); // pushed sibling, same dispatch
    expect(after.layout[vpcId]).toEqual(state.layout[vpcId]); // unrelated Node untouched
  });

  it('is unaffected when displacedPositions is omitted', () => {
    const before = initialSessionState();
    const after = sessionReducer(before, {
      type: 'ADD_NODE',
      serviceId: 'vpc',
      parentId: null,
      position: { x: 1, y: 1 },
    });
    const nodeId = after.canvasTree.roots[0]!.id;
    expect(after.layout).toEqual({ [nodeId]: { x: 1, y: 1 } });
  });
});

describe('MOVE_NODE', () => {
  it('re-parents a Node with its subtree', () => {
    const { state, vpcId, publicId } = seeded();
    const moved = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: publicId,
      newParentId: null,
      position: { x: 99, y: 99 },
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
      position: { x: 0, y: 0 },
    });
    expect(after).toBe(state);
  });

  it('updates only the moved Node\'s own layout entry (contracts/canvas-layout.md case 8)', () => {
    const { state, publicId, frontendId } = seeded();
    const frontendBefore = state.layout[frontendId];

    const moved = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: publicId,
      newParentId: null,
      position: { x: 123, y: 456 },
    });

    expect(moved.layout[publicId]).toEqual({ x: 123, y: 456 });
    // The descendant's own entry is untouched — it stays correct because
    // positions are parent-relative, not because it was recomputed.
    expect(moved.layout[frontendId]).toBe(frontendBefore);
  });

  it('leaves layout unchanged when the move is rejected', () => {
    const { state, vpcId, frontendId } = seeded();
    const after = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: vpcId,
      newParentId: frontendId,
      position: { x: 7, y: 7 },
    });
    expect(after.layout).toBe(state.layout);
  });

  it('merges displacedPositions atomically alongside the moved Node (v0.3.6, directional push)', () => {
    const { state, vpcId, publicId, frontendId } = seeded();

    const moved = sessionReducer(state, {
      type: 'MOVE_NODE',
      nodeId: publicId,
      newParentId: null,
      position: { x: 20, y: 20 },
      displacedPositions: { [vpcId]: { x: 300, y: 20 } },
    });

    expect(moved.layout[publicId]).toEqual({ x: 20, y: 20 });
    expect(moved.layout[vpcId]).toEqual({ x: 300, y: 20 }); // pushed aside, same dispatch
    expect(moved.layout[frontendId]).toBe(state.layout[frontendId]); // untouched descendant
  });
});

describe('deletion and layout pruning', () => {
  it('deletes a childless Node immediately, with no confirmation', () => {
    const { state, frontendId } = seeded();
    const after = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: frontendId });
    expect(after.pendingDeletion).toBeNull();
    expect(findNode(after.canvasTree, frontendId)).toBeNull();
  });

  it('removes the deleted Node\'s layout entry on immediate delete', () => {
    const { state, frontendId } = seeded();
    const after = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: frontendId });
    expect(after.layout).not.toHaveProperty(frontendId);
  });

  it('defers deletion of a populated container pending confirmation', () => {
    const { state, publicId } = seeded();
    const after = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    expect(after.pendingDeletion).toBe(publicId);
    // Nothing removed yet.
    expect(findNode(after.canvasTree, publicId)).not.toBeNull();
    expect(after.layout[publicId]).toBeDefined();
  });

  it('CONFIRM_DELETE cascades to the whole subtree', () => {
    const { state, publicId, frontendId } = seeded();
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    const after = sessionReducer(pending, { type: 'CONFIRM_DELETE' });
    expect(findNode(after.canvasTree, publicId)).toBeNull();
    expect(findNode(after.canvasTree, frontendId)).toBeNull();
    expect(after.pendingDeletion).toBeNull();
  });

  it('CONFIRM_DELETE removes layout entries for the Node and every descendant, none orphaned', () => {
    const { state, vpcId, publicId, frontendId } = seeded();
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    const after = sessionReducer(pending, { type: 'CONFIRM_DELETE' });

    expect(after.layout).not.toHaveProperty(publicId);
    expect(after.layout).not.toHaveProperty(frontendId);
    // The surviving sibling keeps its own entry.
    expect(after.layout[vpcId]).toBeDefined();
  });

  it('CANCEL_DELETE clears the prompt, keeps the Node, and leaves layout untouched', () => {
    const { state, publicId } = seeded();
    const pending = sessionReducer(state, { type: 'REQUEST_DELETE', nodeId: publicId });
    const after = sessionReducer(pending, { type: 'CANCEL_DELETE' });
    expect(after.pendingDeletion).toBeNull();
    expect(findNode(after.canvasTree, publicId)).not.toBeNull();
    expect(after.layout).toBe(pending.layout);
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
    const after = sessionReducer(state, {
      type: 'ADD_NODE',
      serviceId: 'rds',
      parentId: null,
      position: ORIGIN,
    });
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
      position: ORIGIN,
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
      position: ORIGIN,
    });
    expect(after.evaluationStale).toBe(false);
  });

  it('SUBMIT replaces the Evaluation and clears staleness', () => {
    const stale = sessionReducer(withEvaluation(), {
      type: 'ADD_NODE',
      serviceId: 'rds',
      parentId: null,
      position: ORIGIN,
    });
    expect(stale.evaluationStale).toBe(true);

    const fresh: Evaluation = { ...anEvaluation, score: 50, passedCount: 0 };
    const after = sessionReducer(stale, { type: 'SUBMIT', evaluation: fresh });
    expect(after.evaluation).toBe(fresh);
    expect(after.evaluationStale).toBe(false);
  });
});

describe('RESTORE', () => {
  it('restores the tree, revealed Categories, and layout', () => {
    const { state } = seeded();
    const after = sessionReducer(initialSessionState(), {
      type: 'RESTORE',
      canvasTree: state.canvasTree,
      revealedCategories: ['infrastructure', 'data-tier'],
      layout: state.layout,
    });
    expect(countNodes(after.canvasTree)).toBe(3);
    expect(after.revealedCategories).toEqual(['infrastructure', 'data-tier']);
    expect(after.layout).toEqual(state.layout);
  });

  it('leaves the Evaluation null (FR-034)', () => {
    const state = withEvaluation();
    const after = sessionReducer(state, {
      type: 'RESTORE',
      canvasTree: state.canvasTree,
      revealedCategories: [],
      layout: state.layout,
    });
    expect(after.evaluation).toBeNull();
    expect(after.evaluationStale).toBe(false);
  });
});
