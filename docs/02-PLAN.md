# Project Roadmap & Execution Plan

**Current Version**: `v0.2.0`  
**Target Milestone**: `v0.3.0` (2D Free-form Canvas & Node Visualization)  
**Methodology**: SpecKit-driven (Docs -> Brainstorm/Grill -> Spec -> Tasks -> Code)

---

## 1. Guiding Principles & Hard Constraints

1. **Domain Purity (ADR 0001)**: `src/domain/` must remain 100% framework-agnostic. No React, no DOM, no rendering logic. Evaluation operates on pure data.
   Enforced, not just conventional — see the "Domain purity boundary" `no-restricted-imports`/`no-restricted-globals` block in `eslint.config.js`, scoped to `src/domain/**` and `src/challenges/**`.
2. **Minimal Dependencies**: Do not introduce heavy third-party libraries without a formal ADR and explicit trade-off justification.
   `package.json` production deps are `react`, `react-dom`, `@dnd-kit/core` only; routing and state management are hand-rolled rather than adding a library (§3).
3. **Additive Evolution**: New features must not break existing test harnesses or render previous challenges unplayable.
   Verified: `challenge-01.ts` and `challenge-02.ts` share the exact same `Challenge` type shape with no new `Rule` kind added for Challenge #2.
4. **Data Isolation**: Multi-challenge states remain strictly scoped by `challengeId`.
   Implemented via the per-Challenge localStorage key scheme in §3, not just a UI-level convention.

---

## 2. Milestone Roadmap

### v0.1.0 - MVP (Completed)
- 3-panel workspace (Requirements, Services, Canvas).
- Challenge #1 (Simple Web Application, 3-tier VPC).
- Client-side evaluation engine (`evaluate(tree, rules)`).
- Full containerization & 197 passing tests.

### v0.2.0 - Multi-Challenge Platform (Completed)
- Catalog Page (`/`) with difficulty badges and tags.
- Task Page (`/challenge/:id`) with hand-rolled `useRoute()`.
- Challenge #2 (High-Availability Containerized Web App).
- Challenge-scoped persistent storage (`architecture-canvas:session:${challengeId}`).
- 265 passing tests.

### v0.3.0 - 2D Free-form Canvas Engine (Current Focus)
**Goal**: Transition from vertical flex-tree drop-zones to an AWS-like 2D spatial workspace (CloudFormation / Application Composer style). Design captured in [ADR-0002](adr/0002-2d-spatial-canvas-blocks.md).

- Frames (VPC, subnets, ...) and compact Cards (EC2, RDS, ALB, ...) via a new `Service.renderKind: 'frame' | 'card'` field; containment stays the `children` array, `renderKind` only picks the empty-state look.
- Free-form x/y placement with grid-snap, in a fixed (non-pannable, non-zoomable) viewport.
- Layout data (`{x, y, width, height}`) in a new state-layer map, not on the domain `Node` type; persisted per-Challenge alongside the Canvas Tree (`SESSION_VERSION` bump).
- Frames auto-size to their children; no manual resize handle.
- Coarse keyboard support (assign into a Frame); fine-grained keyboard repositioning deferred.
- Deferred to `docs/03-BACKLOG.md`: pan/zoom + minimap, manual Frame resize, full keyboard fine-grained repositioning, collision/overlap-avoidance.


### v0.x.x - Connectors & Explicit Relationships (Future)
- Directed connection lines (arrows between nodes, e.g. ALB -> ECS -> RDS).
- Port/Security group relationship evaluation.

### v.0.x.x - Logic and Evaluation Engines (Future)
- Unified scoring logic across challenges.
- Granular rule evaluation engines.

### v0.x.x - AI Architecture Reviewer & Interviewer (Future)
- LLM integration for dynamic feedback on failed rules.
- Interactive requirement discovery via chat.

---

## 3. Decision Log & Conventions

**ADR-0001 — Client-side validation engine** (2026-08-30, Accepted). No backend; the evaluator is a pure `(CanvasTree, Rule[]) → Evaluation` function, deliberately shaped so it can move behind an API later without a rewrite. Accepted cost: Rules ship in the JS bundle and are readable via devtools — fine while no credential or ranking attaches to a Score. Open tension: the AI client-chat / AI-review features in `PROJECT.md` §4 will need a backend regardless, so this ADR defers that cost rather than avoiding it. Full text: `docs/adr/0001-client-side-validation-engine.md`.

**Routing — hand-rolled `useRoute()`** (`src/routing/useRoute.ts`). `Route = {page:'catalog'} | {page:'task', challengeId}`, parsed from `window.location.pathname`; navigation via `history.pushState` with a synchronous state update, plus a `popstate` listener for back/forward. The hook only *parses* the URL shape — it does not validate that a `challengeId` exists in the Registry; that check (and the fallback to the Catalog Page) lives in `App.tsx`, per FR-005. `App.tsx` also keys `<TaskPage key={challenge.id}>` to force a remount on direct Challenge-to-Challenge URL navigation — without it, `useReducer`'s lazy initializer wouldn't rerun and one Challenge's Canvas Tree could leak into another's session. No routing library; same "no dependency until built-ins stop being enough" reasoning as state management.

**Persistence — per-Challenge scoped localStorage** (`src/state/persistence.ts`). Key format: `` `architecture-canvas:session:${challengeId}` ``. Stored envelope: `{ version: SESSION_VERSION, challengeId, canvasTree, revealedCategories }` — `SESSION_VERSION` is currently `1`. Validation is strictly all-or-nothing: a version mismatch, a `challengeId` mismatch, or any structurally invalid node/category (e.g. a `serviceId` no longer in the Challenge's catalog) discards the whole envelope and starts clean — there is no partial repair or migration. The `challengeId` is checked even though it's embedded in the key name, specifically to guard against Challenge #1 and #2's overlapping Service ids (`vpc`, `rds`, `internet-gateway`, ...) ever letting one Challenge's tree be silently accepted as another's. **Evaluation is never persisted** (FR-034) — a restored session always starts with no results shown. `clearSession(challengeId)` does a hard `localStorage.removeItem`, called from `Header.tsx`'s Back-to-Catalog handler, so leaving a Challenge wipes its in-progress session by design (persistence is a refresh safety-net, not a resume-later feature). Every persistence function swallows storage errors silently — private browsing / disabled storage degrades to "no persistence," never an error UI.

**Challenge data shape & Registry**. `Challenge` (`src/domain/types.ts`): `id, title, description, visibleRequirements, hiddenRequirementCategories, services, rules, difficulty, tags, shortDescription`. `Rule` is a discriminated union — `PresenceRule | ContainmentRule` (`kind: 'presence' | 'containment'`) — checked exhaustively in the evaluator, so a new Rule kind can't compile silently unhandled. The Registry (`src/challenges/index.ts`) is a static, eagerly-imported `challengeRegistry: readonly Challenge[]` in authorial order, plus `getChallengeById(id)` returning `undefined` on a miss — that `undefined` is the deliberate signal `App.tsx` uses to fall back to the Catalog Page, not an error case.

**ADR-0002 — 2D Spatial Canvas Blocks** (2026-09-08, Accepted). Redesigns the Canvas from nested-list rendering into AWS Application Composer-style 2D blocks: Frames (VPC, subnets) that auto-size to their children, compact Cards (EC2, RDS, ALB) for leaves, chosen via a new `Service.renderKind: 'frame' | 'card'` field. Containment stays the `children` array — Layout (position/size) is presentation-only, kept in a new state-layer map rather than on the domain `Node` type, so the evaluator and Domain Purity are untouched. Free placement with grid-snap, fixed viewport (no pan/zoom in v0.3.0), Layout persisted alongside the Canvas Tree. A Node with children always renders as a Frame regardless of `renderKind`, preserving FR-012's "any node may contain any other" with no new restriction. Terminology (Frame/Card/Layout) is canonical per `CONTEXT.md`; "container" stays reserved for this domain's real AWS/Docker sense. Full text: `docs/adr/0002-2d-spatial-canvas-blocks.md`.

**See also** — settled specs this doc intentionally doesn't restate: `docs/pages-ux/01-TASK-PAGE.md` (scoring formula, direct-child-only containment, existential Rules, stale-evaluation marking), `docs/pages-ux/02-CATALOG-PAGE.md` (card contents, Registry-order display, no dedicated 404), and the agent-process docs `docs/agents/domain.md` and `docs/agents/issue-tracker.md`.

## 4. Backlog
- High-level backlog items and future enhancements are tracked in `docs/03-BACKLOG.md`.