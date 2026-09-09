# Phase 0 Research: 2D Spatial Canvas Blocks

**Date**: 2026-09-08 | **Plan**: [plan.md](./plan.md)

The feature specification carries **zero `[NEEDS CLARIFICATION]` markers**. Scope, terminology, and the two behavioral forks that surfaced after the spec was written (resize-triggered overlap, viewport scrolling) were resolved via `/speckit-clarify` and are recorded in `## Clarifications` in [spec.md](./spec.md). What follows restates the pre-settled architectural decisions from [ADR-0002](../../docs/adr/0002-2d-spatial-canvas-blocks.md) in Decision/Rationale/Alternatives form, then resolves the implementation-pattern questions that only surfaced once the design was worked out against the actual code in `src/components/canvas/`, `src/domain/canvas-tree.ts`, and `src/state/`.

## Coordinate space and storage shape

**Decision**: `Layout = { x: number; y: number }` — position only. A Node's rendered *size* is never stored: a Card's size is a fixed constant, and a Frame's size is always derived from its children's positions plus a padding constant, recomputed on every render. Coordinates are **local to the Node's own parent** (Canvas root is the origin for root-level Nodes).

**Rationale**: ADR-0002 decision 5 says Layout lives in a state-layer store rather than on the domain `Node`, and decision 6 says Frames auto-size to their children — meaning a stored Frame width/height could only ever be a stale cache of a value that's cheap to recompute. Storing only `{x, y}` removes an entire class of "Frame size out of sync with its children" bugs by construction, and mirrors this codebase's existing preference for derivation over duplication (`Evaluation.results` looks up descriptions by `ruleId` rather than copying them — `src/domain/types.ts:157`). Local (parent-relative) coordinates, rather than absolute canvas-wide coordinates, are what makes moving a Frame carry its children for free: since a child's position is stored relative to its own parent, dragging the parent to a new spot never requires touching any child's Layout entry — the child is still "20px right, 10px down from my parent," wherever the parent now is. This satisfies spec's Acceptance Scenario "Frame containing several Nodes... dragged... all of its contents move with it" (User Story 2, AS4) with no extra code.

**Alternatives considered**:
- Storing `{x, y, width, height}` per the spec's Key Entities wording taken literally — rejected; "size" in that entry is satisfied by a value that's always derivable, and storing it invites drift.
- Absolute, canvas-root-relative coordinates for every Node regardless of nesting — rejected; it would require rewriting every descendant's stored position whenever an ancestor Frame moves, the opposite of what ADR-0002 decision 1 wants ("moving a Node changes only where it's drawn").

## Collision detection: reuse, not rewrite

**Decision**: `src/components/canvas/collision.ts`'s `deepestDroppableFirst` needs **no logic changes**. The rendering change (flex+indentation → absolute positioning within a `position: relative` parent sized to its computed Frame size) still produces genuinely nested, rect-overlapping DOM droppables for nested Frames — a child Frame's rendered rect is still geometrically inside its parent Frame's rendered rect, exactly as today's indented divs are. `pointerWithin` (falling back to `rectIntersection`) plus the existing depth-tiebreak (`args.droppableContainers[...].data.current.depth`, unchanged) resolves overlapping candidates correctly under the new layout for the same reason it does today.

**Rationale**: ADR-0002's Consequences section predicted `collision.ts` "needs a full rewrite," written before this level of implementation detail was worked out. That prediction assumed the DOM-nesting-driven overlap `collision.ts`'s doc comment describes was an artifact of the old flex/indentation layout specifically. It isn't — it's a consequence of rendering nested Frames as nested DOM elements at all, which the new model still does (per the coordinate-space decision above: children render as real DOM descendants of their parent Frame, not a flat absolutely-positioned layer). `pointerWithin`/`rectIntersection` operate on rendered `getBoundingClientRect()` output regardless of *how* an element got sized and positioned (CSS flex+padding vs. inline `left`/`top`/`width`/`height`), so nothing about switching the positioning mechanism invalidates the existing collision strategy. This doesn't change ADR-0002's decision (containment still resolves via droppable collision, not raw coordinate math) — it only corrects an implementation-cost estimate the ADR made before this research pass.

**Alternatives considered**:
- A flat, single-DOM-layer rendering model (every Node absolutely positioned in canvas-root-relative coordinates regardless of nesting depth, Frames drawn as background rectangles with no DOM nesting) — would indeed need a hand-rolled point-in-rect containment check instead of dnd-kit's droppable collision. Rejected: it also breaks the "moving a Frame carries its children for free" property above, since it would need canvas-root-relative coordinates throughout.

## Drop-position computation

**Decision**: On `DragEndEvent`, compute the drop position from `active.rect.current.translated` (the dragged element's final on-screen rect, provided by dnd-kit) minus `over.rect`'s origin (the resolved target droppable's on-screen rect) — both already measured in the same viewport-relative space by dnd-kit, so no manual scroll-offset math is needed even though the Canvas panel is scrollable (`FR-020`). The result is rounded to the nearest grid-snap increment (see below) before being dispatched.

**Rationale**: This is dnd-kit's documented pattern for "where, precisely, did this land" (as distinct from "which droppable did this land in," which `over.id` already answers) — both rects come from the same measurement pass, so their difference is exactly the local offset needed, with no separate coordinate-transform step for nested Frames.

**Alternatives considered**: Tracking `event.delta` (total pointer movement) and adding it to the dragged Node's prior position — works only for *moving an existing Node* (which has a "prior position" to add to), not for a *new* Node dragged from the Services panel (which has none). The rect-difference approach handles both cases with one code path.

## Grid snap and default sizes

**Decision**: Grid-snap increment **8px**. Card: fixed **160×96px**. Empty-Frame minimum: **220×160px**. Frame content padding (around its children's bounding box): **16px**.

**Rationale**: 8px matches the `gap-2` (0.5rem) spacing already used in `Canvas.tsx`'s root layout, keeping the new spatial rhythm visually consistent with existing spacing rather than introducing an unrelated unit. The Card and minimum-Frame dimensions are sized to comfortably hold today's rendered content (a Service name plus a remove control, `CanvasNode.tsx:47-64`) without implying they're load-bearing product decisions — the spec (Assumptions) explicitly leaves these as implementation details, adjustable without a spec change.

**Alternatives considered**: None weighed formally — these are tunable constants, not architectural choices, and the spec explicitly defers them to this phase.

## Keyboard default placement

**Decision**: The *n*-th Node a keyboard user places into a given parent (via `FR-016`) lands at `(padding + n * 2*gridSnap, padding + n * 2*gridSnap)` — a simple diagonal cascade, deterministic and collision-free-by-construction since overlap is already permitted (spec's Edge Cases: "Keyboard placement into a crowded Frame... never silently off-canvas or indistinguishable from an existing Node").

**Rationale**: Satisfies the edge case without any actual collision-avoidance logic — each successive keyboard placement is visibly offset from the last by construction, not by checking against existing positions.

**Alternatives considered**: A fixed single default position (e.g. always the parent's top-left corner) — rejected; it fails the edge case directly, since a second keyboard-placed Node would be pixel-identical to the first.

## Reducer & domain surface changes

**Decision**: `SessionAction`'s `ADD_NODE` and `MOVE_NODE` variants (`src/state/session-reducer.ts:26-33`) each gain a `position: { x: number; y: number }` field. `SessionState` gains a `layout: Readonly<Record<NodeId, Layout>>` field. A new pure helper, `subtreeIds(tree: CanvasTree, nodeId: NodeId): NodeId[]`, is added to `src/domain/canvas-tree.ts` alongside the existing `findNode`/`isDescendant`/`countNodes` traversal helpers — it enumerates a Node and every descendant's id from the tree *before* `removeNode` runs, since after removal there's nothing left to walk. The reducer uses it to prune `layout` entries on `REQUEST_DELETE` (immediate case) and `CONFIRM_DELETE`, mirroring exactly how those cases already call `removeNode`.

**Rationale**: `subtreeIds` is a generic tree operation with zero Layout-specific knowledge (it doesn't know `Layout` exists), so it belongs beside `canvas-tree.ts`'s other pure traversal functions rather than in the new Layout-specific module — consistent with `src/domain/`'s existing shape and untouched by the domain-purity ESLint boundary (`eslint.config.js`), since it's pure tree math with no React/DOM/storage import.

**Alternatives considered**: Deriving the delete-time id set by diffing the tree before and after `removeNode` — strictly more work for the same answer `subtreeIds` gives directly, and diff-based logic is a worse fit for the "capture then prune" shape the reducer already has for every other multi-field update.

## Frame/Card sizing module

**Decision**: A new module, `src/state/layout.ts` — pure functions and constants (`GRID_SNAP`, `CARD_SIZE`, `MIN_FRAME_SIZE`, `FRAME_PADDING`, `snapToGrid`, `computeContentSize`). `computeContentSize(childPositions, childSizes) → { width, height }` is the single derivation used both for a Frame's size (its children's positions + sizes) and for the Canvas root's own rendered content size (root-level Nodes' positions + sizes) — the same math, applied one level up, is what gives the Canvas panel something real to scroll to for `FR-020`.

**Rationale**: `src/state/` (not `src/domain/`) is the right home: Layout is explicitly presentation data per `CONTEXT.md`'s Layout entry ("no Rule ever evaluates it"), and `src/state/` already sits above `src/domain/` in the layered view `specs/002-multi-challenge-catalog/plan.md`'s Architecture section documents, permitted to depend on `src/domain/` (for `CanvasTree`/`Node` types and `subtreeIds`) without being *part of* the evaluated domain. Reusing one `computeContentSize` function for both the Frame case and the "does the Canvas panel need to scroll" case means `FR-020` (Canvas scrolling) needed no new interaction code — the existing `overflow-auto` on `TaskPage.tsx`'s Canvas `<main>` region (`TaskPage.tsx:74`) already scrolls any content larger than its box; the only missing piece was making the Canvas root's rendered size reflect its true content extent, which is the same derivation Frames already need.

**Alternatives considered**: Placing sizing constants and derivation logic in `src/domain/`, since they're pure functions with no framework import and would pass the ESLint domain-purity check — rejected on conceptual grounds even though it would compile: `src/domain/` is reserved for what the Evaluation actually reasons about (`CONTEXT.md`: Canvas Tree "is the evaluator's input"), and Layout explicitly isn't that.

## Persistence

**Decision**: `PersistedSession` (`src/state/persistence.ts`) gains a `layout: Readonly<Record<NodeId, Layout>>` field. `SESSION_VERSION` bumps from `1` to `2`. Load-time validation adds one more all-or-nothing check: every key in the stored `layout` object must correspond to a `NodeId` actually present in the (already-validated) restored `canvasTree` — an extra or missing entry discards the whole envelope, exactly like every other structural check `loadSession` already performs.

**Rationale**: Matches `specs/002-multi-challenge-catalog/contracts/persistence.md`'s own established pattern to the letter — one version bump, one new field, the same all-or-nothing philosophy, no migration. Full contract in [contracts/persistence.md](./contracts/persistence.md), which formally supersedes spec 002's.

**Alternatives considered**: N/A — this is a direct, minimal extension of an already-settled contract, not a new design.

## Service catalog: `renderKind`

**Decision**: `Service` gains `readonly renderKind: 'frame' | 'card'`. Assignment rule: a Service that represents a real AWS networking or orchestration *boundary* — VPC, Public Subnet, Private Subnet, and (Challenge #2 only) ECS Cluster — is `'frame'`; every other Service (all compute, storage, database, and standalone networking-endpoint Services, including every distractor) is `'card'`. Both `challenge-01.ts` (22 Services) and `challenge-02.ts` (19 Services) need every entry updated; full contract in [contracts/challenge.md](./contracts/challenge.md), which formally supersedes spec 001's.

**Rationale**: This mirrors real AWS architecture-diagram convention (the thing the redesign is explicitly trying to look like, per `PROJECT.md` and the spec's own framing) rather than inventing a new taxonomy — a VPC/Subnet/Cluster is a boundary that holds other resources in every AWS diagramming tool; everything else is drawn as a discrete icon.

**Alternatives considered**: Deriving `renderKind` from `category` (e.g. "Networking" → frame) — rejected; `category` groups Services for the *Services panel's* display (`src/domain/types.ts:41`, "Display grouping in the Services panel, e.g. 'Compute'") and conflating it with rendering semantics would make a future change to one silently affect the other. A dedicated field keeps the two concerns independent, matching how `difficulty`/`tags` were added to `Challenge` in spec 002 as their own fields rather than piggybacking on `category`.

## Open items carried forward

None blocking. Everything above is either a direct, minimal extension of an already-shipped pattern (persistence, Service fields) or a derivation from decisions already fixed in ADR-0002 and the `/speckit-clarify` session. The one correction worth flagging explicitly for whoever reads the ADR later: **`collision.ts` survives with zero changes**, contrary to ADR-0002's Consequences section — noted above, not worth a formal ADR amendment since it doesn't change any decision, only an implementation-cost estimate made before this research pass.
