import { useSession } from '@/state/session-context';
import { ScoreDisplay } from './ScoreDisplay';

/**
 * The Evaluation: every Rule with pass/fail (FR-023), and a Recommendation on
 * each failure (FR-024).
 *
 * Shows ALL Rules rather than only failures, per MVP.md's acceptance criteria
 * ("User can see which requirements passed or failed").
 *
 * Rule text is resolved from the Challenge by ruleId rather than copied into
 * the Evaluation, keeping one source of truth.
 */
export function EvaluationResults() {
  const { state, challenge } = useSession();
  const { evaluation, evaluationStale } = state;

  if (!evaluation) return null;

  return (
    <section aria-label="Evaluation" className="mt-6 border-t border-slate-200 pt-4">
      <ScoreDisplay evaluation={evaluation} />

      {evaluationStale && (
        <p
          role="status"
          className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          These results are from your previous submission. Submit again to re-check.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {evaluation.results.map((result) => {
          const rule = challenge.rules.find((r) => r.id === result.ruleId);
          if (!rule) return null;

          return (
            <li
              key={result.ruleId}
              className={`rounded-md border px-3 py-2 text-xs ${
                result.passed
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex gap-2">
                <span aria-hidden="true">{result.passed ? '✓' : '✗'}</span>
                <span className="font-medium text-slate-800">
                  <span className="sr-only">{result.passed ? 'Passed: ' : 'Failed: '}</span>
                  {rule.description}
                </span>
              </div>
              {!result.passed && (
                <p className="mt-1.5 pl-5 text-slate-600">{rule.recommendation}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
