import { roundScore } from '@/domain/score';
import type { Evaluation } from '@/domain/types';

/**
 * The Score, rounded only here (FR-027), shown beside the passed-Rule count
 * (FR-028).
 *
 * The count is not decoration: Rules are unevenly weighted, because a
 * containment Rule passing implies its presence Rule passes too. Showing
 * "8 of 11" alongside keeps that visible instead of hiding it behind one number.
 */
export function ScoreDisplay({ evaluation }: { readonly evaluation: Evaluation }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-semibold tabular-nums text-slate-900">
        {roundScore(evaluation.score)}
      </span>
      <span className="text-sm text-slate-500">
        {evaluation.passedCount} of {evaluation.totalCount} requirements met
      </span>
    </div>
  );
}
