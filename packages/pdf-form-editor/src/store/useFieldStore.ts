import { create } from 'zustand'
import { produceWithPatches, applyPatches } from 'immer'
import { HistoryStack } from './history'
import type { Field, FieldState, TextOverlay } from './types'

const history = new HistoryStack(100)

interface UpdateOpts {
  undoable?: boolean
}

interface FieldStore extends FieldState {
  // Field operations
  addField: (field: Field, opts?: UpdateOpts) => void
  updateField: (id: string, patch: Partial<Field>, opts?: UpdateOpts) => void
  deleteField: (id: string) => void

  // Text overlay operations
  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  deleteTextOverlay: (id: string) => void

  // Selection
  selectField: (id: string | null) => void
  selectText: (id: string | null) => void

  // History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Bulk
  clearAll: () => void
  getField: (id: string) => Field | undefined
}

export const useFieldStore = create<FieldStore>((set, get) => ({
  fields: {},
  textOverlays: {},
  selectedId: null,
  selectedType: null,

  addField: (field, opts = { undoable: true }) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        draft.fields[field.id] = field
      })
      if (opts.undoable !== false) history.push(patches, inversePatches)
      return nextState
    })
  },

  updateField: (id, patch, opts = { undoable: true }) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        if (draft.fields[id]) Object.assign(draft.fields[id], patch)
      })
      if (opts.undoable !== false) history.push(patches, inversePatches)
      return nextState
    })
  },

  deleteField: (id) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        delete draft.fields[id]
        if (draft.selectedId === id) {
          draft.selectedId = null
          draft.selectedType = null
        }
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  addTextOverlay: (overlay) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        draft.textOverlays[overlay.id] = overlay
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  updateTextOverlay: (id, patch) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        if (draft.textOverlays[id]) Object.assign(draft.textOverlays[id], patch)
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  deleteTextOverlay: (id) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        delete draft.textOverlays[id]
        if (draft.selectedId === id) {
          draft.selectedId = null
          draft.selectedType = null
        }
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  selectField: (id) => set({ selectedId: id, selectedType: id ? 'field' : null }),
  selectText:  (id) => set({ selectedId: id, selectedType: id ? 'text'  : null }),

  undo: () => {
    const patches = history.undo()
    if (patches) set(state => applyPatches(state, patches))
  },

  redo: () => {
    const patches = history.redo()
    if (patches) set(state => applyPatches(state, patches))
  },

  canUndo: () => history.canUndo,
  canRedo: () => history.canRedo,

  clearAll: () => {
    set({ fields: {}, textOverlays: {}, selectedId: null, selectedType: null })
    history.clear()
  },

  getField: (id) => get().fields[id],
}))
