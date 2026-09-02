import { useCallback, useEffect, useState } from 'react';

/**
 * The app's entire route space: two shapes only. See
 * specs/002-multi-challenge-catalog/contracts/routing.md and
 * data-model.md#route.
 */
export type Route = { readonly page: 'catalog' } | { readonly page: 'task'; readonly challengeId: string };

function parseRoute(pathname: string): Route {
  const match = /^\/challenge\/([^/]+)\/?$/.exec(pathname);
  if (match) {
    return { page: 'task', challengeId: decodeURIComponent(match[1]!) };
  }
  return { page: 'catalog' };
}

export interface UseRouteResult {
  readonly route: Route;
  /** Pushes a new URL and updates `route` — no full page reload. */
  readonly navigate: (path: string) => void;
}

/**
 * The app's entire router. A hook, not a component tree — there is exactly
 * one call site (App.tsx), so no <Router>/<Route> composition is needed.
 *
 * Whether `route.challengeId` (when present) actually resolves in the
 * Challenge Registry is not this hook's concern — that check, and the
 * fallback to the Catalog Page on a miss, belongs to the consumer (FR-005).
 */
export function useRoute(): UseRouteResult {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  }, []);

  return { route, navigate };
}
