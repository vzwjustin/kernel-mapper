import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

export type LeftPanelTab = 'explorer' | 'entities' | 'artifacts' | 'validation'
export type RightPanelTab = 'properties' | 'ai' | 'preview'
export type BottomPanelTab = 'logs' | 'trace' | 'warnings' | 'diff'
export type Theme = 'light' | 'dark'

// ---------------------------------------------------------------------------
// Store state and actions
// ---------------------------------------------------------------------------

interface UiState {
  // Panel visibility
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  bottomPanelOpen: boolean

  // Active tabs
  leftPanelTab: LeftPanelTab
  rightPanelTab: RightPanelTab
  bottomPanelTab: BottomPanelTab

  // Theme
  theme: Theme

  // Panel toggle actions
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setBottomPanelOpen: (open: boolean) => void

  // Tab actions
  setLeftPanelTab: (tab: LeftPanelTab) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setBottomPanelTab: (tab: BottomPanelTab) => void

  // Theme action
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useUiStore = create<UiState>()((set) => ({
  // Initial state
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: false,
  leftPanelTab: 'explorer',
  rightPanelTab: 'properties',
  bottomPanelTab: 'logs',
  theme: 'dark',

  // Panel toggle actions
  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  toggleBottomPanel: () =>
    set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),

  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

  // Tab actions
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

  // Theme actions
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}))
