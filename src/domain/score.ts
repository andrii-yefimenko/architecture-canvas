/**
 * Score computation. Pure, framework-free (ADR 0001).
 *
 * Each Rule contributes an equal share of 100 (FR-026). Points are summed at
 * full float precision and rounded ONLY for display (FR-027) — rounding each
 * Rule to 9 points would make a perfect 11-Rule solution score 99, silently
 * contradicting MVP.md's formula.
 */

/**
 * Full-precision Score. Returns 0 rather than NaN when there are no Rules.
 *
 * Deliberately `(passed / total) * 100` and NOT `passed * (100 / total)`: the
 * latter computes 100/11 first and reintroduces the error on multiplication,
 * so a perfect 11-Rule solution yields 100.00000000000001 and fails SC-002's
 * "exactly 100". Dividing first makes the perfect case exactly 1 * 100.
 */
export function computeScore(passedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return (passedCount / totalCount) * 100;
}

/** Display rounding. Apply at render time, never before summing. */
export function roundScore(score: number): number {
  return Math.round(score);
}
