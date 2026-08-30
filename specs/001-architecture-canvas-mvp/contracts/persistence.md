# Contract: Session Persistence

**Module**: `src/state/persistence.ts` | **Covers**: FR-032, FR-033, FR-034, SC-005, SC-009

## Storage key

```
architecture-canvas:session
```

One key for the whole session. Splitting persistence across several keys multiplies the partial-restore failure modes — a restored Canvas Tree paired with a lost revealed-Category set is worse than a clean start.

## Envelope

```ts
type PersistedSession = {
  version: number;          // current: 1
  canvasTree: CanvasTree;
  revealedCategories: CategoryId[];
};
```

The **Evaluation is deliberately absent** (FR-034). A restored session shows no results, because results describe a submission the user is no longer looking at.

## Save

Written after any action that changes `canvasTree` or `revealedCategories`. Never throws: a failed write is silently ignored, since persistence is a convenience and its failure must not interrupt work (SC-009).

## Load

Runs once at startup. The envelope is accepted only if **all** of the following hold:

1. The key exists and parses as JSON.
2. `version` equals the current version.
3. `canvasTree` is structurally valid — `roots` is an array, every Node has `id`, `serviceId`, and an array `children`.
4. Every `serviceId` in the tree resolves against the current Challenge's catalog.
5. Every id in `revealedCategories` resolves against the current Challenge's Categories.

If any check fails, **the entire envelope is discarded** and the session starts empty (FR-033). No partial restore, no repair, no migration. With one Challenge and an MVP-stage schema, a clean start is both cheaper and more predictable than reconstruction.

Check 4 matters more than it looks: it is what makes editing `challenge-01.ts` safe. Renaming a Service id invalidates stored sessions rather than producing a Canvas Tree of Nodes referencing Services that no longer exist.

## Storage unavailability

Every read and write is wrapped. Local storage throws on access in some configurations — private browsing modes, disabled site data, embedded webviews — and merely returns nothing in others.

Both cases are treated identically: **the application runs normally with persistence disabled.** No error is surfaced, no warning banner, no degraded mode. The user loses nothing in the current session and only forgoes restoration after reload (SC-009).

## Version bumping

Increment `version` whenever the shape of `canvasTree` or `revealedCategories` changes. The effect is to invalidate every stored session — which is the intended behaviour at MVP stage, and cheaper than writing migrations for data that represents a few minutes of work.

## Required test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Save then load | Tree and revealed Categories restored identically (SC-005) |
| 2 | Missing key | Clean empty state, no throw |
| 3 | Malformed JSON | Discarded; clean state |
| 4 | Version mismatch | Discarded; clean state (FR-033) |
| 5 | Tree references an unknown `serviceId` | Discarded; clean state |
| 6 | `revealedCategories` holds an unknown id | Discarded; clean state |
| 7 | Storage throws on read | Clean state, no throw, app usable (SC-009) |
| 8 | Storage throws on write | Silently ignored, app usable (SC-009) |
| 9 | Saved envelope inspected | Contains no Evaluation (FR-034) |
