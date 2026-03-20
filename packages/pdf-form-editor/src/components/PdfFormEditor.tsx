import React, { useState, useCallback, useEffect } from 'react'
import { EditorProvider, useEditorContext } from '../context/EditorContext'
import { PdfCanvas } from './PdfCanvas'
import { FieldLayer } from './FieldLayer'
import { PropsPanel } from './PropsPanel'
import { FieldPalette } from './FieldPalette'
import { AiChatPanel } from './AiChatPanel'
import { Toolbar } from './Toolbar'
import { ErrorBoundary } from './ErrorBoundary'
import { ToasterProvider, useToast } from './Toaster'
import { useFormExport } from '../hooks/useFormExport'
import { useSchemaImport } from '../hooks/useSchemaImport'
import { useAutoSave } from '../hooks/useAutoSave'
import { useFieldSync } from '../hooks/useFieldSync'
import { useFieldStore } from '../store/useFieldStore'
import { FIELD_DEFAULTS } from '../store/types'
import type { Field } from '../store/types'
import '../styles/editor.css'

export interface PdfFormEditorProps {
  pdfUrl?: string
  pdfFile?: File
  aiProxyUrl: string
  docId?: string              // Phase 8: enables auto-save when provided
  syncServerUrl?: string      // Phase 9: enables Figma bilateral sync when provided
  fetchFn?: (path: string, init?: RequestInit) => Promise<Response>  // Custom fetch (e.g. with auth)
  onExport?: (schema: ReturnType<typeof import('../hooks/useFormExport').useFormExport>['exportJSON']) => void
  onSave?: (pdfBytes: Uint8Array) => void
}

// Field type shortcuts: press key to add field of that type
const FIELD_SHORTCUTS: Record<string, Field['type']> = {
  t: 'text',
  s: 'signature',
  i: 'initials',
  d: 'date',
  c: 'checkbox',
  l: 'dropdown',
}

function EditorInner({ pdfUrl, pdfFile: pdfFileProp, docId, syncServerUrl, fetchFn, onExport, onSave }: Omit<PdfFormEditorProps, 'aiProxyUrl'>) {
  const [loadedFile, setLoadedFile] = useState<File | null>(pdfFileProp ?? null)
  const [scale, setScale] = useState(1.0)
  const [pageCount, setPageCount] = useState(0)
  const [pageWarnings, setPageWarnings] = useState<Record<number, string>>({})
  const [urlLoading, setUrlLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const { downloadJson, downloadPdf } = useFormExport()
  const { importFile } = useSchemaImport()
  const { toast } = useToast()
  const { engine } = useEditorContext()
  const fieldCount = useFieldStore(s => Object.keys(s.fields).length)

  // Phase 8: Auto-save schema to server (with auth if provided)
  useAutoSave(docId, fetchFn)

  // Phase 9: Bilateral sync with Figma
  useFieldSync(docId, syncServerUrl)

  // Load PDF from URL if pdfFile prop is not provided
  useEffect(() => {
    if (loadedFile || !pdfUrl) return

    let cancelled = false
    setUrlLoading(true)

    fetch(pdfUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        if (cancelled) return
        const file = new File([blob], pdfUrl.split('/').pop() || 'document.pdf', { type: 'application/pdf' })
        setLoadedFile(file)
      })
      .catch(err => {
        console.error('[PdfFormEditor] Failed to load PDF from URL:', err)
      })
      .finally(() => {
        if (!cancelled) setUrlLoading(false)
      })

    return () => { cancelled = true }
  }, [pdfUrl, loadedFile])

  const handlePageWarning = useCallback((pageIdx: number, message: string) => {
    setPageWarnings(prev => ({ ...prev, [pageIdx]: message }))
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setLoadedFile(file)
  }, [])

  const handleExportJson = useCallback(() => {
    downloadJson()
    toast('JSON schema exported', 'success')
  }, [downloadJson, toast])

  const handleExportPdf = useCallback(() => {
    if (loadedFile) {
      downloadPdf(loadedFile)
      toast('PDF exported with form fields', 'success')
    }
  }, [loadedFile, downloadPdf, toast])

  const handleImportSchema = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const { imported, skipped } = await importFile(file)
        toast(`Imported ${imported} field${imported !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`, 'success')
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    }
    input.click()
  }, [importFile, toast])

  // Add a field of given type to center of the currently visible page
  const addFieldOfType = useCallback((type: Field['type']) => {
    let targetPage = currentPage
    if (!engine.getPage(targetPage)) {
      targetPage = engine.pages.keys().next().value as number
    }
    if (targetPage === undefined) return

    const page = engine.getPage(targetPage)
    if (!page) return

    const defaults = FIELD_DEFAULTS[type]
    const ptX = (page.pdfWidthPt - defaults.ptW) / 2
    const ptY = (page.pdfHeightPt - defaults.ptH) / 2

    useFieldStore.getState().addField({
      id: crypto.randomUUID(),
      type,
      pageIdx: targetPage,
      ptX,
      ptY,
      ptW: defaults.ptW,
      ptH: defaults.ptH,
      label: type,
      required: false,
      assignee: '',
    })
  }, [engine, currentPage])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      const isInput = e.target instanceof HTMLInputElement ||
                      e.target instanceof HTMLTextAreaElement ||
                      e.target instanceof HTMLSelectElement

      // Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useFieldStore.getState().undo()
        return
      }

      // Redo
      if (ctrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        useFieldStore.getState().redo()
        return
      }

      // Duplicate selected field (Ctrl+D)
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        const state = useFieldStore.getState()
        if (!state.selectedId) return
        const field = state.fields[state.selectedId]
        if (!field) return
        const newId = crypto.randomUUID()
        state.addField({
          ...field,
          id: newId,
          ptX: field.ptX + 10,
          ptY: field.ptY - 10,
          label: field.label + ' copy',
        })
        state.selectField(newId)
        return
      }

      // Don't handle other shortcuts when typing in inputs
      if (isInput) return

      // Delete selected field
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId, deleteField } = useFieldStore.getState()
        if (selectedId) {
          e.preventDefault()
          deleteField(selectedId)
        }
        return
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        useFieldStore.getState().selectField(null)
        return
      }

      // Field type shortcuts (only when not holding Ctrl and PDF is loaded)
      if (!ctrl && loadedFile) {
        const fieldType = FIELD_SHORTCUTS[e.key.toLowerCase()]
        if (fieldType) {
          e.preventDefault()
          addFieldOfType(fieldType)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loadedFile, addFieldOfType])

  return (
    <div className="pfe-root" onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}>
      {/* Left sidebar */}
      <div className="pfe-sidebar pfe-sidebar--left">
        <div className="pfe-logo">
          <div className="pfe-logo__mark">F</div>
          <div className="pfe-logo__text">Form<span>PDF</span></div>
        </div>
        <FieldPalette currentPage={currentPage} />
      </div>

      {/* Main area */}
      <div className="pfe-main">
        <Toolbar
          scale={scale}
          onScaleChange={setScale}
          onExportJson={handleExportJson}
          onExportPdf={handleExportPdf}
          onImportSchema={handleImportSchema}
          pdfLoaded={!!loadedFile}
        />

        <div className="pfe-canvas-area">
          {Object.values(pageWarnings).map((msg, i) => (
            <div key={i} className="pfe-warning-banner">{msg}</div>
          ))}

          {!loadedFile && !urlLoading && (
            <div className="pfe-drop-zone">
              <div className="pfe-drop-zone__icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                  <rect x="8" y="4" width="32" height="40" rx="3" />
                  <line x1="14" y1="16" x2="34" y2="16" />
                  <line x1="14" y1="22" x2="34" y2="22" />
                  <line x1="14" y1="28" x2="28" y2="28" />
                  <rect x="28" y="32" width="12" height="8" rx="1" strokeDasharray="3 2" />
                </svg>
              </div>
              <p className="pfe-drop-zone__title">Drop a PDF here to get started</p>
              <p className="pfe-drop-zone__hint">or use the button below to browse files</p>
              <label className="pfe-browse-btn">
                Choose file
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && setLoadedFile(e.target.files[0])}
                />
              </label>
              <div className="pfe-drop-zone__shortcuts">
                <span className="pfe-drop-zone__shortcut-hint">Keyboard shortcuts after loading:</span>
                <div className="pfe-drop-zone__shortcut-grid">
                  {Object.entries(FIELD_SHORTCUTS).map(([key, type]) => (
                    <span key={key} className="pfe-drop-zone__shortcut-item">
                      <kbd>{key.toUpperCase()}</kbd> {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {urlLoading && (
            <div className="pfe-drop-zone">
              <div className="pfe-loading-spinner" />
              <p>Loading PDF...</p>
            </div>
          )}

          {loadedFile && (
            <PdfCanvas
              pdfFile={loadedFile}
              scale={scale}
              onPageCount={setPageCount}
              onPageWarning={handlePageWarning}
              onVisiblePageChange={setCurrentPage}
            >
              {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}
            </PdfCanvas>
          )}
        </div>

        {/* Status bar */}
        {loadedFile && (
          <div className="pfe-statusbar">
            <span className="pfe-statusbar__item">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>
              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            </span>
            <span className="pfe-statusbar__sep" />
            <span className="pfe-statusbar__item">
              {pageCount} page{pageCount !== 1 ? 's' : ''}
            </span>
            <span className="pfe-statusbar__spacer" />
            <span className="pfe-statusbar__item pfe-statusbar__kbd-hint">
              <kbd>T</kbd>ext <kbd>S</kbd>ig <kbd>D</kbd>ate <kbd>C</kbd>heck &middot; <kbd>Ctrl+D</kbd> duplicate &middot; <kbd>Del</kbd> delete
            </span>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="pfe-sidebar pfe-sidebar--right">
        <div className="pfe-sidebar__header">
          <span className="pfe-sidebar__title">Inspector</span>
        </div>
        <div className="pfe-sidebar__body">
          <PropsPanel />
          <AiChatPanel />
        </div>
      </div>
    </div>
  )
}

export function PdfFormEditor({ aiProxyUrl, ...rest }: PdfFormEditorProps) {
  return (
    <ErrorBoundary>
      <EditorProvider aiProxyUrl={aiProxyUrl}>
        <ToasterProvider>
          <EditorInner {...rest} />
        </ToasterProvider>
      </EditorProvider>
    </ErrorBoundary>
  )
}
