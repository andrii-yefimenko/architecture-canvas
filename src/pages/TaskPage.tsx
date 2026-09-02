import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Header } from '@/components/Header';
import { CANVAS_ROOT_ID, Canvas } from '@/components/canvas/Canvas';
import { deepestDroppableFirst } from '@/components/canvas/collision';
import { DeleteConfirmDialog } from '@/components/canvas/DeleteConfirmDialog';
import { RequirementsPanel } from '@/components/requirements/RequirementsPanel';
import { ServicesPanel } from '@/components/services/ServicesPanel';
import { SessionProvider } from '@/state/SessionProvider';
import type { Challenge } from '@/domain/types';
import type { SessionState } from '@/state/session-reducer';
import { useSession } from '@/state/session-context';

/**
 * Three-panel shell (FR-035, FR-036) wrapping a single DndContext.
 *
 * All tree mutation goes through reducer actions; no component mutates the
 * Canvas Tree directly. Formerly `App.tsx`'s `Workspace` — moved here
 * unchanged except for taking `navigate` to pass down to the Header's Back to
 * Catalog control.
 */
function Workspace({ navigate }: { readonly navigate: (path: string) => void }) {
  const { dispatch } = useSession();

  const sensors = useSensors(
    // A small activation distance keeps a click on the remove button from
    // registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;

    const dragged = active.data.current;
    if (!dragged) return;

    // Dropping on the Canvas root means "no parent".
    const parentId = over.id === CANVAS_ROOT_ID ? null : String(over.id);

    if (dragged['kind'] === 'service') {
      dispatch({
        type: 'ADD_NODE',
        serviceId: String(dragged['serviceId']),
        parentId,
      });
      return;
    }

    if (dragged['kind'] === 'node') {
      const nodeId = String(dragged['nodeId']);
      // moveNode rejects a self-nesting move and returns the tree unchanged,
      // so no guard is needed here (research R-02).
      dispatch({ type: 'MOVE_NODE', nodeId, newParentId: parentId });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={deepestDroppableFirst}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col bg-slate-50 text-slate-900">
        <Header navigate={navigate} />

        <div className="flex min-h-0 flex-1">
          <section
            aria-label="Requirements"
            className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4"
          >
            <RequirementsPanel />
          </section>

          <main aria-label="Canvas" className="min-w-0 flex-1 overflow-auto bg-slate-100 p-6">
            <Canvas />
          </main>

          <section
            aria-label="Services"
            className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4"
          >
            <ServicesPanel />
          </section>
        </div>
      </div>

      <DeleteConfirmDialog />
    </DndContext>
  );
}

/**
 * The page where a user works a single Challenge, per
 * docs/pages-ux/01-TASK-PAGE.md. `SessionProvider` was already
 * Challenge-parametric before this feature existed (it only ever defaulted to
 * `challenge01`); this is the first place that passes a non-default one.
 */
export function TaskPage({
  challenge,
  navigate,
  initialState,
}: {
  readonly challenge: Challenge;
  readonly navigate: (path: string) => void;
  readonly initialState?: SessionState;
}) {
  return (
    <SessionProvider challenge={challenge} {...(initialState ? { initialState } : {})}>
      <Workspace navigate={navigate} />
    </SessionProvider>
  );
}
