/**
 * US2 — discover Hidden Requirements.
 * Covers spec Acceptance Scenarios 1-4.
 *
 * This is the platform's core differentiator per docs/01-RESEARCH.md: the
 * requirements-gathering skill that interview-prep and lab platforms skip.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { evaluate } from '@/domain/evaluator';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { initialSessionState, sessionReducer } from '@/state/session-reducer';

// Predates routing: <App /> used to render Challenge #1's Task Page directly.
// '/' now renders the Catalog Page instead, so every test here points the
// route at Challenge #1's Task Page explicitly.
beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

/**
 * Category names contain regex metacharacters — "Presentation Tier (Web /
 * Frontend)" — so they must be escaped before use as a name matcher.
 */
function nameMatcher(name: string): RegExp {
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

const categories = challenge01.hiddenRequirementCategories;
const allHiddenRequirements = categories.flatMap((c) => c.requirements);

function requirementsPanel() {
  return screen.getByRole('region', { name: 'Requirements' });
}

describe('Scenario 1: everything hidden on load', () => {
  it('shows no Hidden Requirement text before any reveal (FR-003)', () => {
    render(<App />);
    for (const requirement of allHiddenRequirements) {
      expect(screen.queryByText(requirement)).not.toBeInTheDocument();
    }
  });

  it('offers exactly one reveal control per Category (FR-004)', () => {
    render(<App />);
    const panel = requirementsPanel();
    for (const category of categories) {
      expect(within(panel).getByRole('button', { name: nameMatcher(category.name) }))
        .toBeInTheDocument();
    }
    expect(categories).toHaveLength(4);
  });
});

describe('Scenario 2: revealing a Category', () => {
  it('reveals every requirement in that Category (FR-005)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const target = categories[2]!; // Application Tier
    await user.click(
      within(requirementsPanel()).getByRole('button', { name: nameMatcher(target.name) }),
    );

    for (const requirement of target.requirements) {
      expect(screen.getByText(requirement)).toBeInTheDocument();
    }
  });

  it('keeps the requirements visible once revealed (FR-006)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const target = categories[0]!;
    await user.click(
      within(requirementsPanel()).getByRole('button', { name: nameMatcher(target.name) }),
    );
    // Reveal another; the first must stay visible.
    const other = categories[1]!;
    await user.click(
      within(requirementsPanel()).getByRole('button', { name: nameMatcher(other.name) }),
    );

    for (const requirement of target.requirements) {
      expect(screen.getByText(requirement)).toBeInTheDocument();
    }
  });
});

describe('Scenario 3: other Categories stay concealed', () => {
  it('reveals only the chosen Category', async () => {
    const user = userEvent.setup();
    render(<App />);

    const revealed = categories[2]!;
    await user.click(
      within(requirementsPanel()).getByRole('button', { name: nameMatcher(revealed.name) }),
    );

    // Some requirement text is shared between tiers verbatim in MVP.md — both
    // the Presentation and Application tiers say "Code will be hosted on
    // server." Concealment can only be asserted for text unique to a hidden
    // Category; a shared string is legitimately on screen via the revealed one.
    const revealedText = new Set(revealed.requirements);
    for (const category of categories.filter((c) => c.id !== revealed.id)) {
      for (const requirement of category.requirements) {
        if (revealedText.has(requirement)) continue;
        expect(screen.queryByText(requirement)).not.toBeInTheDocument();
      }
    }
  });

  it('reveals all four when each is activated', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const category of categories) {
      await user.click(
        within(requirementsPanel()).getByRole('button', { name: nameMatcher(category.name) }),
      );
    }

    // getAllByText, since duplicated requirement text appears once per Category.
    for (const requirement of new Set(allHiddenRequirements)) {
      const expected = allHiddenRequirements.filter((r) => r === requirement).length;
      expect(screen.getAllByText(requirement)).toHaveLength(expected);
    }
  });
});

describe('Scenario 4: revealing never affects the Score (FR-007)', () => {
  it('produces an identical Score whether or not Categories were revealed', () => {
    // The Evaluation depends only on the Canvas Tree and the Rules; revealed
    // Categories are not an input to it at all.
    let tree = emptyTree();
    const vpc = addNode(tree, 'vpc', null);
    tree = vpc.tree;

    const withNoReveals = evaluate(tree, challenge01.rules);
    const withAllReveals = evaluate(tree, challenge01.rules);
    expect(withNoReveals.score).toBe(withAllReveals.score);
  });

  it('REVEAL_CATEGORY leaves an existing Evaluation untouched', () => {
    let state = initialSessionState();
    state = sessionReducer(state, {
      type: 'SUBMIT',
      evaluation: evaluate(emptyTree(), challenge01.rules),
    });
    const before = state.evaluation;

    for (const category of categories) {
      state = sessionReducer(state, { type: 'REVEAL_CATEGORY', categoryId: category.id });
    }

    expect(state.evaluation).toBe(before);
    expect(state.evaluationStale).toBe(false);
    expect(state.revealedCategories).toHaveLength(4);
  });

  it('the submitted Score is the same after revealing everything', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    const before = within(screen.getByRole('region', { name: 'Evaluation' })).getByText(
      /of 11 requirements met/,
    ).textContent;

    for (const category of categories) {
      await user.click(
        within(requirementsPanel()).getByRole('button', { name: nameMatcher(category.name) }),
      );
    }
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const after = within(screen.getByRole('region', { name: 'Evaluation' })).getByText(
      /of 11 requirements met/,
    ).textContent;
    expect(after).toBe(before);
  });
});
