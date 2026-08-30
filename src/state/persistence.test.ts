/**
 * The 9 persistence contract cases from contracts/persistence.md.
 *
 * The recurring theme: storage failure must NEVER interrupt work. Persistence
 * is a convenience, so every failure mode degrades to "start clean and carry
 * on", not to an error (SC-009).
 */

import { challenge01 } from '@/challenges/challenge-01';
import { addNode, countNodes, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { STORAGE_KEY, SESSION_VERSION, loadSession, saveSession } from './persistence';

function seededTree(): CanvasTree {
  let tree = emptyTree();
  const vpc = addNode(tree, 'vpc', null);
  tree = vpc.tree;
  const pub = addNode(tree, 'public-subnet', vpc.nodeId);
  tree = pub.tree;
  tree = addNode(tree, 'ec2-frontend', pub.nodeId).tree;
  return tree;
}

/** Replaces globalThis.localStorage for one test, restoring afterwards. */
function withStorage(stub: Partial<Storage>, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
  }
}

beforeEach(() => {
  localStorage.clear();
});

// --- Case 1 ----------------------------------------------------------------
describe('case 1: round trip', () => {
  it('restores the tree and revealed Categories identically (SC-005)', () => {
    const tree = seededTree();
    saveSession({ canvasTree: tree, revealedCategories: ['infrastructure', 'data-tier'] });

    const restored = loadSession(challenge01);
    expect(restored).not.toBeNull();
    expect(countNodes(restored!.canvasTree)).toBe(3);
    expect(restored!.canvasTree).toEqual(tree);
    expect(restored!.revealedCategories).toEqual(['infrastructure', 'data-tier']);
  });

  it('round-trips an empty session', () => {
    saveSession({ canvasTree: emptyTree(), revealedCategories: [] });
    const restored = loadSession(challenge01);
    expect(restored?.canvasTree.roots).toEqual([]);
    expect(restored?.revealedCategories).toEqual([]);
  });
});

// --- Case 2 ----------------------------------------------------------------
describe('case 2: missing key', () => {
  it('returns null without throwing', () => {
    expect(() => loadSession(challenge01)).not.toThrow();
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 3 ----------------------------------------------------------------
describe('case 3: malformed JSON', () => {
  it('discards and returns null', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards JSON that is not an object', () => {
    localStorage.setItem(STORAGE_KEY, '"a string"');
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 4 ----------------------------------------------------------------
describe('case 4: version mismatch (FR-033)', () => {
  it('discards a stale version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION + 1,
        canvasTree: seededTree(),
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a missing version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ canvasTree: seededTree(), revealedCategories: [] }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 5 ----------------------------------------------------------------
describe('case 5: unknown serviceId in the tree', () => {
  it('discards the whole envelope rather than partially restoring', () => {
    // This is what makes editing challenge-01.ts safe: renaming a Service id
    // invalidates stored sessions instead of producing Nodes that reference
    // Services which no longer exist.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: {
          roots: [{ id: 'a', serviceId: 'no-such-service', children: [] }],
        },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards when the unknown Service is nested deep', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: {
          roots: [
            {
              id: 'a',
              serviceId: 'vpc',
              children: [{ id: 'b', serviceId: 'ghost', children: [] }],
            },
          ],
        },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 6 ----------------------------------------------------------------
describe('case 6: unknown Category id', () => {
  it('discards the envelope', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: emptyTree(),
        revealedCategories: ['not-a-category'],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

describe('structural validation', () => {
  it('discards a tree whose roots is not an array', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: { roots: 'nope' },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a Node missing its children array', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: { roots: [{ id: 'a', serviceId: 'vpc' }] },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 7 ----------------------------------------------------------------
describe('case 7: storage throws on read (SC-009)', () => {
  it('returns null without throwing, leaving the app usable', () => {
    withStorage(
      {
        getItem: () => {
          throw new DOMException('access denied', 'SecurityError');
        },
      },
      () => {
        expect(() => loadSession(challenge01)).not.toThrow();
        expect(loadSession(challenge01)).toBeNull();
      },
    );
  });
});

// --- Case 8 ----------------------------------------------------------------
describe('case 8: storage throws on write (SC-009)', () => {
  it('swallows the failure silently', () => {
    withStorage(
      {
        setItem: () => {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        },
      },
      () => {
        expect(() =>
          saveSession({ canvasTree: seededTree(), revealedCategories: [] }),
        ).not.toThrow();
      },
    );
  });
});

// --- Case 9 ----------------------------------------------------------------
describe('case 9: the saved envelope (FR-034)', () => {
  it('contains no Evaluation', () => {
    saveSession({ canvasTree: seededTree(), revealedCategories: ['data-tier'] });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);

    expect(Object.keys(raw).sort()).toEqual(['canvasTree', 'revealedCategories', 'version']);
    expect(raw).not.toHaveProperty('evaluation');
    expect(JSON.stringify(raw)).not.toMatch(/score|passedCount|results/i);
  });

  it('stamps the current version', () => {
    saveSession({ canvasTree: emptyTree(), revealedCategories: [] });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(SESSION_VERSION);
  });

  it('writes to a single key', () => {
    saveSession({ canvasTree: seededTree(), revealedCategories: [] });
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(STORAGE_KEY);
  });
});
