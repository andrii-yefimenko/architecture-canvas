/**
 * Session persistence (FR-032, FR-033, FR-034, SC-005, SC-009).
 *
 * One key, one version number, all-or-nothing validation. The governing rule
 * is that persistence is a convenience: every failure mode degrades to
 * "start clean and carry on", never to an error the user has to deal with.
 */

import type { CanvasTree, CategoryId, Challenge, Node } from '@/domain/types';

/**
 * One key for the whole session. Splitting across several keys multiplies the
 * partial-restore failure modes — a restored Canvas Tree paired with a lost
 * revealed-Category set is worse than a clean start.
 */
export const STORAGE_KEY = 'architecture-canvas:session';

/**
 * Bump whenever the shape of `canvasTree` or `revealedCategories` changes.
 * The effect is to invalidate every stored session, which is the intended
 * behaviour at MVP stage and cheaper than migrating a few minutes of work.
 */
export const SESSION_VERSION = 1;

export interface PersistedSession {
  readonly canvasTree: CanvasTree;
  readonly revealedCategories: readonly CategoryId[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural check plus Service resolution, applied to the whole subtree. */
function isValidNode(value: unknown, knownServiceIds: ReadonlySet<string>): value is Node {
  if (!isRecord(value)) return false;
  if (typeof value['id'] !== 'string') return false;
  if (typeof value['serviceId'] !== 'string') return false;
  // Resolving every serviceId is what makes editing challenge-01.ts safe:
  // renaming an id invalidates stored sessions rather than producing Nodes
  // that reference Services which no longer exist.
  if (!knownServiceIds.has(value['serviceId'])) return false;
  if (!Array.isArray(value['children'])) return false;
  return value['children'].every((child) => isValidNode(child, knownServiceIds));
}

/**
 * Writes the session. Never throws.
 *
 * The Evaluation is deliberately excluded (FR-034): results describe a
 * submission the user is no longer looking at.
 */
export function saveSession(session: PersistedSession): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: session.canvasTree,
        revealedCategories: session.revealedCategories,
      }),
    );
  } catch {
    // Storage can be unavailable (private browsing, disabled site data) or
    // full. Persistence is a convenience; its failure must not interrupt work
    // or surface an error (SC-009).
  }
}

/**
 * Reads the session, or null if there is nothing valid to restore.
 *
 * Validation is all-or-nothing: any failed check discards the ENTIRE envelope
 * (FR-033). No partial restore, no repair, no migration — with one Challenge
 * and an MVP-stage schema, a clean start is cheaper and more predictable than
 * reconstruction.
 */
export function loadSession(challenge: Challenge): PersistedSession | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage unavailable — carry on without it (SC-009).
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

  const tree = parsed['canvasTree'];
  if (!isRecord(tree) || !Array.isArray(tree['roots'])) return null;

  const knownServiceIds = new Set(challenge.services.map((s) => s.id));
  if (!tree['roots'].every((node) => isValidNode(node, knownServiceIds))) return null;

  const revealed = parsed['revealedCategories'];
  if (!Array.isArray(revealed)) return null;

  const knownCategoryIds = new Set(challenge.hiddenRequirementCategories.map((c) => c.id));
  if (!revealed.every((id) => typeof id === 'string' && knownCategoryIds.has(id))) return null;

  return {
    canvasTree: { roots: tree['roots'] as Node[] },
    revealedCategories: revealed as CategoryId[],
  };
}
