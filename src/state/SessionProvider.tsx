import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { challenge01 } from '@/challenges/challenge-01';
import type { Challenge } from '@/domain/types';
import { loadSession, saveSession } from './persistence';
import { SessionContext } from './session-context';
import { initialSessionState, sessionReducer, type SessionState } from './session-reducer';

interface SessionProviderProps {
  readonly children: ReactNode;
  /** Overridable so tests can supply a fixture Challenge. */
  readonly challenge?: Challenge;
  /**
   * Seeds the reducer instead of starting empty or restoring from storage.
   *
   * Lets tests start from a built Canvas Tree without simulating drags, which
   * jsdom cannot measure. When provided, storage is not read.
   */
  readonly initialState?: SessionState;
}

/**
 * Builds the starting state: an explicit seed if given, otherwise a validated
 * persisted session, otherwise empty.
 *
 * Runs inside useReducer's lazy initialiser so the restore happens before the
 * first paint — the user never sees an empty Canvas flash before their work
 * reappears.
 *
 * A restored session carries no Evaluation (FR-034), which falls out of
 * initialSessionState rather than needing special handling.
 */
function buildInitialState(challenge: Challenge, seed: SessionState | undefined): SessionState {
  if (seed) return seed;

  const restored = loadSession(challenge);
  if (!restored) return initialSessionState();

  return {
    ...initialSessionState(),
    canvasTree: restored.canvasTree,
    revealedCategories: [...restored.revealedCategories],
  };
}

export function SessionProvider({
  children,
  challenge = challenge01,
  initialState,
}: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialState, (seed) =>
    buildInitialState(challenge, seed),
  );

  // Skip the write triggered by the very first render: it would rewrite exactly
  // what was just read, and on a fresh session would create a key holding
  // nothing.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    // The Evaluation is deliberately not persisted (FR-034); saveSession takes
    // only the two fields that are.
    saveSession({
      canvasTree: state.canvasTree,
      revealedCategories: state.revealedCategories,
    });
  }, [state.canvasTree, state.revealedCategories]);

  const value = useMemo(() => ({ state, dispatch, challenge }), [state, challenge]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
