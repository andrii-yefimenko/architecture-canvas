/**
 * US4 — keyboard-only placement into a Frame.
 * Covers spec Acceptance Scenarios 1-2.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { addNode, emptyTree } from '@/domain/canvas-tree';
import type { CanvasTree } from '@/domain/types';
import { initialSessionState, type SessionState } from '@/state/session-reducer';

beforeEach(() => {
  window.history.pushState(null, '', '/challenge/challenge-01');
});

describe('Scenario: assigning a Service into a Frame using only the keyboard (AS1)', () => {
  it('adds a new Node inside the chosen target Frame', async () => {
    const user = userEvent.setup();
    let tree: CanvasTree = emptyTree();
    const r = addNode(tree, 'vpc', null);
    tree = r.tree;
    const vpcId = r.nodeId;

    const seeded: SessionState = {
      ...initialSessionState(),
      canvasTree: tree,
      layout: { [vpcId]: { x: 0, y: 0 } },
    };

    render(<App initialState={seeded} />);

    await user.selectOptions(screen.getByLabelText('Service'), 'rds');
    await user.selectOptions(screen.getByLabelText('Place inside'), vpcId);
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const vpcFrame = screen.getByTestId(`node-${vpcId}`);
    expect(within(vpcFrame).getByRole('button', { name: 'RDS' })).toBeInTheDocument();
  });

  it('offers the Canvas root as a target even with nothing placed yet', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Service'), 'vpc');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const canvas = screen.getByRole('main', { name: 'Canvas' });
    expect(within(canvas).getByRole('button', { name: 'VPC' })).toBeInTheDocument();
  });
});

describe('Scenario: repeated keyboard placements land at distinct positions (AS2)', () => {
  it('never places two Nodes pixel-identically', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Service'), 'ec2-frontend');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const canvas = screen.getByRole('main', { name: 'Canvas' });
    const placedHandles = within(canvas).getAllByRole('button', { name: 'EC2 (Frontend)' });
    expect(placedHandles).toHaveLength(3);

    const positions = placedHandles.map((handle) => {
      const node = handle.closest('[data-render-kind]') as HTMLElement;
      return `${node.style.left},${node.style.top}`;
    });
    expect(new Set(positions).size).toBe(3);
  });
});
