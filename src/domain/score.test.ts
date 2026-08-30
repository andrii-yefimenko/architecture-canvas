import { computeScore, roundScore } from './score';

describe('computeScore', () => {
  it('gives exactly 100 for a fully correct solution (SC-002)', () => {
    expect(computeScore(11, 11)).toBe(100);
  });

  it('gives 0 when nothing passes', () => {
    expect(computeScore(0, 11)).toBe(0);
  });

  it('keeps full float precision rather than rounding per Rule (FR-027)', () => {
    // Rounding each Rule to 9 points would make a perfect score 99.
    expect(computeScore(10, 11)).toBeCloseTo(90.909, 3);
    expect(computeScore(1, 11)).toBeCloseTo(9.0909, 4);
  });

  it('returns 0 rather than NaN when there are no Rules', () => {
    expect(computeScore(0, 0)).toBe(0);
  });

  it('is proportional', () => {
    expect(computeScore(2, 4)).toBe(50);
    expect(computeScore(1, 4)).toBe(25);
  });
});

describe('roundScore', () => {
  it('rounds only at display, so 10 of 11 reads 91 (FR-027)', () => {
    expect(roundScore(computeScore(10, 11))).toBe(91);
  });

  it('preserves an exact 100', () => {
    expect(roundScore(computeScore(11, 11))).toBe(100);
  });

  it('preserves an exact 0', () => {
    expect(roundScore(computeScore(0, 11))).toBe(0);
  });

  it('rounds a single passing Rule of 11 to 9', () => {
    expect(roundScore(computeScore(1, 11))).toBe(9);
  });
});
