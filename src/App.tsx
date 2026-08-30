import { Header } from '@/components/Header';
import { SessionProvider } from '@/state/SessionProvider';

/**
 * Three-panel application shell (FR-035, FR-036).
 *
 * Layout per MVP.md: a horizontal header above three vertical regions —
 * Requirements, Canvas, Services — with the Canvas as the largest.
 *
 * Panel bodies are placeholders here. They are filled in by:
 *   RequirementsPanel  T028 (visible) / T040-T041 (hidden reveal)
 *   Canvas             T029-T031
 *   ServicesPanel      T026-T027
 */
export function App() {
  return (
    <SessionProvider>
      <div className="flex h-full flex-col bg-slate-50 text-slate-900">
        <Header />

        <div className="flex min-h-0 flex-1">
          <section
            aria-label="Requirements"
            className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4"
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Requirements
            </h2>
          </section>

          <main
            aria-label="Canvas"
            className="min-w-0 flex-1 overflow-auto bg-slate-100 p-6"
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Canvas
            </h2>
          </main>

          <section
            aria-label="Services"
            className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4"
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Services
            </h2>
          </section>
        </div>
      </div>
    </SessionProvider>
  );
}
