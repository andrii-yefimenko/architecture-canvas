/**
 * Session persistence.
 *
 * One key per Challenge, one version number, all-or-nothing validation. The
 * governing rule is that persistence is a convenience — and, since this
 * feature, an in-progress-only convenience: it exists to survive an
 * accidental refresh, not to let a user resume a Challenge they deliberately
 * left (see `clearSession`). Every failure mode degrades to "start clean and
 * carry on", never to an error the user has to deal with.
 *
 * Supersedes the single flat `architecture-canvas:session` key from
 * specs/001-architecture-canvas-mvp/. See
 * See this feature's persistence contract, which supersedes
 * specs/002-multi-challenge-catalog/contracts/persistence.md.
 */

import type { CanvasTree, CategoryId, Challenge, Node, NodeId } from '@/domain/types';
import type { Layout, LayoutMap } from './layout';

/**
 * One key per Challenge, computed from its Challenge ID. Splitting
 * persistence across *Challenges* doesn't reintroduce the partial-restore
 * risk a single flat key avoided (see contracts/persistence.md) — each
 * Challenge's key still holds one complete envelope, saved and loaded
 * atomically; Challenges just no longer share an envelope they have no
 * business sharing.
 */
export function storageKey(challengeId: string): string {
  return `architecture-canvas:session:${challengeId}`;
}

/**
 * Bump whenever the shape of `canvasTree`, `revealedCategories`, or `layout`
 * changes. The effect is to invalidate every stored session, across every
 * Challenge — the intended behaviour at this stage, and cheaper than
 * migrating a few minutes of work.
 *
 * 2: added `layout` (see this feature's persistence contract).
 */
export const SESSION_VERSION = 2;

export interface PersistedSession {
  readonly canvasTree: CanvasTree;
  readonly revealedCategories: readonly CategoryId[];
  readonly layout: LayoutMap;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A plain object of `{x, y}` pairs. Every key present must resolve to a Node
 * actually in the tree — a stale entry for a deleted or unknown Node
 * invalidates the whole envelope, the same as an unresolvable `serviceId`
 * does for `canvasTree`. Completeness is NOT required: a Node with no entry
 * yet is valid (it renders at the origin — see CanvasNode.tsx) — the same
 * tolerance the reducer and renderer already have, since not every
 * `canvasTree` in this codebase's tests is built through the position-carrying
 * `ADD_NODE` action.
 */
function isValidLayout(value: unknown, knownNodeIds: ReadonlySet<NodeId>): value is Record<NodeId, Layout> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([id, entry]) => {
    if (!knownNodeIds.has(id)) return false;
    return isRecord(entry) && isFiniteNumber(entry['x']) && isFiniteNumber(entry['y']);
  });
}

/** Every NodeId in a validated tree, depth-first. Mirrors src/domain/canvas-tree.ts's subtreeIds, but over plain JSON. */
function collectNodeIds(nodes: readonly Node[], out: Set<NodeId> = new Set()): Set<NodeId> {
  for (const node of nodes) {
    out.add(node.id);
    collectNodeIds(node.children, out);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural check plus Service resolution, applied to the whole subtree. */
function isValidNode(value: unknown, knownServiceIds: ReadonlySet<string>): value is Node {
  if (!isRecord(value)) return false;
  if (typeof value['id'] !== 'string') return false;
  if (typeof value['serviceId'] !== 'string') return false;
  // Resolving every serviceId is what makes editing a Challenge module safe:
  // renaming an id invalidates stored sessions rather than producing Nodes
  // that reference Services which no longer exist.
  if (!knownServiceIds.has(value['serviceId'])) return false;
  if (!Array.isArray(value['children'])) return false;
  return value['children'].every((child) => isValidNode(child, knownServiceIds));
}

/**
 * Writes the session under `challengeId`'s own key. Never throws.
 *
 * The Evaluation is deliberately excluded: results describe a submission the
 * user is no longer looking at.
 */
export function saveSession(challengeId: string, session: PersistedSession): void {
  try {
    localStorage.setItem(
      storageKey(challengeId),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId,
        canvasTree: session.canvasTree,
        revealedCategories: session.revealedCategories,
        layout: session.layout,
      }),
    );
  } catch {
    // Storage can be unavailable (private browsing, disabled site data) or
    // full. Persistence is a convenience; its failure must not interrupt work
    // or surface an error.
  }
}

/**
 * Reads `challenge`'s session, or null if there is nothing valid to restore.
 *
 * Validation is all-or-nothing: any failed check discards the ENTIRE
 * envelope. No partial restore, no repair, no migration — a clean start is
 * cheaper and more predictable than reconstruction.
 *
 * The `challengeId` check is what stops one Challenge's stored Canvas Tree
 * from being silently accepted as another Challenge's session merely because
 * their catalogs happen to share Service ids (e.g. `vpc`, `rds`, both used by
 * Challenge #1 and Challenge #2) — the structural checks below alone are not
 * sufficient once two Challenges' catalogs overlap.
 */
export function loadSession(challenge: Challenge): PersistedSession | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(challenge.id));
  } catch {
    return null; // Storage unavailable — carry on without it.
  }

  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed['version'] !== SESSION_VERSION) return null;
  if (parsed['challengeId'] !== challenge.id) return null;

  const tree = parsed['canvasTree'];
  if (!isRecord(tree) || !Array.isArray(tree['roots'])) return null;

  const knownServiceIds = new Set(challenge.services.map((s) => s.id));
  if (!tree['roots'].every((node) => isValidNode(node, knownServiceIds))) return null;

  const revealed = parsed['revealedCategories'];
  if (!Array.isArray(revealed)) return null;

  const knownCategoryIds = new Set(challenge.hiddenRequirementCategories.map((c) => c.id));
  if (!revealed.every((id) => typeof id === 'string' && knownCategoryIds.has(id))) return null;

  // Every key in `layout` must be exactly a NodeId present in the tree above
  // — no missing entries, no stale ones left over from a deleted Node. The
  // same all-or-nothing rule the other checks already apply.
  const knownNodeIds = collectNodeIds(tree['roots'] as Node[]);
  const layout = parsed['layout'];
  if (!isValidLayout(layout, knownNodeIds)) return null;

  return {
    canvasTree: { roots: tree['roots'] as Node[] },
    revealedCategories: revealed as CategoryId[],
    layout: layout as Record<NodeId, Layout>,
  };
}

/**
 * Clears `challengeId`'s stored session outright — a delete, not a version
 * bump, and not shared with any other Challenge's key. Called when the user
 * leaves via the Header's Back to Catalog control (FR-014): persistence
 * exists to survive an accidental refresh, not the user's decision to leave.
 * Never throws.
 */
export function clearSession(challengeId: string): void {
  try {
    localStorage.removeItem(storageKey(challengeId));
  } catch {
    // Same reasoning as save/load: storage unavailability degrades silently.
  }
}
