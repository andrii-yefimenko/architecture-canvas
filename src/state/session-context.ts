import { createContext, useContext, type Dispatch } from 'react';
import type { Challenge } from '@/domain/types';
import type { SessionAction, SessionState } from './session-reducer';

export interface SessionContextValue {
  readonly state: SessionState;
  readonly dispatch: Dispatch<SessionAction>;
  /** The active Challenge, selected by the current route (`TaskPage`'s `challenge` prop). */
  readonly challenge: Challenge;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return value;
}
