/**
 * v0.3.1 ghost preview — CanvasNode's rendering of it in isolation.
 *
 * A live drag can't be simulated in jsdom, so `DragPreviewContext` is
 * supplied directly rather than triggered through a real `onDragOver`
 * (which is covered at the pure-function level in layout.test.ts's
 * `computeDragPreviewSize` cases, and manually in a real browser).
 * `SessionContext` is also supplied directly — CanvasNode is rendered on
 * its own here, not through the full App/TaskPage stack.
 */

import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { DragPreviewContext, NO_DRAG_PREVIEW, type DragPreviewValue } from '@/state/drag-preview-context';
import { SessionContext } from '@/state/session-context';
import { initialSessionState } from '@/state/session-reducer';
import { CanvasNode } from './CanvasNode';

function renderVpcNode(preview: DragPreviewValue) {
  const { tree, nodeId } = addNode(emptyTree(), 'vpc', null);
  const state = {
    ...initialSessionState(),
    canvasTree: tree,
    layout: { [nodeId]: { x: 0, y: 0 } },
  };

  render(
    <DndContext onDragEnd={() => undefined}>
      <SessionContext.Provider value={{ state, dispatch: () => undefined, challenge: challenge01 }}>
        <DragPreviewContext.Provider value={preview}>
          <CanvasNode node={tree.roots[0]!} depth={0} />
        </DragPreviewContext.Provider>
      </SessionContext.Provider>
    </DndContext>,
  );

  return nodeId;
}

describe('ghost outline (v0.3.1)', () => {
  it('renders no ghost when there is no drag preview', () => {
    const nodeId = renderVpcNode(NO_DRAG_PREVIEW);
    expect(screen.queryByTestId(`ghost-${nodeId}`)).not.toBeInTheDocument();
  });

  it("renders no ghost when this Node isn't the preview's target", () => {
    const nodeId = renderVpcNode({ targetFrameId: 'some-other-node', previewSize: { width: 500, height: 400 } });
    expect(screen.queryByTestId(`ghost-${nodeId}`)).not.toBeInTheDocument();
  });

  it('renders a ghost outline, sized to the preview, when this Node is the target', () => {
    const { tree, nodeId } = addNode(emptyTree(), 'vpc', null);
    const state = { ...initialSessionState(), canvasTree: tree, layout: { [nodeId]: { x: 12, y: 24 } } };

    render(
      <DndContext onDragEnd={() => undefined}>
        <SessionContext.Provider value={{ state, dispatch: () => undefined, challenge: challenge01 }}>
          <DragPreviewContext.Provider
            value={{ targetFrameId: nodeId, previewSize: { width: 500, height: 400 } }}
          >
            <CanvasNode node={tree.roots[0]!} depth={0} />
          </DragPreviewContext.Provider>
        </SessionContext.Provider>
      </DndContext>,
    );

    const ghost = screen.getByTestId(`ghost-${nodeId}`);
    expect(ghost.style.width).toBe('500px');
    expect(ghost.style.height).toBe('400px');
    // Anchored at the same position as the real Node.
    expect(ghost.style.left).toBe('12px');
    expect(ghost.style.top).toBe('24px');
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
  });

  it('never intercepts pointer events', () => {
    const { tree, nodeId } = addNode(emptyTree(), 'vpc', null);
    const state = { ...initialSessionState(), canvasTree: tree, layout: { [nodeId]: { x: 0, y: 0 } } };

    render(
      <DndContext onDragEnd={() => undefined}>
        <SessionContext.Provider value={{ state, dispatch: () => undefined, challenge: challenge01 }}>
          <DragPreviewContext.Provider
            value={{ targetFrameId: nodeId, previewSize: { width: 500, height: 400 } }}
          >
            <CanvasNode node={tree.roots[0]!} depth={0} />
          </DragPreviewContext.Provider>
        </SessionContext.Provider>
      </DndContext>,
    );

    expect(screen.getByTestId(`ghost-${nodeId}`).className).toMatch(/pointer-events-none/);
  });
});
