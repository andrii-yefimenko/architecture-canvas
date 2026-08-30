# Phase 1 Data Model: Architecture Canvas MVP

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md)

All type names use the canonical vocabulary from [`CONTEXT.md`](../../CONTEXT.md). Everything here lives in `src/domain/types.ts` and imports nothing.

## Identifier types

```ts
type ServiceId = string;   // stable catalog key, e.g. "ec2-backend"
type NodeId = string;      // crypto.randomUUID(), per placed Node
type CategoryId = string;  // e.g. "application-tier"
type RuleId = string;      // e.g. "backend-in-private-subnet"
```

`ServiceId` is authored by hand and must be stable — Rules and persisted state both reference it. `NodeId` is generated at drop time and is never authored.

## Service

A catalog definition. A type, not a placed thing.

| Field | Type | Notes |
|---|---|---|
| `id` | `ServiceId` | Unique within the Challenge catalog |
| `name` | `string` | Display label, e.g. "EC2 (Backend)" |
| `category` | `string` | Display grouping, e.g. "Compute" |

A Service's type encodes its role: "EC2 (Frontend)" and "EC2 (Backend)" are two Services, not one configurable Service (FR-010). There is no `isContainer` flag — **any Node may contain any other** (FR-012), so containment is not a property of the Service.

## Node

A placed instance of a Service.

| Field | Type | Notes |
|---|---|---|
| `id` | `NodeId` | `crypto.randomUUID()` at drop time (FR-014) |
| `serviceId` | `ServiceId` | Must resolve against the Challenge catalog |
| `children` | `Node[]` | Empty array when it contains nothing |

Several Nodes may share a `serviceId` (FR-014, and required by the existential Rule semantics). A Node has no `parentId` field — parenthood is expressed by position in the tree, which keeps a single source of truth and makes the persisted JSON self-describing.

## CanvasTree

```ts
type CanvasTree = { roots: Node[] };
```

A forest rather than a single root, because a Service dropped on empty Canvas becomes a root-level Node and the user may create several such Nodes before nesting them (spec Edge Cases).

### Invariants

1. **Unique ids** — every `NodeId` appears at most once in the tree.
2. **Acyclic** — no Node appears within its own subtree. Enforced by `moveNode`; see [research R-02](./research.md).
3. **Resolvable services** — every `serviceId` resolves against the current Challenge catalog. Violation on load discards persisted state (FR-033).

### Operations

All pure; each returns a new `CanvasTree` and never mutates its input.

| Function | Signature | Behaviour |
|---|---|---|
| `addNode` | `(tree, serviceId, parentId \| null) → CanvasTree` | Appends a new Node with a fresh id. `null` parent appends to `roots` (FR-011). |
| `moveNode` | `(tree, nodeId, newParentId \| null) → CanvasTree` | Re-parents the Node **with its entire subtree** (FR-015). Returns the tree unchanged if `newParentId` is inside `nodeId`'s subtree, or equals `nodeId` (invariant 2). |
| `removeNode` | `(tree, nodeId) → CanvasTree` | Removes the Node and its whole subtree (FR-016). |
| `findNode` | `(tree, nodeId) → Node \| null` | Lookup by id. |
| `getParentId` | `(tree, nodeId) → NodeId \| null` | The Evaluation's primitive for direct-containment checks. |
| `isDescendant` | `(tree, ancestorId, candidateId) → boolean` | Backs the cycle guard. |
| `hasChildren` | `(tree, nodeId) → boolean` | Drives the delete-confirmation requirement (FR-017). |
| `getDepth` | `(tree, nodeId) → number` | Roots are depth 0. Used to resolve nested droppable priority. |

## Challenge

The whole exercise, authored as a typed module (FR-001–003, FR-008).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `"challenge-01"` |
| `title` | `string` | |
| `description` | `string` | The business situation |
| `visibleRequirements` | `string[]` | Shown on load, no interaction (FR-002) |
| `hiddenRequirementCategories` | `HiddenRequirementCategory[]` | Concealed on load (FR-003) |
| `services` | `Service[]` | The catalog for this Challenge |
| `rules` | `Rule[]` | Evaluated on submit |

### HiddenRequirementCategory

| Field | Type | Notes |
|---|---|---|
| `id` | `CategoryId` | |
| `name` | `string` | e.g. "Application Tier" — the question the user chooses to ask |
| `requirements` | `string[]` | Revealed together as a unit (FR-005) |

Challenge #1 has exactly four: Infrastructure, Presentation Tier, Application Tier, Data Tier.

## Rule

One checkable condition. Challenge #1 has 11.

```ts
type Rule =
  | { id: RuleId; kind: 'presence';    description: string; recommendation: string;
      serviceId: ServiceId }
  | { id: RuleId; kind: 'containment'; description: string; recommendation: string;
      serviceId: ServiceId; parentServiceId: ServiceId };
```

A discriminated union rather than a single shape with optional fields, so the evaluator's exhaustiveness is checked at compile time and `parentServiceId` cannot be forgotten on a containment Rule.

| Kind | Passes when |
|---|---|
| `presence` | At least one Node in the tree has this `serviceId`. |
| `containment` | At least one Node with this `serviceId` has a **direct** parent whose `serviceId` is `parentServiceId` (FR-021). |

Both are existential — additional non-satisfying Nodes never cause a failure (FR-022).

**Note on redundancy**: for a given Service, a passing `containment` Rule necessarily implies its `presence` Rule also passes. All 11 Rules are retained as written, and the resulting uneven weighting is a known, accepted consequence tracked in `docs/03-BACKLOG.md`.

## Evaluation

Produced by submit; never persisted (FR-034).

```ts
type RuleResult = { ruleId: RuleId; passed: boolean };

type Evaluation = {
  results: RuleResult[];   // one per Rule, in Challenge order — every Rule, not only failures (FR-023)
  passedCount: number;
  totalCount: number;
  score: number;           // full float precision; rounded only at render (FR-027)
};
```

`results` covers every Rule so the UI can render a complete pass/fail checklist. Descriptions and Recommendations are looked up from the Challenge by `ruleId` rather than copied in, keeping one source of truth for that text.

### Score

`computeScore(passedCount, totalCount) → passedCount * (100 / totalCount)`

Returns full precision; `Math.round` is applied only at display (FR-026–028). `totalCount` of 0 returns 0 rather than `NaN`.

## SessionState

The reducer's state. Lives in `src/state/`, not `src/domain/`.

| Field | Type | Notes |
|---|---|---|
| `canvasTree` | `CanvasTree` | Persisted |
| `revealedCategories` | `CategoryId[]` | Persisted; append-only within a session (FR-006) |
| `evaluation` | `Evaluation \| null` | Not persisted |
| `evaluationStale` | `boolean` | True when the tree changed after the Evaluation was produced (FR-030) |
| `pendingDeletion` | `NodeId \| null` | A Node awaiting delete confirmation (FR-017) |

### Actions

| Action | Effect on `evaluation` |
|---|---|
| `ADD_NODE` | Marks stale if present |
| `MOVE_NODE` | Marks stale if present |
| `REQUEST_DELETE` / `CANCEL_DELETE` | Unchanged |
| `CONFIRM_DELETE` | Marks stale if present |
| `REVEAL_CATEGORY` | Unchanged — revealing never affects the Score (FR-007) |
| `SUBMIT` | Replaces it, clears stale (FR-031) |
| `RESTORE` | Sets tree and revealed set; leaves `evaluation` null (FR-034) |

`REQUEST_DELETE` on a Node without children may proceed straight to removal; confirmation is required only when `hasChildren` is true.

## Persisted envelope

Defined in full in [contracts/persistence.md](./contracts/persistence.md).

```ts
type PersistedSession = {
  version: number;
  canvasTree: CanvasTree;
  revealedCategories: CategoryId[];
};
```

One key, one version number. A mismatch or an unresolvable `serviceId` discards the whole envelope and starts clean (FR-033).
