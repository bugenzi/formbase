import React, { useMemo, useCallback, useState } from 'react'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import { FieldItem } from './FieldItem'
import { FIELD_DEFAULTS } from '../store/types'
import type { Field } from '../store/types'

interface FieldLayerProps {
  pageIdx: number
}

/**
 * FieldLayer renders on top of a single PDF page canvas.
 * It must be absolutely positioned with the same dimensions as the canvas.
 * Fields are positioned relative to THIS div, not the scroll container.
 *
 * Also handles drag-and-drop from the FieldPalette — when a field type
 * is dropped here, it creates a new field at the drop position.
 *
 * IMPORTANT: Select s.fields (stable reference) then filter outside the selector.
 * Filtering inside the selector creates a new array every call, which causes
 * an infinite re-render loop with React 18's useSyncExternalStore.
 */
export function FieldLayer({ pageIdx }: FieldLayerProps) {
  const allFields = useFieldStore(s => s.fields)
  const { engine } = useEditorContext()
  const [dragOver, setDragOver] = useState(false)

  const fields = useMemo(
    () => Object.values(allFields).filter(f => f.pageIdx === pageIdx),
    [allFields, pageIdx],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-formpdf-field-type')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const type = e.dataTransfer.getData('application/x-formpdf-field-type') as Field['type']
    if (!type) return

    const defaults = FIELD_DEFAULTS[type]
    if (!defaults) return

    const page = engine.getPage(pageIdx)
    if (!page) return

    // Get drop position relative to this layer
    const rect = e.currentTarget.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Default field size in screen pixels
    const screenW = defaults.ptW * page.scaleX
    const screenH = defaults.ptH * page.scaleY

    // Center the field on the drop point
    const sx = screenX - screenW / 2
    const sy = screenY - screenH / 2

    // Convert screen position to PDF points (applies Y-flip)
    const pts = engine.screenToPdf(sx, sy, screenW, screenH, pageIdx)
    if (!pts) return

    useFieldStore.getState().addField({
      id: crypto.randomUUID(),
      type,
      pageIdx,
      ptX: pts.x,
      ptY: pts.y,
      ptW: pts.w,
      ptH: pts.h,
      label: type,
      required: false,
      assignee: '',
    })
  }, [engine, pageIdx])

  return (
    <div
      className={`field-layer${dragOver ? ' field-layer--drag-over' : ''}`}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      onMouseDown={(e) => {
        // Only deselect when clicking the layer background itself
        if (e.target === e.currentTarget) {
          useFieldStore.getState().selectField(null)
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {fields.map(field => (
        <FieldItem key={field.id} field={field} />
      ))}
    </div>
  )
}
