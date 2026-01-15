/**
 * Branch Store - Manages git branch and worktree state
 *
 * This store tracks git branches, worktrees, and their hierarchical
 * relationships for visualization and management in the Ralph TUI.
 */

import { create } from 'zustand';

/**
 * Branch status
 */
export type BranchStatus = 'active' | 'merged' | 'abandoned';

/**
 * Branch information
 */
export interface BranchInfo {
  /** Branch name */
  name: string;

  /** Current commit hash */
  commitHash: string;

  /** Parent branch name */
  parent: string | null;

  /** Whether this is the main branch */
  isMain: boolean;

  /** Branch status */
  status: BranchStatus;

  /** Associated session ID if any */
  sessionId: string | null;

  /** Worktree path if this branch has a worktree */
  worktreePath: string | null;
}

/**
 * Worktree information
 */
export interface WorktreeInfo {
  /** Branch name */
  branchName: string;

  /** Absolute path to worktree */
  path: string;

  /** Whether worktree is currently checked out */
  isCurrent: boolean;

  /** Associated session ID */
  sessionId: string | null;
}

/**
 * Branch tree node for visualization
 */
export interface BranchNode {
  /** Branch name */
  name: string;

  /** Commit hash */
  commitHash: string;

  /** Branch status */
  status: BranchStatus;

  /** Child branches */
  children: BranchNode[];

  /** Depth in tree */
  depth: number;
}

/**
 * Branch state interface
 */
export interface BranchState {
  /** Current branch name */
  currentBranch: string;

  /** Array of all branches */
  branches: BranchInfo[];

  /** Array of all worktrees */
  worktrees: WorktreeInfo[];

  /** Hierarchical branch tree */
  branchTree: BranchNode[];

  /** Currently selected branch */
  selectedBranch: string | null;

  /** Whether branch operations are in progress */
  isLoading: boolean;
}

/**
 * Branch store actions
 */
export interface BranchActions {
  /** Set current branch */
  setCurrentBranch: (branch: string) => void;

  /** Set all branches */
  setBranches: (branches: BranchInfo[]) => void;

  /** Add a branch */
  addBranch: (branch: BranchInfo) => void;

  /** Update a branch */
  updateBranch: (branchName: string, updates: Partial<BranchInfo>) => void;

  /** Remove a branch */
  removeBranch: (branchName: string) => void;

  /** Set all worktrees */
  setWorktrees: (worktrees: WorktreeInfo[]) => void;

  /** Add a worktree */
  addWorktree: (worktree: WorktreeInfo) => void;

  /** Remove a worktree */
  removeWorktree: (branchName: string) => void;

  /** Build branch tree from branches */
  buildBranchTree: () => void;

  /** Set selected branch */
  setSelectedBranch: (branchName: string | null) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Reset branch state */
  resetBranch: () => void;

  /** Get branch by name */
  getBranchByName: (branchName: string) => BranchInfo | null;

  /** Get worktree by branch name */
  getWorktreeByBranch: (branchName: string) => WorktreeInfo | null;
}

/**
 * Initial branch state
 */
const initialState: BranchState = {
  currentBranch: 'main',
  branches: [],
  worktrees: [],
  branchTree: [],
  selectedBranch: null,
  isLoading: false,
};

/**
 * Build hierarchical tree structure from flat branch list
 */
function buildTree(
  branches: BranchInfo[],
  parent: string | null = null,
  depth: number = 0
): BranchNode[] {
  return branches
    .filter((branch) => branch.parent === parent)
    .map((branch) => ({
      name: branch.name,
      commitHash: branch.commitHash,
      status: branch.status,
      children: buildTree(branches, branch.name, depth + 1),
      depth,
    }));
}

/**
 * Branch store type
 */
export type BranchStore = BranchState & BranchActions;

/**
 * Branch store - manages git branch and worktree state
 */
export const useBranchStore = create<BranchStore>((set, get) => ({
  ...initialState,

  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  setBranches: (branches) =>
    set({
      branches,
      branchTree: buildTree(branches),
    }),

  addBranch: (branch) =>
    set((state) => {
      const newBranches = [...state.branches, branch];
      return {
        branches: newBranches,
        branchTree: buildTree(newBranches),
      };
    }),

  updateBranch: (branchName, updates) =>
    set((state) => {
      const newBranches = state.branches.map((branch) =>
        branch.name === branchName ? { ...branch, ...updates } : branch
      );
      return {
        branches: newBranches,
        branchTree: buildTree(newBranches),
      };
    }),

  removeBranch: (branchName) =>
    set((state) => {
      const newBranches = state.branches.filter(
        (branch) => branch.name !== branchName
      );
      return {
        branches: newBranches,
        branchTree: buildTree(newBranches),
      };
    }),

  setWorktrees: (worktrees) => set({ worktrees }),

  addWorktree: (worktree) =>
    set((state) => ({
      worktrees: [...state.worktrees, worktree],
    })),

  removeWorktree: (branchName) =>
    set((state) => ({
      worktrees: state.worktrees.filter(
        (wt) => wt.branchName !== branchName
      ),
    })),

  buildBranchTree: () =>
    set((state) => ({
      branchTree: buildTree(state.branches),
    })),

  setSelectedBranch: (branchName) => set({ selectedBranch: branchName }),

  setLoading: (isLoading) => set({ isLoading }),

  resetBranch: () => set(initialState),

  getBranchByName: (branchName) => {
    const state = get();
    return state.branches.find((b) => b.name === branchName) || null;
  },

  getWorktreeByBranch: (branchName) => {
    const state = get();
    return state.worktrees.find((wt) => wt.branchName === branchName) || null;
  },
}));
