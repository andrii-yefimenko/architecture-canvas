/**
 * Application header. Holds the submit control, which is ALWAYS enabled —
 * an empty Canvas is a valid submission scoring 0 with a full list of unmet
 * requirements (FR-019, FR-025). There is deliberately no disabled state.
 */
export function Header() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <h1 className="text-base font-semibold tracking-tight text-slate-900">Architecture Canvas</h1>
      <button
        type="button"
        // Submit wiring lands in T036 (Phase 3).
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Submit
      </button>
    </header>
  );
}
