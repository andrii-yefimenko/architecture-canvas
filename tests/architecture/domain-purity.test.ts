/**
 * Architectural guard: the domain layer stays framework-free.
 *
 * ADR 0001 accepts a client-side evaluator on the basis that relocating it
 * server-side later is a *transport* change, not a rewrite. That promise holds
 * only while `src/domain/` and `src/challenges/` can run outside a browser. A
 * single React or storage import silently destroys it, and nothing in a normal
 * test run would notice.
 *
 * ESLint already forbids these imports (eslint.config.js), but lint is easy to
 * skip and easy to disable inline. This asserts the same property from the
 * test suite, which gates CI.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PURE_DIRS = ['src/domain', 'src/challenges'];

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFilesIn(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const pureFiles = PURE_DIRS.flatMap(sourceFilesIn);
// Tests inside the domain may legitimately import fixtures; the production
// modules are what must stay pure.
const productionFiles = pureFiles.filter((f) => !f.endsWith('.test.ts'));

describe('domain layer purity (ADR 0001)', () => {
  it('finds the domain source files to check', () => {
    expect(productionFiles.length).toBeGreaterThan(0);
  });

  it.each(productionFiles)('%s imports no framework or UI package', (file) => {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);

    for (const specifier of imports) {
      expect(specifier).not.toMatch(/^react($|\/|-)/);
      expect(specifier).not.toMatch(/^@dnd-kit\//);
      expect(specifier).not.toMatch(/^@\/(state|components)\//);
      expect(specifier).not.toMatch(/^\.\.\/(state|components)\//);
    }
  });

  it.each(productionFiles)('%s touches no browser storage or globals', (file) => {
    const source = readFileSync(file, 'utf8');
    // Strip comments so prose explaining the rule does not trip it.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/\blocalStorage\b/);
    expect(code).not.toMatch(/\bsessionStorage\b/);
    expect(code).not.toMatch(/\bdocument\b/);
    expect(code).not.toMatch(/\bwindow\b/);
  });

  it('contains no .tsx files — JSX would imply a React dependency', () => {
    expect(pureFiles.filter((f) => f.endsWith('.tsx'))).toEqual([]);
  });

  it('keeps the evaluator signature transport-agnostic', () => {
    // (CanvasTree, Rule[]) -> Evaluation is what makes the ADR's migration
    // path a transport change. Adding a parameter sourced from component state
    // or storage would break it.
    const source = readFileSync('src/domain/evaluator.ts', 'utf8');
    expect(source).toMatch(
      /export function evaluate\(\s*canvasTree: CanvasTree,\s*rules: readonly Rule\[\],?\s*\): Evaluation/,
    );
  });
});
