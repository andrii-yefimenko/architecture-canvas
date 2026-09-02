import { evaluate } from '@/domain/evaluator';
import { useSession } from '@/state/session-context';

/**
 * Application header, holding the submit control and — on the Task Page — a
 * Back to Catalog control (FR-007).
 *
 * The submit control is ALWAYS enabled (FR-019). An empty Canvas is a valid
 * submission: it scores 0 and returns a full list of unmet requirements, which
 * is itself useful feedback (FR-025). There is deliberately no disabled state
 * and no minimum-Nodes gate.
 */
export function Header({ navigate }: { readonly navigate: (path: string) => void }) {
  const { state, dispatch, challenge } = useSession();

  const handleSubmit = () => {
    dispatch({
      type: 'SUBMIT',
      evaluation: evaluate(state.canvasTree, challenge.rules),
    });
  };

  const handleBackToCatalog = () => {
    navigate('/');
  };

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleBackToCatalog}
          className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          &larr; Back to Catalog
        </button>
        <h1 className="text-base font-semibold tracking-tight text-slate-900">Architecture Canvas</h1>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Submit
      </button>
    </header>
  );
}
