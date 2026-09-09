# Implementation Plan: 2D Spatial Canvas Blocks

**Branch**: `003-2d-canvas-blocks` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-2d-canvas-blocks/spec.md`

## Summary

Redesign the Canvas from a nested-list, flex+indentation rendering into an AWS CloudFormation/Application Composer-style 2D spatial surface: container-style Nodes render as auto-sized Frames, leaf Nodes render as compact Cards, and every Node carries a free-form position instead of an implicit list slot. This extends the shipped MVP and multi-Challenge platform (`specs/001-architecture-canvas-mvp/`, `specs/002-multi-challenge-catalog/`) rather than replacing any part of it: the evaluator, Canvas Tree operations, and per-Challenge persistence scoping are all reused, extended only where the spec requires (`FR-018`, `FR-019`).

The technical approach centers on one finding from Phase 0 research: **containment stays exactly what it already is** — the `children` array — and a Node's new spatial position is purely additive state living beside it, never inside the domain layer. This is what keeps the change small: `src/domain/types.ts` gains one field (`Service.renderKind`), a new `src/state/layout.ts` module holds all position/size math, and — the one genuine surprise — `src/components/canvas/collision.ts` needs **no changes at all**, because nested Frames still nest in the DOM under the new rendering model exactly as today's indented divs do, so the existing depth-tiebreak collision strategy remains correct (`research.md`).

## Technical Context

**Language/Version**: TypeScript 5.x, targeting ES2022 — unchanged from specs 001/002.

**Primary Dependencies**: React 18, Vite 8, Tailwind CSS 3, dnd-kit (`@dnd-kit/core` 6.3.1, confirmed installed) — unchanged. **No new dependency is added by this feature.** The spatial redesign is built entirely on dnd-kit's existing droppable/draggable/collision APIs (`research.md`).

**Storage**: Browser local storage, one versioned key per Challenge ID (unchanged format). The envelope gains a `layout` field; `SESSION_VERSION` moves `1` → `2`. See `contracts/persistence.md`.

**Testing**: Vitest for unit tests, React Testing Library for integration tests, jsdom environment — unchanged. jsdom still cannot measure real layout (the same caveat `specs/001-architecture-canvas-mvp/quickstart.md` already documents for drag gestures), so tests assert against `Layout`/`SessionState` values and rendered inline style/size props directly, not against measured pixel positions.

**Target Platform**: Modern desktop browsers, static bundle served by nginx on port 3000 via Docker Compose — unchanged.

**Project Type**: Single-project frontend SPA — unchanged. Still no backend tier.

**Performance Goals**: Unchanged 60fps drag target. New: Frame auto-size recomputation (`computeContentSize`) runs on every `ADD_NODE`/`MOVE_NODE`/delete and must stay cheap at this app's realistic scale (dozens of Nodes, not thousands) — no numeric target is fixed, matching the spec's deliberate choice not to set one (Assumptions, "Outstanding" item from `/speckit-clarify`'s coverage summary).

**Constraints**: Unchanged — fully offline-capable, no network calls, no telemetry. **No collision-avoidance algorithm of any kind** is in scope (ADR-0002 decision 4; confirmed for the resize-triggered case via `/speckit-clarify`) — this bounds Phase 1 design away from anything resembling auto-arrange.

**Scale/Scope**: Two Challenges, ~41 Service catalog entries total needing a `renderKind` value (22 in Challenge #1, 19 in Challenge #2). Still a single anonymous local user; no concurrency. Pan/zoom, manual Frame resize, full keyboard fine-grained repositioning, and collision-avoidance are explicitly out of scope (`docs/03-BACKLOG.md`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status: PASS (vacuously) — no constitution is defined**, same finding as `specs/001-architecture-canvas-mvp/plan.md` and `specs/002-multi-challenge-catalog/plan.md`. `.specify/memory/constitution.md` remains the unmodified Spec Kit template.

The candidate principles those plans recommended ratifying hold under this feature, and this feature is the first real stress-test of one of them:

- **Domain purity** — `src/domain/types.ts` gains exactly one additive field (`Service.renderKind`); every other domain type is untouched. All new position/size math lives in `src/state/layout.ts`, deliberately kept *outside* `src/domain/` even though it's pure, framework-free code that would pass the ESLint domain-purity check — because Layout is presentation data `CONTEXT.md` explicitly says no Rule ever evaluates (`research.md`'s module-placement decision). This is Domain Purity being actively applied to a judgment call, not just passively holding.
- **Per-Challenge data isolation** (ratified as a candidate in spec 002's plan) — `layout` is persisted under the same per-Challenge key as `canvasTree`, subject to the same `challengeId` check; nothing new to isolate that the existing mechanism doesn't already cover.
- **Canonical terminology** — `CONTEXT.md` was updated with Frame, Card, and Layout *before* this plan was written (during the `grill-with-docs` pass that preceded `/speckit-specify`), including an explicit note reserving "container" for its real AWS/Docker meaning — avoiding exactly the kind of terminology drift the existing principle exists to prevent.
- **Test-first for domain logic** — the one new domain-layer function (`subtreeIds` in `canvas-tree.ts`) is pure and directly unit-testable without rendering, consistent with how `canvas-tree.ts`'s existing functions are tested.

**Post-Phase 1 re-check**: PASS. Phase 1 design added one field to an existing domain type, one new `src/state/` module, one new domain helper function, and extended two existing contracts (persistence, challenge authoring) — no new project, no new repository/service abstraction, no new dependency, no indirection beyond what the existing domain/state/components split already accommodates. Nothing requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-2d-canvas-blocks/
├── plan.md                    # This file
├── spec.md                    # Feature specification (includes Clarifications)
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/                 # Phase 1 output
│   ├── canvas-layout.md       # NEW — Layout, sizing, collision reuse, reducer changes
│   ├── persistence.md         # Supersedes spec 002's version
│   └── challenge.md           # Supersedes spec 001's version
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main.tsx                          # Unchanged
├── App.tsx                           # Unchanged
│
├── domain/                           # `Service` gains one field; everything else unchanged
│   ├── types.ts                      # CHANGED — Service.renderKind: 'frame' | 'card'
│   ├── canvas-tree.ts                # CHANGED — one addition: subtreeIds()
│   ├── evaluator.ts                  # Unchanged (FR-018)
│   └── score.ts                      # Unchanged
│
├── challenges/
│   ├── challenge-01.ts               # CHANGED — every Service entry gains renderKind (22)
│   ├── challenge-01.test.ts          # CHANGED — asserts contracts/challenge.md rule 9
│   ├── challenge-02.ts               # CHANGED — every Service entry gains renderKind (19)
│   ├── challenge-02.test.ts          # CHANGED — same
│   └── index.ts                      # Unchanged
│
├── state/
│   ├── layout.ts                     # NEW — Layout, LayoutMap, constants, snapToGrid, computeContentSize
│   ├── layout.test.ts                # NEW
│   ├── session-reducer.ts            # CHANGED — layout field; ADD_NODE/MOVE_NODE gain `position`; delete/RESTORE handle layout
│   ├── session-reducer.test.ts       # CHANGED
│   ├── SessionProvider.tsx           # CHANGED — seeds/saves `layout` alongside canvasTree
│   ├── session-context.ts            # Unchanged
│   ├── persistence.ts                # CHANGED — envelope gains `layout`, SESSION_VERSION 1 → 2
│   └── persistence.test.ts           # CHANGED
│
├── pages/
│   └── TaskPage.tsx                  # CHANGED — drag-end handler computes position (rect math), dispatches new action shape
│
└── components/
    ├── Header.tsx                    # Unchanged
    ├── canvas/
    │   ├── Canvas.tsx                 # CHANGED — renders sized/positioned content, root sizing for scroll (FR-020)
    │   ├── CanvasNode.tsx             # CHANGED — Frame/Card rendering, absolute positioning, no more flex/indentation
    │   ├── collision.ts               # UNCHANGED — see research.md
    │   ├── collision.test.ts          # Unchanged (existing cases still hold)
    │   └── KeyboardPlacement.tsx      # NEW — FR-016/FR-017's keyboard-only assign-into-Frame control
    ├── requirements/                  # Unchanged
    └── services/                      # Unchanged

tests/
├── architecture/                      # Unchanged guards still apply (domain purity, terminology, keyboard access)
└── integration/
    ├── spatial-placement.test.tsx     # NEW — US1
    ├── reposition-reparent.test.tsx   # NEW — US2
    ├── layout-persistence.test.tsx    # NEW — US3
    └── keyboard-placement.test.tsx    # NEW — US4
```

**Structure Decision**: No new top-level project, no new architectural layer — this remains the single-project frontend SPA from spec 001, extended per spec 002's layered view (`pages/` → `components/` + `routing/` → `state/` → `domain/`/`challenges/`). The only new directory content is one file, `src/state/layout.ts`, sitting beside `persistence.ts` and `session-reducer.ts` at the same layer — not a new layer of its own. `src/domain/` and `src/challenges/` remain the framework-free boundary, now including `Service.renderKind` as one more additive field within it.

## Architecture

### Layered view (extends spec 002's)

```text
┌──────────────────────────────────────────────────────────────┐
│ pages/        TaskPage's drag-end handler computes position   │
│ components/   canvas/ renders Frames/Cards from state + layout│
│ routing/      Unchanged                                       │
├──────────────────────────────────────────────────────────────┤
│ state/        + layout.ts (Layout, sizing, snap — pure)       │
│               session-reducer.ts owns SessionState.layout     │
│               persistence.ts persists it per Challenge        │
├──────────────────────────────────────────────────────────────┤
│ domain/       + Service.renderKind (data only)                │
│               + subtreeIds() (pure tree helper)                │
│               canvas-tree.ts's children array is UNCHANGED     │
│               as the sole source of structural truth           │
│ challenges/   Every Service entry gains renderKind             │
└──────────────────────────────────────────────────────────────┘
```

`layout.ts` sits in `state/`, not `domain/`, for the reason `research.md`'s module-placement decision gives: it's presentation data by `CONTEXT.md`'s own definition, even though nothing stops it from being framework-free. This is the one place this feature draws a boundary tighter than the ESLint rule strictly requires.

### Why the domain layer barely moves

`src/domain/canvas-tree.ts`'s `Node` type, and every one of its pure functions (`addNode`, `moveNode`, `removeNode`, `findNode`, `isDescendant`, `hasChildren`, `getDepth`), are **untouched**. Containment was never going to move to spatial overlap (settled in the Grill session behind ADR-0002 decision 1, before this plan existed), so the domain layer's job — deciding what's inside what — doesn't change at all. The only domain-layer addition, `subtreeIds`, is scaffolding the *state* layer needs to keep `layout` in sync with deletions; it carries no Layout-specific knowledge itself.

### Why `collision.ts` needed no design work

This was the one place Phase 0 research overturned an assumption from ADR-0002's Consequences section (predicted "a full rewrite"). `pointerWithin`/`rectIntersection` operate on rendered DOM rects regardless of how those rects got their size and position — CSS flex+padding today, inline `left`/`top`/`width`/`height` after this feature. Since nested Frames still render as nested DOM elements (children are real descendants of their parent Frame's box, not a flat absolutely-positioned layer — this is also what makes "drag a Frame, its contents move for free" true), the existing depth-tiebreak logic remains exactly correct. See `research.md` for the full reasoning and the one alternative (a flat rendering layer) that *would* have required a rewrite, and why it was rejected.

### Execution phases

Six phases. A has no dependency and can start immediately; B depends on A; C and D both depend on B (and D lightly on A, for `renderKind`) and can run in parallel once B lands; E depends on B and D; F depends on everything.

| Phase | Delivers | Spec coverage |
|---|---|---|
| **A — Domain & Layout primitives** | `Service.renderKind` added to both catalogs (with the `contracts/challenge.md` integrity rule and test), `src/state/layout.ts` (constants, `snapToGrid`, `computeContentSize`), `subtreeIds` in `canvas-tree.ts` | FR-001, FR-004, FR-005 |
| **B — Reducer & state shape** | `SessionState.layout`, `ADD_NODE`/`MOVE_NODE` gain `position`, delete actions prune `layout` via `subtreeIds`, `RESTORE` gains `layout` | FR-002, FR-003, FR-008, FR-009, FR-015 |
| **C — Persistence** | `persistence.ts` extended per `contracts/persistence.md` (envelope, `SESSION_VERSION` 2), `SessionProvider.tsx` seeds/saves `layout` | FR-012, FR-013, FR-014 |
| **D — Rendering** | `Canvas.tsx`/`CanvasNode.tsx` rewritten for Frame/Card rendering and absolute positioning; Canvas root sized for scroll; `TaskPage.tsx`'s drag-end handler computes drop position and dispatches the new action shape; `collision.ts` verified unchanged | FR-001–FR-011, FR-020 |
| **E — Keyboard placement** | New `KeyboardPlacement.tsx` control (select a Service, select a target Frame/root, dispatch `ADD_NODE` at the deterministic default position from `contracts/canvas-layout.md`) | FR-016, FR-017 |
| **F — Verification** | The four new integration tests, `layout.test.ts`, updated `session-reducer.test.ts`/`persistence.test.ts`/`challenge-0{1,2}.test.ts`, the quickstart's four manual scenarios run once by hand | SC-001–SC-007 |

## Complexity Tracking

> No Constitution Check violations. Nothing to justify.

No new project, no new dependency, no new architectural layer, no collision-avoidance algorithm, no manual-resize interaction. The only structural addition — `src/state/layout.ts` — is one file at an existing layer, and the one domain-layer addition — `subtreeIds` — is one function beside five that already do the same kind of pure tree traversal.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
