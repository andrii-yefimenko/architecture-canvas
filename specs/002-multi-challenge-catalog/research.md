# Phase 0 Research: Multi-Challenge Catalog & Challenge #2

The feature specification carries **zero `[NEEDS CLARIFICATION]` markers**. Every ambiguity that would ordinarily surface here — routing approach, persistence key scoping, whether a new Rule kind is needed, Challenge #2's distractor Services, and how to treat `MVP.md` now that a second Challenge exists — was resolved in a `grill-with-docs` audit and a brainstorming round earlier in the same conversation, before this spec was written, and recorded in `docs/04-TECH-STACK.md`, `docs/pages-ux/01-TASK-PAGE.md`, `docs/pages-ux/02-CATALOG-PAGE.md`, and `docs/03-BACKLOG.md`. What follows restates those decisions in Decision/Rationale/Alternatives form and adds the few concrete implementation-pattern findings needed to move into Phase 1 design.

## Routing

**Decision**: A single hand-rolled `useRoute()` hook — reads `window.location.pathname`, exposes the two possible route shapes (`{ page: 'catalog' }` or `{ page: 'task', challengeId }`), navigates via `history.pushState` (no full page reload), and re-renders on a `popstate` listener so the browser's native back/forward controls work.

**Rationale**: The app has exactly two page shapes. `docs/04-TECH-STACK.md` already rejected a routing library for this scope, for the same reason `useReducer` beat an external state library at MVP scale: no dependency until the built-in tools stop being enough.

**Alternatives considered**: React Router — rejected for now as ceremony disproportionate to two routes; noted in `docs/04-TECH-STACK.md` as the fallback if the page count grows.

**Implementation-pattern finding**: `nginx.conf` already serves `try_files $uri $uri/ /index.html;` for every unmatched path (added in Phase 1 of the original MVP for exactly this reason). A deep link to `/challenge/challenge-02` followed by a hard refresh already resolves to `index.html` with no server-side change required — the router only needs to read `window.location.pathname` on mount, not coordinate with nginx.

## Persistence key scoping

**Decision**: One `localStorage` key per Challenge, `` `architecture-canvas:session:${challengeId}` ``, holding `{ version, challengeId, canvasTree, revealedCategories }`. On load, both the key's presence *and* the envelope's `challengeId` field are checked against the requested Challenge before the stored data is trusted.

**Rationale**: The existing single-key scheme (`architecture-canvas:session`) was written when one Challenge existed and has no Challenge-scoping at all. Challenge #1 and Challenge #2 already share catalog ids (`vpc`, `rds`, `internet-gateway`, `nat-gateway`) — the existing `isValidNode` structural check in `src/state/persistence.ts` would happily accept Challenge #1's stored tree as Challenge #2's, since it only resolves each `serviceId` against the *current* Challenge's catalog and never checks which Challenge produced the data. The redundant `challengeId` field is what closes that gap; the key alone isn't sufficient on its own if the key format is ever miscomputed, so the belt-and-suspenders check costs one field.

**Alternatives considered**: A single key holding a `{ [challengeId]: PersistedSession }` map — rejected because it reintroduces the exact multi-key partial-restore risk `src/state/persistence.ts`'s original design note explicitly avoided ("splitting across several keys multiplies the partial-restore failure modes"); one key per Challenge keeps that same one-envelope-at-a-time guarantee, just parameterized.

**Migration note**: Bumping nothing about `SESSION_VERSION` semantics — the pre-existing flat `architecture-canvas:session` key simply stops being read once `loadSession` starts computing a challenge-scoped key, and browsers don't clean up orphaned keys automatically. This is accepted as-is (same "discard beats migrate" philosophy the original persistence design already documents); not worth a cleanup routine for a few kilobytes of orphaned MVP-era data.

## Challenge Registry

**Decision**: `src/challenges/index.ts` exports `challengeRegistry: readonly Challenge[] = [challenge01, challenge02]` (eager imports, Registry order = array order = authorial order per `CONTEXT.md`) plus a pure `getChallengeById(id: ChallengeId): Challenge | undefined` helper.

**Rationale**: Two Challenges, no code-splitting need, no dynamic content source — a plain array is the simplest thing that satisfies FR-001 (fixed authorial order) and FR-004/FR-005 (lookup by id, undefined on miss is what lets the caller fall back to the Catalog Page). Stays framework-free, so it remains inside the domain-purity boundary alongside `src/challenges/challenge-01.ts` and `challenge-02.ts`.

**Alternatives considered**: A `Map<ChallengeId, Challenge>` — rejected; a `readonly Challenge[]` already gives Registry order for free (a `Map`'s iteration order is insertion order too, but an array is the more direct fit for "the Catalog Page lists these in order").

## Challenge #2 evaluator coverage

**Decision**: No new Rule kind. Challenge #2's 9 Rules (`docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`) are entirely `presence` and `containment`, the two kinds `src/domain/evaluator.ts` already implements. The two "must not exist" rules originally drafted for this Challenge were removed rather than added as a new Rule kind (recorded in `docs/03-BACKLOG.md`'s resolution log).

**Rationale**: Confirmed by re-reading `evaluateRule` in `src/domain/evaluator.ts` against every line of Challenge #2's Evaluation Rules section — each one is either "X must exist" or "X must be inside Y," both already handled. This means Phase 1 design touches `src/challenges/` and `src/state/`, but **not** `src/domain/`.

**Alternatives considered**: N/A — this was a verification step, not a design choice.

## Page composition

**Decision**: The current `Workspace` function inside `src/App.tsx` becomes `src/pages/TaskPage.tsx`, taking a `challenge: Challenge` prop and rendering the existing three-panel layout unchanged. A new `src/pages/CatalogPage.tsx` renders one `ChallengeCard` (`src/components/catalog/ChallengeCard.tsx`) per entry in `challengeRegistry`. `App.tsx` becomes a thin switch on `useRoute()`'s result: Catalog Page, Task Page for a known Challenge ID, or a redirect-in-place to the Catalog Page for an unknown one.

**Rationale**: `SessionProvider` already accepts an optional `challenge` prop defaulting to `challenge01` (confirmed by reading `src/state/SessionProvider.tsx`) — the session/reducer layer was already Challenge-parametric before this feature existed. The only genuinely new plumbing is *which* Challenge gets passed in, driven by the route instead of a hardcoded default.

**Alternatives considered**: N/A — this follows directly from the existing code shape rather than choosing between options.
