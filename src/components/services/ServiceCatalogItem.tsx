import { useDraggable } from '@dnd-kit/core';
import type { Service } from '@/domain/types';

/**
 * A draggable catalog entry (FR-009).
 *
 * Drag data is discriminated by `kind` so onDragEnd can tell a new placement
 * ('service') from a re-parent ('node').
 */
export function ServiceCatalogItem({ service }: { readonly service: Service }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `service:${service.id}`,
    data: { kind: 'service', serviceId: service.id },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={`w-full cursor-grab rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {service.name}
    </button>
  );
}
