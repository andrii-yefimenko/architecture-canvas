import { countNodes, findNode } from '@/domain/canvas-tree';
import { useSession } from '@/state/session-context';

/**
 * Confirmation for deleting a populated container (FR-017).
 *
 * Exists because deletion cascades to the whole subtree (FR-016) and the MVP
 * has no undo — a mis-click would otherwise silently discard several minutes
 * of work. A childless Node is removed immediately, without this prompt.
 */
export function DeleteConfirmDialog() {
  const { state, dispatch, challenge } = useSession();

  if (state.pendingDeletion === null) return null;

  const node = findNode(state.canvasTree, state.pendingDeletion);
  if (!node) return null;

  const name =
    challenge.services.find((s) => s.id === node.serviceId)?.name ?? node.serviceId;
  const descendants = countNodes({ roots: node.children });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 id="delete-dialog-title" className="text-sm font-semibold text-slate-900">
          Remove {name}?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This also removes {descendants} nested{' '}
          {descendants === 1 ? 'service' : 'services'}. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'CANCEL_DELETE' })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'CONFIRM_DELETE' })}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
