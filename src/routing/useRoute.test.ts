/**
 * See contracts/routing.md in specs/002-multi-challenge-catalog/ for the
 * required test case table this file implements (cases 1-5). Case 6 —
 * "an unresolved challengeId falls back to the Catalog Page" — is not this
 * hook's concern (see useRoute.ts's docstring) and is covered instead by the
 * User Story 1 integration test that exercises App.tsx.
 */

import { act, renderHook } from '@testing-library/react';
import { useRoute } from './useRoute';

function setPathname(path: string) {
  window.history.pushState(null, '', path);
}

describe('useRoute', () => {
  it('parses an initial pathname of "/" as the Catalog Page (case 1)', () => {
    setPathname('/');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({ page: 'catalog' });
  });

  it('parses "/challenge/challenge-02" as the Task Page route (case 2)', () => {
    setPathname('/challenge/challenge-02');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({ page: 'task', challengeId: 'challenge-02' });
  });

  it('falls back to the Catalog Page for an unrecognized pathname (case 3)', () => {
    setPathname('/nonsense');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({ page: 'catalog' });
  });

  it('navigate() updates the route synchronously via pushState, without a reload (case 4)', () => {
    setPathname('/');
    const { result } = renderHook(() => useRoute());
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    act(() => {
      result.current.navigate('/challenge/challenge-01');
    });

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/challenge/challenge-01');
    expect(window.location.pathname).toBe('/challenge/challenge-01');
    expect(result.current.route).toEqual({ page: 'task', challengeId: 'challenge-01' });

    pushStateSpy.mockRestore();
  });

  it('re-parses the pathname on a popstate event, e.g. the browser back button (case 5)', () => {
    setPathname('/');
    const { result } = renderHook(() => useRoute());

    act(() => {
      result.current.navigate('/challenge/challenge-02');
    });
    expect(result.current.route).toEqual({ page: 'task', challengeId: 'challenge-02' });

    // Simulate the browser's back button: the URL reverts (as the browser
    // itself would do) and fires popstate — navigate() is not involved.
    act(() => {
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.route).toEqual({ page: 'catalog' });
  });

  it('removes its popstate listener on unmount', () => {
    setPathname('/');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useRoute());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    removeSpy.mockRestore();
  });
});
