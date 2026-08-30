import { useSession } from '@/state/session-context';
import { EvaluationResults } from './EvaluationResults';
import { HiddenRequirementCategory } from './HiddenRequirementCategory';

/**
 * Challenge title, description, and Visible Requirements (FR-001, FR-002),
 * with the Evaluation appended after a submission (FR-037).
 *
 * Hidden Requirements are concealed on load and revealed a Category at a
 * time, simulating a client who has to be interviewed (FR-003, FR-004).
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

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Ask the client
      </h3>
      <div className="mt-2 flex flex-col gap-1.5">
        {challenge.hiddenRequirementCategories.map((category) => (
          <HiddenRequirementCategory key={category.id} category={category} />
        ))}
      </div>

      <EvaluationResults />
    </div>
  );
}
