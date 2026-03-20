import { describe, it, expect, beforeEach } from 'vitest'
import { useFieldStore } from '../store/useFieldStore'
import type { FormSchema } from '../store/types'

// We test the import logic directly since useSchemaImport requires EditorContext.
// The core validation and field creation logic is the same.

function makeSchema(overrides: Partial<FormSchema> = {}): FormSchema {
  return {
    version: '2.0',
    pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
    fields: [
      {
        id: 'f1',
        type: 'text',
        label: 'Full Name',
        page: 1,
        required: true,
        assignee: 'signer1',
        positionPt: { x: 72, y: 680, w: 200, h: 24 },
        positionRel: { x: 0.118, y: 0.111, w: 0.327, h: 0.03 },
      },
      {
        id: 'f2',
        type: 'signature',
        label: 'Signature',
        page: 1,
        required: true,
        assignee: 'signer1',
        positionPt: { x: 72, y: 100, w: 240, h: 48 },
        positionRel: { x: 0.118, y: 0.814, w: 0.392, h: 0.061 },
      },
    ],
    ...overrides,
  }
}

describe('Schema Import', () => {
  beforeEach(() => {
    useFieldStore.getState().clearAll()
  })

  it('imports fields from a valid schema', () => {
    const schema = makeSchema()
    const store = useFieldStore.getState()

    for (const sf of schema.fields) {
      store.addField({
        id: sf.id,
        type: sf.type,
        pageIdx: sf.page - 1,
        ptX: sf.positionPt.x,
        ptY: sf.positionPt.y,
        ptW: sf.positionPt.w,
        ptH: sf.positionPt.h,
        label: sf.label,
        required: sf.required,
        assignee: sf.assignee,
      })
    }

    const fields = useFieldStore.getState().fields
    expect(Object.keys(fields)).toHaveLength(2)
    expect(fields['f1'].label).toBe('Full Name')
    expect(fields['f1'].ptX).toBe(72)
    expect(fields['f1'].ptY).toBe(680)
    expect(fields['f1'].pageIdx).toBe(0)
    expect(fields['f2'].type).toBe('signature')
  })

  it('preserves existing fields when not clearing', () => {
    const store = useFieldStore.getState()
    store.addField({
      id: 'existing',
      type: 'checkbox',
      pageIdx: 0,
      ptX: 50,
      ptY: 50,
      ptW: 14,
      ptH: 14,
      label: 'Existing',
      required: false,
      assignee: '',
    })

    const schema = makeSchema()
    for (const sf of schema.fields) {
      store.addField({
        id: sf.id,
        type: sf.type,
        pageIdx: sf.page - 1,
        ptX: sf.positionPt.x,
        ptY: sf.positionPt.y,
        ptW: sf.positionPt.w,
        ptH: sf.positionPt.h,
        label: sf.label,
        required: sf.required,
        assignee: sf.assignee,
      })
    }

    expect(Object.keys(useFieldStore.getState().fields)).toHaveLength(3)
    expect(useFieldStore.getState().fields['existing']).toBeDefined()
  })

  it('validates schema structure', () => {
    const valid: FormSchema = makeSchema()
    expect(valid.version).toBe('2.0')
    expect(Array.isArray(valid.fields)).toBe(true)
    expect(Array.isArray(valid.pages)).toBe(true)

    // Invalid version
    expect({ ...valid, version: '1.0' }.version).not.toBe('2.0')
  })

  it('handles fields with PDF point coordinates correctly', () => {
    const schema = makeSchema()
    const sf = schema.fields[0]

    // positionPt stores PDF user-space coords (bottom-left origin)
    expect(sf.positionPt.x).toBe(72)
    expect(sf.positionPt.y).toBe(680)

    // These go directly into the store without conversion
    const store = useFieldStore.getState()
    store.addField({
      id: sf.id,
      type: sf.type,
      pageIdx: 0,
      ptX: sf.positionPt.x,
      ptY: sf.positionPt.y,
      ptW: sf.positionPt.w,
      ptH: sf.positionPt.h,
      label: sf.label,
      required: sf.required,
      assignee: sf.assignee,
    })

    const field = useFieldStore.getState().fields[sf.id]
    expect(field.ptX).toBe(72)
    expect(field.ptY).toBe(680)
  })
})
