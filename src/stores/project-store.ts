import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Domain types — inline until @/types/domain is created
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CommandDef {
  id: string
  name: string
  description?: string
  parameters: Record<string, unknown>
  returnType?: string
}

export interface EventDef {
  id: string
  name: string
  description?: string
  payload: Record<string, unknown>
}

export interface TypeDef {
  id: string
  name: string
  kind: 'struct' | 'enum' | 'union' | 'alias'
  fields: Record<string, unknown>
}

export interface ApiSchema {
  id: string
  projectId: string
  name: string
  version: string
  commands: CommandDef[]
  events: EventDef[]
  typeDefs: TypeDef[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Store state and actions
// ---------------------------------------------------------------------------

interface ProjectState {
  // Data
  currentProject: Project | null
  currentSchema: ApiSchema | null
  schemas: ApiSchema[]

  // Loading
  isLoadingProject: boolean
  isLoadingSchema: boolean
  isLoadingSchemas: boolean

  // Dirty tracking
  hasUnsavedChanges: boolean

  // Project actions
  setProject: (project: Project | null) => void

  // Schema actions
  setSchema: (schema: ApiSchema | null) => void
  updateSchema: (updates: Partial<Omit<ApiSchema, 'id' | 'projectId'>>) => void
  setSchemas: (schemas: ApiSchema[]) => void

  // Command actions
  addCommand: (command: CommandDef) => void
  updateCommand: (id: string, updates: Partial<CommandDef>) => void
  removeCommand: (id: string) => void

  // Event actions
  addEvent: (event: EventDef) => void
  updateEvent: (id: string, updates: Partial<EventDef>) => void
  removeEvent: (id: string) => void

  // TypeDef actions
  addTypeDef: (typeDef: TypeDef) => void
  updateTypeDef: (id: string, updates: Partial<TypeDef>) => void
  removeTypeDef: (id: string) => void

  // Loading state actions
  setLoadingProject: (loading: boolean) => void
  setLoadingSchema: (loading: boolean) => void
  setLoadingSchemas: (loading: boolean) => void

  // Dirty tracking
  markClean: () => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useProjectStore = create<ProjectState>()((set) => ({
  // Initial state
  currentProject: null,
  currentSchema: null,
  schemas: [],
  isLoadingProject: false,
  isLoadingSchema: false,
  isLoadingSchemas: false,
  hasUnsavedChanges: false,

  // Project actions
  setProject: (project) =>
    set({ currentProject: project, hasUnsavedChanges: false }),

  // Schema actions
  setSchema: (schema) =>
    set({ currentSchema: schema, hasUnsavedChanges: false }),

  updateSchema: (updates) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: { ...state.currentSchema, ...updates },
        hasUnsavedChanges: true,
      }
    }),

  setSchemas: (schemas) => set({ schemas }),

  // Command actions
  addCommand: (command) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          commands: [...state.currentSchema.commands, command],
        },
        hasUnsavedChanges: true,
      }
    }),

  updateCommand: (id, updates) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          commands: state.currentSchema.commands.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        },
        hasUnsavedChanges: true,
      }
    }),

  removeCommand: (id) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          commands: state.currentSchema.commands.filter((c) => c.id !== id),
        },
        hasUnsavedChanges: true,
      }
    }),

  // Event actions
  addEvent: (event) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          events: [...state.currentSchema.events, event],
        },
        hasUnsavedChanges: true,
      }
    }),

  updateEvent: (id, updates) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          events: state.currentSchema.events.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        },
        hasUnsavedChanges: true,
      }
    }),

  removeEvent: (id) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          events: state.currentSchema.events.filter((e) => e.id !== id),
        },
        hasUnsavedChanges: true,
      }
    }),

  // TypeDef actions
  addTypeDef: (typeDef) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          typeDefs: [...state.currentSchema.typeDefs, typeDef],
        },
        hasUnsavedChanges: true,
      }
    }),

  updateTypeDef: (id, updates) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          typeDefs: state.currentSchema.typeDefs.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        },
        hasUnsavedChanges: true,
      }
    }),

  removeTypeDef: (id) =>
    set((state) => {
      if (!state.currentSchema) return state
      return {
        currentSchema: {
          ...state.currentSchema,
          typeDefs: state.currentSchema.typeDefs.filter((t) => t.id !== id),
        },
        hasUnsavedChanges: true,
      }
    }),

  // Loading state actions
  setLoadingProject: (loading) => set({ isLoadingProject: loading }),
  setLoadingSchema: (loading) => set({ isLoadingSchema: loading }),
  setLoadingSchemas: (loading) => set({ isLoadingSchemas: loading }),

  // Dirty tracking
  markClean: () => set({ hasUnsavedChanges: false }),
}))
