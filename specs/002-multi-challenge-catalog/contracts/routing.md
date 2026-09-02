# Contract: Client-Side Routing

**Module**: `src/routing/` | **Covers**: FR-004, FR-005, FR-006, FR-008

## Route shape

See [data-model.md](../data-model.md#route):

```ts
type Route =
  | { page: 'catalog' }
  | { page: 'task'; challengeId: string };
```

## `useRoute()`

```ts
interface UseRouteResult {
  readonly route: Route;
  readonly navigate: (path: string) => void;
}

function useRoute(): UseRouteResult;
```

`navigate` is returned alongside `route` rather than exported as a free function, since it must update the same `useState` the hook's re-renders are driven by — a module-level `navigate` would have no way to notify the one component subscribed via `useRoute()`. Consumers below reach it via a prop passed down from `App.tsx`, the hook's single call site.

A hook, not a component tree — there is exactly one call site (`App.tsx`), so no `<Router>`/`<Route>` composition is needed.

Behaviour:

1. On mount, parses `window.location.pathname` into a `Route` (see the pathname table in data-model.md).
2. Registers a `popstate` listener so the browser's native back/forward controls re-parse the pathname and trigger a re-render (FR-008).
3. Exposes a `navigate(path: string): void` function that calls `history.pushState(null, '', path)` and updates the hook's own state synchronously — a full page reload never happens on in-app navigation.
4. Cleans up the `popstate` listener on unmount (only relevant to tests; the hook lives for the app's lifetime in production).

## Consumers

- **`ChallengeCard`**'s Start Challenge control calls `navigate(`/challenge/${challenge.id}`)` (FR-004).
- **`Header`**'s Back to Catalog control calls `navigate('/')` (FR-007), and — per the persistence contract — triggers the current Challenge's session clear as part of the same handler, not as a side effect of the route change itself. Routing and persistence are deliberately kept as two separate calls in one handler, not coupled inside `useRoute()`, so the router stays ignorant of persistence.
- **`App.tsx`** reads the `Route` and renders `CatalogPage` for `{ page: 'catalog' }`, or resolves `challengeId` via `getChallengeById` for `{ page: 'task', ... }` — rendering `TaskPage` on a hit, or `CatalogPage` on a miss (FR-005).

## What this contract explicitly does not cover

- Nested routes, layouts, or route parameters beyond a single `challengeId` — out of scope; there are exactly two page shapes (`docs/04-TECH-STACK.md`).
- Server-side rendering or route-based code splitting — the app is a single bundle (per the existing Docker/nginx setup); `nginx.conf`'s SPA fallback is what makes deep links work, not this module.

## Required test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Initial pathname `/` | `{ page: 'catalog' }` |
| 2 | Initial pathname `/challenge/challenge-02` | `{ page: 'task', challengeId: 'challenge-02' }` |
| 3 | Initial pathname `/nonsense` | `{ page: 'catalog' }` |
| 4 | `navigate('/challenge/challenge-01')` called | Route updates synchronously; `history.pushState` invoked; no reload |
| 5 | Simulated `popstate` event after a `pushState` | Route re-parses the new pathname |
| 6 | `challengeId` in the route does not resolve via `getChallengeById` | Consumer (`App.tsx`) renders the Catalog Page, not an error (FR-005) |
