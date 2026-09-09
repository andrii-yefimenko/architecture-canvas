import { useDroppable } from '@dnd-kit/core';
import { useSession } from '@/state/session-context';
import { computeRootContentSize } from '@/state/layout';
import { CanvasNode } from './CanvasNode';

export const CANVAS_ROOT_ID = 'canvas-root';

/**
 * The Canvas root droppable. A Service dropped here becomes a root-level Node
 * (FR-011), positioned in free 2D space rather than appended to a list.
 *
 * Depth -1 so that every real Node (depth >= 0) outranks the root when
 * collisions are resolved deepest-first.
 *
 * Sized to the true extent of its root-level content (same derivation a
 * Frame uses for its children), which is what gives the panel's existing
 * `overflow-auto` (TaskPage.tsx) something real to scroll to (FR-020).
 */
export function Canvas() {
  const { state, challenge } = useSession();
  const { setNodeRef } = useDroppable({
    id: CANVAS_ROOT_ID,
    data: { kind: 'canvas-root', depth: -1 },
  });

  if (state.canvasTree.roots.length === 0) {
    return (
      <div ref={setNodeRef} data-testid="canvas-root" className="min-h-full">
        <p className="select-none pt-8 text-center text-sm text-slate-400">
          Drag Services here to design your architecture.
        </p>
      </div>
    );
  }

  const renderKindOf = (serviceId: string) =>
    challenge.services.find((s) => s.id === serviceId)?.renderKind ?? 'card';
  const size = computeRootContentSize(state.canvasTree.roots, state.layout, renderKindOf);

  return (
    <div
      ref={setNodeRef}
      data-testid="canvas-root"
      className="relative min-h-full min-w-full"
      style={{ width: size.width, height: size.height }}
    >
      {state.canvasTree.roots.map((node) => (
        <CanvasNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
