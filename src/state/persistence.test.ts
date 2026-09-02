/**
 * The persistence contract cases from
 * specs/002-multi-challenge-catalog/contracts/persistence.md: the original 9
 * from spec 001, re-run against a per-Challenge key, plus new cases 10, 11,
 * and 14 for cross-Challenge isolation.
 *
 * The recurring theme: storage failure must NEVER interrupt work. Persistence
 * is a convenience, so every failure mode degrades to "start clean and carry
 * on", not to an error (SC-009 in spec 001).
 */

import { challenge01 } from '@/challenges/challenge-01';
import { challenge02 } from '@/challenges/challenge-02';
import { addNode, countNodes, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { storageKey, SESSION_VERSION, loadSession, saveSession, clearSession } from './persistence';

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
  it('restores the tree and revealed Categories identically (SC-005, spec 001)', () => {
    const tree = seededTree();
    saveSession(challenge01.id, { canvasTree: tree, revealedCategories: ['infrastructure', 'data-tier'] });

    const restored = loadSession(challenge01);
    expect(restored).not.toBeNull();
    expect(countNodes(restored!.canvasTree)).toBe(3);
    expect(restored!.canvasTree).toEqual(tree);
    expect(restored!.revealedCategories).toEqual(['infrastructure', 'data-tier']);
  });

  it('round-trips an empty session', () => {
    saveSession(challenge01.id, { canvasTree: emptyTree(), revealedCategories: [] });
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
    localStorage.setItem(storageKey(challenge01.id), '{not valid json');
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards JSON that is not an object', () => {
    localStorage.setItem(storageKey(challenge01.id), '"a string"');
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 4 ----------------------------------------------------------------
describe('case 4: version mismatch (FR-033, spec 001)', () => {
  it('discards a stale version', () => {
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION + 1,
        challengeId: challenge01.id,
        canvasTree: seededTree(),
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a missing version', () => {
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({ challengeId: challenge01.id, canvasTree: seededTree(), revealedCategories: [] }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 5 ----------------------------------------------------------------
describe('case 5: unknown serviceId in the tree', () => {
  it('discards the whole envelope rather than partially restoring', () => {
    // This is what makes editing a Challenge module safe: renaming a Service
    // id invalidates stored sessions instead of producing Nodes that
    // reference Services which no longer exist.
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
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
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
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
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
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
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
        canvasTree: { roots: 'nope' },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a Node missing its children array', () => {
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
        canvasTree: { roots: [{ id: 'a', serviceId: 'vpc' }] },
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 7 ----------------------------------------------------------------
describe('case 7: storage throws on read (SC-009, spec 001)', () => {
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
describe('case 8: storage throws on write (SC-009, spec 001)', () => {
  it('swallows the failure silently', () => {
    withStorage(
      {
        setItem: () => {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        },
      },
      () => {
        expect(() =>
          saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: [] }),
        ).not.toThrow();
      },
    );
  });
});

// --- Case 9 ----------------------------------------------------------------
describe('case 9: the saved envelope (FR-034, spec 001)', () => {
  it('contains no Evaluation', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: ['data-tier'] });
    const raw = JSON.parse(localStorage.getItem(storageKey(challenge01.id))!);

    expect(Object.keys(raw).sort()).toEqual(['canvasTree', 'challengeId', 'revealedCategories', 'version']);
    expect(raw).not.toHaveProperty('evaluation');
    expect(JSON.stringify(raw)).not.toMatch(/score|passedCount|results/i);
  });

  it('stamps the current version and its own Challenge ID', () => {
    saveSession(challenge01.id, { canvasTree: emptyTree(), revealedCategories: [] });
    const raw = JSON.parse(localStorage.getItem(storageKey(challenge01.id))!);
    expect(raw.version).toBe(SESSION_VERSION);
    expect(raw.challengeId).toBe(challenge01.id);
  });

  it('writes to a single key for that Challenge', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: [] });
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(storageKey(challenge01.id));
  });
});

// --- Case 10 -----------------------------------------------------------
describe('case 10: one Challenge never reads another\'s key', () => {
  it('Challenge #2 starts empty when only Challenge #1 has a saved session', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: ['infrastructure'] });

    expect(loadSession(challenge02)).toBeNull();
  });
});

// --- Case 11 -----------------------------------------------------------
describe('case 11: mismatched challengeId is rejected even when Service ids overlap', () => {
  it('discards an envelope whose challengeId does not match, despite passing every structural check', () => {
    // Every serviceId here ('vpc', 'public-subnet') exists in BOTH catalogs,
    // so checks 4-6 alone would accept this envelope for Challenge #2. Only
    // the challengeId check (new for this feature) catches it.
    localStorage.setItem(
      storageKey(challenge02.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id, // wrong — this key is challenge02's
        canvasTree: seededTree(),
        revealedCategories: [],
      }),
    );

    expect(loadSession(challenge02)).toBeNull();
  });
});

// --- Case 12 -------------------------------------------------------------
describe('case 12: clearSession removes the key outright', () => {
  it('leaves nothing behind for that Challenge', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: ['infrastructure'] });
    expect(loadSession(challenge01)).not.toBeNull();

    clearSession(challenge01.id);

    expect(localStorage.getItem(storageKey(challenge01.id))).toBeNull();
    expect(loadSession(challenge01)).toBeNull();
  });

  it('does not touch a different Challenge\'s key', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: [] });
    saveSession(challenge02.id, { canvasTree: seededTree(), revealedCategories: [] });

    clearSession(challenge01.id);

    expect(loadSession(challenge01)).toBeNull();
    expect(loadSession(challenge02)).not.toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    withStorage(
      {
        removeItem: () => {
          throw new DOMException('access denied', 'SecurityError');
        },
      },
      () => {
        expect(() => clearSession(challenge01.id)).not.toThrow();
      },
    );
  });
});

// --- Case 13 -------------------------------------------------------------
describe('case 13: restarting after a clear is identical to a first visit', () => {
  it('has no Canvas Tree or revealed Categories to restore', () => {
    saveSession(challenge01.id, { canvasTree: seededTree(), revealedCategories: ['infrastructure'] });
    clearSession(challenge01.id);

    const restored = loadSession(challenge01);
    expect(restored).toBeNull();
  });
});

// --- Case 14 -----------------------------------------------------------
describe('case 14: a reload restores exactly as left', () => {
  it('is exactly the round-trip guarantee from case 1, scoped per Challenge', () => {
    // The end-to-end version of this (through App.tsx, across an actual
    // reload) lives in tests/integration/session-isolation.test.tsx —
    // covered here at the persistence-module level only.
    const tree = seededTree();
    saveSession(challenge01.id, { canvasTree: tree, revealedCategories: ['presentation-tier'] });

    expect(loadSession(challenge01)).toEqual({
      canvasTree: tree,
      revealedCategories: ['presentation-tier'],
    });
  });
});
