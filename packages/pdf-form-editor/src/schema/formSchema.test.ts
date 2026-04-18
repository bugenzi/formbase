import { describe, expect, it } from 'vitest'
import { buildFormSchema, parseFormSchema, validateFormSchema } from './formSchema'
import type { Field, TextOverlay } from '../store/types'
import type { PageRegistration } from '../engine/CoordEngine'

function createPageRegistration(overrides: Partial<PageRegistration> = {}): PageRegistration {
  return {
    pdfWidthPt: 600,
    pdfHeightPt: 800,
    canvasWidthPx: 600,
    canvasHeightPx: 800,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...overrides,
  }
}

describe('formSchema', () => {
  it('exports field styling and text overlays', () => {
    const field: Field = {
      id: 'field-1',
      type: 'text',
      pageIdx: 0,
      ptX: 120,
      ptY: 300,
      ptW: 180,
      ptH: 24,
      label: 'Tenant Name',
      required: true,
      assignee: 'signer1',
      fontSize: 16,
      fontColor: '#112233',
      placeholder: 'Jane Doe',
    }

    const overlay: TextOverlay = {
      id: 'overlay-1',
      pageIdx: 0,
      ptX: 90,
      ptY: 500,
      ptW: 220,
      ptH: 30,
      content: 'Lease Summary',
      fontSize: 18,
      fontFamily: 'Helvetica',
      color: '#445566',
    }

    const schema = buildFormSchema(
      { [field.id]: field },
      { [overlay.id]: overlay },
      [[0, createPageRegistration()]],
    )

    expect(schema.version).toBe('2.0')
    expect(schema.fields).toHaveLength(1)
    expect(schema.textOverlays).toHaveLength(1)
    expect(schema.fields[0].fontSize).toBe(16)
    expect(schema.fields[0].fontColor).toBe('#112233')
    expect(schema.fields[0].placeholder).toBe('Jane Doe')
    expect(schema.fields[0].positionPt).toEqual({ x: 120, y: 300, w: 180, h: 24 })
    expect(schema.fields[0].positionRel).toEqual({
      x: 0.2,
      y: 0.595,
      w: 0.3,
      h: 0.03,
    })
    expect(schema.textOverlays?.[0]).toEqual({
      id: 'overlay-1',
      page: 1,
      positionPt: { x: 90, y: 500, w: 220, h: 30 },
      content: 'Lease Summary',
      fontSize: 18,
      fontFamily: 'Helvetica',
      color: '#445566',
    })
  })

  it('round-trips editor state without dropping field styling or overlays', () => {
    const originalField: Field = {
      id: 'field-1',
      type: 'date',
      pageIdx: 0,
      ptX: 140,
      ptY: 220,
      ptW: 100,
      ptH: 24,
      label: 'Start Date',
      required: false,
      assignee: '',
      fontSize: 14,
      fontColor: '#0000ff',
      placeholder: '2026-07-01',
    }

    const originalOverlay: TextOverlay = {
      id: 'overlay-1',
      pageIdx: 0,
      ptX: 80,
      ptY: 640,
      ptW: 260,
      ptH: 28,
      content: 'Move-in Details',
      fontSize: 20,
      fontFamily: 'Inter',
      color: '#111111',
    }

    const pages: Array<[number, PageRegistration]> = [[0, createPageRegistration()]]

    const exported = buildFormSchema(
      { [originalField.id]: originalField },
      { [originalOverlay.id]: originalOverlay },
      pages,
    )

    const parsed = parseFormSchema(exported)

    const rebuilt = buildFormSchema(
      Object.fromEntries(parsed.fields.map((field) => [field.id, field])),
      Object.fromEntries(parsed.textOverlays.map((overlay) => [overlay.id, overlay])),
      pages,
    )

    expect(parsed.skippedFields).toBe(0)
    expect(parsed.skippedTextOverlays).toBe(0)
    expect(rebuilt).toEqual(exported)
  })

  it('accepts older schemas without text overlays', () => {
    const legacySchema = {
      version: '2.0',
      pages: [{ page: 1, widthPt: 600, heightPt: 800 }],
      fields: [
        {
          id: 'field-1',
          type: 'text',
          label: 'Name',
          page: 1,
          required: false,
          assignee: '',
          positionPt: { x: 100, y: 200, w: 180, h: 24 },
          positionRel: { x: 1 / 6, y: 0.72, w: 0.3, h: 0.03 },
        },
      ],
    }

    expect(validateFormSchema(legacySchema)).toBe(true)

    const parsed = parseFormSchema(legacySchema)
    expect(parsed.fields).toHaveLength(1)
    expect(parsed.textOverlays).toHaveLength(0)
    expect(parsed.fields[0].fontSize).toBe(12)
    expect(parsed.fields[0].fontColor).toBe('#000000')
    expect(parsed.fields[0].placeholder).toBe('')
  })
})
