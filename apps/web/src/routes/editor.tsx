import { PdfFormEditor } from '@formpdf/editor'
import '@formpdf/editor/styles.css'

export default function EditorRoute() {
  return (
    <PdfFormEditor
      onExport={(schema) => {
        console.log('[Formbase] Schema exported:', schema)
      }}
      onSave={(bytes) => {
        console.log('[Formbase] PDF bytes ready, length:', bytes.length)
      }}
    />
  )
}
