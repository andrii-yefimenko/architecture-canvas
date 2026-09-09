/**
 * Session state and its pure reducer.
 *
 * Lives in src/state/ rather than src/domain/ because it models the *session*,
 * not the problem domain — but it is still a pure function, so it is directly
 * unit-testable without rendering. All tree mutation is delegated to
 * src/domain/canvas-tree.ts.
 */

import { addNode, emptyTree, hasChildren, moveNode, removeNode, subtreeIds } from '@/domain/canvas-tree';
import type { CanvasTree, CategoryId, Evaluation, NodeId, ServiceId } from '@/domain/types';
import type { Layout, LayoutMap } from './layout';

export interface SessionState {
  readonly canvasTree: CanvasTree;
  /** Append-only within a session (FR-006). */
  readonly revealedCategories: readonly CategoryId[];
  /** Null until the first submission. Never persisted (FR-034). */
  readonly evaluation: Evaluation | null;
  /** True when the Canvas Tree changed after the Evaluation was produced (FR-030). */
  readonly evaluationStale: boolean;
  /** A Node awaiting delete confirmation (FR-017). */
  readonly pendingDeletion: NodeId | null;
  /** Every placed Node's position, keyed by NodeId. Presentation data only — see CONTEXT.md's Layout entry. */
  readonly layout: LayoutMap;
}

export type SessionAction =
  | { type: 'ADD_NODE'; serviceId: ServiceId; parentId: NodeId | null; position: Layout }
  | { type: 'MOVE_NODE'; nodeId: NodeId; newParentId: NodeId | null; position: Layout }
  | { type: 'REQUEST_DELETE'; nodeId: NodeId }
  | { type: 'CANCEL_DELETE' }
  | { type: 'CONFIRM_DELETE' }
  | { type: 'REVEAL_CATEGORY'; categoryId: CategoryId }
  | { type: 'SUBMIT'; evaluation: Evaluation }
  | {
      type: 'RESTORE';
      canvasTree: CanvasTree;
      revealedCategories: readonly CategoryId[];
      layout: LayoutMap;
    };

export function initialSessionState(): SessionState {
  return {
    canvasTree: emptyTree(),
    revealedCategories: [],
    evaluation: null,
    evaluationStale: false,
    pendingDeletion: null,
    layout: {},
  };
}

/** Everything in `layout` except the given ids — used when a delete cascades. */
function omitLayoutEntries(layout: LayoutMap, ids: readonly NodeId[]): LayoutMap {
  if (ids.length === 0) return layout;
  const excluded = new Set(ids);
  const result: Record<NodeId, Layout> = {};
  for (const [id, position] of Object.entries(layout)) {
    if (!excluded.has(id)) result[id] = position;
  }
  return result;
}

/**
 * Marks an existing Evaluation stale rather than clearing it (FR-030).
 *
 * Clearing would destroy the Recommendations the user is reading *while* they
 * fix the problem, which is the single most useful thing on screen mid-revision.
 */
function markStale(state: SessionState): Pick<SessionState, 'evaluationStale'> {
  return { evaluationStale: state.evaluation !== null };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'ADD_NODE': {
      const { tree, nodeId } = addNode(state.canvasTree, action.serviceId, action.parentId);
      if (tree === state.canvasTree) return state;
      return {
        ...state,
        canvasTree: tree,
        layout: { ...state.layout, [nodeId]: action.position },
        ...markStale(state),
      };
    }

    case 'MOVE_NODE': {
      const tree = moveNode(state.canvasTree, action.nodeId, action.newParentId);
      // moveNode returns the input tree when the move is rejected (cycle guard).
      if (tree === state.canvasTree) return state;
      // Only the moved Node's own entry changes — every descendant keeps its
      // existing parent-relative position, so a dragged Frame visually
      // carries its contents for free (research.md).
      return {
        ...state,
        canvasTree: tree,
        layout: { ...state.layout, [action.nodeId]: action.position },
        ...markStale(state),
      };
    }

    case 'REQUEST_DELETE': {
      // Confirmation is required only for a populated container (FR-017);
      // an empty Node goes immediately.
      if (hasChildren(state.canvasTree, action.nodeId)) {
        return { ...state, pendingDeletion: action.nodeId };
      }
      // Captured before removeNode runs — nothing left to walk afterwards.
      const removedIds = subtreeIds(state.canvasTree, action.nodeId);
      const tree = removeNode(state.canvasTree, action.nodeId);
      if (tree === state.canvasTree) return state;
      return {
        ...state,
        canvasTree: tree,
        layout: omitLayoutEntries(state.layout, removedIds),
        pendingDeletion: null,
        ...markStale(state),
      };
    }

    case 'CANCEL_DELETE':
      return state.pendingDeletion === null ? state : { ...state, pendingDeletion: null };

    case 'CONFIRM_DELETE': {
      if (state.pendingDeletion === null) return state;
      const removedIds = subtreeIds(state.canvasTree, state.pendingDeletion);
      const tree = removeNode(state.canvasTree, state.pendingDeletion);
      return {
        ...state,
        canvasTree: tree,
        layout: omitLayoutEntries(state.layout, removedIds),
        pendingDeletion: null,
        ...markStale(state),
      };
    }

    case 'REVEAL_CATEGORY': {
      // Revealing never touches the Evaluation or Score (FR-007).
      if (state.revealedCategories.includes(action.categoryId)) return state;
      return { ...state, revealedCategories: [...state.revealedCategories, action.categoryId] };
    }

    case 'SUBMIT':
      return { ...state, evaluation: action.evaluation, evaluationStale: false };

    case 'RESTORE':
      return {
        ...state,
        canvasTree: action.canvasTree,
        revealedCategories: [...action.revealedCategories],
        layout: action.layout,
        // A restored session shows no results: they describe a submission the
        // user is no longer looking at (FR-034).
        evaluation: null,
        evaluationStale: false,
        pendingDeletion: null,
      };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
