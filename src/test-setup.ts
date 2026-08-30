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

/**
 * Clear persisted session state between tests.
 *
 * Once SessionProvider restores from localStorage on init, any test that
 * renders <App /> without an explicit initialState inherits whatever the
 * previous test saved. Clearing here keeps every test independent, rather than
 * making each file remember to do it.
 */
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // Storage may be unavailable in some environments; nothing to clear.
  }
});
