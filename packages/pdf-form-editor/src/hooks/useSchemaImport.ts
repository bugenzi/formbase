import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { FormSchema, Field } from '../store/types'
import { FIELD_DEFAULTS } from '../store/types'

/**
 * Import a previously exported FormSchema back into the editor.
 *
 * Fields are stored in PDF points (bottom-left origin) in the schema,
 * which matches our store format exactly — no coordinate conversion needed.
 *
 * Usage:
 *   const { importSchema, importFile } = useSchemaImport()
 *   importSchema(jsonObject)     // from in-memory object
 *   importFile(fileFromInput)    // from File input / drop
 */
export function useSchemaImport() {
  const { addField } = useFieldStore()
  const { engine } = useEditorContext()

  function validateSchema(data: unknown): data is FormSchema {
    if (!data || typeof data !== 'object') return false
    const obj = data as Record<string, unknown>
    if (obj.version !== '2.0') return false
    if (!Array.isArray(obj.fields)) return false
    if (!Array.isArray(obj.pages)) return false
    return true
  }

  const VALID_TYPES = new Set(Object.keys(FIELD_DEFAULTS))

  function importSchema(schema: FormSchema, opts?: { clearExisting?: boolean }): { imported: number; skipped: number } {
    if (opts?.clearExisting) {
      useFieldStore.getState().clearAll()
    }

    let imported = 0
    let skipped = 0

    for (const sf of schema.fields) {
      // Validate field type
      if (!VALID_TYPES.has(sf.type)) {
        console.warn(`[importSchema] Skipping field "${sf.label}": unknown type "${sf.type}"`)
        skipped++
        continue
      }

      // Validate position
      const pt = sf.positionPt
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number' ||
          typeof pt.w !== 'number' || typeof pt.h !== 'number') {
        console.warn(`[importSchema] Skipping field "${sf.label}": invalid positionPt`)
        skipped++
        continue
      }

      // Validate page index
      const pageIdx = (sf.page ?? 1) - 1
      if (pageIdx < 0) {
        skipped++
        continue
      }

      const field: Field = {
        id: sf.id || crypto.randomUUID(),
        type: sf.type,
        pageIdx,
        ptX: pt.x,
        ptY: pt.y,
        ptW: pt.w,
        ptH: pt.h,
        label: sf.label || sf.type,
        required: sf.required ?? false,
        assignee: sf.assignee || '',
      }

      addField(field, { undoable: true })
      imported++
    }

    return { imported, skipped }
  }

  async function importFile(file: File): Promise<{ imported: number; skipped: number }> {
    const text = await file.text()
    let data: unknown

    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON file')
    }

    if (!validateSchema(data)) {
      throw new Error('Invalid FormSchema: must have version "2.0", pages array, and fields array')
    }

    return importSchema(data)
  }

  return { importSchema, importFile, validateSchema }
}
