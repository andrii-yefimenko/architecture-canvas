/**
 * T057 — canonical terminology (CONTEXT.md).
 *
 * CONTEXT.md exists because the documentation audit found real drift —
 * "Backend EC2" against "EC2 (Backend)" — of exactly the kind that produces a
 * silently wrong Score. Its avoid-lists are asserted here so the vocabulary
 * cannot quietly rot as the codebase grows.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFilesIn(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const sources = sourceFilesIn('src').map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

/** Terms CONTEXT.md explicitly tells us not to use, and what to say instead. */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; instead: string }> = [
  { pattern: /\bblocks?\b/i, instead: 'Service (catalog) or Node (placed)' },
  { pattern: /\bvalidation rules?\b/i, instead: 'Rule' },
  { pattern: /\brules array\b/i, instead: 'Rule' },
  { pattern: /\bchecklist items?\b/i, instead: 'Rule' },
  { pattern: /\bcanvas (?:item|element)s?\b/i, instead: 'Node' },
  { pattern: /\bdiagram\b/i, instead: 'Canvas Tree' },
];

describe('canonical vocabulary', () => {
  it('reads the source tree', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)('never says $instead the wrong way ($pattern)', ({ pattern, instead }) => {
    const offenders = sources
      .filter(({ text }) => pattern.test(text))
      .map(({ path }) => path);

    expect(
      offenders,
      `Use "${instead}" instead — see CONTEXT.md. Found in: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('uses the canonical Service ids for the two EC2 roles', () => {
    // The exact drift the doc audit caught. These ids are referenced by Rules
    // and by persisted sessions, so a rename is a breaking change.
    const challenge = readFileSync('src/challenges/challenge-01.ts', 'utf8');
    expect(challenge).toMatch(/id: 'ec2-frontend'/);
    expect(challenge).toMatch(/id: 'ec2-backend'/);
    expect(challenge).toMatch(/name: 'EC2 \(Frontend\)'/);
    expect(challenge).toMatch(/name: 'EC2 \(Backend\)'/);
    expect(challenge).not.toMatch(/Backend EC2|Frontend EC2/);
  });
});
