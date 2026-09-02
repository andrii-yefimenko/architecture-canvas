# Implementation Plan: Multi-Challenge Catalog & Challenge #2

**Branch**: `feat/02-challenge-2-and-menu` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-multi-challenge-catalog/spec.md`

## Summary

Add a Catalog Page that lists every Challenge in a new Challenge Registry, add a second, independent Challenge (a containerized ECS Fargate microservice), and give each Challenge its own isolated, in-progress-only persisted session. This extends the shipped single-Challenge MVP (`specs/001-architecture-canvas-mvp/`) rather than replacing any part of it: the evaluator, Canvas Tree operations, drag-and-drop mechanics, and three-panel Task Page layout are all reused unmodified per Challenge.

The technical approach centres on one observation made during research: **`SessionProvider` was already Challenge-parametric** (it accepts an optional `challenge` prop, defaulting to `challenge01`) before this feature existed. The genuinely new work is entirely in three places — a Challenge Registry to select from, a two-route client-side router to reach a selection, and a persistence layer that scopes itself by Challenge ID instead of assuming there is only one session to save. `src/domain/` is untouched: Challenge #2's nine Rules need no new Rule kind (confirmed in `research.md`).

## Technical Context

**Language/Version**: TypeScript 5.x, targeting ES2022 — unchanged from spec 001.

**Primary Dependencies**: React 18, Vite 8, Tailwind CSS 3, dnd-kit (`@dnd-kit/core`) — unchanged. **No new dependency is added by this feature.** Routing is a hand-rolled hook (`docs/04-TECH-STACK.md`), not a library.

**Storage**: Browser local storage, now **one versioned key per Challenge ID** (`architecture-canvas:session:${challengeId}`) instead of one key for the whole application. See `contracts/persistence.md`.

**Testing**: Vitest for unit tests, React Testing Library for integration tests, jsdom environment — unchanged.

**Target Platform**: Modern desktop browsers, served as a static bundle by nginx on port 3000 via Docker Compose — unchanged. `nginx.conf`'s existing SPA fallback already handles deep links to `/challenge/:id` with zero server-side change (`research.md`).

**Project Type**: Single-project frontend SPA — unchanged. Still no backend tier.

**Performance Goals**: Unchanged (60 fps drag, evaluation within one animation frame). New: a Catalog-to-Task Page navigation must feel instant — it's a `pushState` and a re-render, no network request, no bundle re-fetch.

**Constraints**: Unchanged — fully offline-capable after first load, no network calls at runtime, no telemetry. The "no dependency until the built-in tools stop being enough" pattern that justified `useReducer` over an external state library now also justifies the hand-rolled router over React Router.

**Scale/Scope**: Two Challenges (11 Rules and 9 Rules respectively), a Catalog Page with two cards, two page shapes, one additional persisted-session dimension (Challenge ID). Still a single anonymous local user; no concurrency; no cross-Challenge aggregation (score comparison across Challenges remains explicitly out of scope, tracked in `docs/03-BACKLOG.md`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status: PASS (vacuously) — no constitution is defined**, same finding as `specs/001-architecture-canvas-mvp/plan.md`. `.specify/memory/constitution.md` remains the unmodified Spec Kit template.

The three principles that plan recommended ratifying are still the right ones, and this feature adds a candidate fourth:

- **Domain purity** — `src/domain/` stays untouched by this feature (confirmed in `research.md`); the Challenge Registry lives in `src/challenges/`, which is framework-free by the same existing convention as `challenge-01.ts`.
- **Canonical terminology** — `CONTEXT.md` was updated with Challenge ID, Challenge Registry, Catalog Page, Task Page, Difficulty, and Tags *before* this plan was written, and its pre-existing Hidden Requirement entry was corrected to stop hardcoding Challenge #1's specific category names as if they applied to every Challenge.
- **Test-first for domain logic** — unchanged; this feature adds no domain logic to test-first, only data and plumbing.
- **New candidate: per-Challenge data isolation** — this feature's central risk (one Challenge's persisted state silently read as another's, per `research.md`'s persistence-scoping finding) is exactly the kind of defect a ratified principle should name explicitly once a second Challenge makes it possible for the first time.

**Post-Phase 1 re-check**: PASS. Phase 1 design added a Challenge Registry (data), a routing hook (state/component-layer), and a persistence key-scoping change — no new project, no new repository/service abstraction layer, and no indirection beyond what the existing domain/state/components split already has room for. Nothing requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-challenge-catalog/
├── plan.md                    # This file
├── spec.md                    # Feature specification
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/                 # Phase 1 output
│   ├── routing.md
│   ├── persistence.md         # Supersedes spec 001's version
│   └── challenge-registry.md  # Extends spec 001's contracts/challenge.md
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main.tsx                         # Entry point (unchanged)
├── App.tsx                          # NEW ROLE: thin router switch — Catalog vs. Task Page
│
├── routing/                         # NEW — framework-bound (imports React), not domain
│   ├── useRoute.ts                  # useRoute(), navigate()
│   └── useRoute.test.ts
│
├── domain/                          # UNCHANGED — no new Rule kind needed
│   └── ...                          # (types.ts, canvas-tree.ts, evaluator.ts, score.ts, as in spec 001)
│
├── challenges/
│   ├── challenge-01.ts              # Unchanged; gains difficulty/tags fields
│   ├── challenge-01.test.ts
│   ├── challenge-02.ts              # NEW — authored from docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md
│   ├── challenge-02.test.ts         # NEW — mirrors challenge-01.test.ts's integrity checks
│   ├── index.ts                     # NEW — challengeRegistry, getChallengeById
│   └── index.test.ts                # NEW — Registry-level integrity (contracts/challenge-registry.md)
│
├── state/
│   ├── session-reducer.ts           # Unchanged
│   ├── SessionProvider.tsx          # Unchanged — already accepts a `challenge` prop
│   └── persistence.ts               # CHANGED — per-Challenge key, challengeId field, clearSession()
│
├── pages/                           # NEW
│   ├── CatalogPage.tsx              # Renders one ChallengeCard per Registry entry
│   └── TaskPage.tsx                 # The former `Workspace` from App.tsx, now takes a `challenge` prop
│
└── components/
    ├── Header.tsx                   # CHANGED — adds Back to Catalog control
    ├── catalog/
    │   └── ChallengeCard.tsx        # NEW
    ├── requirements/                # Unchanged
    ├── services/                    # Unchanged
    └── canvas/                      # Unchanged

tests/
├── architecture/                    # Unchanged guards still apply (domain purity, terminology, keyboard access)
└── integration/
    ├── catalog-and-launch.test.tsx      # NEW — US1
    ├── challenge-02-loop.test.tsx       # NEW — US2
    ├── session-isolation.test.tsx       # NEW — US3
    └── clear-on-leave.test.tsx          # NEW — US4
```

**Structure Decision**: No new top-level project, no `frontend/`/`backend` split — this remains the single-project frontend SPA from spec 001. Two new top-level `src/` directories: `routing/` (small enough not to need `components/routing/`, and conceptually closer to `state/` than to any single component) and `pages/` (the layer that used to not exist because there was only one page — `App.tsx` rendered `Workspace` unconditionally). `src/domain/` and `src/challenges/` remain the framework-free boundary; `routing/`, `state/`, `pages/`, and `components/` are all allowed to import React, exactly as `state/` and `components/` already were in spec 001.

## Architecture

### Layered view (extends spec 001's)

```text
┌──────────────────────────────────────────────────────────────┐
│ pages/        App.tsx routes to CatalogPage or TaskPage       │
│ components/   React + Tailwind + dnd-kit, renders state       │
│ routing/      useRoute() — reads/writes window.location only  │
├──────────────────────────────────────────────────────────────┤
│ state/        useReducer + Context, persistence (per-Challenge)│
│               Owns SessionState, mediates domain              │
├──────────────────────────────────────────────────────────────┤
│ domain/       Pure functions. Unchanged by this feature.      │
│ challenges/   Challenge data + Registry. Framework-free.      │
└──────────────────────────────────────────────────────────────┘
```

`routing/` sits beside `components/` rather than above or below it: it doesn't render anything and doesn't touch `SessionState`, it only turns a URL into a `Route` value and turns a navigation intent back into a URL. `App.tsx` is the only module that reads a `Route` and decides what to render, keeping that decision in one place.

### Why `SessionProvider` needed no interface change

`src/state/SessionProvider.tsx` (spec 001) already has the shape `{ children, challenge = challenge01, initialState }`. `TaskPage.tsx` calls it exactly as `App.tsx` used to, except the `challenge` argument now comes from `getChallengeById(route.challengeId)` instead of being omitted (which fell through to the default). This is why the plan's Complexity Tracking table below is empty: the highest-risk-looking part of this feature — "make the app's core state layer work for more than one Challenge" — turns out to already be done.

### Why persistence needed a real interface change

Unlike `SessionProvider`, `src/state/persistence.ts` (spec 001) has no Challenge-scoping at all: `STORAGE_KEY` is a module-level constant, and `loadSession(challenge)` validates a tree's *content* against a Challenge's catalog without ever checking whether that stored data was produced *for* that Challenge. `research.md` and `contracts/persistence.md` cover why this is a real (not theoretical) bug once Challenge #2 reuses Service ids like `vpc` and `rds`, and how the `challengeId`-in-both-key-and-envelope check closes it.

### Execution phases

Six phases. A and B have no dependency on each other and can run in parallel; C and D both depend on A and B; E depends on D (needs a Task Page and Header to attach to) but not on C; F depends on everything.

| Phase | Delivers | Spec coverage |
|---|---|---|
| **A — Challenge #2 data** | `challenge-02.ts` authored from `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`, `challenge-02.test.ts` mirroring `challenge-01.test.ts`'s integrity checks, `difficulty`/`tags` fields added to both Challenges | FR-009, FR-010, FR-011 |
| **B — Routing foundation** | `src/routing/useRoute.ts`, `useRoute.test.ts` per `contracts/routing.md` | FR-006, FR-008 |
| **C — Challenge Registry & Catalog Page** | `src/challenges/index.ts`, `ChallengeCard.tsx`, `CatalogPage.tsx`, wired into `App.tsx` | FR-001–005 |
| **D — Task Page routing** | `Workspace` extracted to `TaskPage.tsx` taking a `challenge` prop, `App.tsx` resolves `challengeId` → Challenge via `getChallengeById`, `Header.tsx` gains Back to Catalog → **US1 complete** once combined with C | FR-004, FR-006, FR-007 |
| **E — Per-Challenge persistence** | `persistence.ts` rewritten per `contracts/persistence.md` (keyed storage, `challengeId` field, `clearSession`), Back to Catalog handler calls it → **US3, US4 complete** | FR-012–016 |
| **F — Verification** | The four new integration tests, the quickstart's manual scenarios run once by hand, README/docs pointer updates if any drifted → **US2 complete** (Challenge #2's playability is asserted here, though its content was authored in Phase A) | SC-001–006 |

## Complexity Tracking

> No Constitution Check violations. Nothing to justify.

No new project, no new repository or service abstraction, no state library, no router library, no backend. The only structural additions — `src/routing/` and `src/pages/` — are new directories, not new architectural layers; they slot into the existing domain/state/components split exactly where spec 001's own layered view already had room for "the thing that decides what to render."
