import type { RenderKind } from '@/domain/types';
import type { Size } from '@/state/layout';

interface DragOverlayPreviewProps {
  readonly label: string;
  readonly size: Size;
  readonly renderKind: RenderKind;
}

/**
 * v0.3.2's cursor-following drag feedback — the content of `<DragOverlay>`
 * in `TaskPage.tsx`. Deliberately dumb: no dnd-kit hooks, no `SessionContext`
 * — dnd-kit's `DragOverlay` positions this under the cursor on its own, so
 * this component only needs to look like the real Frame/Card it stands in
 * for. A Frame being dragged shows its real footprint size and label only —
 * it never recursively renders nested children (scope decision, v0.3.2).
 */
export function DragOverlayPreview({ label, size, renderKind }: DragOverlayPreviewProps) {
  const isFrame = renderKind === 'frame';

  return (
    <div
      aria-hidden="true"
      data-testid="drag-overlay"
      style={{ width: size.width, height: size.height }}
      className={`pointer-events-none rounded-lg p-2 shadow-lg ${
        isFrame
          ? 'border-2 border-dashed border-slate-400 bg-slate-50/90'
          : 'border-2 border-solid border-slate-300 bg-white'
      }`}
    >
      <span className="cursor-grabbing select-none rounded px-1.5 py-0.5 text-sm font-medium text-slate-800">
        {label}
      </span>
    </div>
  );
}
