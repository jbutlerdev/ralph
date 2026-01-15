/**
 * Session Store - Manages session and agent execution state
 *
 * This store tracks the current Claude SDK session, execution phase,
 * task progress, and error states for the Ralph TUI Orchestrator.
 */

import { create } from 'zustand';

/**
 * Session phases
 */
export type SessionPhase = 'idle' | 'planning' | 'implementation' | 'review';

/**
 * Session state interface
 */
export interface SessionState {
  /** Current session ID from Claude SDK */
  sessionId: string | null;

  /** Current phase of the orchestration */
  phase: SessionPhase;

  /** Current task ID being executed */
  currentTaskId: string | null;

  /** Whether AI is actively executing */
  isExecuting: boolean;

  /** Last checkpoint ID for recovery */
  lastCheckpoint: string | null;

  /** Current error if any */
  error: Error | null;

  /** Session metadata */
  metadata: {
    /** Session start timestamp */
    startedAt: Date | null;

    /** Last activity timestamp */
    lastActivity: Date | null;

    /** Total tokens used in session */
    totalTokens: number;

    /** Total cost in USD */
    totalCost: number;
  };
}

/**
 * Session store actions
 */
export interface SessionActions {
  /** Set the current session ID */
  setSessionId: (sessionId: string | null) => void;

  /** Set the current phase */
  setPhase: (phase: SessionPhase) => void;

  /** Set the current task being executed */
  setCurrentTaskId: (taskId: string | null) => void;

  /** Set execution state */
  setExecuting: (isExecuting: boolean) => void;

  /** Set last checkpoint ID */
  setLastCheckpoint: (checkpointId: string | null) => void;

  /** Set current error */
  setError: (error: Error | null) => void;

  /** Update session metadata */
  updateMetadata: (updates: Partial<SessionState['metadata']>) => void;

  /** Reset session state */
  resetSession: () => void;

  /** Clear error */
  clearError: () => void;
}

/**
 * Initial session state
 */
const initialState: SessionState = {
  sessionId: null,
  phase: 'idle',
  currentTaskId: null,
  isExecuting: false,
  lastCheckpoint: null,
  error: null,
  metadata: {
    startedAt: null,
    lastActivity: null,
    totalTokens: 0,
    totalCost: 0,
  },
};

/**
 * Session store type
 */
export type SessionStore = SessionState & SessionActions;

/**
 * Session store - manages session and agent state
 */
export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),

  setPhase: (phase) => set({ phase }),

  setCurrentTaskId: (currentTaskId) => set({ currentTaskId }),

  setExecuting: (isExecuting) => set({ isExecuting }),

  setLastCheckpoint: (lastCheckpoint) => set({ lastCheckpoint }),

  setError: (error) => set({ error }),

  updateMetadata: (updates) =>
    set((state) => ({
      metadata: { ...state.metadata, ...updates },
    })),

  resetSession: () => set(initialState),

  clearError: () => set({ error: null }),
}));
