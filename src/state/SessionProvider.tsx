import { useMemo, useReducer, type ReactNode } from 'react';
import { challenge01 } from '@/challenges/challenge-01';
import type { Challenge } from '@/domain/types';
import { SessionContext } from './session-context';
import { initialSessionState, sessionReducer, type SessionState } from './session-reducer';

interface SessionProviderProps {
  readonly children: ReactNode;
  /** Overridable so tests can supply a fixture Challenge. */
  readonly challenge?: Challenge;
  /**
   * Seeds the reducer instead of starting empty.
   *
   * This is the injection seam for restoring a persisted session on load
   * (T052, Phase 6), and it lets tests start from a built Canvas Tree without
   * simulating drags — which jsdom cannot measure anyway.
   */
  readonly initialState?: SessionState;
}

export function SessionProvider({
  children,
  challenge = challenge01,
  initialState,
}: SessionProviderProps) {
  const [state, dispatch] = useReducer(
    sessionReducer,
    initialState,
    (seed) => seed ?? initialSessionState(),
  );

  const value = useMemo(() => ({ state, dispatch, challenge }), [state, challenge]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
