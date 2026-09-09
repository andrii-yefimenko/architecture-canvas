---

description: "Task list for 2D Spatial Canvas Blocks"
---

# Tasks: 2D Spatial Canvas Blocks

**Input**: Design documents from `/specs/003-2d-canvas-blocks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — all present

**Tests**: Included. This repo's established convention is test-first (`docs/04-TECH-STACK.md`'s "Vitest, evaluator-focused" rationale, 265 existing tests), and every contract in `contracts/` explicitly enumerates required test cases — an explicit request per the Task Generation Rules.

**Organization**: Tasks are grouped by user story from `spec.md`. **User Stories 1 and 2 are both Priority P1** — see Implementation Strategy below; the usual "MVP = just US1" shorthand doesn't apply here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, from `spec.md`
- Trailing `(depends on Txxx)` notes are informational, not part of the required prefix format

## Path Conventions

Single-project frontend SPA. `src/`, `tests/` at repository root, per `plan.md`'s Project Structure.

---

## Phase 1: Setup

**Purpose**: Confirm environment readiness. This feature adds no new dependency and needs no new tooling.

- [ ] T001 Confirm `@dnd-kit/core` 6.3.1 is already present in `package.json` and no new dependency is required (`research.md`, "Primary Dependencies"); no `npm install` or config change needed before starting Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain field, the pure Layout module, and the reducer/state shape every user story dispatches through. No user story can be implemented or tested independently until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Add `RenderKind = 'frame' | 'card'` type and `Service.renderKind: RenderKind` field to `src/domain/types.ts` (`data-model.md`'s Service entity)
- [ ] T003 [P] Add `subtreeIds(tree: CanvasTree, nodeId: NodeId): NodeId[]` pure helper to `src/domain/canvas-tree.ts`, beside `findNode`/`isDescendant`/`countNodes` (`data-model.md`'s Canvas Tree operations)
- [ ] T004 [P] Create `src/state/layout.ts`: `Layout`, `LayoutMap` types; `GRID_SNAP`, `CARD_SIZE`, `MIN_FRAME_SIZE`, `FRAME_PADDING` constants; `snapToGrid()`; `computeContentSize()` — per `contracts/canvas-layout.md`
- [ ] T005 [P] Write unit tests for `computeContentSize` and `snapToGrid` in `src/state/layout.test.ts` — empty children → `MIN_FRAME_SIZE`; one/several children → bounding box + `FRAME_PADDING` (`contracts/canvas-layout.md` cases 4–5) (depends on T004)
- [ ] T006 [P] Write unit tests for `subtreeIds` in `src/domain/canvas-tree.test.ts` — single Node, a nested subtree, a Node not present in the tree (depends on T003)
- [ ] T007 [P] Add `renderKind` to every Service entry in `src/challenges/challenge-01.ts` (22 entries) per `contracts/challenge.md`'s assignment rule (depends on T002)
- [ ] T008 [P] Add `renderKind` to every Service entry in `src/challenges/challenge-02.ts` (19 entries) per `contracts/challenge.md`'s assignment rule (depends on T002)
- [ ] T009 Extend `src/challenges/challenge-01.test.ts` and `src/challenges/challenge-02.test.ts` with integrity rule 9, "every Service declares a `renderKind`" (`contracts/challenge.md`) (depends on T007, T008)
- [ ] T010 Add `layout: LayoutMap` to `SessionState`, and `position: Layout` to the `ADD_NODE` and `MOVE_NODE` action payloads, in `src/state/session-reducer.ts` (`data-model.md`'s SessionState/Actions tables) (depends on T004)
- [ ] T011 Update the `ADD_NODE` and `MOVE_NODE` reducer cases in `src/state/session-reducer.ts` to set `layout[nodeId] = position` (depends on T010)
- [ ] T012 Update `REQUEST_DELETE` (immediate case) and `CONFIRM_DELETE` in `src/state/session-reducer.ts` to prune `layout` entries via `subtreeIds`, computed against the tree **before** `removeNode` runs (depends on T010, T003)
- [ ] T013 Add `layout: LayoutMap` to the `RESTORE` action and reducer case in `src/state/session-reducer.ts` (depends on T010)
- [ ] T014 Update `src/state/session-reducer.test.ts` for the new `layout` field and the position-carrying `ADD_NODE`/`MOVE_NODE`, the delete-pruning behavior, and `RESTORE` (depends on T011, T012, T013)

**Checkpoint**: Foundation ready — User Story implementation can now begin.

---

## Phase 3: User Story 1 - Place Services as Frames and Cards in Free 2D Space (Priority: P1) 🎯 MVP (with US2)

**Goal**: A dropped Service renders where it was dropped, as a Frame (VPC-like) or Card (EC2-like), with Frames auto-sizing to their contents.

**Independent Test**: Load a Challenge's Task Page, drag a Frame-kind Service and a Card-kind Service onto an empty Canvas, and confirm each renders in its distinct visual form at its drop position (`spec.md` US1).

### Tests for User Story 1

- [ ] T015 [P] [US1] Integration test: dragging a Frame-kind Service and a Card-kind Service onto an empty Canvas renders each in its distinct visual form at the drop position, in `tests/integration/spatial-placement.test.tsx` (US1 Acceptance Scenarios 1–2)
- [ ] T016 [P] [US1] Integration test: a Frame's bounds auto-size to enclose its children plus padding, and a childless Card-kind Node promotes to an auto-sized Frame the moment it gains a child, in `tests/integration/spatial-placement.test.tsx` (US1 Acceptance Scenarios 3–4; `contracts/canvas-layout.md` cases 3–5)
- [ ] T017 [P] [US1] Integration test: placing enough Nodes to exceed the Canvas panel's visible area makes the panel scrollable and every Node stays reachable, in `tests/integration/spatial-placement.test.tsx` (`FR-020`, `SC-007`; `contracts/canvas-layout.md` case 13)

### Implementation for User Story 1

- [ ] T018 [US1] Rewrite `src/components/canvas/CanvasNode.tsx` to render a Frame or Card per `contracts/canvas-layout.md`'s rendering derivation (renderKind + children-based promotion), absolutely positioned from its `Layout` entry instead of flex/indentation (depends on T007, T008, T010)
- [ ] T019 [US1] Rewrite `src/components/canvas/Canvas.tsx` to size its root content wrapper via `computeContentSize` over root-level Nodes, inside the already-`overflow-auto` Canvas panel (`src/pages/TaskPage.tsx:74`) (depends on T004, T018)
- [ ] T020 [US1] Update `handleDragEnd` in `src/pages/TaskPage.tsx`'s `Workspace` to compute the drop position from `active.rect.current.translated` minus `over.rect`, snapped via `snapToGrid`, and dispatch `ADD_NODE` with `position` for a Service dragged from the catalog (`contracts/canvas-layout.md`'s drop-position formula) (depends on T004, T011)
- [ ] T021 [US1] Verify `src/components/canvas/collision.ts` needs no code changes: run the existing `collision.test.ts` unmodified against the new rendering and confirm nested-Frame drop resolution still passes (`research.md`, `contracts/canvas-layout.md` case 15) (depends on T018, T019)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Reposition and Reparent Nodes Freely (Priority: P1) 🎯 MVP (with US1)

**Goal**: An already-placed Node can be dragged to a new spot — within its Frame or into a different one — landing exactly where it's dropped, carrying its own children with it.

**Independent Test**: Place two Frames side by side, each with a Card inside; drag a Card from one Frame into the other at a specific point, and confirm it lands there (`spec.md` US2).

### Tests for User Story 2

- [ ] T022 [P] [US2] Integration test: dragging an existing Card from one Frame into another lands it at the drop point translated into the new parent's local coordinates, and a Node dragged onto empty root space becomes a positioned root-level Node, in `tests/integration/reposition-reparent.test.tsx` (US2 Acceptance Scenarios 1–2)
- [ ] T023 [P] [US2] Integration test: dragging a Frame with several Nodes inside it moves all of its contents with it, preserving their relative arrangement, in `tests/integration/reposition-reparent.test.tsx` (US2 Acceptance Scenario 4; `contracts/canvas-layout.md` case 8)
- [ ] T024 [P] [US2] Integration test: dragging one Card to overlap a sibling Card is accepted with neither nudged, and a Frame's auto-resize that newly overlaps a sibling is accepted the same way, in `tests/integration/reposition-reparent.test.tsx` (US2 Acceptance Scenario 3; `spec.md` Clarifications session 2026-09-08; `contracts/canvas-layout.md` cases 9–10)

### Implementation for User Story 2

- [ ] T025 [US2] Extend `handleDragEnd` in `src/pages/TaskPage.tsx`'s `Workspace` to compute and dispatch `position` for `MOVE_NODE` (dragging an existing Node), reusing US1's rect-math from T020 (depends on T020, T011)

**Checkpoint**: User Stories 1 and 2 both work independently — this is the MVP.

---

## Phase 5: User Story 3 - Layout Survives a Reload, Scoped Per Challenge (Priority: P2)

**Goal**: A spatial arrangement built on one Challenge is restored exactly on reload, and never leaks into a different Challenge.

**Independent Test**: Arrange several Nodes spatially, reload the Task Page, confirm identical positions; visit a different Challenge and confirm no trace of the first Challenge's arrangement (`spec.md` US3).

### Tests for User Story 3

- [ ] T026 [P] [US3] Contract tests for the extended persistence envelope in `src/state/persistence.test.ts`, per `contracts/persistence.md` cases 15–19 (layout saved and restored identically; a `layout` entry missing for, or referencing, a Node not in `canvasTree` discards the whole envelope; a `version: 1` envelope is discarded)
- [ ] T027 [P] [US3] Integration test: arranging Nodes spatially, reloading, and confirming identical positions restored; visiting a different Challenge shows no carried-over arrangement, in `tests/integration/layout-persistence.test.tsx` (US3 Acceptance Scenarios 1–3)

### Implementation for User Story 3

- [ ] T028 [US3] Extend `PersistedSession`, `saveSession`, and `loadSession` in `src/state/persistence.ts` with the `layout` field and its all-or-nothing validation check, per `contracts/persistence.md` (depends on T010)
- [ ] T029 [US3] Bump `SESSION_VERSION` from `1` to `2` in `src/state/persistence.ts` (depends on T028)
- [ ] T030 [US3] Update `buildInitialState` and the save effect in `src/state/SessionProvider.tsx` to seed and persist `layout` alongside `canvasTree`/`revealedCategories` (depends on T028, T010)

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Keyboard-Only Placement Into a Frame (Priority: P3)

**Goal**: A keyboard-only user can select a Service and assign it into a chosen Frame at a deterministic default position.

**Independent Test**: Using only the keyboard, select a Service, choose a target Frame, and confirm a new Node is added inside it at a default position (`spec.md` US4).

### Tests for User Story 4

- [ ] T031 [P] [US4] Integration test: using only the keyboard, selecting a Service and a target Frame adds a new Node inside it at a default position; three successive placements into the same Frame land at three distinct positions, in `tests/integration/keyboard-placement.test.tsx` (US4 Acceptance Scenarios 1–2; `contracts/canvas-layout.md` case 14)

### Implementation for User Story 4

- [ ] T032 [US4] Add `defaultPositionForKeyboardPlacement(childCount: number): Layout` to `src/state/layout.ts` per `contracts/canvas-layout.md`'s keyboard-placement formula (depends on T004)
- [ ] T033 [US4] Create `src/components/canvas/KeyboardPlacement.tsx`: a keyboard-operable control to select a Service and a target Frame (or the Canvas root) and dispatch `ADD_NODE` with the computed default position (depends on T032, T011, T018)
- [ ] T034 [US4] Wire `KeyboardPlacement.tsx` into `src/pages/TaskPage.tsx`'s `Workspace` (depends on T033)

**Checkpoint**: All four User Stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature verification, spanning every User Story.

- [ ] T035 [P] Run the full `npm test` suite; confirm no regression to any `specs/001-architecture-canvas-mvp/` or `specs/002-multi-challenge-catalog/` behavior (`quickstart.md`'s Definition of Done)
- [ ] T036 [P] Manually run all four `quickstart.md` validation scenarios and its five edge cases
- [ ] T037 [P] Confirm `npm run lint` passes with zero domain-purity violations across every changed file (`eslint.config.js`'s domain-purity boundary)
- [ ] T038 Update `docs/02-PLAN.md`'s v0.3.0 Milestone Roadmap entry to mark it Completed, with a test count, once T035–T037 all pass — per `docs/agents/plan.md`'s "Current Focus → Completed" rule

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — **blocks every User Story**.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational **and** on User Story 1's `handleDragEnd` rect-math (T020) — not independent of US1 the way the template's generic case assumes, because both stories share the same drag-end handler and rendering. Still independently *testable* once T020 exists.
- **User Story 3 (Phase 5)**: Depends on Foundational only. Does not depend on US1/US2's rendering to function correctly, though seeing it work is easiest once US1 renders positions visually.
- **User Story 4 (Phase 6)**: Depends on Foundational and on US1's `CanvasNode.tsx` (T018), to have real Frame targets to present.
- **Polish (Phase 7)**: Depends on every User Story in scope.

### Parallel Opportunities

- T002, T003, T004 (different files, no interdependency) — parallel.
- T005, T006 — parallel with each other, each depending on its own single prior task.
- T007, T008 — parallel (different files, both depend only on T002).
- T015, T016, T017 — parallel (same file, independent test cases, common in this codebase's existing `*.test.tsx` files).
- T022, T023, T024 — parallel, same reasoning.
- T026, T027 — parallel (different files).
- T035, T036, T037 — parallel.

---

## Parallel Example: Foundational Phase

```bash
# Launch together:
Task: "Add RenderKind type and Service.renderKind field in src/domain/types.ts"
Task: "Add subtreeIds() helper in src/domain/canvas-tree.ts"
Task: "Create src/state/layout.ts with Layout/LayoutMap, constants, snapToGrid, computeContentSize"
```

---

## Implementation Strategy

### MVP = User Stories 1 and 2 together

Unusually, **both US1 and US2 are Priority P1** in `spec.md` — the spec's own "Why this priority" for US2 says a redesign that can place Nodes but not rearrange them "isn't a replacement for what already ships." Treat Phases 1–4 as the MVP unit, not Phase 3 alone:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: run both stories' independent tests
6. Deploy/demo if ready — this is the smallest shippable increment `spec.md` considers complete

### Incremental delivery past the MVP

7. Add User Story 3 (persistence) → test independently → deploy/demo
8. Add User Story 4 (keyboard) → test independently → deploy/demo
9. Phase 7: Polish, full regression pass, mark v0.3.0 Completed in `docs/02-PLAN.md`

### Notes

- [P] tasks touch different files with no blocking dependency on an incomplete task.
- Commit after each task or logical group, per this repo's existing commit-message conventions (`git log`).
- `tests/architecture/` (domain-purity, terminology, keyboard-access guards from spec 001) must keep passing throughout — no task above should need to weaken them.
