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
 * for (v0.3.3's square-tile Card / corner-badge Frame look). A Frame being
 * dragged shows its real footprint size and badge label only — it never
 * recursively renders nested children (scope decision, v0.3.2).
 */
export function DragOverlayPreview({ label, size, renderKind }: DragOverlayPreviewProps) {
  const isFrame = renderKind === 'frame';

  if (isFrame) {
    return (
      <div
        aria-hidden="true"
        data-testid="drag-overlay"
        style={{ width: size.width, height: size.height }}
        className="pointer-events-none relative rounded-lg border-2 border-dashed border-slate-400 bg-slate-50/90 p-2 shadow-lg"
      >
        <span className="absolute -top-3 left-3 cursor-grabbing select-none rounded-full border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="drag-overlay"
      style={{ width: size.width, height: size.height }}
      className="pointer-events-none flex cursor-grabbing items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-slate-300 bg-white p-1 shadow-lg"
    >
      <span className="select-none text-center text-xs leading-snug font-medium text-slate-800">{label}</span>
    </div>
  );
}
