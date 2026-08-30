import {
  addNode,
  countNodes,
  emptyTree,
  findNode,
  getDepth,
  getParentId,
  hasChildren,
  isDescendant,
  moveNode,
  removeNode,
} from './canvas-tree';
import type { CanvasTree } from './types';

/** Builds VPC > [Public Subnet > [EC2 Frontend], Private Subnet] and returns ids. */
function buildNestedTree() {
  let tree = emptyTree();
  let r = addNode(tree, 'vpc', null);
  tree = r.tree;
  const vpcId = r.nodeId;

  r = addNode(tree, 'public-subnet', vpcId);
  tree = r.tree;
  const publicId = r.nodeId;

  r = addNode(tree, 'private-subnet', vpcId);
  tree = r.tree;
  const privateId = r.nodeId;

  r = addNode(tree, 'ec2-frontend', publicId);
  tree = r.tree;
  const frontendId = r.nodeId;

  return { tree, vpcId, publicId, privateId, frontendId };
}

describe('emptyTree', () => {
  it('has no roots', () => {
    expect(emptyTree().roots).toEqual([]);
  });
});

describe('addNode', () => {
  it('adds a Node at root when parentId is null', () => {
    const { tree, nodeId } = addNode(emptyTree(), 'vpc', null);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]?.id).toBe(nodeId);
    expect(tree.roots[0]?.serviceId).toBe('vpc');
    expect(tree.roots[0]?.children).toEqual([]);
  });

  it('adds a Node as a child of the given parent', () => {
    const first = addNode(emptyTree(), 'vpc', null);
    const second = addNode(first.tree, 'public-subnet', first.nodeId);
    const vpc = findNode(second.tree, first.nodeId);
    expect(vpc?.children).toHaveLength(1);
    expect(vpc?.children[0]?.serviceId).toBe('public-subnet');
  });

  it('gives every Node a distinct id, including Nodes of the same Service', () => {
    const a = addNode(emptyTree(), 'vpc', null);
    const b = addNode(a.tree, 'vpc', null);
    expect(a.nodeId).not.toBe(b.nodeId);
    expect(b.tree.roots).toHaveLength(2);
  });

  it('returns the tree unchanged when the parent does not exist', () => {
    const tree = emptyTree();
    const { tree: result } = addNode(tree, 'vpc', 'missing-id');
    expect(result).toEqual(tree);
  });

  it('does not mutate the input tree', () => {
    const tree = emptyTree();
    addNode(tree, 'vpc', null);
    expect(tree.roots).toEqual([]);
  });
});

describe('findNode', () => {
  it('finds a deeply nested Node', () => {
    const { tree, frontendId } = buildNestedTree();
    expect(findNode(tree, frontendId)?.serviceId).toBe('ec2-frontend');
  });

  it('returns null for an unknown id', () => {
    expect(findNode(buildNestedTree().tree, 'nope')).toBeNull();
  });
});

describe('getParentId', () => {
  it('returns null for a root Node', () => {
    const { tree, vpcId } = buildNestedTree();
    expect(getParentId(tree, vpcId)).toBeNull();
  });

  it('returns the direct parent id for a nested Node', () => {
    const { tree, publicId, frontendId } = buildNestedTree();
    expect(getParentId(tree, frontendId)).toBe(publicId);
  });

  it('returns null for an unknown id', () => {
    expect(getParentId(buildNestedTree().tree, 'nope')).toBeNull();
  });
});

describe('getDepth', () => {
  it('reports 0 for roots and increments per level', () => {
    const { tree, vpcId, publicId, frontendId } = buildNestedTree();
    expect(getDepth(tree, vpcId)).toBe(0);
    expect(getDepth(tree, publicId)).toBe(1);
    expect(getDepth(tree, frontendId)).toBe(2);
  });

  it('returns -1 for an unknown id', () => {
    expect(getDepth(buildNestedTree().tree, 'nope')).toBe(-1);
  });
});

describe('hasChildren', () => {
  it('is true for a container and false for a leaf', () => {
    const { tree, publicId, frontendId } = buildNestedTree();
    expect(hasChildren(tree, publicId)).toBe(true);
    expect(hasChildren(tree, frontendId)).toBe(false);
  });
});

describe('isDescendant', () => {
  it('is true for a nested descendant at any depth', () => {
    const { tree, vpcId, frontendId } = buildNestedTree();
    expect(isDescendant(tree, vpcId, frontendId)).toBe(true);
  });

  it('is false in the reverse direction', () => {
    const { tree, vpcId, frontendId } = buildNestedTree();
    expect(isDescendant(tree, frontendId, vpcId)).toBe(false);
  });

  it('is false for a Node against itself', () => {
    const { tree, vpcId } = buildNestedTree();
    expect(isDescendant(tree, vpcId, vpcId)).toBe(false);
  });
});

describe('moveNode', () => {
  it('re-parents a Node together with its whole subtree', () => {
    const { tree, privateId, publicId, frontendId } = buildNestedTree();
    const moved = moveNode(tree, publicId, privateId);

    expect(getParentId(moved, publicId)).toBe(privateId);
    // The frontend travelled with its parent (FR-015).
    expect(getParentId(moved, frontendId)).toBe(publicId);
    expect(getDepth(moved, frontendId)).toBe(3);
    expect(countNodes(moved)).toBe(countNodes(tree));
  });

  it('moves a nested Node out to the root', () => {
    const { tree, frontendId } = buildNestedTree();
    const moved = moveNode(tree, frontendId, null);
    expect(getParentId(moved, frontendId)).toBeNull();
    expect(getDepth(moved, frontendId)).toBe(0);
  });

  it('allows structurally absurd placements (FR-012)', () => {
    // A VPC inside an EC2 instance is nonsense architecture, but the Canvas
    // accepts it and leaves the judgement to the Evaluation.
    const { tree, vpcId, frontendId } = buildNestedTree();
    const r = addNode(tree, 'vpc', null);
    const moved = moveNode(r.tree, r.nodeId, frontendId);
    expect(getParentId(moved, r.nodeId)).toBe(frontendId);
    expect(vpcId).not.toBe(r.nodeId);
  });

  // --- The cycle invariant (research R-02) ---------------------------------

  it('rejects moving a Node into its own subtree', () => {
    const { tree, vpcId, frontendId } = buildNestedTree();
    expect(moveNode(tree, vpcId, frontendId)).toEqual(tree);
  });

  it('rejects moving a Node into its direct child', () => {
    const { tree, vpcId, publicId } = buildNestedTree();
    expect(moveNode(tree, vpcId, publicId)).toEqual(tree);
  });

  it('rejects moving a Node into itself', () => {
    const { tree, vpcId } = buildNestedTree();
    expect(moveNode(tree, vpcId, vpcId)).toEqual(tree);
  });

  it('returns the tree unchanged for an unknown node or parent', () => {
    const { tree, vpcId } = buildNestedTree();
    expect(moveNode(tree, 'nope', vpcId)).toEqual(tree);
    expect(moveNode(tree, vpcId, 'nope')).toEqual(tree);
  });

  it('does not mutate the input tree', () => {
    const { tree, frontendId, privateId } = buildNestedTree();
    const before = JSON.stringify(tree);
    moveNode(tree, frontendId, privateId);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('removeNode', () => {
  it('removes a leaf Node', () => {
    const { tree, frontendId } = buildNestedTree();
    const result = removeNode(tree, frontendId);
    expect(findNode(result, frontendId)).toBeNull();
    expect(countNodes(result)).toBe(countNodes(tree) - 1);
  });

  it('cascades to the entire subtree (FR-016)', () => {
    const { tree, publicId, frontendId } = buildNestedTree();
    const result = removeNode(tree, publicId);
    expect(findNode(result, publicId)).toBeNull();
    expect(findNode(result, frontendId)).toBeNull();
    expect(countNodes(result)).toBe(2);
  });

  it('removes a root Node and everything under it', () => {
    const { tree, vpcId } = buildNestedTree();
    const result = removeNode(tree, vpcId);
    expect(result.roots).toEqual([]);
    expect(countNodes(result)).toBe(0);
  });

  it('returns the tree unchanged for an unknown id', () => {
    const { tree } = buildNestedTree();
    expect(removeNode(tree, 'nope')).toEqual(tree);
  });

  it('does not mutate the input tree', () => {
    const { tree, publicId } = buildNestedTree();
    const before = JSON.stringify(tree);
    removeNode(tree, publicId);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('countNodes', () => {
  it('counts every Node at every depth', () => {
    expect(countNodes(buildNestedTree().tree)).toBe(4);
    expect(countNodes(emptyTree() as CanvasTree)).toBe(0);
  });
});
