import { render, screen } from '@testing-library/react';
import { DragOverlayPreview } from './DragOverlayPreview';

describe('DragOverlayPreview (v0.3.2)', () => {
  it('renders the label and applies the given size', () => {
    render(<DragOverlayPreview label="RDS" size={{ width: 160, height: 96 }} renderKind="card" />);

    expect(screen.getByText('RDS')).toBeInTheDocument();
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay.style.width).toBe('160px');
    expect(overlay.style.height).toBe('96px');
  });

  it('renders a solid border for a Card', () => {
    render(<DragOverlayPreview label="EC2" size={{ width: 160, height: 96 }} renderKind="card" />);

    expect(screen.getByTestId('drag-overlay').className).toMatch(/border-solid/);
  });

  it('renders a dashed border for a Frame', () => {
    render(<DragOverlayPreview label="VPC" size={{ width: 220, height: 160 }} renderKind="frame" />);

    expect(screen.getByTestId('drag-overlay').className).toMatch(/border-dashed/);
  });

  it('never intercepts pointer events', () => {
    render(<DragOverlayPreview label="VPC" size={{ width: 220, height: 160 }} renderKind="frame" />);

    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay.className).toMatch(/pointer-events-none/);
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });
});
