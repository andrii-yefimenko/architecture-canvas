import { useDroppable } from '@dnd-kit/core';
import { useSession } from '@/state/session-context';
import { CanvasNode } from './CanvasNode';

export const CANVAS_ROOT_ID = 'canvas-root';

/**
 * The Canvas root droppable. A Service dropped here becomes a root-level Node
 * (FR-011), valid to place but failing any Rule requiring containment.
 *
 * Depth -1 so that every real Node (depth >= 0) outranks the root when
 * collisions are resolved deepest-first.
 */
export function Canvas() {
  const { state } = useSession();
  const { setNodeRef } = useDroppable({
    id: CANVAS_ROOT_ID,
    data: { kind: 'canvas-root', depth: -1 },
  });

  return (
    <div ref={setNodeRef} data-testid="canvas-root" className="min-h-full">
      {state.canvasTree.roots.length === 0 ? (
        <p className="select-none pt-8 text-center text-sm text-slate-400">
          Drag Services here to design your architecture.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {state.canvasTree.roots.map((node) => (
            <CanvasNode key={node.id} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
