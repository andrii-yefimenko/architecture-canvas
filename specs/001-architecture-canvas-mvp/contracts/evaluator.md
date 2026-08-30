# Contract: Evaluator

**Module**: `src/domain/evaluator.ts` | **Stability**: This is the project's most important interface. Changing its shape is a breaking change.

## Signature

```ts
function evaluate(canvasTree: CanvasTree, rules: Rule[]): Evaluation;
```

## Why this shape matters

Two arguments in, one value out, no imports from React, no reads from storage, no clock, no randomness. That is what makes it exhaustively testable without rendering, and what makes [ADR 0001](../../../docs/adr/0001-client-side-validation-engine.md)'s migration path real: relocating evaluation behind an endpoint later becomes a transport change, because the same function runs unmodified on either side.

**Any future change that adds a side effect, a React import, or a dependency on component state breaks that migration path.** Treat this signature as the boundary it is.

## Guarantees

1. **Pure** — same inputs always produce the same output. No mutation of `canvasTree` or `rules`.
2. **Total** — never throws. Every input, including an empty tree and an empty rule set, produces a valid `Evaluation`.
3. **Complete** — `results.length === rules.length` always. Every Rule is reported, passing or failing (FR-023).
4. **Order-preserving** — `results` follows the order of `rules`, so the UI renders a stable checklist.

## Semantics

### `presence` Rule

Passes when at least one Node anywhere in the tree has the Rule's `serviceId`.

### `containment` Rule

Passes when at least one Node with the Rule's `serviceId` has a **direct parent** whose `serviceId` equals `parentServiceId`.

Direct parent only — a Node nested one level deeper does **not** satisfy the Rule (FR-021). Root-level Nodes have no parent and satisfy no containment Rule.

### Existential quantification

Both kinds are existential (FR-022). One satisfying Node passes the Rule. Additional Nodes — satisfying or not — never change the result. There is no penalty for duplicates and no "all matching Nodes must comply" reading.

## Required test cases

These are the behaviours a change must not break. Written first, per the plan's Phase B.

| # | Input | Expected |
|---|---|---|
| 1 | Empty tree, 11 Rules | All fail; `passedCount` 0; `score` 0 (FR-025) |
| 2 | Tree matching expected architecture | All pass; `score` exactly 100 (SC-002) |
| 3 | Empty rule set, any tree | `results` empty; `score` 0; no throw |
| 4 | Node at correct depth+1 (extra wrapper) | Containment Rule **fails** (FR-021) |
| 5 | Node at root, containment Rule for it | Fails |
| 6 | Two Nodes of same Service, one placed correctly | Rule **passes** (FR-022) |
| 7 | Two Nodes of same Service, both misplaced | Rule fails |
| 8 | Correct tree plus unrelated extra Nodes | Still all pass; extras are inert (FR-022) |
| 9 | Deeply nested absurd structure (VPC inside RDS) | No throw; Rules judged normally |
| 10 | Same tree evaluated twice | Identical results (purity) |
| 11 | Evaluate, then assert inputs unchanged | No mutation |

## Non-responsibilities

The evaluator does **not**: know about React, read or write storage, look up Rule descriptions or Recommendations (the UI resolves those from the Challenge by `ruleId`), round the Score, or decide staleness. Rounding is a display concern (FR-027); staleness is session state.
