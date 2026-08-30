import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ---------------------------------------------------------------------------
  // Domain purity boundary.
  //
  // `src/domain/` and `src/challenges/` MUST stay framework-free. This is not a
  // style preference: ADR 0001 accepts a client-side evaluator on the basis that
  // relocating it server-side later is a transport change, not a rewrite. A
  // single React or storage import inside the domain silently destroys that
  // migration path, so the boundary is enforced by lint rather than by review.
  //
  // Task T054 verifies this holds at the end of implementation; this rule stops
  // the violation from ever landing.
  // ---------------------------------------------------------------------------
  {
    files: ['src/domain/**/*.ts', 'src/challenges/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react/*', 'react-dom/*'],
              message:
                'The domain layer must stay framework-free (ADR 0001). Move React-aware code to src/state/ or src/components/.',
            },
            {
              group: ['@dnd-kit/*'],
              message:
                'The domain layer must not know about drag and drop. Translate drags into reducer actions in src/components/ instead.',
            },
            {
              group: ['@/state/*', '@/components/*', '../state/*', '../components/*'],
              message:
                'Dependencies point downward only: domain must never import from state or components.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'The domain layer must not touch storage. Persistence lives in src/state/persistence.ts.',
        },
        {
          name: 'sessionStorage',
          message: 'The domain layer must not touch storage. See src/state/persistence.ts.',
        },
        {
          name: 'window',
          message: 'The domain layer must be environment-agnostic so it can run outside a browser.',
        },
        {
          name: 'document',
          message: 'The domain layer must be environment-agnostic so it can run outside a browser.',
        },
      ],
    },
  },

  // Test files may use node/vitest globals freely.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test-setup.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Config files run in Node.
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
