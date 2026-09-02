/**
 * US4 — leaving a Challenge clears its in-progress session.
 * Covers spec Acceptance Scenarios 1-2 in
 * specs/002-multi-challenge-catalog/spec.md.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import { loadSession } from '@/state/persistence';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

function goTo(path: string) {
  window.history.pushState(null, '', path);
}

function seededState(): SessionState {
  const { tree } = addNode(emptyTree(), 'vpc', null);
  return { ...initialSessionState(), canvasTree: tree };
}

describe('Scenario 1: Back to Catalog clears the current Challenge\'s session', () => {
  it('removes the persisted session for that Challenge', async () => {
    const user = userEvent.setup();
    goTo('/challenge/challenge-01');
    const rendered = render(<App initialState={seededState()} />);

    // Force a save first, so there is something to clear.
    const panel = screen.getByRole('region', { name: 'Requirements' });
    await user.click(within(panel).getByRole('button', { name: /infrastructure/i }));
    expect(loadSession(challenge01)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /back to catalog/i }));

    expect(loadSession(challenge01)).toBeNull();
    expect(window.location.pathname).toBe('/');
    rendered.unmount();
  });
});

describe('Scenario 2: restarting the same Challenge after leaving starts clean', () => {
  it('shows an empty Canvas and no revealed Categories, identical to a first visit', async () => {
    const user = userEvent.setup();
    goTo('/challenge/challenge-01');
    const first = render(<App initialState={seededState()} />);

    const panel = () => screen.getByRole('region', { name: 'Requirements' });
    await user.click(within(panel()).getByRole('button', { name: /infrastructure/i }));
    await user.click(screen.getByRole('button', { name: /back to catalog/i }));
    first.unmount();

    // Starting the same Challenge again, with no explicit seed this time.
    goTo('/challenge/challenge-01');
    render(<App />);

    expect(screen.getByText(/drag services here/i)).toBeInTheDocument();
    expect(
      within(panel()).getByRole('button', { name: /infrastructure/i }),
    ).toBeInTheDocument();
    // A revealed Category's requirement text would be present if state had
    // survived; it must not have.
    for (const requirement of challenge01.hiddenRequirementCategories[0]!.requirements) {
      expect(screen.queryByText(requirement)).not.toBeInTheDocument();
    }
  });
});
