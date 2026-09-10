# Project Roadmap & Execution Plan

**Current Version**: `v0.3.4`  
**Target Milestone**: `v0.x.x` (Connectors & Explicit Relationships) — not yet scoped; needs its own Brainstorm/Grill session before `/speckit-specify`, per `docs/agents/plan.md`.  
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

### v0.3.0 - 2D Free-form Canvas Engine (Completed)
**Goal**: Transition from vertical flex-tree drop-zones to an AWS-like 2D spatial workspace (CloudFormation / Application Composer style). Design captured in [ADR-0002](adr/0002-2d-spatial-canvas-blocks.md); spec/plan/tasks in `specs/003-2d-canvas-blocks/`.

- Frames (VPC, subnets, ECS Cluster) and compact Cards (EC2, RDS, ALB, ...) via a new `Service.renderKind: 'frame' | 'card'` field; containment stays the `children` array, `renderKind` only picks the empty-state look — a Node with children always renders as a Frame regardless.
- Free-form x/y placement with grid-snap (8px), in a fixed (non-pannable, non-zoomable but scrollable) viewport.
- Position data (`{x, y}`; size is always derived, never stored) in a new `src/state/layout.ts` module, not on the domain `Node` type; persisted per-Challenge alongside the Canvas Tree (`SESSION_VERSION` bumped 1 → 2).
- Frames auto-size to their children; no manual resize handle. `src/components/canvas/collision.ts` needed **zero** code changes — nested Frames still nest in the DOM, so the existing depth-tiebreak collision strategy stayed correct (a correction to ADR-0002's own cost estimate, found during implementation).
- Coarse keyboard support (assign into a Frame via a new `KeyboardPlacement` control); fine-grained keyboard repositioning deferred.
- Deferred to `docs/03-BACKLOG.md`: pan/zoom + minimap, manual Frame resize, full keyboard fine-grained repositioning, collision/overlap-avoidance.
- 321 passing tests (up from 265). Real pointer-driven drag-and-drop — including reparenting a Card into a Frame and auto-resize — was verified in an actual headless-Chromium browser session, not just jsdom; this is the first time this project has directly confirmed the drag gesture itself, closing the manual-verification gap `MVP.md`'s own acceptance evidence had flagged since v0.1.0.


### v0.3.1 - Canvas Polish (Completed)
**Goal**: Fix real friction found in hands-on browser testing of v0.3.0, before starting v0.4.0. Decision captured in [ADR-0003](adr/0003-auto-snap-overlap-on-drop.md); no full SpecKit spec/tasks cycle — bounded fixes to already-shipped code, no new page/layer/dependency.

- Direct drags now auto-snap to the nearest free grid slot on overlap (`findFreePosition`/`rectsOverlap`/`siblingRectsFor` in `src/state/layout.ts`) — reverses `FR-010`'s "never blocks a drop for overlap" for the direct-drag case only; Frame-auto-resize-triggered overlap is unchanged, still deferred (`docs/03-BACKLOG.md`).
- Fixed a self-collision bug: every Node is both draggable and droppable on the same id, and a small drag that never left the dragged Node's own stationary rect resolved `over.id === active.id`, which the cycle guard then silently rejected — including the position update. `collision.ts`'s `deepestDroppableFirst` now excludes the active draggable's own id from candidates.
- Added a live "ghost outline" preview (`DragPreviewContext`, new) showing a Frame's projected size while a dragged item hovers over it as a potential parent — a non-committal overlay; the real Frame and every other Node's layout stay untouched until drop.
- 348 passing tests (up from 321). Verified in a real headless-Chromium session, not just jsdom: overlap auto-snap avoiding a genuine sibling collision, a small in-place drag actually moving, and the ghost preview appearing/growing/disappearing correctly relative to the real (unchanged-until-drop) Frame box.

### v0.3.2 - Drag Overlay (Completed)
**Goal**: Fix the last friction point found in hands-on browser testing before v0.4.0 — dragging a Node had no visual element attached to the cursor. No ADR: this adopts `@dnd-kit/core`'s own standard `DragOverlay` pattern (already in `package.json`, no new dependency), not a reversal of any prior decision, so it doesn't clear the three-part ADR bar.

- A new `<DragOverlay>` (wired into the existing `DndContext` in `TaskPage.tsx`, previously unused anywhere in the codebase) renders a `DragOverlayPreview` — styled like the real Frame/Card, sized to match — that dnd-kit positions under the cursor for the whole gesture, for both a new Service dragged from the palette and an existing Node being repositioned/reparented.
- A dragged Frame's overlay shows only its real footprint size and label, not its nested children (scope decision, confirmed with the user) — matches the existing v0.3.1 ghost-preview's level of detail rather than a full recursive WYSIWYG copy.
- The source element keeps its existing `opacity-40` dim-in-place — standard dnd-kit combo of "origin dims, overlay tracks the pointer."
- `dropAnimation={null}` on `<DragOverlay>`: dnd-kit's default drop animation slides the overlay back to the dragged element's *original* rect (the dimmed source card never visually moves during the drag), reading as a snap-back to the start before the real, now-repositioned element appears. Disabled so the overlay vanishes the instant a drop happens, right as the real element (already re-rendered at its new position) takes its place.
- Extracted `computeDraggedItemSize` in `src/state/layout.ts`, replacing an identical branch that had been duplicated three times across `handleDragOver`/`handleDragEnd` in `TaskPage.tsx`.
- 356 passing tests (up from 348). Verified in a real headless-Chromium session: the overlay appears on drag start, its bounding box moves in lockstep with the pointer across multiple points, it carries the correct label and Card/Frame border style, and it's gone (drop-animation settled) after drop.

### v0.3.3 - Canvas Visual Alignment with AWS Diagrams (Completed)
**Goal**: Align the Canvas's look with standard AWS Architecture Diagram / Application Composer conventions. No ADR: `CONTEXT.md` already defined Card as "a compact, fixed-size square" — the previous rectangular `CARD_SIZE` contradicted the repo's own glossary, so this corrects a mismatch rather than making a new trade-off decision.

- `CARD_SIZE` is now `{width: 64, height: 64}` (was `{160, 96}`) — a Card is a square tile with its label centered and wrapping, like a labeled icon (64 = 8 × `GRID_SNAP`; shrunk from an initial 96 to a tighter, more icon-like footprint after review). `MIN_FRAME_SIZE.width` is now `224` (was `220`, not a multiple of `GRID_SNAP`) — every layout constant is now grid-aligned.
- A Frame's label is now a rounded corner badge straddling the top border (`CanvasNode.tsx`, `DragOverlayPreview.tsx`), reading as an "AWS Group" rather than a header row identical to a Card's. This needed **no `layout.ts` size-math changes** — the badge's overlap into the box stays within the existing `FRAME_PADDING` already reserved for first-child placement, which was the deciding factor over a full-width header bar (that alternative would have needed a new reserved-height constant threaded through both `computeNodeSize` and `computeDragPreviewSize` to stay in sync).
- A Card's whole tile is now its own drag handle (draggable + droppable refs merged onto one element) rather than a small label span — its remove button is a corner overlay with `onPointerDown` stopPropagation so a click never gets read as a drag-start.
- 356 tests unchanged in count (all pass symbolically against the imported size constants — only `DragOverlayPreview.test.tsx`'s hardcoded literal sizes needed fixing to import the real constants, closing a silent-staleness risk). Verified visually in a real headless-Chromium session.

### v0.3.4 - Modular Placement Grid & Gutters (Completed)
**Goal**: Turn v0.3.1's overlap-triggered auto-snap into a real modular placement system — every placement lands on a predictable lattice, with a guaranteed minimum gutter between elements. Decision captured in [ADR-0004](adr/0004-modular-placement-grid-and-gutters.md); no full SpecKit spec/tasks cycle, same weight as ADR-0003.

- Every drop — not just overlap recovery — now snaps to a 16px grid (`snapToGrid`, stepping by `FRAME_PADDING`), replacing the old fine 8px `GRID_SNAP`/`snapToGrid`. An initial version tied the snap step to `CARD_SIZE` (`MODULE_STEP` = 80px) — hands-on testing showed that felt rigid, so the step was decoupled from `CARD_SIZE` entirely and revised down to 16px before this milestone was committed.
- New `hasClearance` enforces a minimum `FRAME_PADDING` (16px) gutter between siblings, independent of the snap-step size — reused as one spacing constant for multiple roles (a Frame's own border inset, inter-sibling clearance, and now the placement-grid step) rather than several same-valued constants. `findFreePosition`'s existing ring search (from ADR-0003) steps by `FRAME_PADDING` and requires clearance, not just non-overlap.
- `findFreePosition` gained a `minPosition` parameter (generalizing its existing "never negative" floor) so a child placed into a real Frame stays at least `FRAME_PADDING` clear of the Frame's own border and corner badge — the initial version allowed `(0, 0)`, which visually overlapped both. The Canvas root keeps its original `{0, 0}` floor.
- Keyboard placement (`KeyboardPlacement.tsx`) now shares the exact same `findFreePosition` call the drag paths use, including the same interior-padding floor — its old bespoke diagonal cascade (`defaultPositionForKeyboardPlacement`, removed) had no collision check at all, a premise this milestone invalidated. One placement algorithm for both input methods.
- No new landing-slot/placeholder visual was added — the v0.3.1 ghost outline (a Frame's own growth preview) is a different, untouched concept; the cursor-following Drag Overlay (v0.3.2) stays the only landing feedback, by explicit choice.
- 362 passing tests (up from 357). Verified in a real headless-Chromium session: scattered drops land on the finer 16px grid with real positioning freedom, near-neighbor drops keep a visible gutter, a Card dropped into an empty Frame lands inset from the border/badge rather than flush against it, keyboard-placed items land distinct and gutter-respecting, and the ghost preview/no-placeholder behavior is unchanged.

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

**Persistence — per-Challenge scoped localStorage** (`src/state/persistence.ts`). Key format: `` `architecture-canvas:session:${challengeId}` ``. Stored envelope: `{ version: SESSION_VERSION, challengeId, canvasTree, revealedCategories, layout }` — `layout` and the `1 → 2` version bump added by ADR-0002 (below); envelope shape as of that ADR is current. Validation is strictly all-or-nothing: a version mismatch, a `challengeId` mismatch, or any structurally invalid node/category (e.g. a `serviceId` no longer in the Challenge's catalog) discards the whole envelope and starts clean — there is no partial repair or migration. The `challengeId` is checked even though it's embedded in the key name, specifically to guard against Challenge #1 and #2's overlapping Service ids (`vpc`, `rds`, `internet-gateway`, ...) ever letting one Challenge's tree be silently accepted as another's. **Evaluation is never persisted** (FR-034) — a restored session always starts with no results shown. `clearSession(challengeId)` does a hard `localStorage.removeItem`, called from `Header.tsx`'s Back-to-Catalog handler, so leaving a Challenge wipes its in-progress session by design (persistence is a refresh safety-net, not a resume-later feature). Every persistence function swallows storage errors silently — private browsing / disabled storage degrades to "no persistence," never an error UI.

**Challenge data shape & Registry**. `Challenge` (`src/domain/types.ts`): `id, title, description, visibleRequirements, hiddenRequirementCategories, services, rules, difficulty, tags, shortDescription`. `Rule` is a discriminated union — `PresenceRule | ContainmentRule` (`kind: 'presence' | 'containment'`) — checked exhaustively in the evaluator, so a new Rule kind can't compile silently unhandled. The Registry (`src/challenges/index.ts`) is a static, eagerly-imported `challengeRegistry: readonly Challenge[]` in authorial order, plus `getChallengeById(id)` returning `undefined` on a miss — that `undefined` is the deliberate signal `App.tsx` uses to fall back to the Catalog Page, not an error case.

**ADR-0002 — 2D Spatial Canvas Blocks** (2026-09-08, Accepted). Redesigns the Canvas from nested-list rendering into AWS Application Composer-style 2D blocks: Frames (VPC, subnets) that auto-size to their children, compact Cards (EC2, RDS, ALB) for leaves, chosen via a new `Service.renderKind: 'frame' | 'card'` field. Containment stays the `children` array — Layout (position/size) is presentation-only, kept in a new state-layer map rather than on the domain `Node` type, so the evaluator and Domain Purity are untouched. Free placement with grid-snap, fixed viewport (no pan/zoom in v0.3.0), Layout persisted alongside the Canvas Tree. A Node with children always renders as a Frame regardless of `renderKind`, preserving FR-012's "any node may contain any other" with no new restriction. Terminology (Frame/Card/Layout) is canonical per `CONTEXT.md`; "container" stays reserved for this domain's real AWS/Docker sense. Full text: `docs/adr/0002-2d-spatial-canvas-blocks.md`.

**ADR-0003 — Auto-snap to nearest free slot on overlap** (2026-09-09, Accepted). Direct drags now auto-snap to the nearest non-overlapping grid-aligned slot rather than landing exactly where released — reverses `FR-010`/ADR-0002 decision 4's "never blocks a drop for overlap" for the direct-drag case specifically. Deliberately narrow: Frame-auto-resize-triggered overlap is excluded and stays exactly as the v0.3.0 `/speckit-clarify` session left it (accepted, never nudged) — extending the fix there would mean re-running the search reactively on every tree change, not just on drop. Algorithm is a bounded expanding-ring grid search (`findFreePosition` in `src/state/layout.ts`), never searching forever and never repositioning anything but the single dropped/moved Node. Co-shipped alongside two non-ADR items in the same v0.3.1 pass: a `collision.ts` fix excluding a dragged Node's own droppable from candidates (was silently blocking small in-place drags), and a new ephemeral `DragPreviewContext` ghost-outline hover preview. Full text: `docs/adr/0003-auto-snap-overlap-on-drop.md`.

**ADR-0004 — Modular placement grid and gutters** (2026-09-09, Accepted). Generalizes ADR-0003's overlap-triggered auto-snap: every placement (not just overlap recovery) snaps to a fine `FRAME_PADDING`-based grid (16px, `snapToGrid`), and a minimum `FRAME_PADDING`-sized gutter (`hasClearance`) is enforced between siblings — deliberately decoupled from each other and from `CARD_SIZE`, after an initial 80px-step version (tying the snap grid to `CARD_SIZE`) proved too rigid in hands-on testing. `findFreePosition` also gained a `minPosition` floor (default `{0,0}`) so placing into a Frame keeps children clear of its own border/badge (`{FRAME_PADDING, FRAME_PADDING}`), generalizing the function's prior hardcoded "never negative" rule. One placement algorithm (`findFreePosition`) serves both pointer drags and keyboard placement, replacing keyboard placement's old collision-blind diagonal cascade. Old `GRID_SNAP`/`snapToGrid` (the pre-v0.3.4 8px version) removed as no longer load-bearing; the `snapToGrid` name is reused for the new function. Same "direct placement only" boundary as ADR-0003 — Frame-auto-resize-triggered growth still isn't gutter-checked against siblings. No new landing-slot preview added; the v0.3.1 ghost outline (Frame-growth preview) and v0.3.2 Drag Overlay are unchanged and remain the only drag-time feedback. Full text: `docs/adr/0004-modular-placement-grid-and-gutters.md`.

**See also** — settled specs this doc intentionally doesn't restate: `docs/pages-ux/01-TASK-PAGE.md` (scoring formula, direct-child-only containment, existential Rules, stale-evaluation marking), `docs/pages-ux/02-CATALOG-PAGE.md` (card contents, Registry-order display, no dedicated 404), and the agent-process docs `docs/agents/domain.md` and `docs/agents/issue-tracker.md`.

## 4. Backlog
- High-level backlog items and future enhancements are tracked in `docs/03-BACKLOG.md`.