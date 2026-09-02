# Contract: Session Persistence (per Challenge)

**Module**: `src/state/persistence.ts` | **Covers**: FR-012, FR-013, FR-014, FR-015, FR-016, SC-004, SC-005, SC-006

**Supersedes**: `specs/001-architecture-canvas-mvp/contracts/persistence.md`. Everything below replaces that contract; nothing from it carries forward unmodified except the general shape of the validation and storage-unavailability rules, restated here per-Challenge.

## Storage key

```
architecture-canvas:session:${challengeId}
```

One key per Challenge instead of one key for the whole application. Splitting persistence across *Challenges* (rather than across pieces of a single session) doesn't reintroduce the partial-restore risk the original single-key design avoided — each Challenge's key still holds one complete envelope, saved and loaded atomically; Challenges just no longer share a envelope they have no business sharing.

## Envelope

```ts
type PersistedSession = {
  version: number;          // current: 1
  challengeId: string;      // NEW — must equal the Challenge the key was computed from
  canvasTree: CanvasTree;
  revealedCategories: CategoryId[];
};
```

The Evaluation remains deliberately absent (FR-034 in spec 001, unchanged).

## Save

Unchanged in mechanics from spec 001: written after any action that changes `canvasTree` or `revealedCategories`, addressed to the *current* Challenge's key, never throws.

## Load

Runs when a Task Page mounts for a given Challenge. The envelope is accepted only if **all** of the following hold:

1. The key `architecture-canvas:session:${challengeId}` exists and parses as JSON.
2. `version` equals the current version.
3. **`challengeId` in the envelope equals the `challengeId` the key was computed from** (new check — FR-013).
4. `canvasTree` is structurally valid — `roots` is an array, every Node has `id`, `serviceId`, and an array `children`.
5. Every `serviceId` in the tree resolves against *this* Challenge's catalog.
6. Every id in `revealedCategories` resolves against *this* Challenge's Categories.

If any check fails, the entire envelope is discarded and that Challenge starts empty (FR-015). No partial restore, no repair, no migration, no cross-Challenge fallback.

Check 3 exists because checks 4–6 alone are not sufficient once two Challenges share Service ids — Challenge #1 and Challenge #2 both use `vpc`, `rds`, `internet-gateway`, and `nat-gateway`. Without check 3, a stored Challenge #1 tree built entirely from shared ids would pass every structural check run against Challenge #2's catalog and be silently displayed as Challenge #2's in-progress work.

## Clear (new)

```ts
function clearSession(challengeId: string): void;
```

Called by the Header's Back to Catalog handler for the *current* Challenge only (FR-014). Removes that Challenge's key outright — not a version bump, not a tombstone value, an actual `localStorage.removeItem`. Never throws, matching Save/Load's storage-unavailability handling below.

## Storage unavailability

Unchanged from spec 001: every read, write, and clear is wrapped; a throwing or unavailable `localStorage` degrades that Challenge's persistence silently, with the Task Page otherwise fully usable for the current visit (SC-009 in spec 001).

## Version bumping

Unchanged in mechanics: bump `version` whenever `canvasTree` or `revealedCategories`'s shape changes. The effect — discarding every stored session — now applies per Challenge rather than globally, but the reasoning (a clean start is cheaper than migrating a few minutes of work) is unchanged.

## Migration from the spec-001 single key

The old flat `architecture-canvas:session` key is simply never read again once this feature ships — no code migrates its contents into a per-Challenge key, and no code deletes it either. It becomes inert, orphaned browser storage. Accepted as-is; see `research.md`'s "Persistence key scoping" section for why this isn't worth a cleanup routine.

## Required test cases

All nine from `specs/001-architecture-canvas-mvp/contracts/persistence.md`, run against a per-Challenge key instead of the flat key, plus:

| # | Scenario | Expected |
|---|---|---|
| 10 | Challenge #1 has a saved session; Challenge #2's Task Page loads | Challenge #2 starts empty — Challenge #1's key is never read for Challenge #2 (SC-004) |
| 11 | A stored envelope's `canvasTree` uses only Service ids that exist in *both* Challenge #1 and Challenge #2, but the envelope's `challengeId` doesn't match | Discarded — check 3 fails even though checks 4–6 would have passed (FR-013) |
| 12 | Back to Catalog is activated with an unsaved, partially built Canvas Tree present | That Challenge's key is removed from storage (FR-014) |
| 13 | The same Challenge is started again after its key was cleared | Empty Canvas Tree, no revealed Categories — identical to a first visit (SC-005) |
| 14 | The Task Page is reloaded (hard refresh) without going through Back to Catalog | The Challenge's Canvas Tree and revealed Categories are restored exactly as left (SC-006) |
