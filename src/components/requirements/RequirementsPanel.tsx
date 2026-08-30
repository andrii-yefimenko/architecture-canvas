import { useSession } from '@/state/session-context';
import { EvaluationResults } from './EvaluationResults';

/**
 * Challenge title, description, and Visible Requirements (FR-001, FR-002),
 * with the Evaluation appended after a submission (FR-037).
 *
 * Hidden Requirement Category reveal controls arrive in T040-T041 (Phase 4).
 */
export function RequirementsPanel() {
  const { challenge } = useSession();

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{challenge.title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{challenge.description}</p>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Requirements
      </h3>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-slate-700">
        {challenge.visibleRequirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>

      <EvaluationResults />
    </div>
  );
}
