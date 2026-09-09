# Contract: Session Persistence (Layout added)

**Module**: `src/state/persistence.ts` | **Covers**: FR-012, FR-013, FR-014, SC-003

**Supersedes**: `specs/002-multi-challenge-catalog/contracts/persistence.md`. Everything below replaces that contract; the key format, per-Challenge scoping, `clearSession` behavior, and storage-unavailability handling carry forward unmodified and are restated here for completeness.

## Storage key

```
architecture-canvas:session:${challengeId}
```

Unchanged — one key per Challenge.

## Envelope

```ts
type PersistedSession = {
  version: number;                        // current: 2 (was 1)
  challengeId: string;
  canvasTree: CanvasTree;
  revealedCategories: CategoryId[];
  layout: Record<NodeId, { x: number; y: number }>;   // NEW
};
```

The Evaluation remains deliberately absent (FR-034 in spec 001, unchanged).

## Save

Unchanged in mechanics: written after any action that changes `canvasTree`, `revealedCategories`, or (new) `layout`, addressed to the current Challenge's key, never throws.

## Load

Runs when a Task Page mounts for a given Challenge. The envelope is accepted only if **all** of the following hold:

1. The key `architecture-canvas:session:${challengeId}` exists and parses as JSON.
2. `version` equals the current version (`2`).
3. `challengeId` in the envelope equals the `challengeId` the key was computed from (unchanged from spec 002).
4. `canvasTree` is structurally valid — `roots` is an array, every Node has `id`, `serviceId`, and an array `children`; every `serviceId` resolves against this Challenge's catalog (unchanged from spec 002).
5. Every id in `revealedCategories` resolves against this Challenge's Categories (unchanged from spec 002).
6. **`layout` is a plain object whose keys are exactly the set of `NodeId`s present in the (already-validated) `canvasTree` — no missing entries, no extras — and every value is a record of two finite numbers, `x` and `y`.** (new)

If any check fails, the entire envelope is discarded and that Challenge starts empty. No partial restore, no repair, no migration, no cross-Challenge fallback — unchanged philosophy from specs 001/002.

Check 6 exists for the same reason check 4 already resolves every `serviceId`: it's what makes renaming or restructuring Nodes safe across a code change. Without it, a stale `layout` entry for a Node id that no longer exists (or a missing entry for one that does) would either be silently dropped or leave a Node with no known position — both worse than a clean discard.

## Clear (unchanged)

```ts
function clearSession(challengeId: string): void;
```

Unchanged from spec 002 — a hard `localStorage.removeItem`, called from the Header's Back to Catalog handler, never throws.

## Storage unavailability

Unchanged from specs 001/002: every read, write, and clear is wrapped; a throwing or unavailable `localStorage` degrades that Challenge's persistence silently, with the Task Page otherwise fully usable for the current visit.

## Version bumping

`SESSION_VERSION` moves from `1` to `2` for this feature — the shape of the envelope changed (new `layout` field). The effect is the same as any prior bump: every stored session, across both Challenges, is discarded on next load. Consistent with the "a clean start is cheaper than migrating a few minutes of work" reasoning already established in specs 001/002.

## Required test cases

All fourteen from `specs/002-multi-challenge-catalog/contracts/persistence.md`, run against `version: 2` and an envelope that now includes `layout`, plus:

| # | Scenario | Expected |
|---|---|---|
| 15 | Save then load, with several Nodes at distinct positions | Every Node's `layout` entry restored identically (SC-003) |
| 16 | Stored envelope's `layout` is missing an entry for a Node present in `canvasTree` | Discarded — check 6 fails even though checks 1–5 would have passed |
| 17 | Stored envelope's `layout` has an entry for a `NodeId` not present in `canvasTree` (e.g. a deleted Node's stale position) | Discarded — check 6 fails |
| 18 | Stored envelope has `version: 1` (pre-feature shape, no `layout` field) | Discarded — check 2 fails, matching the existing version-mismatch behavior |
| 19 | Saved envelope inspected | Contains no Evaluation (FR-034, unchanged) |
