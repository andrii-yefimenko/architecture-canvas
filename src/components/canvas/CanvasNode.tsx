import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Node } from '@/domain/types';
import { useDragPreview } from '@/state/drag-preview-context';
import { useSession } from '@/state/session-context';
import { computeNodeSize, effectiveRenderKind } from '@/state/layout';

interface CanvasNodeProps {
  readonly node: Node;
  /** Roots are 0. Carried in droppable data so nested drops resolve deepest-first. */
  readonly depth: number;
}

/**
 * A placed Node: both droppable (anything may nest inside it, FR-012) and
 * draggable (it may be re-parented, FR-015). Renders as a Frame — auto-sized
 * to enclose its children — or a Card of fixed size, absolutely positioned
 * from its own Layout entry (see contracts/canvas-layout.md). A childless
 * Node whose Service defaults to Card promotes to a Frame the moment it
 * gains a child (FR-002); the drop that causes this is never rejected.
 *
 * Deliberately renders NO valid/invalid drop signal while a drag is in
 * progress (FR-013) — hinting at legal parents would leak the answer. The
 * only drag-time styling is on the Node being dragged, not on prospective
 * targets.
 */
export function CanvasNode({ node, depth }: CanvasNodeProps) {
  const { challenge, state, dispatch } = useSession();

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
  const renderKindOf = (serviceId: string) =>
    challenge.services.find((s) => s.id === serviceId)?.renderKind ?? 'card';

  const position = state.layout[node.id] ?? { x: 0, y: 0 };
  const size = computeNodeSize(node, state.layout, renderKindOf);
  const renderKind = effectiveRenderKind(node.children.length, service?.renderKind ?? 'card');
  const isFrame = renderKind === 'frame';

  // v0.3.1 ghost preview: a non-committal outline showing the projected
  // size while a dragged item hovers over this Node as a potential parent.
  // The real box above is untouched — nothing here affects `size`/`position`.
  const { targetFrameId, previewSize } = useDragPreview();
  const showGhost = node.id === targetFrameId && previewSize !== null;

  const label = service?.name ?? node.serviceId;
  const positionStyle = {
    position: 'absolute' as const,
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
  };

  const removeButton = (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => dispatch({ type: 'REQUEST_DELETE', nodeId: node.id })}
      className="absolute right-1 top-1 rounded px-1 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
    >
      ✕
    </button>
  );

  return (
    <>
      {showGhost && (
        <div
          aria-hidden="true"
          data-testid={`ghost-${node.id}`}
          style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            width: previewSize!.width,
            height: previewSize!.height,
          }}
          className="pointer-events-none rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/40"
        />
      )}
      {isFrame ? (
        // A Frame renders as an AWS-Group-style box: the label is a rounded
        // badge straddling the top border rather than a header row, so it
        // costs no reserved vertical space in the size math (research: the
        // badge's overlap into the box stays within the existing
        // FRAME_PADDING already used for first-child placement).
        <div
          ref={setDroppableRef}
          data-testid={`node-${node.id}`}
          data-render-kind={renderKind}
          style={positionStyle}
          className={`relative rounded-lg border-2 border-dashed border-slate-400 bg-slate-50/80 p-2 ${
            isDragging ? 'opacity-40' : ''
          }`}
        >
          <span
            ref={setDraggableRef}
            {...listeners}
            {...attributes}
            className="absolute -top-3 left-3 cursor-grab select-none rounded-full border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm"
          >
            {label}
          </span>
          {removeButton}

          {node.children.map((child) => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : (
        // A Card is a compact square tile (CONTEXT.md) — the whole tile is
        // the drag handle, its label centered like an icon's caption.
        <div
          ref={(el) => {
            setDroppableRef(el);
            setDraggableRef(el);
          }}
          {...listeners}
          {...attributes}
          // Without this, the tile's accessible name (role="button" comes
          // from dnd-kit's `attributes`) would be computed from ALL its
          // descendant text — including the remove button's own label —
          // since the whole tile is now the drag handle rather than just
          // the label span.
          aria-label={label}
          data-testid={`node-${node.id}`}
          data-render-kind={renderKind}
          style={positionStyle}
          className={`relative flex cursor-grab items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-slate-300 bg-white p-1 ${
            isDragging ? 'opacity-40' : ''
          }`}
        >
          <span className="select-none text-center text-xs leading-snug font-medium text-slate-800">{label}</span>
          {removeButton}
        </div>
      )}
    </>
  );
}
