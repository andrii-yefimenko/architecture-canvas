/**
 * The Challenge Registry — every Challenge available in the app, in Registry
 * (authorial) order. Backs the Catalog Page. Framework-free, like the
 * individual Challenge modules (ADR 0001).
 *
 * See specs/002-multi-challenge-catalog/contracts/challenge-registry.md.
 */

import type { Challenge } from '@/domain/types';
import { challenge01 } from './challenge-01';
import { challenge02 } from './challenge-02';

export const challengeRegistry: readonly Challenge[] = [challenge01, challenge02];

/**
 * Looks up a Challenge by id. `undefined` on a miss is not an edge case to
 * guard against elsewhere — it is the exact signal the router uses to fall
 * back to the Catalog Page (FR-005).
 */
export function getChallengeById(id: string): Challenge | undefined {
  return challengeRegistry.find((challenge) => challenge.id === id);
}
