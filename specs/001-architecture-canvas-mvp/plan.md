# Implementation Plan: Architecture Canvas MVP

**Branch**: `docs/spec-initial` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-architecture-canvas-mvp/spec.md`

## Summary

Build a client-side single-page application that presents one architecture Challenge, lets the user reveal withheld requirements a Category at a time, drag Services into a freely nested Canvas Tree, and submit that tree for rule-based Evaluation with a Score and per-Rule Recommendations.

The technical approach centres on one decision: **the domain layer is framework-free**. `evaluate(canvasTree, rules) → Evaluation` and every Canvas Tree operation are pure TypeScript functions with no React imports. React, dnd-kit, and Tailwind are the delivery mechanism around that core, not part of it. This directly serves the migration path in ADR 0001 — relocating evaluation server-side later becomes a transport change rather than a rewrite — and makes the highest-risk logic exhaustively unit-testable without rendering anything.

## Technical Context

**Language/Version**: TypeScript 5.x, targeting ES2022

**Primary Dependencies**: React 18, Vite 8, Tailwind CSS 3, dnd-kit (`@dnd-kit/core`)

> Vite was planned as 5 and installed as 8 (with Vitest 4 and `@vitejs/plugin-react` 6) during Phase 1. Vite 5's toolchain carried six advisories, two rated critical, all in dev-only dependencies with zero production exposure. Upgrading at scaffold time — before any application code existed to break — cost nothing and brought `npm audit` to zero. Verified: build, lint, Vitest harness, dev server, and production preview all pass on the upgraded stack.

**Storage**: Browser local storage — one versioned key holding `{ version, canvasTree, revealedCategories }`. No database, no server-side persistence.

**Testing**: Vitest for unit tests, React Testing Library for integration tests, jsdom environment

**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari, Edge — current and previous major). Served as a static bundle by nginx on port 3000 via Docker Compose.

**Project Type**: Single-project frontend SPA. No backend tier — see [ADR 0001](../../docs/adr/0001-client-side-validation-engine.md).

**Performance Goals**: Drag interaction sustains 60 fps. Evaluation completes within one animation frame — trivially met, since Challenge #1 has 11 Rules over a Canvas Tree of roughly 5–20 Nodes.

**Constraints**: Fully offline-capable after first load; no network calls at runtime. No telemetry. Bundle should stay small enough to load quickly on a modest connection — dnd-kit and React are the only substantial dependencies.

**Scale/Scope**: One Challenge, 11 Rules, ~20 Services in the catalog, 4 Hidden Requirement Categories, a single screen with three panels plus a header. Single anonymous local user; no concurrency.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status: PASS (vacuously) — no constitution is defined.**

`.specify/memory/constitution.md` is the unmodified Spec Kit template: every principle is still a `[PRINCIPLE_N_NAME]` placeholder, and the governance section is unfilled. There are therefore no ratified project principles to gate this design against, and no gate can meaningfully fail.

This is a genuine gap rather than a clean pass, and it is recorded here rather than glossed. Running `/speckit-constitution` would establish real gates. The principles most worth ratifying for this project, based on decisions already made in `docs/`:

- **Domain purity** — evaluation and tree logic stay free of framework imports (already load-bearing for ADR 0001's migration path).
- **Canonical terminology** — code, tests, and docs use `CONTEXT.md` vocabulary.
- **Test-first for domain logic** — the evaluator silently returning a wrong Score is the one defect users will not report.

The design below already conforms to all three, so ratifying them later should not force rework.

**Post-Phase 1 re-check**: PASS. The design introduces no additional projects, no repository or service abstraction layers, and no indirection beyond a domain/state/components split. Nothing requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-architecture-canvas-mvp/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── evaluator.md
│   ├── challenge.md
│   └── persistence.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main.tsx                         # Entry point
├── App.tsx                          # Layout shell + DndContext
│
├── domain/                          # Framework-free. No React imports.
│   ├── types.ts                     # Service, Node, CanvasTree, Challenge, Rule, Evaluation
│   ├── canvas-tree.ts               # addNode, moveNode, removeNode, findNode, isDescendant
│   ├── canvas-tree.test.ts
│   ├── evaluator.ts                 # evaluate(canvasTree, rules) -> Evaluation
│   ├── evaluator.test.ts
│   ├── score.ts                     # computeScore(passedCount, totalRules)
│   └── score.test.ts
│
├── challenges/
│   ├── challenge-01.ts              # Typed Challenge, authored from MVP.md
│   └── challenge-01.test.ts         # Guards catalog/Rule referential integrity
│
├── state/
│   ├── session-reducer.ts           # Pure reducer + action types
│   ├── session-reducer.test.ts
│   ├── SessionProvider.tsx          # Context + useReducer wiring
│   └── persistence.ts               # Versioned load/save, storage-unavailable safe
│
├── components/
│   ├── Header.tsx                   # Submit control
│   ├── requirements/
│   │   ├── RequirementsPanel.tsx
│   │   ├── HiddenRequirementCategory.tsx
│   │   ├── ScoreDisplay.tsx
│   │   └── EvaluationResults.tsx    # Per-Rule pass/fail + Recommendations
│   ├── services/
│   │   ├── ServicesPanel.tsx
│   │   └── ServiceCatalogItem.tsx   # useDraggable
│   └── canvas/
│       ├── Canvas.tsx               # Root droppable
│       ├── CanvasNode.tsx           # Recursive; droppable + draggable
│       └── DeleteConfirmDialog.tsx
│
└── styles/
    └── index.css                    # Tailwind directives

tests/
└── integration/
    ├── design-and-evaluate.test.tsx # US1
    ├── reveal-requirements.test.tsx # US2
    ├── revise-and-resubmit.test.tsx # US3
    └── session-resume.test.tsx      # US4

Dockerfile                           # Multi-stage: node build -> nginx
docker-compose.yml                   # Publishes :3000
nginx.conf                           # SPA fallback
vite.config.ts
tailwind.config.js
tsconfig.json
package.json
```

**Structure Decision**: Single-project frontend, no `frontend/`+`backend/` split, because ADR 0001 establishes there is no backend. The layout's organising principle is the **domain boundary**: `src/domain/` and `src/challenges/` are pure TypeScript that never import React, while `src/state/` and `src/components/` hold everything framework-bound. Unit tests are colocated with the domain modules they cover, giving a tight red-green loop on the logic that matters most; the four integration tests live in `tests/integration/` and map one-to-one onto the spec's four user stories.

## Architecture

### Layered view

```text
┌──────────────────────────────────────────────────────┐
│ components/   React + Tailwind + dnd-kit             │
│               Renders state, dispatches actions      │
├──────────────────────────────────────────────────────┤
│ state/        useReducer + Context, persistence      │
│               Owns SessionState, mediates domain     │
├──────────────────────────────────────────────────────┤
│ domain/       Pure functions. No React. No storage.  │
│ challenges/   evaluate(), tree ops, Challenge data   │
└──────────────────────────────────────────────────────┘
```

Dependencies point strictly downward. `domain/` imports nothing from the layers above it — enforceable by review, and by the absence of React in its import list.

### Canvas Tree representation

The Canvas Tree is a **nested structure** (each Node carries a `children` array), not a flat parent-pointer map. Rationale: it matches the "Canvas JSON tree structure" `MVP.md` already describes, it is the shape that gets persisted, and it renders directly through a recursive component. The usual argument for flattening — O(1) lookup and cheap re-parenting — is irrelevant at 5–20 Nodes.

### The cycle invariant

One rule constrains dropping, and it is worth stating loudly because it *looks* like it contradicts FR-012 ("any Node inside any other Node, no placement restriction"):

> **A Node cannot be moved into its own subtree.**

This is not a UX guardrail of the kind FR-013 forbids. It is a data-structure impossibility: FR-015 requires descendants to travel with a moved Node, so a Node dropped into its own descendant would have to be both ancestor and descendant of itself. `moveNode` rejects such a move and the Canvas Tree is left unchanged. Every other placement — including structurally absurd ones like a VPC inside a database — is accepted, exactly as FR-012 requires, and is left for the Evaluation to judge.

### Drag and drop

A single `DndContext` at `App` level. Catalog entries and placed Nodes are both draggable, distinguished by a `kind` discriminator in their drag data (`'service'` for a new placement, `'node'` for a re-parent). The Canvas root and every Node are droppable.

Collision detection composes `pointerWithin` with a `rectIntersection` fallback, per [dnd-kit's guidance](https://dndkit.com/react/guides/collision-detection/) for high-precision and nested-container interfaces. Because nested Nodes produce overlapping droppables, the resulting collisions are resolved by **greatest tree depth wins** — the innermost container under the pointer receives the drop, which is the only interpretation consistent with deliberate nesting.

`onDragEnd` translates the drop into exactly one reducer action (`ADD_NODE` or `MOVE_NODE`); no tree mutation happens in component code.

### State and staleness

`SessionState` holds the Canvas Tree, the set of revealed Category ids, and an optional `{ evaluation, stale }` pair. Every Canvas-mutating action marks an existing Evaluation stale rather than clearing it (FR-030); `SUBMIT` replaces it and clears the flag (FR-031). Persistence deliberately excludes the Evaluation (FR-034).

### Execution phases

Nine phases, ordered so that each completes a testable slice and the P1 user story is demonstrable by the end of Phase E.

| Phase | Delivers | Spec coverage |
|---|---|---|
| **A — Foundation** | Vite + React + TS + Tailwind scaffold, Vitest config, Dockerfile, compose, nginx | — |
| **B — Domain core** | `types.ts`, `canvas-tree.ts`, `evaluator.ts`, `score.ts`, all unit-tested first | FR-021, FR-022, FR-026–028 |
| **C — Challenge data** | `challenge-01.ts` authored from `MVP.md` + referential-integrity test | FR-001–003, FR-008 |
| **D — Layout & static panels** | Three-panel shell, Header, Requirements (Visible only), Services catalog | FR-001–002, FR-008–010, FR-035–036 |
| **E — Canvas & drag-drop** | DndContext, recursive Node rendering, add/move/delete, confirm dialog | FR-011–018 |
| **F — Submit & Evaluation** | Wire evaluator to UI, Score display, per-Rule results, Recommendations | FR-019–025, FR-037 → **US1 complete** |
| **G — Hidden Requirements** | Category reveal controls and revealed state | FR-004–007 → **US2 complete** |
| **H — Resubmission** | Unlimited resubmit, stale marking and clearing | FR-029–031 → **US3 complete** |
| **I — Persistence** | Versioned save/load, incompatible-state discard, storage-unavailable safety | FR-032–034 → **US4 complete** |

Phases B and C have no UI dependency and could run in parallel with D. Phases G, H, and I are independent of one another and may be reordered freely.

## Complexity Tracking

> No Constitution Check violations. Nothing to justify.

The design adds no abstraction beyond a three-layer split, introduces no state library, no router, no backend, and no graph engine. Every dependency in Technical Context traces to a decision already recorded in `docs/04-TECH-STACK.md`.
