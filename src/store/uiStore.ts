/**
 * UI Store - Manages TUI state and user interactions
 *
 * This store tracks the current view, focus state, mode, and other
 * UI-specific state for the Ralph Terminal User Interface.
 */

import { create } from 'zustand';

/**
 * Available views in the TUI
 */
export type ViewType = 'plan' | 'tasks' | 'diff' | 'branches' | 'help';

/**
 * Focus areas within the UI
 */
export type FocusType = 'main' | 'sidebar' | 'input';

/**
 * UI modes
 */
export type UIMode = 'view' | 'edit' | 'review';

/**
 * Key hint for display
 */
export interface KeyHint {
  /** Key to press */
  key: string;

  /** Description of what it does */
  description: string;
}

/**
 * UI state interface
 */
export interface UIState {
  /** Current active view */
  currentView: ViewType;

  /** Current focus area */
  focus: FocusType;

  /** Current UI mode */
  mode: UIMode;

  /** Currently selected commit hash for review */
  selectedCommit: string | null;

  /** Currently selected line in diff */
  selectedLine: number | null;

  /** Contextual key hints to display */
  keyHints: KeyHint[];

  /** Terminal dimensions */
  dimensions: {
    /** Terminal rows */
    rows: number;

    /** Terminal columns */
    columns: number;
  };

  /** Whether to show help overlay */
  showHelp: boolean;

  /** Notification message */
  notification: {
    /** Message text */
    message: string;

    /** Notification type */
    type: 'info' | 'success' | 'warning' | 'error';

    /** Whether to auto-dismiss */
    autoDismiss: boolean;

    /** Timestamp */
    timestamp: Date;
  } | null;

  /** Loading overlay message */
  loadingMessage: string | null;

  /** Current input value */
  inputValue: string;

  /** Input prompt placeholder */
  inputPlaceholder: string;

  /** Whether input is disabled */
  inputDisabled: boolean;
}

/**
 * UI store actions
 */
export interface UIActions {
  /** Set current view */
  setCurrentView: (view: ViewType) => void;

  /** Set focus */
  setFocus: (focus: FocusType) => void;

  /** Set mode */
  setMode: (mode: UIMode) => void;

  /** Set selected commit */
  setSelectedCommit: (commitHash: string | null) => void;

  /** Set selected line */
  setSelectedLine: (line: number | null) => void;

  /** Set key hints */
  setKeyHints: (hints: KeyHint[]) => void;

  /** Update terminal dimensions */
  updateDimensions: (rows: number, columns: number) => void;

  /** Toggle help overlay */
  toggleHelp: () => void;

  /** Show notification */
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    autoDismiss?: boolean
  ) => void;

  /** Clear notification */
  clearNotification: () => void;

  /** Set loading message */
  setLoading: (message: string | null) => void;

  /** Set input value */
  setInputValue: (value: string) => void;

  /** Set input placeholder */
  setInputPlaceholder: (placeholder: string) => void;

  /** Set input disabled state */
  setInputDisabled: (disabled: boolean) => void;

  /** Clear input */
  clearInput: () => void;

  /** Reset UI state */
  resetUI: () => void;
}

/**
 * Initial UI state
 */
const initialState: UIState = {
  currentView: 'plan',
  focus: 'main',
  mode: 'view',
  selectedCommit: null,
  selectedLine: null,
  keyHints: [],
  dimensions: {
    rows: 24,
    columns: 80,
  },
  showHelp: false,
  notification: null,
  loadingMessage: null,
  inputValue: '',
  inputPlaceholder: '',
  inputDisabled: false,
};

/**
 * UI store type
 */
export type UIStore = UIState & UIActions;

/**
 * UI store - manages TUI state
 */
export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  setCurrentView: (view) => set({ currentView: view }),

  setFocus: (focus) => set({ focus }),

  setMode: (mode) => set({ mode }),

  setSelectedCommit: (commitHash) => set({ selectedCommit: commitHash }),

  setSelectedLine: (line) => set({ selectedLine: line }),

  setKeyHints: (hints) => set({ keyHints: hints }),

  updateDimensions: (rows, columns) =>
    set({
      dimensions: { rows, columns },
    }),

  toggleHelp: () =>
    set((state) => ({
      showHelp: !state.showHelp,
    })),

  showNotification: (message, type, autoDismiss = true) =>
    set({
      notification: {
        message,
        type,
        autoDismiss,
        timestamp: new Date(),
      },
    }),

  clearNotification: () => set({ notification: null }),

  setLoading: (message) => set({ loadingMessage: message }),

  setInputValue: (value) => set({ inputValue: value }),

  setInputPlaceholder: (placeholder) => set({ inputPlaceholder: placeholder }),

  setInputDisabled: (disabled) => set({ inputDisabled: disabled }),

  clearInput: () =>
    set({
      inputValue: '',
      inputPlaceholder: '',
    }),

  resetUI: () => set(initialState),
}));
