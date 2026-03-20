import { describe, it, expect, beforeEach } from 'vitest'
import { useFieldStore } from '../store/useFieldStore'
import type { Field } from '../store/types'

function makeField(overrides: Partial<Field> = {}): Field {
  return {
    id: overrides.id ?? 'field-1',
    type: 'text',
    pageIdx: 0,
    ptX: 100,
    ptY: 200,
    ptW: 180,
    ptH: 24,
    label: 'Test',
    required: false,
    assignee: '',
    ...overrides,
  }
}

describe('useFieldStore', () => {
  beforeEach(() => {
    useFieldStore.getState().clearAll()
  })

  describe('addField / getField / deleteField', () => {
    it('adds a field', () => {
      const f = makeField()
      useFieldStore.getState().addField(f)
      expect(useFieldStore.getState().fields['field-1']).toEqual(f)
      expect(useFieldStore.getState().getField('field-1')).toEqual(f)
    })

    it('deletes a field', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().deleteField('field-1')
      expect(useFieldStore.getState().fields['field-1']).toBeUndefined()
    })

    it('deselects on delete if selected', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().selectField('field-1')
      useFieldStore.getState().deleteField('field-1')
      expect(useFieldStore.getState().selectedId).toBeNull()
    })
  })

  describe('updateField', () => {
    it('updates field properties', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().updateField('field-1', { label: 'Updated', ptX: 50 })
      const f = useFieldStore.getState().fields['field-1']
      expect(f.label).toBe('Updated')
      expect(f.ptX).toBe(50)
      expect(f.ptY).toBe(200) // unchanged
    })

    it('ignores update for nonexistent field', () => {
      useFieldStore.getState().updateField('nope', { label: 'x' })
      expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(0)
    })
  })

  describe('selection', () => {
    it('selectField sets selectedId and selectedType', () => {
      useFieldStore.getState().selectField('abc')
      expect(useFieldStore.getState().selectedId).toBe('abc')
      expect(useFieldStore.getState().selectedType).toBe('field')
    })

    it('selectField(null) clears selection', () => {
      useFieldStore.getState().selectField('abc')
      useFieldStore.getState().selectField(null)
      expect(useFieldStore.getState().selectedId).toBeNull()
      expect(useFieldStore.getState().selectedType).toBeNull()
    })

    it('selectText sets text type', () => {
      useFieldStore.getState().selectText('txt-1')
      expect(useFieldStore.getState().selectedType).toBe('text')
    })
  })

  describe('undo / redo', () => {
    it('undo reverts addField', () => {
      useFieldStore.getState().addField(makeField())
      expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(1)
      useFieldStore.getState().undo()
      expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(0)
    })

    it('redo re-applies addField', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().undo()
      useFieldStore.getState().redo()
      expect(useFieldStore.getState().fields['field-1']).toBeDefined()
    })

    it('undo reverts updateField', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().updateField('field-1', { label: 'Changed' })
      useFieldStore.getState().undo()
      expect(useFieldStore.getState().fields['field-1'].label).toBe('Test')
    })

    it('undo reverts deleteField', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().deleteField('field-1')
      useFieldStore.getState().undo()
      expect(useFieldStore.getState().fields['field-1']).toBeDefined()
    })

    it('non-undoable operations are not in history', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().updateField('field-1', { label: 'Silent' }, { undoable: false })
      useFieldStore.getState().undo()
      // Undo should revert the addField, not the update
      expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(0)
    })
  })

  describe('textOverlay operations', () => {
    it('adds and deletes text overlays', () => {
      useFieldStore.getState().addTextOverlay({
        id: 'txt-1',
        pageIdx: 0,
        ptX: 50,
        ptY: 100,
        ptW: 200,
        ptH: 20,
        content: 'Hello',
        fontSize: 12,
        fontFamily: 'Helvetica',
        color: '#000000',
      })
      expect(useFieldStore.getState().textOverlays['txt-1']).toBeDefined()
      useFieldStore.getState().deleteTextOverlay('txt-1')
      expect(useFieldStore.getState().textOverlays['txt-1']).toBeUndefined()
    })
  })

  describe('clearAll', () => {
    it('resets all state', () => {
      useFieldStore.getState().addField(makeField())
      useFieldStore.getState().selectField('field-1')
      useFieldStore.getState().clearAll()
      expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(0)
      expect(useFieldStore.getState().selectedId).toBeNull()
    })
  })
})
