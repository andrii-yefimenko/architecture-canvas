# Phase 1 Data Model: Multi-Challenge Catalog & Challenge #2

**Date**: 2026-09-02 | **Plan**: [plan.md](./plan.md)

Everything in `specs/001-architecture-canvas-mvp/data-model.md` — `Service`, `Node`, `CanvasTree`, `Challenge`, `HiddenRequirementCategory`, `Rule`, `Evaluation`, `SessionState` — stands unchanged. This document covers only what's new or changed for this feature. Type names use the canonical vocabulary from [`CONTEXT.md`](../../CONTEXT.md).

## Challenge (cardinality change only)

No field changes. What changes is that `Challenge` is no longer the application's single fixed exercise — it is one entry among several in the Challenge Registry. Two additional display-only fields, present on every Challenge from this feature onward:

| Field | Type | Notes |
|---|---|---|
| `difficulty` | `'beginner' \| 'intermediate' \| 'advanced'` | Shown on the Catalog Page card. Not evaluated; purely presentational. |
| `tags` | `string[]` | Shown on the Catalog Page card. Not used for filtering in this feature (`docs/pages-ux/02-CATALOG-PAGE.md`). |

## Challenge Registry

Lives in `src/challenges/index.ts`. Framework-free, alongside `challenge-01.ts` and `challenge-02.ts`, inside the domain-purity boundary.

```ts
export const challengeRegistry: readonly Challenge[] = [challenge01, challenge02];

export function getChallengeById(id: string): Challenge | undefined {
  return challengeRegistry.find((c) => c.id === id);
}
```

### Invariants

1. **Registry order is authorial** — the array's declaration order, not sorted or computed (FR-001). The Catalog Page renders cards in this order.
2. **Every Challenge id is unique** within the Registry — enforced by a referential-integrity test alongside the existing per-Challenge checks in `challenge-01.test.ts` / `challenge-02.test.ts`.
3. `getChallengeById` returning `undefined` is not an error case to guard against elsewhere — it is exactly the signal the router uses to fall back to the Catalog Page (FR-005).

## Route

The client-side router's parsed result. Lives in `src/routing/`, and — like everything under `src/state/` and `src/components/` — is allowed to import React, unlike `src/domain/` and `src/challenges/`.

```ts
type Route =
  | { page: 'catalog' }
  | { page: 'task'; challengeId: string };
```

Produced by parsing `window.location.pathname`:

| Pathname | Route |
|---|---|
| `/` | `{ page: 'catalog' }` |
| `/challenge/:id` | `{ page: 'task', challengeId: id }` |
| anything else | `{ page: 'catalog' }` |

`{ page: 'task', challengeId }` does **not** guarantee `challengeId` resolves in the Challenge Registry — that check happens where the route is consumed (`App.tsx`), via `getChallengeById`, per FR-005. The `Route` type itself is a pure parse of the URL, nothing more.

## Persisted envelope (shape change)

Supersedes `specs/001-architecture-canvas-mvp/data-model.md`'s `PersistedSession` and `specs/001-architecture-canvas-mvp/contracts/persistence.md`. Full contract in [contracts/persistence.md](./contracts/persistence.md).

```ts
type PersistedSession = {
  version: number;
  challengeId: string;      // NEW — validated against the requested Challenge on load
  canvasTree: CanvasTree;
  revealedCategories: CategoryId[];
};
```

The storage key itself is now a function of Challenge ID rather than a fixed constant:

```ts
function storageKey(challengeId: string): string {
  return `architecture-canvas:session:${challengeId}`;
}
```

### Invariants

1. Everything from the original envelope's invariants still applies, per-Challenge: `version` match, structurally valid `canvasTree`, every `serviceId` resolving against *that* Challenge's catalog, every revealed-Category id resolving against *that* Challenge's Categories.
2. **New**: the envelope's `challengeId` field must equal the Challenge ID the key was computed from. This is what stops one Challenge's stored tree from being silently accepted as another's when their catalogs happen to share Service ids (FR-013) — the key format alone is a strong guard, but not one worth trusting as the *only* guard when a single typo in `storageKey` would otherwise go undetected by every existing structural check.
3. **New**: the Back to Catalog control clears the current Challenge's key outright (FR-014) — this is a delete, not a version bump, and not shared with any other Challenge's key.
