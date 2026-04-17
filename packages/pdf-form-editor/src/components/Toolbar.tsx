import { useFieldStore } from '../store/useFieldStore'

interface ToolbarProps {
  scale: number
  onScaleChange: (scale: number) => void
  onExportJson: () => void
  onExportPdf: () => void
  onExportPdfMake?: () => void
  onExportPdfMakeJson?: () => void
  onImportSchema?: () => void
  pdfLoaded: boolean
}

// Inline SVG icons — small, sharp, 16x16
const icons = {
  zoomIn: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" /><line x1="5" y1="7" x2="9" y2="7" /><line x1="7" y1="5" x2="7" y2="9" />
    </svg>
  ),
  zoomOut: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" /><line x1="5" y1="7" x2="9" y2="7" />
    </svg>
  ),
  undo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h7a3 3 0 1 1 0 6H8" /><polyline points="6 3 3 6 6 9" />
    </svg>
  ),
  redo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 6H6a3 3 0 1 0 0 6h2" /><polyline points="10 3 13 6 10 9" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 4 5 13 11 13 12 4" /><line x1="3" y1="4" x2="13" y2="4" /><path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8" /><polyline points="5 7 8 10 11 7" /><path d="M3 12v1h10v-1" />
    </svg>
  ),
  duplicate: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 11V3a1 1 0 0 1 1-1h8" />
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10V2" /><polyline points="5 5 8 2 11 5" /><path d="M3 12v1h10v-1" />
    </svg>
  ),
}

export function Toolbar({ scale, onScaleChange, onExportJson, onExportPdf, onExportPdfMake, onExportPdfMakeJson, onImportSchema, pdfLoaded }: ToolbarProps) {
  const { undo, redo, canUndo, canRedo, selectedId, deleteField } = useFieldStore()

  const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

  function zoomIn() {
    const next = zoomLevels.find(z => z > scale)
    if (next) onScaleChange(next)
  }

  function zoomOut() {
    const prev = [...zoomLevels].reverse().find(z => z < scale)
    if (prev) onScaleChange(prev)
  }

  function handleDelete() {
    if (selectedId) deleteField(selectedId)
  }

  function handleDuplicate() {
    const state = useFieldStore.getState()
    if (!state.selectedId) return
    const field = state.fields[state.selectedId]
    if (!field) return
    state.addField({
      ...field,
      id: crypto.randomUUID(),
      ptX: field.ptX + 10,
      ptY: field.ptY - 10,
      label: field.label + ' copy',
    })
  }

  return (
    <div className="pfe-toolbar">
      <div className="pfe-toolbar__group">
        <button
          className="pfe-toolbar__icon-btn"
          onClick={zoomOut}
          disabled={scale <= zoomLevels[0]}
          title="Zoom out"
        >
          {icons.zoomOut}
        </button>
        <span className="pfe-toolbar__zoom">{Math.round(scale * 100)}%</span>
        <button
          className="pfe-toolbar__icon-btn"
          onClick={zoomIn}
          disabled={scale >= zoomLevels[zoomLevels.length - 1]}
          title="Zoom in"
        >
          {icons.zoomIn}
        </button>
      </div>

      <div className="pfe-toolbar__group">
        <button
          className="pfe-toolbar__icon-btn"
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          {icons.undo}
        </button>
        <button
          className="pfe-toolbar__icon-btn"
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          {icons.redo}
        </button>
      </div>

      <div className="pfe-toolbar__group">
        <button
          className="pfe-toolbar__icon-btn"
          onClick={handleDuplicate}
          disabled={!selectedId}
          title="Duplicate (Ctrl+D)"
        >
          {icons.duplicate}
        </button>
        <button
          className="pfe-toolbar__icon-btn"
          onClick={handleDelete}
          disabled={!selectedId}
          title="Delete (Del)"
        >
          {icons.trash}
        </button>
      </div>

      <div className="pfe-toolbar__spacer" />

      <div className="pfe-toolbar__group">
        {onImportSchema && (
          <button
            className="pfe-toolbar__text-btn"
            onClick={onImportSchema}
            disabled={!pdfLoaded}
            title="Import field schema from JSON"
          >
            {icons.upload}
            <span>Import</span>
          </button>
        )}
        <button
          className="pfe-toolbar__text-btn"
          onClick={onExportJson}
          disabled={!pdfLoaded}
          title="Export field schema as JSON"
        >
          {icons.download}
          <span>JSON</span>
        </button>
        <button
          className="pfe-toolbar__text-btn pfe-toolbar__btn--accent"
          onClick={onExportPdf}
          disabled={!pdfLoaded}
          title="Export PDF with embedded form fields"
        >
          {icons.download}
          <span>Export PDF</span>
        </button>
        {onExportPdfMake && (
          <button
            className="pfe-toolbar__text-btn"
            onClick={onExportPdfMake}
            disabled={!pdfLoaded}
            title="Export clean form template via pdfmake"
          >
            {icons.download}
            <span>Template</span>
          </button>
        )}
        {onExportPdfMakeJson && (
          <button
            className="pfe-toolbar__text-btn"
            onClick={onExportPdfMakeJson}
            disabled={!pdfLoaded}
            title="Export pdfmake document definition as JSON"
          >
            {icons.download}
            <span>pdfmake</span>
          </button>
        )}
      </div>
    </div>
  )
}
