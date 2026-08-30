import type { HiddenRequirementCategory as Category } from '@/domain/types';
import { useSession } from '@/state/session-context';

/**
 * One Hidden Requirement Category: a reveal control while concealed, the
 * requirement list once revealed (FR-004, FR-005).
 *
 * The whole Category reveals as a unit — never an individual requirement. That
 * is the interview question the user chooses to ask, and it is what trains the
 * "which area do I need to clarify?" instinct rather than turning discovery
 * into a guessing game.
 *
 * Revealing is one-way and carries no Score penalty (FR-006, FR-007).
 */
export function HiddenRequirementCategory({ category }: { readonly category: Category }) {
  const { state, dispatch } = useSession();
  const revealed = state.revealedCategories.includes(category.id);

  if (revealed) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <h4 className="text-xs font-semibold text-slate-700">{category.name}</h4>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-slate-600">
          {category.requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'REVEAL_CATEGORY', categoryId: category.id })}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      <span className="font-medium">Ask about: {category.name}</span>
      <span aria-hidden="true" className="text-slate-400">
        +
      </span>
    </button>
  );
}
