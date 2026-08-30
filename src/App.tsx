import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Header } from '@/components/Header';
import { CANVAS_ROOT_ID, Canvas } from '@/components/canvas/Canvas';
import { deepestDroppableFirst } from '@/components/canvas/collision';
import { DeleteConfirmDialog } from '@/components/canvas/DeleteConfirmDialog';
import { RequirementsPanel } from '@/components/requirements/RequirementsPanel';
import { ServicesPanel } from '@/components/services/ServicesPanel';
import { SessionProvider } from '@/state/SessionProvider';
import { useSession } from '@/state/session-context';

/**
 * Three-panel shell (FR-035, FR-036) wrapping a single DndContext.
 *
 * All tree mutation goes through reducer actions; no component mutates the
 * Canvas Tree directly.
 */
function Workspace() {
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
        <Header />

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

export function App() {
  return (
    <SessionProvider>
      <Workspace />
    </SessionProvider>
  );
}
