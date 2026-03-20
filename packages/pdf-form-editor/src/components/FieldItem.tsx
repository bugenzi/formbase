import React, { useRef, useEffect } from 'react'
import interact from 'interactjs'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import { useAlignmentGuides } from '../hooks/useAlignmentGuides'
import type { Field } from '../store/types'

interface FieldItemProps {
  field: Field
}

export function FieldItem({ field }: FieldItemProps) {
  const elRef = useRef<HTMLDivElement>(null)
  /**
   * dragPos holds the current screen position during an active drag.
   * It is a REF, not state. Writing it to state on every mouse move
   * would cause a React re-render on every frame, making drag feel laggy.
   * State (via updateField) is only written on drag-end.
   */
  const dragPos = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const { updateField, selectField, selectedId } = useFieldStore()
  const { engine } = useEditorContext()
  const { computeGuides, clearGuides } = useAlignmentGuides()
  const isSelected = selectedId === field.id

  // Keep guide functions in a ref so interact.js listeners always see latest
  const guidesRef = useRef({ computeGuides, clearGuides })
  guidesRef.current = { computeGuides, clearGuides }

  // Derive initial screen position from PDF points
  const screen = engine.pdfToScreen(field.ptX, field.ptY, field.ptW, field.ptH, field.pageIdx)

  useEffect(() => {
    const el = elRef.current
    const s = engine.pdfToScreen(field.ptX, field.ptY, field.ptW, field.ptH, field.pageIdx)
    if (!el || !s) return

    dragPos.current = { x: s.x, y: s.y, w: s.w, h: s.h }

    const interactable = interact(el)
      .draggable({
        modifiers: [
          interact.modifiers.restrict({ restriction: 'parent', elementRect: { top: 0, left: 0, bottom: 1, right: 1 } }),
        ],
        listeners: {
          move(event) {
            dragPos.current.x += event.dx
            dragPos.current.y += event.dy

            // Compute alignment guides and snap
            const layer = el.closest('.field-layer') as HTMLElement | null
            const { snapX, snapY } = guidesRef.current.computeGuides(
              field.id, dragPos.current.x, dragPos.current.y,
              dragPos.current.w, dragPos.current.h, field.pageIdx, layer,
            )
            if (snapX !== null) dragPos.current.x = snapX
            if (snapY !== null) dragPos.current.y = snapY

            el.style.left = dragPos.current.x + 'px'
            el.style.top  = dragPos.current.y + 'px'
          },
          end() {
            guidesRef.current.clearGuides()
            const clamped = engine.clamp(
              dragPos.current.x,
              dragPos.current.y,
              dragPos.current.w,
              dragPos.current.h,
              field.pageIdx,
            )
            const pts = engine.screenToPdf(clamped.x, clamped.y, clamped.w, clamped.h, field.pageIdx)
            if (pts) {
              updateField(field.id, { ptX: pts.x, ptY: pts.y }, { undoable: true })
            }
          },
        },
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.restrictSize({ min: { width: 20, height: 12 } }),
        ],
        listeners: {
          move(event) {
            const { left, top } = event.deltaRect
            dragPos.current.x += left
            dragPos.current.y += top
            dragPos.current.w  = event.rect.width
            dragPos.current.h  = event.rect.height

            // Compute alignment guides during resize too
            const layer = el.closest('.field-layer') as HTMLElement | null
            const { snapX, snapY } = guidesRef.current.computeGuides(
              field.id, dragPos.current.x, dragPos.current.y,
              dragPos.current.w, dragPos.current.h, field.pageIdx, layer,
            )
            if (snapX !== null) dragPos.current.x = snapX
            if (snapY !== null) dragPos.current.y = snapY

            el.style.left   = dragPos.current.x + 'px'
            el.style.top    = dragPos.current.y + 'px'
            el.style.width  = dragPos.current.w + 'px'
            el.style.height = dragPos.current.h + 'px'
          },
          end() {
            guidesRef.current.clearGuides()
            const pts = engine.screenToPdf(
              dragPos.current.x,
              dragPos.current.y,
              dragPos.current.w,
              dragPos.current.h,
              field.pageIdx,
            )
            if (pts) {
              updateField(field.id, { ptX: pts.x, ptY: pts.y, ptW: pts.w, ptH: pts.h }, { undoable: true })
            }
          },
        },
      })

    // CRITICAL: unset() prevents double-binding in React Strict Mode
    // and cleans up when the component remounts after hot reload.
    return () => interactable.unset()
  }, [field.id, field.pageIdx, engine, updateField])

  if (!screen) return null

  return (
    <div
      ref={elRef}
      id={`field-${field.id}`}
      className={`form-field form-field--${field.type}${isSelected ? ' form-field--selected' : ''}${field.aiPending ? ' form-field--ai-pending' : ''}`}
      style={{
        position: 'absolute',
        left: screen.x,
        top:  screen.y,
        width:  screen.w,
        height: screen.h,
      }}
      onClick={(e) => {
        e.stopPropagation()
        selectField(field.id)
      }}
    >
      <span className="form-field__label">{field.label}</span>
      {field.aiPending && (
        <div className="form-field__ai-controls">
          <button onClick={(e) => { e.stopPropagation(); confirmAiField(field.id) }}>&#x2713;</button>
          <button onClick={(e) => { e.stopPropagation(); discardAiField(field.id) }}>&#x2715;</button>
        </div>
      )}
    </div>
  )
}

function confirmAiField(id: string) {
  useFieldStore.getState().updateField(id, { aiPending: false })
}
function discardAiField(id: string) {
  useFieldStore.getState().deleteField(id)
}
