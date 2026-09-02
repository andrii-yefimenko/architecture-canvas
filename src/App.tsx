import { getChallengeById } from '@/challenges';
import { CatalogPage } from '@/pages/CatalogPage';
import { TaskPage } from '@/pages/TaskPage';
import type { SessionState } from '@/state/session-reducer';
import { useRoute } from '@/routing/useRoute';

/**
 * The app's entire routing decision, per
 * specs/002-multi-challenge-catalog/contracts/routing.md: Catalog Page at
 * `/`, Task Page at `/challenge/:id` for a Challenge ID that resolves in the
 * Challenge Registry, Catalog Page as the fallback for one that doesn't
 * (FR-005).
 *
 * `initialState` is passed through to `TaskPage` untouched — it exists purely
 * so tests can seed a built Canvas Tree without simulating drags, which jsdom
 * cannot measure (see SessionProvider.tsx). It has no effect on the Catalog
 * Page.
 */
export function App({ initialState }: { readonly initialState?: SessionState }) {
  const { route, navigate } = useRoute();

  if (route.page === 'catalog') {
    return <CatalogPage navigate={navigate} />;
  }

  const challenge = getChallengeById(route.challengeId);
  if (!challenge) {
    return <CatalogPage navigate={navigate} />;
  }

  return (
    <TaskPage
      challenge={challenge}
      navigate={navigate}
      {...(initialState ? { initialState } : {})}
    />
  );
}
