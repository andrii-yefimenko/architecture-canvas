import { useMemo, useReducer, type ReactNode } from 'react';
import { challenge01 } from '@/challenges/challenge-01';
import type { Challenge } from '@/domain/types';
import { SessionContext } from './session-context';
import { initialSessionState, sessionReducer } from './session-reducer';

interface SessionProviderProps {
  readonly children: ReactNode;
  /** Overridable so tests can supply a fixture Challenge. */
  readonly challenge?: Challenge;
}

export function SessionProvider({ children, challenge = challenge01 }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialSessionState);

  // Persistence restore (RESTORE dispatch) is wired in T052, Phase 6.
  const value = useMemo(() => ({ state, dispatch, challenge }), [state, challenge]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
