import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

// Placeholder shell. The three-panel layout (Requirements / Canvas / Services
// beneath a header) is built in T019 as `src/App.tsx`, which replaces this.
createRoot(rootElement).render(
  <StrictMode>
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm">Architecture Canvas — scaffold ready.</p>
    </main>
  </StrictMode>,
);
