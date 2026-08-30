import '@testing-library/jest-dom/vitest';

// jsdom does not always expose `crypto.randomUUID`, which every Node instance
// depends on for its identity (see data-model.md). Provide a deterministic-shape
// fallback so domain and component tests can run without polyfill noise.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => {
        counter += 1;
        return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}` as const;
      },
    },
    configurable: true,
  });
}
