/**
 * US4 — resume an in-progress session.
 * Covers spec Acceptance Scenarios 1-3.
 *
 * Reload is simulated by unmounting and rendering a fresh <App />: the second
 * mount reads whatever the first persisted, which is exactly what a browser
 * reload does.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, countNodes, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree, NodeId } from '@/domain/types';
import { STORAGE_KEY, SESSION_VERSION, loadSession } from '@/state/persistence';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

function seededState(): SessionState {
  let tree: CanvasTree = emptyTree();
  const add = (serviceId: string, parentId: NodeId | null = null): NodeId => {
    const r = addNode(tree, serviceId, parentId);
    tree = r.tree;
    return r.nodeId;
  };
  const vpc = add('vpc');
  const pub = add('public-subnet', vpc);
  add('ec2-frontend', pub);
  add('private-subnet', vpc);

  return { ...initialSessionState(), canvasTree: tree };
}

const categories = challenge01.hiddenRequirementCategories;

function nameMatcher(name: string): RegExp {
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

describe('Scenario 1: the Canvas Tree survives a reload', () => {
  it('restores identical structure (SC-005)', async () => {
    const user = userEvent.setup();
    const seeded = seededState();

    // First visit: seeded Canvas, then an edit to force a save.
    const first = render(<App initialState={seeded} />);
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Frontend)' }));
    first.unmount();

    // Storage now holds the edited tree.
    const persisted = loadSession(challenge01);
    expect(persisted).not.toBeNull();
    expect(countNodes(persisted!.canvasTree)).toBe(3);

    // Second visit restores it without an explicit seed.
    render(<App />);
    expect(screen.getByRole('button', { name: 'Remove VPC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Public Subnet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove EC2 (Frontend)' })).not.toBeInTheDocument();
    expect(screen.queryByText(/drag services here/i)).not.toBeInTheDocument();
  });
});

describe('Scenario 2: revealed Categories survive a reload', () => {
  it('keeps revealed Categories revealed and the rest concealed', async () => {
    const user = userEvent.setup();
    const panel = () => screen.getByRole('region', { name: 'Requirements' });

    const first = render(<App />);
    const revealed = [categories[0]!, categories[3]!];
    for (const category of revealed) {
      await user.click(within(panel()).getByRole('button', { name: nameMatcher(category.name) }));
    }
    first.unmount();

    render(<App />);
    for (const category of revealed) {
      for (const requirement of category.requirements) {
        expect(screen.getAllByText(requirement).length).toBeGreaterThan(0);
      }
    }
    // The other two still offer their reveal control.
    for (const category of [categories[1]!, categories[2]!]) {
      expect(
        within(panel()).getByRole('button', { name: nameMatcher(category.name) }),
      ).toBeInTheDocument();
    }
  });
});

describe('the Evaluation is deliberately not restored (FR-034)', () => {
  it('shows no results after a reload, even if one was submitted before', async () => {
    const user = userEvent.setup();

    const first = render(<App initialState={seededState()} />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('region', { name: 'Evaluation' })).toBeInTheDocument();
    first.unmount();

    render(<App />);
    expect(screen.queryByRole('region', { name: 'Evaluation' })).not.toBeInTheDocument();
  });

  it('never writes an Evaluation to storage', async () => {
    const user = userEvent.setup();
    const first = render(<App initialState={seededState()} />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('button', { name: 'Remove EC2 (Frontend)' }));
    first.unmount();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual([
      'canvasTree',
      'revealedCategories',
      'version',
    ]);
  });
});

describe('Scenario 3: incompatible stored state (FR-033)', () => {
  it('starts clean on a version mismatch rather than failing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION + 99,
        canvasTree: seededState().canvasTree,
        revealedCategories: [],
      }),
    );

    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });

  it('starts clean when stored Nodes reference an unknown Service', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SESSION_VERSION,
        canvasTree: { roots: [{ id: 'x', serviceId: 'retired-service', children: [] }] },
        revealedCategories: [],
      }),
    );

    render(<App />);
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });

  it('starts clean on malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'definitely not json');
    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
  });
});

describe('storage unavailable (SC-009)', () => {
  it('renders and works normally when localStorage throws', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
        setItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
        clear: () => undefined,
      },
      configurable: true,
    });

    try {
      const user = userEvent.setup();
      expect(() => render(<App initialState={seededState()} />)).not.toThrow();

      // Fully usable: submitting still works, no error surfaced.
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(screen.getByRole('region', { name: 'Evaluation' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove EC2 (Frontend)' }));
      expect(screen.queryByRole('button', { name: 'Remove EC2 (Frontend)' })).not.toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});
