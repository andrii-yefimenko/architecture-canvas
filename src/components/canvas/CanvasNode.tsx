import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSession } from '@/state/session-context';
import type { Node } from '@/domain/types';

interface CanvasNodeProps {
  readonly node: Node;
  /** Roots are 0. Carried in droppable data so nested drops resolve deepest-first. */
  readonly depth: number;
}

/**
 * A placed Node: both droppable (anything may nest inside it, FR-012) and
 * draggable (it may be re-parented, FR-015).
 *
 * Deliberately renders NO valid/invalid drop signal while a drag is in
 * progress (FR-013) — hinting at legal parents would leak the answer. The only
 * drag-time styling is on the Node being dragged, not on prospective targets.
 */
export function CanvasNode({ node, depth }: CanvasNodeProps) {
  const { challenge, dispatch } = useSession();

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: node.id,
    data: { kind: 'node', nodeId: node.id, depth },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: { kind: 'node', nodeId: node.id },
  });

  const service = challenge.services.find((s) => s.id === node.serviceId);

  return (
    <div
      ref={setDroppableRef}
      data-testid={`node-${node.id}`}
      className={`rounded-lg border-2 border-slate-300 bg-white/70 p-2 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          ref={setDraggableRef}
          {...listeners}
          {...attributes}
          className="cursor-grab select-none rounded px-1.5 py-0.5 text-sm font-medium text-slate-800"
        >
          {service?.name ?? node.serviceId}
        </span>
        <button
          type="button"
          aria-label={`Remove ${service?.name ?? node.serviceId}`}
          onClick={() => dispatch({ type: 'REQUEST_DELETE', nodeId: node.id })}
          className="rounded px-1.5 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          ✕
        </button>
      </div>

      {node.children.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 pl-3">
          {node.children.map((child) => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
