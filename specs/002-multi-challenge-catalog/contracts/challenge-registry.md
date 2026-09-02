# Contract: Challenge Registry & Challenge #2 Authoring

**Module**: `src/challenges/index.ts`, `src/challenges/challenge-02.ts` | **Covers**: FR-001, FR-002, FR-003, FR-009, FR-010, FR-011

**Extends**: `specs/001-architecture-canvas-mvp/contracts/challenge.md`, which already anticipated this: *"a new Challenge is a new module satisfying this contract... Selecting between Challenges is the only genuinely new work."* This contract covers exactly that selection mechanism, plus the two new display-only fields every Challenge now carries.

## Registry shape

See [data-model.md](../data-model.md#challenge-registry).

```ts
export const challengeRegistry: readonly Challenge[] = [challenge01, challenge02];
export function getChallengeById(id: string): Challenge | undefined { ... }
```

## Challenge shape (additive)

Every field from `specs/001-architecture-canvas-mvp/contracts/challenge.md`'s shape, plus:

```ts
{
  // ...existing fields...
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  tags: string[],
}
```

## Integrity rules (Registry-level, new)

Enforced by a new test alongside the existing per-Challenge integrity tests:

1. **Challenge ids are unique across the whole Registry** — `challenge-01` and `challenge-02` must not collide, and neither may any Challenge added later.
2. **Registry order matches declaration order** — the test asserts `challengeRegistry.map(c => c.id)` equals the literal array as written, catching an accidental reorder that would silently change Catalog Page display order (FR-001).
3. **`getChallengeById` round-trips every Registry entry** — for every Challenge in `challengeRegistry`, `getChallengeById(c.id) === c`.
4. **`getChallengeById` returns `undefined` for an id not in the Registry** — this is a contract, not a gap: `App.tsx` depends on this exact return value to trigger the Catalog Page fallback (FR-005).

## Integrity rules (per-Challenge, additive to challenge.md)

Applied to Challenge #2 exactly as `challenge-01.test.ts` already applies the original eight rules to Challenge #1:

5. **`difficulty` is one of the three literal values** — not a free-form string.
6. **`tags` is non-empty** — a card with no tags still needs *something* to distinguish it at a glance on the Catalog Page.

## Content requirements for Challenge #2

Transcribed from `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`; the authored module must not paraphrase or reorder.

- **Title**: "Containerized Microservice with ECS Fargate".
- **Difficulty**: `intermediate`.
- **Categories**: exactly four — Infrastructure, Presentation & Ingress, Compute (Containers), Data Tier. (Different names from Challenge #1's four categories — this is expected and correct; `CONTEXT.md`'s Hidden Requirement entry no longer assumes a fixed category set across Challenges.)
- **Rules**: exactly nine, in the source document's numbered order — `presence` and `containment` only, no other kind (confirmed in `research.md`).
- **Services**: the full catalog from the source document's "Available Services", including EC2 (Backend) and EC2 (Frontend) as unscored distractors — no Rule references either, and none should be added (per the Q2 resolution logged in `docs/03-BACKLOG.md`).

## Adding a Challenge #3 later

Out of scope for this feature and not yet in `docs/03-BACKLOG.md` as active work, but the shape continues not to obstruct it: append one more module to `challengeRegistry`. No change to `App.tsx`, `useRoute()`, `CatalogPage`, or `TaskPage` — every one of those is already written against "N Challenges," not "2 Challenges," because they consume `challengeRegistry` and `getChallengeById` rather than naming `challenge01`/`challenge02` directly.
