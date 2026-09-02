# Technical Stack Decisions

Settled 2026-08-30, ahead of writing the SpecKit specification. Each entry records the choice and why it beat the alternatives.

The MVP is a **frontend-only single-page application**. There is no backend service — see [`adr/0001-client-side-validation-engine.md`](adr/0001-client-side-validation-engine.md).

## Stack

| Concern | Choice |
|---|---|
| Framework | React |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Drag and drop | dnd-kit |
| State | `useReducer` + Context (no external state library) |
| Routing | Hand-rolled `useRoute()` hook (`window.location.pathname` + `history.pushState`/`popstate`); no routing library |
| Testing | Vitest + React Testing Library |
| Container | Multi-stage Docker → static nginx on :3000 |
| Challenge data | Typed TypeScript modules, collected into a static Challenge Registry |

## Rationale

**React** — has the strongest ecosystem for the nested-container drag-and-drop this MVP needs, and is the most legible choice for the cloud/DevOps audience identified in `01-RESEARCH.md` if the repo doubles as a portfolio piece. Svelte and Vue were both viable; React won on drag-and-drop library maturity.

**TypeScript** — the evaluator compares a canvas tree against a typed rules array. That's precisely where a wrong shape or a misspelled service id fails silently as an incorrect score rather than loudly as an error. The `"Backend EC2"` vs `"EC2 (Backend)"` drift found during the doc audit is exactly the class of bug types prevent.

**Vite** — the standard toolchain for React + TypeScript + Tailwind. No competing consideration.

**Tailwind CSS** — fastest route to the clean, uncluttered UI `PROJECT.md` calls for, and keeps depth styling for nested containers readable inline. CSS Modules was the runner-up.

**dnd-kit** — TypeScript-first, actively maintained, and handles nested droppable containers without the HTML5 Drag and Drop API's dragenter/dragleave bubbling problems. Ships keyboard accessibility, which matters for a learning tool. The native API and react-dnd were both rejected as more hand-work for a worse result.

**`useReducer` + Context** — one screen, and the canvas mutations (add, move subtree, cascade delete) are naturally reducer actions. An external state library would be unearned weight at this size.

**Vitest, evaluator-focused** — exhaustive unit tests on the rule evaluator, which is a pure function, carries the highest bug cost, and covers the decided edge cases (empty canvas scoring 0, duplicate nodes, direct-child-only matching). Plus a small number of React Testing Library tests for the drop → submit → score flow. Drag-simulation E2E was rejected as slow and flaky for a one-challenge MVP.

**Multi-stage Docker → nginx** — builds the SPA in a Node stage and serves the static output from nginx. Small image, production-realistic, and honors the `docker compose up --build -d` → `localhost:3000` flow README already documents.

**Typed TypeScript challenge modules** — each Challenge (`challenges/challenge-01.ts`, `challenge-02.ts`, ...) exports a typed `Challenge` object (description, visible and hidden requirements, service catalog, rules). Gives compile-time safety on rule → service-id references, and the shape is unchanged if challenges are later fetched as JSON.

**Hand-rolled routing** — the app has exactly two page shapes (Catalog Page at `/`, Task Page at `/challenge/:id`), so a small `useRoute()` hook reading `window.location.pathname` and navigating via `history.pushState`/`popstate` covers it without a dependency. Same reasoning as `useReducer` over an external state library: no external tool until the built-in ones stop being enough. React Router is the fallback if the page count grows enough to make route matching, nested layouts, or programmatic navigation hand-rolling error-prone.

**Static Challenge Registry** — `src/challenges/index.ts` exports `challengeRegistry: readonly Challenge[]` (all Challenge modules eagerly imported) plus a pure `getChallengeById(id)` lookup. Framework-free, so it stays part of the domain-purity boundary. Eager import over lazy-loading because the bundle is small and there's no code-splitting need yet.

## Explicitly rejected

**Node-graph libraries (React Flow and similar).** `MVP.md` specifies a hierarchical tree of nested containers with *no edges* — relationships are parent-child, not connections. Graph libraries are built around edges and free XY positioning, which is the wrong model here. The canvas is nested DOM containers.

**A backend service.** See the ADR. Validation is client-side against a hardcoded rules array, matching what `MVP.md` already described.
