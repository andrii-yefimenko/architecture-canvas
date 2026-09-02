/**
 * US1 — discover and launch a Challenge from the Catalog.
 * Covers spec Acceptance Scenarios 1-5 in
 * specs/002-multi-challenge-catalog/spec.md.
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { challenge01 } from '@/challenges/challenge-01';
import { challenge02 } from '@/challenges/challenge-02';
import { challengeRegistry } from '@/challenges';

function goTo(path: string) {
  window.history.pushState(null, '', path);
}

describe('Scenario: the Catalog Page lists every Challenge in Registry order', () => {
  it('renders one card per Challenge, in Registry order', () => {
    goTo('/');
    render(<App />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(challengeRegistry.length);
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(
      challengeRegistry.map((c) => c.title),
    );
  });

  it('shows every card\'s title, Difficulty, short description, Tags, and Start Challenge control', () => {
    goTo('/');
    render(<App />);

    const cards = screen.getAllByRole('article');
    const challenge01Card = cards[0]!;

    expect(within(challenge01Card).getByRole('heading')).toHaveTextContent(challenge01.title);
    expect(within(challenge01Card).getByText(/beginner/i)).toBeInTheDocument();
    expect(within(challenge01Card).getByText(challenge01.shortDescription)).toBeInTheDocument();
    for (const tag of challenge01.tags) {
      expect(within(challenge01Card).getByText(tag)).toBeInTheDocument();
    }
    expect(within(challenge01Card).getByRole('button', { name: 'Start Challenge' })).toBeInTheDocument();
  });
});

describe('Scenario: launching a Challenge from its card', () => {
  it('navigates to that Challenge\'s Task Page, addressed by its Challenge ID', async () => {
    const user = userEvent.setup();
    goTo('/');
    render(<App />);

    const cards = screen.getAllByRole('article');
    const challenge02Card = cards[1]!;
    await user.click(within(challenge02Card).getByRole('button', { name: 'Start Challenge' }));

    expect(window.location.pathname).toBe('/challenge/challenge-02');
    expect(
      within(screen.getByRole('region', { name: 'Requirements' })).getByRole('heading', {
        level: 2,
      }),
    ).toHaveTextContent(challenge02.title);
    // Challenge #1's title must not leak onto Challenge #2's Task Page.
    expect(screen.queryByText(challenge01.title)).not.toBeInTheDocument();
  });
});

describe('Scenario: Back to Catalog returns from a Task Page', () => {
  it('navigates back to the Catalog Page and shows every card again', async () => {
    const user = userEvent.setup();
    goTo('/challenge/challenge-01');
    render(<App />);

    await user.click(screen.getByRole('button', { name: /back to catalog/i }));

    expect(window.location.pathname).toBe('/');
    expect(screen.getAllByRole('article')).toHaveLength(challengeRegistry.length);
  });
});

describe('Scenario: an unknown Challenge ID falls back to the Catalog Page', () => {
  it('shows the Catalog Page instead of an error', () => {
    goTo('/challenge/does-not-exist');
    render(<App />);

    expect(screen.getAllByRole('article')).toHaveLength(challengeRegistry.length);
  });
});

describe('Edge case: the browser back button behaves like Back to Catalog', () => {
  it('returns to the Catalog Page on a popstate event', async () => {
    const user = userEvent.setup();
    goTo('/');
    render(<App />);

    const cards = screen.getAllByRole('article');
    await user.click(within(cards[0]!).getByRole('button', { name: 'Start Challenge' }));
    expect(window.location.pathname).toBe('/challenge/challenge-01');

    act(() => {
      goTo('/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getAllByRole('article')).toHaveLength(challengeRegistry.length);
  });
});
