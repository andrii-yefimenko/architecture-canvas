---

description: "Task list for Architecture Canvas MVP implementation"
---

# Tasks: Architecture Canvas MVP

**Input**: Design documents from `/specs/001-architecture-canvas-mvp/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. `docs/04-TECH-STACK.md` specifies an evaluator-focused Vitest strategy, and [contracts/evaluator.md](./contracts/evaluator.md) enumerates required cases. Domain tests are written before their implementation.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4, mapping to spec.md user stories
- Exact file paths included in every task

## Path Conventions

Single-project frontend SPA. `src/` and `tests/` at repository root, per [plan.md](./plan.md) Structure Decision. No backend paths exist.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and deployment shell

- [x] T001 Scaffold Vite + React + TypeScript project at repository root, creating `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`
- [x] T002 Configure TypeScript strict mode and the `@/` path alias in `tsconfig.json`
- [x] T003 [P] Install and configure Tailwind CSS in `tailwind.config.js`, `postcss.config.js`, and `src/styles/index.css`
- [x] T004 [P] Configure Vitest with jsdom and React Testing Library in `vite.config.ts` and `src/test-setup.ts`
- [x] T005 [P] Configure ESLint and Prettier in `eslint.config.js` and `.prettierrc`
- [x] T006 [P] Install `@dnd-kit/core` and record the pinned version in `package.json`
- [x] T007 [P] Write multi-stage `Dockerfile` — Node build stage producing a static bundle, nginx runtime stage
- [x] T008 [P] Write `nginx.conf` with SPA history fallback to `index.html`
- [x] T009 [P] Write `docker-compose.yml` publishing the nginx container on port 3000

**Checkpoint**: `npm run dev` serves a blank app; `docker compose up --build -d` serves it at `localhost:3000`

> **Checkpoint status — verified on Node 22.22.1 / npm 9.2.0:**
>
> Stack installed as Vite 8.2.2 / Vitest 4.1.11 / `@vitejs/plugin-react` 6.1.1 / jsdom 30, upgraded from the planned Vite 5 during this phase to clear six dev-only advisories (two critical). `npm audit` now reports **0 vulnerabilities**. See the note in [plan.md](./plan.md) Technical Context.
>
> - ✅ `npm install` — 308 packages, `package-lock.json` generated, 0 vulnerabilities
> - ✅ `npm run build` — typecheck clean, bundle emitted (140.81 kB JS, 3.97 kB Tailwind CSS)
> - ✅ `npm run lint` — zero errors; domain-purity rule confirmed firing against a probe file
> - ✅ `npm run dev` — HTTP 200 at `localhost:3000`
> - ✅ `npm run preview` — production `dist/` serves; hashed JS and CSS assets resolve; deep-link fallback returns 200
> - ✅ Vitest harness — globals, jsdom, and `test-setup.ts` all confirmed working
> - ✅ `docker compose up --build -d` — image builds (73.8 MB), container reports **healthy**, app serves at `localhost:3000`
> - ✅ nginx SPA fallback — `/deep/route` and `/challenge/1/edit` return 200; `/assets/nope.js` correctly 404s rather than falling back
> - ✅ nginx cache headers — hashed assets `public, immutable, max-age=31536000`; `index.html` `no-cache, no-store, must-revalidate`; gzip negotiated with `Vary: Accept-Encoding`
>
> **One defect found and fixed during Docker verification.** The healthcheck probed `http://localhost:3000/`, which resolves to `::1` first inside the container, while `listen 3000;` binds IPv4 only — so the container ran perfectly but reported `unhealthy`. Fixed on both sides: `nginx.conf` gained `listen [::]:3000;` for genuine dual-stack serving, and the healthcheck now targets `127.0.0.1` unambiguously. Confirmed healthy after rebuild.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain layer, Challenge data, session state, and app shell that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Define all domain types — `ServiceId`, `NodeId`, `CategoryId`, `RuleId`, `Service`, `Node`, `CanvasTree`, `Challenge`, `HiddenRequirementCategory`, `Rule`, `RuleResult`, `Evaluation` — in `src/domain/types.ts` per [data-model.md](./data-model.md). `Rule` MUST be a discriminated union on `kind`.
- [x] T011 Write failing unit tests for Canvas Tree operations in `src/domain/canvas-tree.test.ts` — covering add at root and nested, move with subtree, cascade remove, `findNode`, `getParentId`, `getDepth`, `hasChildren`, and the cycle guard rejecting a move into own subtree
- [x] T012 Implement pure Canvas Tree operations in `src/domain/canvas-tree.ts` — `addNode`, `moveNode`, `removeNode`, `findNode`, `getParentId`, `isDescendant`, `hasChildren`, `getDepth`. All return new trees and never mutate input. `moveNode` MUST reject self-nesting per [research.md](./research.md) R-02.
- [x] T013 [P] Author the Challenge #1 typed module in `src/challenges/challenge-01.ts` — title, description, visible requirements, four Hidden Requirement Categories, the full Service catalog including distractors, and all 11 Rules with descriptions and Recommendations, transcribed from `MVP.md` per [contracts/challenge.md](./contracts/challenge.md)
- [x] T014 [P] Write Challenge referential-integrity tests in `src/challenges/challenge-01.test.ts` — unique Service/Rule/Category ids, every Rule `serviceId` and `parentServiceId` resolving to the catalog, non-empty descriptions and Recommendations, non-empty Categories, exactly 11 Rules and 4 Categories
- [x] T015 Define `SessionState` and the action union — `ADD_NODE`, `MOVE_NODE`, `REQUEST_DELETE`, `CANCEL_DELETE`, `CONFIRM_DELETE`, `REVEAL_CATEGORY`, `SUBMIT`, `RESTORE` — in `src/state/session-reducer.ts` per [data-model.md](./data-model.md)
- [x] T016 Write failing unit tests for the session reducer in `src/state/session-reducer.test.ts` covering every action's effect on `canvasTree`, `revealedCategories`, and `pendingDeletion`
- [x] T017 Implement the pure session reducer in `src/state/session-reducer.ts`, delegating all tree mutation to `src/domain/canvas-tree.ts`
- [x] T018 Implement `SessionProvider` with `useReducer` plus Context, and a `useSession` hook, in `src/state/SessionProvider.tsx`
- [x] T019 Build the three-panel application shell — Requirements, Canvas, Services beneath a header, Canvas widest — in `src/App.tsx` using Tailwind, satisfying FR-035
- [x] T020 [P] Build the header containing the submit control, always enabled, in `src/components/Header.tsx` satisfying FR-019 and FR-036

**Checkpoint**: Domain logic and Challenge data are tested and green; the shell renders three empty panels

> **Checkpoint status — VERIFIED.**
>
> - ✅ `npx vitest run` — **81 tests passing** across 4 files (31 Canvas Tree, 26 Challenge integrity, 22 reducer, 2 shell)
> - ✅ `npm run lint` — zero errors, zero warnings
> - ✅ `npm run build` — typecheck clean; 150.25 kB JS, 6.62 kB CSS
> - ✅ Domain purity — no `react`/`@dnd-kit` imports under `src/domain/` or `src/challenges/`; ESLint probe confirmed catching both restricted-import and restricted-global violations
> - ✅ `npm run preview` — shell and Challenge #1 content both present in the served bundle
>
> **Cycle guard (research R-02) is implemented and covered** by three tests: rejecting a move into a descendant, into a direct child, and into itself. `moveNode` returns the input tree by reference on rejection, which the reducer relies on to avoid marking an Evaluation stale for a move that never happened.
>
> **Two deviations from the plan's file layout**, both driven by lint:
> - `src/state/session-context.ts` was added, holding `SessionContext` and `useSession`. The plan put these in `SessionProvider.tsx`, but mixing a hook with a component export breaks React Fast Refresh (`react-refresh/only-export-components`).
> - `src/domain/score.ts` is **not** yet written. The plan lists it under this phase's directory tree, but `tasks.md` correctly assigns it to T024 in Phase 3, where its tests (T022) live. Phase 2 is complete without it.

---

## Phase 3: User Story 1 - Design an Architecture and Receive an Evaluation (Priority: P1) 🎯 MVP

**Goal**: The complete core loop — read the Challenge, drag Services into a nested Canvas Tree, submit, and receive a Score with a per-Rule breakdown.

**Independent Test**: Load the app, drag Services onto the Canvas to form a nested structure, submit, and confirm a Score and complete pass/fail breakdown appear. Hidden Requirements, revision, and persistence are all absent and unnecessary.

### Tests for User Story 1 ⚠️

> Write these FIRST and confirm they FAIL before implementing

- [x] T021 [P] [US1] Write the 11 evaluator contract tests in `src/domain/evaluator.test.ts` exactly as enumerated in [contracts/evaluator.md](./contracts/evaluator.md) — empty tree scores 0, correct tree scores 100, empty rule set, extra-wrapper containment failure, root-level containment failure, duplicate with one correct passing, all-duplicates-misplaced failing, inert extra Nodes, absurd nesting not throwing, determinism, and non-mutation of inputs
- [x] T022 [P] [US1] Write Score computation tests in `src/domain/score.test.ts` — 11 of 11 yields exactly 100, 10 of 11 rounds to 91 at display, 0 of 11 yields 0, and a total of 0 yields 0 rather than `NaN`
- [x] T023 [P] [US1] Write the integration test for the design-and-evaluate journey in `tests/integration/design-and-evaluate.test.tsx` covering spec Acceptance Scenarios 1–6

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement `computeScore` at full float precision in `src/domain/score.ts` satisfying FR-026 and FR-027
- [x] T025 [US1] Implement the pure `evaluate(canvasTree, rules)` function in `src/domain/evaluator.ts` — existential matching for both Rule kinds, direct-parent-only containment, one `RuleResult` per Rule in Challenge order, never throwing (FR-020 to FR-025)
- [x] T026 [P] [US1] Build the Services panel listing all Services grouped by category in `src/components/services/ServicesPanel.tsx` satisfying FR-008
- [x] T027 [US1] Build the draggable Service catalog entry using `useDraggable` with drag data `{ kind: 'service', serviceId }` in `src/components/services/ServiceCatalogItem.tsx` satisfying FR-009
- [x] T028 [P] [US1] Build the Requirements panel rendering the Challenge title, description, and Visible Requirements in `src/components/requirements/RequirementsPanel.tsx` satisfying FR-001 and FR-002
- [x] T029 [US1] Build the Canvas root as a droppable accepting drops at root level in `src/components/canvas/Canvas.tsx` satisfying FR-011
- [x] T030 [US1] Build the recursive Canvas Node — both `useDroppable` and `useDraggable` with drag data `{ kind: 'node', nodeId }` — rendering children nested with visible containment depth, in `src/components/canvas/CanvasNode.tsx`
- [x] T031 [US1] Wire `DndContext` in `src/App.tsx` with collision detection composing `pointerWithin` and a `rectIntersection` fallback, resolving overlapping droppables by greatest tree depth per [research.md](./research.md) R-01
- [x] T032 [US1] Implement the `onDragEnd` handler in `src/App.tsx` dispatching `ADD_NODE` for `kind: 'service'` drags and `MOVE_NODE` for `kind: 'node'` drags, with no tree mutation in component code (FR-012, FR-015)
- [x] T033 [US1] Verify no drag-time validity signalling exists on any droppable in `src/components/canvas/Canvas.tsx` and `src/components/canvas/CanvasNode.tsx` — no highlight, cursor change, or disabled state indicating a valid or invalid parent (FR-013)
- [x] T034 [P] [US1] Build the delete confirmation dialog in `src/components/canvas/DeleteConfirmDialog.tsx` satisfying FR-017
- [x] T035 [US1] Wire Node deletion in `src/components/canvas/CanvasNode.tsx` — `REQUEST_DELETE` prompting only when `hasChildren` is true, otherwise removing immediately; `CONFIRM_DELETE` cascading to the subtree (FR-016, FR-017)
- [x] T036 [US1] Wire the header submit control to dispatch `SUBMIT`, invoking `evaluate` with the current Canvas Tree and the Challenge Rules, in `src/state/session-reducer.ts` and `src/components/Header.tsx`
- [x] T037 [P] [US1] Build the Score display showing the rounded Score beside the passed-Rule count in `src/components/requirements/ScoreDisplay.tsx` satisfying FR-028
- [x] T038 [US1] Build the Evaluation results list rendering **every** Rule with pass/fail status, and a Recommendation on each failure, in `src/components/requirements/EvaluationResults.tsx` satisfying FR-023, FR-024, and FR-037

**Checkpoint**: US1 is fully functional. The Required Architecture scores exactly 100; an empty Canvas scores 0 with 11 Recommendations. This is a demonstrable MVP.

> **Checkpoint status — VERIFIED. 🎯 MVP reached.**
>
> - ✅ `npx vitest run` — **117 tests passing** across 7 files
> - ✅ All 11 evaluator contract cases from [contracts/evaluator.md](./contracts/evaluator.md) green
> - ✅ Required Architecture scores **exactly 100**; empty Canvas scores **0** with all 11 Recommendations shown
> - ✅ `npm run lint` — zero errors, zero warnings; `npm run build` clean (195.21 kB JS, 10.25 kB CSS)
> - ✅ `docker compose up --build -d` — healthy, app and deep-link both 200
> - ✅ **T033 verified by absence**: neither `Canvas.tsx` nor `CanvasNode.tsx` destructures `isOver` from `useDroppable`, so no drop-target validity signal is reachable (FR-013). The only drag-time styling is `isDragging` on the item being dragged.
>
> **A real defect the tests caught.** `computeScore` was written as `passed * (100 / total)`, which yields **100.00000000000001** for 11 of 11 — silently failing SC-002's "exactly 100". Reordered to `(passed / total) * 100`, which makes the perfect case exactly `1 * 100`. The comment in `score.ts` records why the order matters.
>
> **Deviation — drag gestures are not simulated in tests.** dnd-kit drags depend on layout measurements jsdom does not produce, so simulating pointer events would test the mock rather than the app. The drop → reducer-action translation is covered by unit and integration tests; the gesture itself is verified manually per [quickstart.md](./quickstart.md). `src/components/canvas/collision.ts` (depth-wins resolution, research R-01) is therefore covered by reasoning and manual check, not automated test.

---

## Phase 4: User Story 2 - Discover Hidden Requirements (Priority: P2)

**Goal**: Requirements are withheld and revealed one Category at a time, simulating a client interview.

**Independent Test**: Confirm Hidden Requirements are concealed on load, that each Category's control reveals exactly that Category, and that revealing changes no Score.

### Tests for User Story 2 ⚠️

- [ ] T039 [P] [US2] Write the integration test for requirement discovery in `tests/integration/reveal-requirements.test.tsx` covering spec Acceptance Scenarios 1–4, including the Score-neutrality comparison

### Implementation for User Story 2

- [ ] T040 [US2] Build the Hidden Requirement Category component — a reveal control when concealed, the requirement list once revealed — in `src/components/requirements/HiddenRequirementCategory.tsx` satisfying FR-004 and FR-005
- [ ] T041 [US2] Render one Category component per Challenge Category in `src/components/requirements/RequirementsPanel.tsx`, concealed on load, satisfying FR-003
- [ ] T042 [US2] Wire `REVEAL_CATEGORY` dispatch so revealed Categories persist for the session and never influence the Evaluation or Score, in `src/state/session-reducer.ts` satisfying FR-006 and FR-007

**Checkpoint**: US1 and US2 both work independently

---

## Phase 5: User Story 3 - Revise and Resubmit (Priority: P3)

**Goal**: Unlimited resubmission, with the previous Evaluation staying readable while the user acts on it.

**Independent Test**: Submit a flawed Canvas Tree, correct one failing Rule, resubmit, and confirm the Score rises and that Rule passes.

### Tests for User Story 3 ⚠️

- [ ] T043 [P] [US3] Write the integration test for revision and resubmission in `tests/integration/revise-and-resubmit.test.tsx` covering spec Acceptance Scenarios 1–4, asserting the Evaluation remains visible after a Canvas edit

### Implementation for User Story 3

- [ ] T044 [US3] Set `evaluationStale` on `ADD_NODE`, `MOVE_NODE`, and `CONFIRM_DELETE` when an Evaluation exists — keeping the Evaluation itself, never clearing it — in `src/state/session-reducer.ts` satisfying FR-030
- [ ] T045 [US3] Clear `evaluationStale` and replace the Evaluation on `SUBMIT` in `src/state/session-reducer.ts` satisfying FR-031
- [ ] T046 [US3] Render the stale indicator — text making clear the results describe the previous submission — in `src/components/requirements/EvaluationResults.tsx` satisfying FR-030
- [ ] T047 [US3] Confirm the Canvas never locks and the submit control never disables after a submission, in `src/components/Header.tsx` satisfying FR-029

**Checkpoint**: US1, US2, and US3 all work independently

---

## Phase 6: User Story 4 - Resume an In-Progress Session (Priority: P4)

**Goal**: Canvas Tree and revealed Categories survive a reload; the Evaluation deliberately does not.

**Independent Test**: Build a Canvas Tree, reveal Categories, reload, and confirm both are restored with no Evaluation shown.

### Tests for User Story 4 ⚠️

- [ ] T048 [P] [US4] Write the 9 persistence tests in `src/state/persistence.test.ts` exactly as enumerated in [contracts/persistence.md](./contracts/persistence.md) — round trip, missing key, malformed JSON, version mismatch, unknown `serviceId`, unknown Category id, storage throwing on read, storage throwing on write, and the saved envelope containing no Evaluation
- [ ] T049 [P] [US4] Write the integration test for session resumption in `tests/integration/session-resume.test.tsx` covering spec Acceptance Scenarios 1–3

### Implementation for User Story 4

- [ ] T050 [US4] Implement `loadSession` and `saveSession` against the single versioned key `architecture-canvas:session` in `src/state/persistence.ts`, with every storage access wrapped so unavailability degrades persistence only (FR-032, SC-009)
- [ ] T051 [US4] Implement envelope validation in `src/state/persistence.ts` — version match, structural validity, and every `serviceId` and Category id resolving against the current Challenge; discard the whole envelope on any failure (FR-033)
- [ ] T052 [US4] Dispatch `RESTORE` from a validated envelope on `SessionProvider` initialisation, leaving `evaluation` null, in `src/state/SessionProvider.tsx` satisfying FR-034
- [ ] T053 [US4] Persist after every action changing `canvasTree` or `revealedCategories` in `src/state/SessionProvider.tsx`, excluding the Evaluation from the envelope (FR-032, FR-034)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T054 [P] Verify domain purity — assert no file under `src/domain/` or `src/challenges/` imports React, dnd-kit, or browser storage APIs, protecting [ADR 0001](../../docs/adr/0001-client-side-validation-engine.md)'s migration path
- [ ] T055 [P] Verify keyboard operability of drag and drop via dnd-kit's keyboard sensor across `src/components/canvas/` and `src/components/services/`
- [ ] T056 [P] Replace the tech-stack placeholders in `README.md` with real setup and run instructions matching the delivered project
- [ ] T057 Confirm every `CONTEXT.md` canonical term is used consistently across `src/` — Service, Node, Canvas Tree, Rule, Evaluation, Recommendation, Score — with no "block", "element", or "validation rule" drift
- [ ] T058 Run the full manual edge-case table from [quickstart.md](./quickstart.md), including duplicate Nodes, over-nesting, absurd placement, and the cycle rejection
- [ ] T059 Verify `docker compose up --build -d` serves the working application at `localhost:3000`, satisfying `MVP.md`'s deployment acceptance criterion
- [ ] T060 Confirm every `MVP.md` acceptance-criteria checkbox is satisfied and tick them in place

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational. No dependency on US2–US4
- **US2 (Phase 4)**: Depends on Foundational. Independent of US1, US3, US4
- **US3 (Phase 5)**: Depends on Foundational **and US1** — it revises an Evaluation, which US1 produces
- **US4 (Phase 6)**: Depends on Foundational. Independent of US1–US3
- **Polish (Phase 7)**: Depends on all desired stories being complete

### User Story Dependencies

US3 is the only story with a genuine dependency on another. US2 and US4 can be built and tested with US1 absent — US2 needs only the Requirements panel from Foundational, and US4 persists a Canvas Tree regardless of whether anything evaluates it.

### Within Each User Story

- Tests are written and confirmed failing before implementation
- Domain functions before the components that call them
- Components before the wiring that connects them
- Reducer changes before the UI reflecting them

### Parallel Opportunities

- T003–T009 (Setup) all parallel
- T013 and T014 (Challenge data) parallel with T010–T012 (tree operations) — different files, no shared dependencies
- T021, T022, T023 (US1 tests) all parallel
- T026, T028, T034, T037 (independent US1 components) parallel
- Once Foundational completes, US1, US2, and US4 can proceed in parallel across developers; US3 waits on US1
- T054, T055, T056 (Polish) parallel

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together, confirm all fail:
Task: "11 evaluator contract tests in src/domain/evaluator.test.ts"
Task: "Score computation tests in src/domain/score.test.ts"
Task: "Design-and-evaluate integration test in tests/integration/design-and-evaluate.test.tsx"

# Then build independent components together:
Task: "Services panel in src/components/services/ServicesPanel.tsx"
Task: "Requirements panel in src/components/requirements/RequirementsPanel.tsx"
Task: "Delete confirmation dialog in src/components/canvas/DeleteConfirmDialog.tsx"
Task: "Score display in src/components/requirements/ScoreDisplay.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **critical, blocks everything**
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: build the Required Architecture and confirm a Score of exactly 100; confirm an empty Canvas scores 0 without erroring
5. Demo-ready — this alone is the differentiated product

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate → **MVP demo**
3. Add US2 → the requirements-discovery differentiator from `docs/01-RESEARCH.md`
4. Add US3 → converts a one-shot test into a practice loop
5. Add US4 → removes the accidental-refresh frustration

### Parallel Team Strategy

After Foundational completes: one developer on US1 (the largest slice), a second on US2 and US4 in sequence, with US3 picked up by whoever finishes first once US1 lands.

---

## Notes

- Every task names its exact file path and maps to at least one FR, contract, or research decision
- The cycle guard in T012 is the one placement restriction in the system — see [research.md](./research.md) R-02
- T033 is a verification task, not a build task: FR-013 is satisfied by the *absence* of drag-time feedback, which is easy to add by reflex and must be explicitly checked for
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
