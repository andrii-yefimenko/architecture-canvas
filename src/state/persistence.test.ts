/**
 * The persistence contract cases from this feature's contracts/persistence.md
 * (see specs/, feature 003): all nineteen — the
 * original 9 from spec 001, cases 10/11/14 added for cross-Challenge
 * isolation in spec 002, and cases 15-19 added here for Layout.
 *
 * The recurring theme: storage failure must NEVER interrupt work. Persistence
 * is a convenience, so every failure mode degrades to "start clean and carry
 * on", not to an error (SC-009 in spec 001).
 */

import { challenge01 } from '@/challenges/challenge-01';
import { challenge02 } from '@/challenges/challenge-02';
import { addNode, countNodes, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import type { LayoutMap } from './layout';
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

/** A Layout entry for every Node in `tree`, in tree order — vpc, public-subnet, ec2-frontend. */
function seededLayout(tree: CanvasTree): LayoutMap {
  const vpc = tree.roots[0]!;
  const pub = vpc.children[0]!;
  const frontend = pub.children[0]!;
  return {
    [vpc.id]: { x: 10, y: 20 },
    [pub.id]: { x: 30, y: 40 },
    [frontend.id]: { x: 50, y: 60 },
  };
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
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['infrastructure', 'data-tier'],
      layout: seededLayout(tree),
    });

    const restored = loadSession(challenge01);
    expect(restored).not.toBeNull();
    expect(countNodes(restored!.canvasTree)).toBe(3);
    expect(restored!.canvasTree).toEqual(tree);
    expect(restored!.revealedCategories).toEqual(['infrastructure', 'data-tier']);
  });

  it('round-trips an empty session', () => {
    saveSession(challenge01.id, { canvasTree: emptyTree(), revealedCategories: [], layout: {} });
    const restored = loadSession(challenge01);
    expect(restored?.canvasTree.roots).toEqual([]);
    expect(restored?.revealedCategories).toEqual([]);
    expect(restored?.layout).toEqual({});
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
    const tree = seededTree();
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION + 1,
        challengeId: challenge01.id,
        canvasTree: tree,
        revealedCategories: [],
        layout: seededLayout(tree),
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a missing version', () => {
    const tree = seededTree();
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        challengeId: challenge01.id,
        canvasTree: tree,
        revealedCategories: [],
        layout: seededLayout(tree),
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });

  it('discards a pre-Layout envelope (version 1, no layout field)', () => {
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: 1,
        challengeId: challenge01.id,
        canvasTree: seededTree(),
        revealedCategories: [],
      }),
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
        layout: { a: { x: 0, y: 0 } },
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
        layout: { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
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
        layout: {},
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
        layout: {},
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
        layout: { a: { x: 0, y: 0 } },
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
        const tree = seededTree();
        expect(() =>
          saveSession(challenge01.id, {
            canvasTree: tree,
            revealedCategories: [],
            layout: seededLayout(tree),
          }),
        ).not.toThrow();
      },
    );
  });
});

// --- Case 9 ----------------------------------------------------------------
describe('case 9: the saved envelope (FR-034, spec 001)', () => {
  it('contains no Evaluation', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['data-tier'],
      layout: seededLayout(tree),
    });
    const raw = JSON.parse(localStorage.getItem(storageKey(challenge01.id))!);

    expect(Object.keys(raw).sort()).toEqual(
      ['canvasTree', 'challengeId', 'layout', 'revealedCategories', 'version'].sort(),
    );
    expect(raw).not.toHaveProperty('evaluation');
    expect(JSON.stringify(raw)).not.toMatch(/score|passedCount|results/i);
  });

  it('stamps the current version and its own Challenge ID', () => {
    saveSession(challenge01.id, { canvasTree: emptyTree(), revealedCategories: [], layout: {} });
    const raw = JSON.parse(localStorage.getItem(storageKey(challenge01.id))!);
    expect(raw.version).toBe(SESSION_VERSION);
    expect(raw.challengeId).toBe(challenge01.id);
  });

  it('writes to a single key for that Challenge', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: [],
      layout: seededLayout(tree),
    });
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(storageKey(challenge01.id));
  });
});

// --- Case 10 -----------------------------------------------------------
describe('case 10: one Challenge never reads another\'s key', () => {
  it('Challenge #2 starts empty when only Challenge #1 has a saved session', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['infrastructure'],
      layout: seededLayout(tree),
    });

    expect(loadSession(challenge02)).toBeNull();
  });
});

// --- Case 11 -----------------------------------------------------------
describe('case 11: mismatched challengeId is rejected even when Service ids overlap', () => {
  it('discards an envelope whose challengeId does not match, despite passing every structural check', () => {
    // Every serviceId here ('vpc', 'public-subnet') exists in BOTH catalogs,
    // so checks 4-6 alone would accept this envelope for Challenge #2. Only
    // the challengeId check (from spec 002) catches it.
    const tree = seededTree();
    localStorage.setItem(
      storageKey(challenge02.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id, // wrong — this key is challenge02's
        canvasTree: tree,
        revealedCategories: [],
        layout: seededLayout(tree),
      }),
    );

    expect(loadSession(challenge02)).toBeNull();
  });
});

// --- Case 12 -------------------------------------------------------------
describe('case 12: clearSession removes the key outright', () => {
  it('leaves nothing behind for that Challenge', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['infrastructure'],
      layout: seededLayout(tree),
    });
    expect(loadSession(challenge01)).not.toBeNull();

    clearSession(challenge01.id);

    expect(localStorage.getItem(storageKey(challenge01.id))).toBeNull();
    expect(loadSession(challenge01)).toBeNull();
  });

  it('does not touch a different Challenge\'s key', () => {
    const tree = seededTree();
    saveSession(challenge01.id, { canvasTree: tree, revealedCategories: [], layout: seededLayout(tree) });
    saveSession(challenge02.id, { canvasTree: tree, revealedCategories: [], layout: seededLayout(tree) });

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
  it('has no Canvas Tree, revealed Categories, or Layout to restore', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['infrastructure'],
      layout: seededLayout(tree),
    });
    clearSession(challenge01.id);

    const restored = loadSession(challenge01);
    expect(restored).toBeNull();
  });
});

// --- Case 14 -----------------------------------------------------------
describe('case 14: a reload restores exactly as left', () => {
  it('is exactly the round-trip guarantee from case 1, scoped per Challenge', () => {
    // The end-to-end version of this (through App.tsx, across an actual
    // reload) lives in tests/integration/session-isolation.test.tsx and
    // tests/integration/layout-persistence.test.tsx — covered here at the
    // persistence-module level only.
    const tree = seededTree();
    const layout = seededLayout(tree);
    saveSession(challenge01.id, { canvasTree: tree, revealedCategories: ['presentation-tier'], layout });

    expect(loadSession(challenge01)).toEqual({
      canvasTree: tree,
      revealedCategories: ['presentation-tier'],
      layout,
    });
  });
});

// --- Case 15 -------------------------------------------------------------
describe('case 15: Layout round-trips identically (SC-003)', () => {
  it('restores every Node\'s position exactly as saved', () => {
    const tree = seededTree();
    const layout = seededLayout(tree);
    saveSession(challenge01.id, { canvasTree: tree, revealedCategories: [], layout });

    expect(loadSession(challenge01)?.layout).toEqual(layout);
  });
});

// --- Case 16 -------------------------------------------------------------
describe('case 16: a layout missing an entry for a Node present in canvasTree', () => {
  it('is accepted — completeness is not required, matching CanvasNode.tsx\'s origin fallback', () => {
    const tree = seededTree();
    const layout = seededLayout(tree);
    const incomplete = { ...layout };
    delete incomplete[tree.roots[0]!.id];
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
        canvasTree: tree,
        revealedCategories: [],
        layout: incomplete,
      }),
    );
    expect(loadSession(challenge01)?.layout).toEqual(incomplete);
  });
});

// --- Case 17 -------------------------------------------------------------
describe('case 17: layout has an entry for a NodeId not present in canvasTree', () => {
  it('discards the whole envelope', () => {
    const tree = seededTree();
    const layout = { ...seededLayout(tree), 'stale-deleted-node': { x: 1, y: 1 } };
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: SESSION_VERSION,
        challengeId: challenge01.id,
        canvasTree: tree,
        revealedCategories: [],
        layout,
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 18 -------------------------------------------------------------
describe('case 18: a version: 1 envelope (pre-Layout shape) is discarded', () => {
  it('rejects it even though canvasTree/revealedCategories alone would be valid', () => {
    localStorage.setItem(
      storageKey(challenge01.id),
      JSON.stringify({
        version: 1,
        challengeId: challenge01.id,
        canvasTree: seededTree(),
        revealedCategories: [],
      }),
    );
    expect(loadSession(challenge01)).toBeNull();
  });
});

// --- Case 19 -------------------------------------------------------------
describe('case 19: the saved envelope contains no Evaluation', () => {
  it('is unaffected by adding Layout (FR-034, unchanged)', () => {
    const tree = seededTree();
    saveSession(challenge01.id, {
      canvasTree: tree,
      revealedCategories: ['data-tier'],
      layout: seededLayout(tree),
    });
    const raw = JSON.parse(localStorage.getItem(storageKey(challenge01.id))!);
    expect(raw).not.toHaveProperty('evaluation');
  });
});
