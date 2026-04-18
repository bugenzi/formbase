import type { PageRegistration } from '../engine/CoordEngine'
import type { Field, FormSchema, TextOverlay } from '../store/types'
import { FIELD_DEFAULTS } from '../store/types'

const VALID_TYPES = new Set(Object.keys(FIELD_DEFAULTS))

export function buildFormSchema(
  fields: Record<string, Field>,
  textOverlays: Record<string, TextOverlay>,
  pages: Iterable<[number, PageRegistration]>,
): FormSchema {
  const pageMap = new Map<number, { page: number; widthPt: number; heightPt: number }>()

  for (const [pageIdx, page] of [...pages].sort(([a], [b]) => a - b)) {
    pageMap.set(pageIdx, {
      page: pageIdx + 1,
      widthPt: page.pdfWidthPt,
      heightPt: page.pdfHeightPt,
    })
  }

  const schemaFields = Object.values(fields).map((field) => {
    const page = pageMap.get(field.pageIdx)
    const pageWidthPt = page?.widthPt ?? 1
    const pageHeightPt = page?.heightPt ?? 1

    return {
      id: field.id,
      type: field.type,
      label: field.label,
      page: field.pageIdx + 1,
      required: field.required,
      assignee: field.assignee,
      fontSize: field.fontSize ?? 12,
      fontColor: field.fontColor ?? '#000000',
      placeholder: field.placeholder ?? '',
      positionPt: { x: field.ptX, y: field.ptY, w: field.ptW, h: field.ptH },
      positionRel: {
        x: field.ptX / pageWidthPt,
        y: (pageHeightPt - field.ptY - field.ptH) / pageHeightPt,
        w: field.ptW / pageWidthPt,
        h: field.ptH / pageHeightPt,
      },
    }
  })

  const schemaTextOverlays = Object.values(textOverlays).map((overlay) => ({
    id: overlay.id,
    page: overlay.pageIdx + 1,
    positionPt: {
      x: overlay.ptX,
      y: overlay.ptY,
      w: overlay.ptW,
      h: overlay.ptH,
    },
    content: overlay.content,
    fontSize: overlay.fontSize,
    fontFamily: overlay.fontFamily,
    color: overlay.color,
  }))

  return {
    version: '2.0',
    pages: [...pageMap.values()],
    fields: schemaFields,
    textOverlays: schemaTextOverlays,
  }
}

export function validateFormSchema(data: unknown): data is FormSchema {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (obj.version !== '2.0') return false
  if (!Array.isArray(obj.fields)) return false
  if (!Array.isArray(obj.pages)) return false
  if (obj.textOverlays !== undefined && !Array.isArray(obj.textOverlays)) return false
  return true
}

export function parseFormSchema(schema: FormSchema): {
  fields: Field[]
  textOverlays: TextOverlay[]
  skippedFields: number
  skippedTextOverlays: number
} {
  const fields: Field[] = []
  const textOverlays: TextOverlay[] = []
  let skippedFields = 0
  let skippedTextOverlays = 0

  for (const schemaField of schema.fields) {
    if (!VALID_TYPES.has(schemaField.type)) {
      skippedFields++
      continue
    }

    const pt = schemaField.positionPt
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number' || typeof pt.w !== 'number' || typeof pt.h !== 'number') {
      skippedFields++
      continue
    }

    const pageIdx = (schemaField.page ?? 1) - 1
    if (pageIdx < 0) {
      skippedFields++
      continue
    }

    fields.push({
      id: schemaField.id,
      type: schemaField.type,
      pageIdx,
      ptX: pt.x,
      ptY: pt.y,
      ptW: pt.w,
      ptH: pt.h,
      label: schemaField.label || schemaField.type,
      required: schemaField.required ?? false,
      assignee: schemaField.assignee || '',
      fontSize: schemaField.fontSize ?? 12,
      fontColor: schemaField.fontColor ?? '#000000',
      placeholder: schemaField.placeholder ?? '',
    })
  }

  for (const overlay of schema.textOverlays ?? []) {
    const pt = overlay.positionPt
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number' || typeof pt.w !== 'number' || typeof pt.h !== 'number') {
      skippedTextOverlays++
      continue
    }

    const pageIdx = (overlay.page ?? 1) - 1
    if (pageIdx < 0 || typeof overlay.content !== 'string') {
      skippedTextOverlays++
      continue
    }

    textOverlays.push({
      id: overlay.id,
      pageIdx,
      ptX: pt.x,
      ptY: pt.y,
      ptW: pt.w,
      ptH: pt.h,
      content: overlay.content,
      fontSize: overlay.fontSize ?? 12,
      fontFamily: overlay.fontFamily ?? 'Helvetica',
      color: overlay.color ?? '#000000',
    })
  }

  return { fields, textOverlays, skippedFields, skippedTextOverlays }
}
