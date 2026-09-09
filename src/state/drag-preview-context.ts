import { createContext, useContext } from 'react';
import type { NodeId } from '@/domain/types';
import type { Size } from './layout';

/**
 * Ephemeral, drag-only UI feedback (v0.3.1's ghost preview) — never part of
 * `SessionState`, never persisted. `targetFrameId` is the Node currently
 * under the pointer whose Frame would grow to fit the dragged item;
 * `previewSize` is the projected size, or `null` when there's nothing to
 * preview (no drag in progress, or the target wouldn't need to grow).
 *
 * Defaults to "nothing to preview" rather than throwing outside a Provider —
 * unlike SessionContext, a missing preview is a normal, harmless state, not
 * a programming error.
 */
export interface DragPreviewValue {
  readonly targetFrameId: NodeId | null;
  readonly previewSize: Size | null;
}

export const NO_DRAG_PREVIEW: DragPreviewValue = { targetFrameId: null, previewSize: null };

export const DragPreviewContext = createContext<DragPreviewValue>(NO_DRAG_PREVIEW);

export function useDragPreview(): DragPreviewValue {
  return useContext(DragPreviewContext);
}
