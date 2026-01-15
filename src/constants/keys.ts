/**
 * Keyboard shortcuts for the Ralph TUI
 *
 * These constants define keyboard shortcuts for different contexts
 * within the Terminal User Interface.
 */

/**
 * Global shortcuts (available in all views)
 */
export const GLOBAL_SHORTCUTS = {
  /** Quit the application */
  QUIT: ['q', 'ctrl+c'],

  /** Show help overlay */
  HELP: ['?', 'f1'],

  /** Toggle between views */
  TOGGLE_VIEW: ['tab'],

  /** Focus input prompt */
  FOCUS_INPUT: ['i'],
} as const;

/**
 * Planning phase shortcuts
 */
export const PLANNING_SHORTCUTS = {
  /** Next step in planning */
  NEXT: ['n'],

  /** Edit current spec/plan */
  EDIT: ['e'],

  /** Delete selected item */
  DELETE: ['d', 'backspace'],

  /** Approve and move to implementation */
  APPROVE: ['ctrl+a'],

  /** Save current changes */
  SAVE: ['ctrl+s'],
} as const;

/**
 * Implementation phase shortcuts
 */
export const IMPLEMENTATION_SHORTCUTS = {
  /** Start/pause task execution */
  TOGGLE_EXECUTION: ['space'],

  /** Create a new fork */
  CREATE_FORK: ['f'],

  /** Switch between branches */
  SWITCH_BRANCH: ['b'],

  /** Skip current task */
  SKIP_TASK: ['s'],
} as const;

/**
 * Review phase shortcuts
 */
export const REVIEW_SHORTCUTS = {
  /** Approve the commit */
  APPROVE: ['a'],

  /** Iterate with feedback */
  ITERATE: ['i'],

  /** Create fork from commit */
  FORK: ['f'],

  /** Add comment to diff */
  COMMENT: ['c'],

  /** Navigate diff */
  NAVIGATE_UP: ['k', 'up'],
  NAVIGATE_DOWN: ['j', 'down'],
  NAVIGATE_TOP: ['g'],
  NAVIGATE_BOTTOM: ['shift+g'],
  PAGE_UP: ['pageup'],
  PAGE_DOWN: ['pagedown'],
} as const;

/**
 * Vim mode shortcuts (optional)
 */
export const VIM_SHORTCUTS = {
  /** Enter normal mode */
  NORMAL_MODE: ['escape'],

  /** Enter insert mode */
  INSERT_MODE: ['i'],

  /** Visual mode */
  VISUAL_MODE: ['v'],

  /** Command mode */
  COMMAND_MODE: [':'],
} as const;
