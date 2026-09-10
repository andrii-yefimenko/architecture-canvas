import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Header } from '@/components/Header';
import { CANVAS_ROOT_ID, Canvas } from '@/components/canvas/Canvas';
import { deepestDroppableFirst } from '@/components/canvas/collision';
import { DeleteConfirmDialog } from '@/components/canvas/DeleteConfirmDialog';
import { DragOverlayPreview } from '@/components/canvas/DragOverlayPreview';
import { KeyboardPlacement } from '@/components/canvas/KeyboardPlacement';
import { RequirementsPanel } from '@/components/requirements/RequirementsPanel';
import { ServicesPanel } from '@/components/services/ServicesPanel';
import { SessionProvider } from '@/state/SessionProvider';
import { findNode } from '@/domain/canvas-tree';
import type { Challenge } from '@/domain/types';
import { DragPreviewContext, NO_DRAG_PREVIEW } from '@/state/drag-preview-context';
import {
  computeDraggedItemSize,
  computeDragPreviewSize,
  effectiveRenderKind,
  resolveDropPosition,
} from '@/state/layout';
import type { SessionState } from '@/state/session-reducer';
import { useSession } from '@/state/session-context';

type ActiveDrag = { readonly kind: 'service'; readonly serviceId: string } | { readonly kind: 'node'; readonly nodeId: string };

/**
 * Three-panel shell (FR-035, FR-036) wrapping a single DndContext.
 *
 * All tree mutation goes through reducer actions; no component mutates the
 * Canvas Tree directly. Formerly `App.tsx`'s `Workspace` — moved here
 * unchanged except for taking `navigate` to pass down to the Header's Back to
 * Catalog control.
 */
function Workspace({ navigate }: { readonly navigate: (path: string) => void }) {
  const { state, challenge, dispatch } = useSession();

  const sensors = useSensors(
    // A small activation distance keeps a click on the remove button from
    // registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const renderKindOf = (serviceId: string) =>
    challenge.services.find((s) => s.id === serviceId)?.renderKind ?? 'card';

  // Ephemeral, drag-only feedback (v0.3.1's ghost preview) — never touches
  // SessionState/layout. Cleared whenever the drag ends, is cancelled, or
  // stops hovering over a Frame that would need to grow.
  const [dragPreview, setDragPreview] = useState(NO_DRAG_PREVIEW);

  // v0.3.2's cursor-following overlay — which item, if any, is mid-drag.
  // Also ephemeral; cleared on drag end/cancel, same as dragPreview above.
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const handleDragStart = ({ active }: DragStartEvent) => {
    const dragged = active.data.current;
    if (dragged?.['kind'] === 'service') {
      setActiveDrag({ kind: 'service', serviceId: String(dragged['serviceId']) });
    } else if (dragged?.['kind'] === 'node') {
      setActiveDrag({ kind: 'node', nodeId: String(dragged['nodeId']) });
    }
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const dragged = active.data.current;
    const targetId = over && over.id !== CANVAS_ROOT_ID ? String(over.id) : null;

    if (!dragged || !over || !targetId || (dragged['kind'] === 'node' && String(dragged['nodeId']) === targetId)) {
      setDragPreview(NO_DRAG_PREVIEW);
      return;
    }

    const targetNode = findNode(state.canvasTree, targetId);
    if (!targetNode) {
      setDragPreview(NO_DRAG_PREVIEW);
      return;
    }

    let draggedSize;
    let excludeNodeId: string | null = null;
    if (dragged['kind'] === 'service') {
      draggedSize = computeDraggedItemSize({ kind: 'service', serviceId: String(dragged['serviceId']) }, state.canvasTree, state.layout, renderKindOf);
    } else if (dragged['kind'] === 'node') {
      excludeNodeId = String(dragged['nodeId']);
      draggedSize = computeDraggedItemSize({ kind: 'node', nodeId: excludeNodeId }, state.canvasTree, state.layout, renderKindOf);
    } else {
      setDragPreview(NO_DRAG_PREVIEW);
      return;
    }

    // The exact same resolved-position pipeline handleDragEnd uses for a
    // real drop (v0.3.5) — the mid-drag rects change live as the pointer
    // moves, but the floor/gutter-search math is identical, so the preview
    // always matches exactly where the item will actually land.
    const activeRect = active.rect.current.translated ?? active.rect.current.initial;
    const projectedPosition = resolveDropPosition(
      state.canvasTree,
      state.layout,
      renderKindOf,
      activeRect ?? over.rect,
      over.rect,
      targetId,
      draggedSize,
      excludeNodeId,
    );

    const previewSize = computeDragPreviewSize(
      targetNode,
      state.layout,
      renderKindOf,
      projectedPosition,
      draggedSize,
      excludeNodeId,
    );

    setDragPreview(previewSize ? { targetFrameId: targetId, previewSize } : NO_DRAG_PREVIEW);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragPreview(NO_DRAG_PREVIEW);
    setActiveDrag(null);
    if (!over) return;

    const dragged = active.data.current;
    if (!dragged) return;

    // Dropping on the Canvas root means "no parent".
    const parentId = over.id === CANVAS_ROOT_ID ? null : String(over.id);

    // The dragged element's final on-screen rect — dnd-kit-measured in the
    // same viewport-relative space as `over.rect` (contracts/canvas-layout.md's
    // drop-position formula). `resolveDropPosition` turns this into the
    // final, floor-clamped, gutter-searched position (v0.3.5).
    const activeRect = active.rect.current.translated ?? active.rect.current.initial ?? over.rect;

    if (dragged['kind'] === 'service') {
      const serviceId = String(dragged['serviceId']);
      // A brand-new Node has no children yet, so its size is its Service's
      // fixed empty-state size (FR-004, FR-005) — never a Frame's auto-size,
      // since it can't have children before it exists.
      const newNodeSize = computeDraggedItemSize({ kind: 'service', serviceId }, state.canvasTree, state.layout, renderKindOf);
      const position = resolveDropPosition(state.canvasTree, state.layout, renderKindOf, activeRect, over.rect, parentId, newNodeSize, null);

      dispatch({ type: 'ADD_NODE', serviceId, parentId, position });
      return;
    }

    if (dragged['kind'] === 'node') {
      const nodeId = String(dragged['nodeId']);
      const movedSize = computeDraggedItemSize({ kind: 'node', nodeId }, state.canvasTree, state.layout, renderKindOf);
      const position = resolveDropPosition(state.canvasTree, state.layout, renderKindOf, activeRect, over.rect, parentId, movedSize, nodeId);

      // moveNode rejects a self-nesting move and returns the tree unchanged,
      // so no guard is needed here (research R-02).
      dispatch({ type: 'MOVE_NODE', nodeId, newParentId: parentId, position });
    }
  };

  // Overlay content derived from activeDrag — label/size/renderKind for
  // whatever's currently under the cursor, or null when nothing is dragging.
  const overlayContent = (() => {
    if (!activeDrag) return null;

    if (activeDrag.kind === 'service') {
      const service = challenge.services.find((s) => s.id === activeDrag.serviceId);
      const size = computeDraggedItemSize(activeDrag, state.canvasTree, state.layout, renderKindOf);
      return { label: service?.name ?? activeDrag.serviceId, size, renderKind: renderKindOf(activeDrag.serviceId) };
    }

    const movedNode = findNode(state.canvasTree, activeDrag.nodeId);
    if (!movedNode) return null;
    const service = challenge.services.find((s) => s.id === movedNode.serviceId);
    const size = computeDraggedItemSize(activeDrag, state.canvasTree, state.layout, renderKindOf);
    const renderKind = effectiveRenderKind(movedNode.children.length, renderKindOf(movedNode.serviceId));
    return { label: service?.name ?? movedNode.serviceId, size, renderKind };
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={deepestDroppableFirst}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragPreview(NO_DRAG_PREVIEW);
        setActiveDrag(null);
      }}
    >
      {/*
        No drop animation: dnd-kit's default animates the overlay back to the
        dragged element's *original* rect (the source card never visually
        moves during the drag), which reads as "snapping back to the start"
        for a heartbeat before the real, now-repositioned element appears.
        Disabling it makes the overlay vanish the instant drop happens, right
        as the real element (already re-rendered at its new position) takes
        its place — no return trip.
      */}
      <DragOverlay dropAnimation={null}>
        {overlayContent && (
          <DragOverlayPreview label={overlayContent.label} size={overlayContent.size} renderKind={overlayContent.renderKind} />
        )}
      </DragOverlay>
      <DragPreviewContext.Provider value={dragPreview}>
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
              <KeyboardPlacement />
            </section>
          </div>
        </div>

        <DeleteConfirmDialog />
      </DragPreviewContext.Provider>
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
