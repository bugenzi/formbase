import React from 'react'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import { FIELD_DEFAULTS } from '../store/types'
import type { Field } from '../store/types'

const FIELD_META: Array<{ type: Field['type']; label: string; shortcut: string }> = [
  { type: 'text',      label: 'Text Input',  shortcut: 'T' },
  { type: 'signature', label: 'Signature',    shortcut: 'S' },
  { type: 'initials',  label: 'Initials',     shortcut: 'I' },
  { type: 'date',      label: 'Date',         shortcut: 'D' },
  { type: 'checkbox',  label: 'Checkbox',     shortcut: 'C' },
  { type: 'dropdown',  label: 'Dropdown',     shortcut: 'L' },
]

interface FieldPaletteProps {
  currentPage?: number
}

export function FieldPalette({ currentPage }: FieldPaletteProps) {
  const { addField } = useFieldStore()
  const { engine } = useEditorContext()

  function handleAddField(type: Field['type']) {
    // Use the currently visible page, fallback to first registered page
    let targetPage = currentPage
    if (targetPage === undefined || !engine.getPage(targetPage)) {
      targetPage = engine.pages.keys().next().value
    }
    if (targetPage === undefined) return

    const page = engine.getPage(targetPage)
    if (!page) return

    const defaults = FIELD_DEFAULTS[type]
    const ptX = (page.pdfWidthPt - defaults.ptW) / 2
    const ptY = (page.pdfHeightPt - defaults.ptH) / 2

    addField({
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
  }

  function handleDragStart(e: React.DragEvent, type: Field['type']) {
    e.dataTransfer.setData('application/x-formpdf-field-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      <div className="pfe-sidebar__header">
        <span className="pfe-sidebar__title">Fields</span>
      </div>
      <div className="pfe-sidebar__body">
        <p className="field-palette__hint">Click to add or drag onto a page</p>
        <div className="field-palette__list">
          {FIELD_META.map(({ type, label, shortcut }) => (
            <button
              key={type}
              className="field-palette__item"
              onClick={() => handleAddField(type)}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
            >
              <span className={`field-palette__dot field-palette__dot--${type}`} />
              {label}
              <span className="field-palette__shortcut">{shortcut}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
