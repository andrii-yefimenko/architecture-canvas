---

description: "Task list for Multi-Challenge Catalog & Challenge #2"
---

# Tasks: Multi-Challenge Catalog & Challenge #2

**Input**: Design documents from `/specs/002-multi-challenge-catalog/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. This repo's contracts (`contracts/routing.md`, `contracts/persistence.md`, `contracts/challenge-registry.md`) each define a required-test-case table, and the shipped MVP (`specs/001-architecture-canvas-mvp/`) established exhaustive testing as house style — 197 tests, plus architecture-guard tests for domain purity and terminology. Test tasks below are not optional for this feature.

**Organization**: Tasks are grouped by user story from `spec.md`, in priority order (P1, P1, P2, P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1–US4 from `spec.md`
- File paths are exact and relative to the repository root

## Path Conventions

Single-project frontend SPA, unchanged from spec 001: `src/`, `tests/` at repository root. New directories this feature adds: `src/routing/`, `src/pages/`, `src/components/catalog/`.

---

## Phase 1: Setup

**Purpose**: The one shared type change every other task in this feature depends on.

- [x] T001 Extend the `Challenge` interface in `src/domain/types.ts` with `difficulty: 'beginner' | 'intermediate' | 'advanced'` and `tags: readonly string[]`, per `data-model.md`'s "Challenge (cardinality change only)" section

**Checkpoint**: No new npm dependency is required for this feature (confirmed in `research.md`); `nginx.conf` and `docker-compose.yml` need no change (SPA fallback already covers `/challenge/:id`). Nothing else to scaffold before Foundational work starts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Challenge Registry and the routing hook — both User Story 1 and User Story 2 depend on a second Challenge existing in a Registry, and every story that navigates depends on `useRoute()`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add `difficulty: 'beginner'` and `tags: ['AWS', 'Single VPC', 'Three-Tier']` to `src/challenges/challenge-01.ts`, matching `docs/challenges/01-SIMPLE-WEB-APPLICATION.md`'s Metadata (depends on T001)
- [x] T003 [P] Author `src/challenges/challenge-02.ts` from `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md` — title, description, Visible Requirements, four Hidden Requirement Categories, Service catalog (including the EC2 Frontend/Backend distractors), and all 9 Rules (`presence`/`containment` only), plus `difficulty: 'intermediate'` and its Tags (depends on T001)
- [x] T004 Write `src/challenges/challenge-02.test.ts` mirroring `src/challenges/challenge-01.test.ts`'s integrity checks (unique Service/Rule/Category ids, every Rule's `serviceId`/`parentServiceId` resolves, non-empty descriptions/recommendations, non-empty `visibleRequirements`, every Category non-empty) plus the two new checks from `contracts/challenge-registry.md` rules 5–6 (`difficulty` is a literal, `tags` non-empty) (depends on T003)
- [x] T005 Create `src/challenges/index.ts` exporting `challengeRegistry: readonly Challenge[] = [challenge01, challenge02]` and `getChallengeById(id: string): Challenge | undefined`, per `contracts/challenge-registry.md` (depends on T002, T003)
- [x] T006 Write `src/challenges/index.test.ts` covering `contracts/challenge-registry.md`'s Registry-level integrity rules 1–4: unique ids across the Registry, Registry order matches declaration order, `getChallengeById` round-trips every entry, `getChallengeById` returns `undefined` for an unknown id (depends on T005)
- [x] T007 [P] Create `src/routing/useRoute.ts` implementing `useRoute(): Route` and `navigate(path: string): void` per `contracts/routing.md` (pathname parsing, `history.pushState`, `popstate` listener with cleanup)
- [x] T008 Write `src/routing/useRoute.test.ts` covering all 6 required test cases in `contracts/routing.md` (depends on T007)

**Checkpoint**: Foundation ready — the Challenge Registry has two Challenges and the router can parse/navigate both route shapes. User story implementation can now begin.

---

## Phase 3: User Story 1 - Discover and Launch a Challenge from the Catalog (Priority: P1) 🎯 MVP

**Goal**: A user landing on `/` sees a Catalog Page with one card per Challenge and can launch either one's Task Page; the header can navigate back; an unknown Challenge ID falls back to the Catalog.

**Independent Test**: Load `/`, confirm two Challenge cards render in Registry order, activate Start Challenge on a card, confirm the corresponding Task Page loads with that Challenge's own content.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `src/components/catalog/ChallengeCard.tsx` — renders a Challenge's title, Difficulty, short description, and Tags, plus a Start Challenge control that calls `navigate` from `useRoute()` (FR-003, FR-004)
- [ ] T010 [US1] Create `src/pages/CatalogPage.tsx` — renders one `ChallengeCard` per entry in `challengeRegistry`, in Registry order (FR-002) (depends on T009)
- [ ] T011 [P] [US1] Extract the `Workspace` function currently inside `src/App.tsx` into `src/pages/TaskPage.tsx`, changing its signature to accept a `challenge: Challenge` prop that it passes to `SessionProvider`, instead of relying on `SessionProvider`'s `challenge01` default
- [ ] T012 [P] [US1] Add a "Back to Catalog" control to `src/components/Header.tsx` that calls `navigate('/')` from `useRoute()` (FR-007) — session-clearing behavior is added later, in Phase 6
- [ ] T013 [US1] Rewrite `src/App.tsx` as a router switch: call `useRoute()`; for `{ page: 'catalog' }` render `CatalogPage`; for `{ page: 'task', challengeId }` resolve the Challenge via `getChallengeById` and render `TaskPage` with it on a hit, or `CatalogPage` on a miss (FR-005, FR-006) (depends on T007, T010, T011, T005)
- [ ] T014 [P] [US1] Update the now-inaccurate "Single-Challenge MVP, so this is constant" comment on the `challenge` field in `src/state/session-context.ts` to describe per-route Challenge selection instead
- [ ] T015 [US1] Write `tests/integration/catalog-and-launch.test.tsx` covering spec Acceptance Scenarios 1–5: card rendering in Registry order, card contents, launch navigation to the correct Task Page, Back to Catalog navigation, and the unknown-Challenge-ID fallback to the Catalog Page (depends on T013)

**Checkpoint**: User Story 1 is fully functional and independently testable — the Catalog Page, both Challenges, and navigation between them all work.

---

## Phase 4: User Story 2 - Complete Challenge #2 End to End (Priority: P1)

**Goal**: Challenge #2 is playable exactly like Challenge #1 — its own requirements, its own Service catalog, evaluated against its own 9 Rules.

**Independent Test**: From the Catalog, start Challenge #2, build a Canvas Tree matching its Required Architecture, submit, confirm a Score of 100 with 9 of 9 Rules passed.

### Implementation for User Story 2

- [ ] T016 [US2] Write `tests/integration/challenge-02-loop.test.tsx` covering spec Acceptance Scenarios 1–4: Challenge #2's own title/description/Visible Requirements render (not Challenge #1's), only Challenge #2's Service catalog is listed, a Canvas Tree matching its Required Architecture scores exactly 100 with all 9 Rules passed, and a Canvas Tree with the ECS Cluster outside a Private Subnet fails that Rule with a Recommendation (depends on T013, T003, T004)

**Checkpoint**: User Stories 1 and 2 both work — this is the full "browse and complete either Challenge" slice. No implementation code was needed beyond Phase 2/3: `RequirementsPanel`, `ServicesPanel`, and the evaluator already consume `challenge` generically via `useSession()` (confirmed in `research.md`'s "Page composition" finding), and Challenge #2 introduces no new Rule kind.

---

## Phase 5: User Story 3 - Work Stays Isolated Between Challenges (Priority: P2)

**Goal**: Each Challenge's Canvas Tree and revealed Categories are persisted under a key scoped to that Challenge's ID; one Challenge's stored session is never used to restore another's, even when they share Service ids.

**Independent Test**: Build a Canvas Tree on Challenge #1, navigate directly to Challenge #2's Task Page, confirm its Canvas is empty; reload Challenge #1's Task Page directly and confirm its Nodes are restored.

### Implementation for User Story 3

- [ ] T017 [US3] Rewrite `src/state/persistence.ts` per `contracts/persistence.md`: add `storageKey(challengeId)` computing `` `architecture-canvas:session:${challengeId}` ``, add `challengeId` to `PersistedSession`, and update `saveSession`/`loadSession` to take a `challengeId` and validate the envelope's `challengeId` field against it (checks 1–6 in the contract, including the new check 3)
- [ ] T018 [US3] Update `src/state/SessionProvider.tsx`'s `buildInitialState` to pass `challenge.id` into `loadSession` and `saveSession` (depends on T017)
- [ ] T019 [P] [US3] Update `src/state/persistence.test.ts`: re-run the 9 original required test cases against a per-Challenge key, and add new cases 10, 11, and 14 from `contracts/persistence.md` (cross-Challenge isolation, mismatched-`challengeId` rejection even when Service ids overlap, reload-without-clearing restores) (depends on T017)
- [ ] T020 [US3] Write `tests/integration/session-isolation.test.tsx` covering spec Acceptance Scenarios 1–3 (depends on T018)

**Checkpoint**: User Stories 1, 2, and 3 all work — Challenge sessions no longer leak into each other.

---

## Phase 6: User Story 4 - Leaving a Challenge Clears Its In-Progress Session (Priority: P3)

**Goal**: Activating Back to Catalog clears the current Challenge's persisted session, so starting that Challenge again begins empty.

**Independent Test**: Build a partial Canvas Tree, activate Back to Catalog, start the same Challenge again, confirm the Canvas is empty.

### Implementation for User Story 4

- [ ] T021 [US4] Add `clearSession(challengeId: string): void` to `src/state/persistence.ts` per `contracts/persistence.md`'s Clear section (`localStorage.removeItem`, wrapped, never throws) (depends on T017)
- [ ] T022 [P] [US4] Add cases 12 and 13 from `contracts/persistence.md` to `src/state/persistence.test.ts` (Back to Catalog clears the key; restarting after a clear is identical to a first visit) (depends on T021)
- [ ] T023 [US4] Wire `src/components/Header.tsx`'s Back to Catalog handler to also call `clearSession(challenge.id)` alongside the existing `navigate('/')` (FR-014) (depends on T012, T021)
- [ ] T024 [US4] Write `tests/integration/clear-on-leave.test.tsx` covering spec Acceptance Scenarios 1–2 (depends on T023)

**Checkpoint**: All four user stories are independently functional. This is the complete feature.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and documentation, no new behavior.

- [ ] T025 [P] Update `README.md`'s "How it works" (mention starting from the Catalog Page) and "Project Structure" (add `src/pages/`, `src/routing/`, `src/components/catalog/`) sections
- [ ] T026 Run `npm run lint` and `npm run build`; confirm zero errors and that `tests/architecture/domain-purity.test.ts` and `tests/architecture/terminology.test.ts` still pass unmodified, verifying the Constitution Check's claim that `src/domain/` was untouched
- [ ] T027 Run `docker compose up --build -d`; confirm the Catalog Page serves at `localhost:3000/` and both Challenges are reachable and playable, per `quickstart.md`'s Definition of Done (depends on T026)
- [ ] T028 Manually execute `quickstart.md`'s 4 validation scenarios and edge-case table, including the deep-link and two-tabs cases that can't be exercised in jsdom (depends on T027)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories.
- **User Story 1 (Phase 3)** and **User Story 2 (Phase 4)**: Both depend on Foundational. US2 additionally depends on US1's routing (T013) to have a Task Page to navigate to, but adds no implementation of its own — it is a verification phase.
- **User Story 3 (Phase 5)**: Depends on Foundational only for the Challenge Registry existing (two Challenges to isolate between); does not depend on US1/US2's routing UI, though its integration test (T020) exercises navigation built in Phase 3.
- **User Story 4 (Phase 6)**: Depends on User Story 3 (T017, persistence rewrite) and User Story 1 (T012, the Back to Catalog control it extends).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only.
- **US2 (P1)**: Depends on Foundational + US1's routing (T013). Contributes no new implementation.
- **US3 (P2)**: Depends on Foundational only.
- **US4 (P3)**: Depends on US1 (T012) and US3 (T017) both being complete.

### Within Each User Story

- Foundational data/registry/routing before any story's UI.
- Card/page components before the router switch that composes them.
- Persistence rewrite before the Header wiring and tests that depend on it.
- Story's integration test last, after every task it exercises.

### Parallel Opportunities

- T002 and T003 (different Challenge files) once T001 lands.
- T007 (routing) can start immediately alongside T002/T003 — no shared file.
- Within Phase 3: T009, T011, T012 touch three different files and can run in parallel; T010 and T013 are the two points where those parallel threads converge.
- T019 (persistence tests) and T018 (SessionProvider wiring) can run in parallel once T017 lands — different files.
- T022 (persistence tests) and T023 (Header wiring) can run in parallel once T021 lands — different files.
- T025 (README) can run any time after Phase 6, in parallel with T026.

---

## Parallel Example: Foundational Phase

```bash
# After T001 (Challenge type extension) lands:
Task: "Add difficulty/tags to src/challenges/challenge-01.ts"
Task: "Author src/challenges/challenge-02.ts from docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md"
Task: "Create src/routing/useRoute.ts"
```

## Parallel Example: User Story 1

```bash
# All three touch different files and have no dependency on each other:
Task: "Create src/components/catalog/ChallengeCard.tsx"
Task: "Extract Workspace into src/pages/TaskPage.tsx"
Task: "Add Back to Catalog control to src/components/Header.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T008) — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 (T009–T015)
4. **STOP and VALIDATE**: Load `/`, confirm both cards, launch each Task Page, confirm Back to Catalog and the unknown-id fallback
5. This alone is already a meaningful increment: a navigable Catalog replaces the old "Challenge is the app's main window" behavior, even before persistence isolation exists.

### Incremental Delivery

1. Setup + Foundational → two Challenges registered, routing works standalone (testable via `useRoute.test.ts` alone).
2. Add US1 → Catalog Page and navigation work end-to-end → demoable (MVP).
3. Add US2 → Challenge #2 is provably completable, not just visible on a card.
4. Add US3 → Challenge sessions stop leaking into each other (the concrete data-corruption risk `research.md` identified is closed).
5. Add US4 → persistence behaves exactly as `docs/pages-ux/01-TASK-PAGE.md` specifies: a refresh safety net, not a resume feature.
6. Polish → docs and full verification pass.

Each step adds value without breaking the previous one; US2 in particular adds zero new code, only proof that Phase 2/3's generic wiring actually generalizes.

---

## Notes

- [P] tasks touch different files and have no dependency on another incomplete task in the same batch.
- [Story] labels trace every Phase 3–6 task back to `spec.md`'s User Story 1–4.
- Commit after each task or logical group, consistent with this project's per-phase commit history (`specs/001-architecture-canvas-mvp/` shipped as one commit per phase).
- Per `research.md`: `src/domain/` is not touched by any task above — if a task here seems to require a domain change, stop and re-check against `research.md`'s "Challenge #2 evaluator coverage" finding before proceeding.
