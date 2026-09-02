import { render, screen } from '@testing-library/react';
import { App } from '@/App';

/**
 * Phase 2 checkpoint: the shell renders three empty panels beneath a header.
 * Panel contents arrive in Phase 3+.
 *
 * Predates routing: <App /> used to render Challenge #1's Task Page
 * directly. `/` now renders the Catalog Page instead, so every test here
 * points the route at Challenge #1's Task Page explicitly.
 */
beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

describe('application shell', () => {
  it('renders the three regions and the header', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('always offers an enabled submit control (FR-019)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });
});
