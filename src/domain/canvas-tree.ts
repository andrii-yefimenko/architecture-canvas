/**
 * Pure Canvas Tree operations.
 *
 * Every function returns a new tree and never mutates its input, so React can
 * rely on reference identity and the reducer stays trivially testable.
 *
 * The tree is nested (each Node carries `children`) rather than a flat
 * parent-pointer map: it matches the "Canvas JSON tree structure" MVP.md
 * describes, it is the persisted shape, and it renders directly through a
 * recursive component. At 5-20 Nodes the traversal cost is irrelevant.
 */

import type { CanvasTree, Node, NodeId, ServiceId } from './types';

export function emptyTree(): CanvasTree {
  return { roots: [] };
}

/** Depth-first walk over every Node in the tree. */
function* walk(tree: CanvasTree): Generator<Node> {
  const stack: Node[] = [...tree.roots];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    yield node;
    stack.push(...node.children);
  }
}

export function findNode(tree: CanvasTree, nodeId: NodeId): Node | null {
  for (const node of walk(tree)) {
    if (node.id === nodeId) return node;
  }
  return null;
}

export function countNodes(tree: CanvasTree): number {
  const count = (nodes: readonly Node[]): number =>
    nodes.reduce((total, node) => total + 1 + count(node.children), 0);
  return count(tree.roots);
}

/** The Evaluation's primitive for direct-containment checks. Null at root. */
export function getParentId(tree: CanvasTree, nodeId: NodeId): NodeId | null {
  for (const node of walk(tree)) {
    if (node.children.some((child) => child.id === nodeId)) return node.id;
  }
  return null;
}

/** Roots are depth 0. Returns -1 when the Node is not in the tree. */
export function getDepth(tree: CanvasTree, nodeId: NodeId): number {
  const search = (nodes: readonly Node[], depth: number): number => {
    for (const node of nodes) {
      if (node.id === nodeId) return depth;
      const found = search(node.children, depth + 1);
      if (found !== -1) return found;
    }
    return -1;
  };
  return search(tree.roots, 0);
}

export function hasChildren(tree: CanvasTree, nodeId: NodeId): boolean {
  return (findNode(tree, nodeId)?.children.length ?? 0) > 0;
}

/** True when `candidateId` sits anywhere beneath `ancestorId`. Backs the cycle guard. */
export function isDescendant(
  tree: CanvasTree,
  ancestorId: NodeId,
  candidateId: NodeId,
): boolean {
  const ancestor = findNode(tree, ancestorId);
  if (!ancestor) return false;
  const subtree: CanvasTree = { roots: [...ancestor.children] };
  for (const node of walk(subtree)) {
    if (node.id === candidateId) return true;
  }
  return false;
}

/** Rebuilds the tree, replacing the children of `parentId` via `transform`. */
function mapChildren(
  nodes: readonly Node[],
  parentId: NodeId,
  transform: (children: readonly Node[]) => readonly Node[],
): readonly Node[] {
  return nodes.map((node) =>
    node.id === parentId
      ? { ...node, children: transform(node.children) }
      : { ...node, children: mapChildren(node.children, parentId, transform) },
  );
}

/** Removes `nodeId` wherever it appears, returning the new forest. */
function detach(nodes: readonly Node[], nodeId: NodeId): readonly Node[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ ...node, children: detach(node.children, nodeId) }));
}

/**
 * Appends a new Node of `serviceId`. A null `parentId` places it at the Canvas
 * root (FR-011). Returns the tree unchanged if the parent does not exist.
 *
 * The generated id is returned alongside the tree so callers can address the
 * new Node without re-searching for it.
 */
export function addNode(
  tree: CanvasTree,
  serviceId: ServiceId,
  parentId: NodeId | null,
): { tree: CanvasTree; nodeId: NodeId } {
  const node: Node = { id: crypto.randomUUID(), serviceId, children: [] };

  if (parentId === null) {
    return { tree: { roots: [...tree.roots, node] }, nodeId: node.id };
  }

  if (!findNode(tree, parentId)) {
    return { tree, nodeId: node.id };
  }

  return {
    tree: { roots: mapChildren(tree.roots, parentId, (children) => [...children, node]) },
    nodeId: node.id,
  };
}

/**
 * Re-parents `nodeId` together with its entire subtree (FR-015). A null
 * `newParentId` moves it to the Canvas root.
 *
 * Returns the tree UNCHANGED when the move would place a Node inside its own
 * subtree, or into itself. This is the single restriction in the whole
 * application, and it is structural rather than semantic: because descendants
 * travel with a moved Node, self-nesting would make the Node its own ancestor
 * and corrupt the tree. Architecturally absurd but representable placements —
 * a VPC inside a database — remain fully allowed and are judged by the
 * Evaluation (FR-012). See research.md R-02.
 */
export function moveNode(
  tree: CanvasTree,
  nodeId: NodeId,
  newParentId: NodeId | null,
): CanvasTree {
  const node = findNode(tree, nodeId);
  if (!node) return tree;

  if (newParentId !== null) {
    if (newParentId === nodeId) return tree;
    if (!findNode(tree, newParentId)) return tree;
    if (isDescendant(tree, nodeId, newParentId)) return tree;
  }

  const detached = detach(tree.roots, nodeId);

  if (newParentId === null) {
    return { roots: [...detached, node] };
  }

  return { roots: mapChildren(detached, newParentId, (children) => [...children, node]) };
}

/** Removes `nodeId` and its whole subtree (FR-016). */
export function removeNode(tree: CanvasTree, nodeId: NodeId): CanvasTree {
  if (!findNode(tree, nodeId)) return tree;
  return { roots: detach(tree.roots, nodeId) };
}
