import { useState } from 'react';
import type { Node, Service } from '@/domain/types';
import { defaultPositionForKeyboardPlacement, effectiveRenderKind } from '@/state/layout';
import { useSession } from '@/state/session-context';

interface FrameTarget {
  /** null = the Canvas root itself. */
  readonly id: string | null;
  readonly label: string;
  readonly childCount: number;
}

function collectFrameTargets(nodes: readonly Node[], services: readonly Service[], out: FrameTarget[]): void {
  for (const node of nodes) {
    const service = services.find((s) => s.id === node.serviceId);
    const kind = effectiveRenderKind(node.children.length, service?.renderKind ?? 'card');
    if (kind === 'frame') {
      out.push({ id: node.id, label: service?.name ?? node.serviceId, childCount: node.children.length });
    }
    collectFrameTargets(node.children, services, out);
  }
}

/**
 * Keyboard-only placement (FR-016, FR-017): select a Service and a target
 * Frame — or the Canvas root — and assign it there at a deterministic
 * default position. A coarse but fully keyboard-operable path to the same
 * ADD_NODE action pointer drag-and-drop dispatches; not a substitute for
 * fine-grained keyboard repositioning, which is out of scope for this
 * release (docs/03-BACKLOG.md).
 */
export function KeyboardPlacement() {
  const { challenge, state, dispatch } = useSession();
  const [serviceId, setServiceId] = useState(challenge.services[0]?.id ?? '');
  const [targetId, setTargetId] = useState('root');

  const targets: FrameTarget[] = [
    { id: null, label: 'Canvas (top level)', childCount: state.canvasTree.roots.length },
  ];
  collectFrameTargets(state.canvasTree.roots, challenge.services, targets);

  const handleAssign = () => {
    if (!serviceId) return;
    const parentId = targetId === 'root' ? null : targetId;
    const target = targets.find((t) => (t.id ?? 'root') === targetId);
    const position = defaultPositionForKeyboardPlacement(target?.childCount ?? 0);
    dispatch({ type: 'ADD_NODE', serviceId, parentId, position });
  };

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Keyboard placement
      </h3>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600" htmlFor="keyboard-placement-service">
          Service
          <select
            id="keyboard-placement-service"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          >
            {challenge.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600" htmlFor="keyboard-placement-target">
          Place inside
          <select
            id="keyboard-placement-target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          >
            {targets.map((target) => (
              <option key={target.id ?? 'root'} value={target.id ?? 'root'}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!serviceId}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Add
        </button>
      </div>
    </div>
  );
}
