import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { FormSchema } from '../store/types'
import { parseFormSchema, validateFormSchema } from '../schema/formSchema'

/**
 * Import a previously exported FormSchema back into the editor.
 *
 * Fields are stored in PDF points (bottom-left origin) in the schema,
 * which matches our store format exactly — no coordinate conversion needed.
 */
export function useSchemaImport() {
  const { addField, addTextOverlay } = useFieldStore()
  const { engine } = useEditorContext()
  void engine

  function importSchema(schema: FormSchema, opts?: { clearExisting?: boolean }): { imported: number; skipped: number } {
    if (opts?.clearExisting) {
      useFieldStore.getState().clearAll()
    }

    const parsed = parseFormSchema(schema)

    for (const field of parsed.fields) {
      addField(field, { undoable: true })
    }

    for (const overlay of parsed.textOverlays) {
      addTextOverlay(overlay)
    }

    return {
      imported: parsed.fields.length + parsed.textOverlays.length,
      skipped: parsed.skippedFields + parsed.skippedTextOverlays,
    }
  }

  async function importFile(file: File): Promise<{ imported: number; skipped: number }> {
    const text = await file.text()
    let data: unknown

    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON file')
    }

    if (!validateFormSchema(data)) {
      throw new Error('Invalid FormSchema: must have version "2.0", pages array, and fields array')
    }

    return importSchema(data)
  }

  return { importSchema, importFile, validateSchema: validateFormSchema }
}
