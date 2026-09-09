import { render, screen } from '@testing-library/react';
import { CARD_SIZE, MIN_FRAME_SIZE } from '@/state/layout';
import { DragOverlayPreview } from './DragOverlayPreview';

describe('DragOverlayPreview (v0.3.2, restyled v0.3.3)', () => {
  it('renders the label and applies the given size', () => {
    render(<DragOverlayPreview label="RDS" size={CARD_SIZE} renderKind="card" />);

    expect(screen.getByText('RDS')).toBeInTheDocument();
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay.style.width).toBe(`${CARD_SIZE.width}px`);
    expect(overlay.style.height).toBe(`${CARD_SIZE.height}px`);
  });

  it('renders a solid border for a Card', () => {
    render(<DragOverlayPreview label="EC2" size={CARD_SIZE} renderKind="card" />);

    expect(screen.getByTestId('drag-overlay').className).toMatch(/border-solid/);
  });

  it('renders a dashed border for a Frame', () => {
    render(<DragOverlayPreview label="VPC" size={MIN_FRAME_SIZE} renderKind="frame" />);

    expect(screen.getByTestId('drag-overlay').className).toMatch(/border-dashed/);
  });

  it("renders a Frame's label as a corner badge, not inline text", () => {
    render(<DragOverlayPreview label="VPC" size={MIN_FRAME_SIZE} renderKind="frame" />);

    expect(screen.getByText('VPC').className).toMatch(/rounded-full/);
  });

  it('never intercepts pointer events', () => {
    render(<DragOverlayPreview label="VPC" size={MIN_FRAME_SIZE} renderKind="frame" />);

    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay.className).toMatch(/pointer-events-none/);
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });
});
