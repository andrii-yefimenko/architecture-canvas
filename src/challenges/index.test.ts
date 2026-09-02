/**
 * Registry-level integrity guards.
 * See contracts/challenge-registry.md in specs/002-multi-challenge-catalog/.
 */

import { challenge01 } from './challenge-01';
import { challenge02 } from './challenge-02';
import { challengeRegistry, getChallengeById } from './index';

describe('challengeRegistry', () => {
  it('has unique Challenge ids across the whole Registry (rule 1)', () => {
    const ids = new Set(challengeRegistry.map((c) => c.id));
    expect(ids.size).toBe(challengeRegistry.length);
  });

  it('matches its literal declaration order (rule 2)', () => {
    expect(challengeRegistry.map((c) => c.id)).toEqual([challenge01.id, challenge02.id]);
  });

  it('contains both authored Challenges', () => {
    expect(challengeRegistry).toContain(challenge01);
    expect(challengeRegistry).toContain(challenge02);
  });
});

describe('getChallengeById', () => {
  it('round-trips every Registry entry (rule 3)', () => {
    for (const challenge of challengeRegistry) {
      expect(getChallengeById(challenge.id)).toBe(challenge);
    }
  });

  it('returns undefined for an id not in the Registry (rule 4)', () => {
    expect(getChallengeById('does-not-exist')).toBeUndefined();
  });
});

describe('Catalog metadata (contracts/challenge-registry.md rules 5-6)', () => {
  it.each(challengeRegistry.map((c) => [c.id, c] as const))(
    '%s has a valid difficulty and non-empty tags',
    (_id, challenge) => {
      expect(['beginner', 'intermediate', 'advanced']).toContain(challenge.difficulty);
      expect(challenge.tags.length).toBeGreaterThan(0);
      expect(challenge.shortDescription.trim().length).toBeGreaterThan(0);
    },
  );
});
