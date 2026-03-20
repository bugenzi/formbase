import { PDFDocument, PDFName, PDFDict, PDFArray, rgb } from 'pdf-lib'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { FormSchema, Field } from '../store/types'
import { saveAs } from 'file-saver'

/**
 * IMPORTANT — pdf-lib hard limits:
 * 1. Encrypted PDFs: PDFDocument.load() throws. Guard with try/catch.
 * 2. Existing digital signatures: pdf-lib modifies the byte stream,
 *    permanently invalidating them. Detect /Sig fields and warn before export.
 * 3. pdf-lib cannot CREATE digital signatures (no sign() API).
 *    It can add blank signature WIDGETS (input areas), which is the MVP use case.
 */

export function useFormExport() {
  const { engine } = useEditorContext()

  async function loadPdfSafely(file: File): Promise<PDFDocument | null> {
    const bytes = await file.arrayBuffer()

    try {
      const doc = await PDFDocument.load(bytes)

      // Check for existing digital signatures — warn before any modification
      const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
      if (acroForm) {
        const fieldArray = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)
        if (fieldArray) {
          for (let i = 0; i < fieldArray.size(); i++) {
            try {
              const f = fieldArray.lookup(i, PDFDict)
              const ft = f.lookupMaybe(PDFName.of('FT'), PDFName)
              if (ft?.asString() === 'Sig') {
                console.warn(
                  '[useFormExport] PDF contains existing digital signatures. ' +
                  'Exporting will invalidate them. Consider warning the user.',
                )
                break
              }
            } catch {}
          }
        }
      }

      return doc
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('encrypted')) {
        console.error('[useFormExport] PDF is encrypted. Cannot load with pdf-lib.')
      } else {
        console.error('[useFormExport] Failed to load PDF:', msg)
      }
      return null
    }
  }

  function exportJSON(): FormSchema {
    // Read fields at call time (not hook creation time) to avoid stale data
    const fields = useFieldStore.getState().fields

    const pages = [...engine.pages.entries()].map(([i, p]) => ({
      page: i + 1,
      widthPt: p.pdfWidthPt,
      heightPt: p.pdfHeightPt,
    }))

    const schemaFields = Object.values(fields).map(f => {
      const p = engine.getPage(f.pageIdx)!
      return {
        id: f.id,
        type: f.type,
        label: f.label,
        page: f.pageIdx + 1,
        required: f.required,
        assignee: f.assignee,
        fontSize: f.fontSize ?? 12,
        fontColor: f.fontColor ?? '#000000',
        placeholder: f.placeholder ?? '',
        positionPt: { x: f.ptX, y: f.ptY, w: f.ptW, h: f.ptH },
        // positionRel uses TOP-LEFT origin for front-end consumers
        positionRel: {
          x: f.ptX / p.pdfWidthPt,
          y: (p.pdfHeightPt - f.ptY - f.ptH) / p.pdfHeightPt,
          w: f.ptW / p.pdfWidthPt,
          h: f.ptH / p.pdfHeightPt,
        },
      }
    })

    return { version: '2.0', pages, fields: schemaFields }
  }

  async function exportToPdf(originalFile: File): Promise<Uint8Array | null> {
    const doc = await loadPdfSafely(originalFile)
    if (!doc) return null

    // Read fields at call time to get latest state
    const fields = useFieldStore.getState().fields

    const form = doc.getForm()
    const pdfPages = doc.getPages()

    for (const field of Object.values(fields)) {
      const page = pdfPages[field.pageIdx]
      if (!page) continue

      // pdf-lib uses bottom-left origin natively — no Y-flip needed here
      // field.ptX and field.ptY are already in PDF user space
      const rect = {
        x: field.ptX,
        y: field.ptY,
        width: field.ptW,
        height: field.ptH,
      }

      const fieldName = field.label || field.id

      const fontSize = field.fontSize ?? 12
      // Parse hex color to rgb (default black)
      const hex = field.fontColor ?? '#000000'
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      const color = rgb(r, g, b)

      switch (field.type) {
        case 'text':
        case 'date': {
          const tf = form.createTextField(fieldName)
          tf.addToPage(page, rect)
          tf.setFontSize(fontSize)
          if (field.placeholder) tf.setText(field.placeholder)
          break
        }
        case 'signature':
        case 'initials': {
          // pdf-lib adds blank signature widget (input area only, no crypto signing)
          const sf = form.createTextField(fieldName)
          sf.addToPage(page, rect)
          sf.setFontSize(fontSize)
          break
        }
        case 'checkbox':
          form.createCheckBox(fieldName).addToPage(page, rect)
          break
        case 'dropdown': {
          const dd = form.createDropdown(fieldName)
          dd.addToPage(page, rect)
          dd.setFontSize(fontSize)
          break
        }
      }
    }

    return doc.save()
  }

  async function downloadJson(filename = 'form-schema.json') {
    const schema = exportJSON()
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
    saveAs(blob, filename)
  }

  async function downloadPdf(originalFile: File, filename = 'form-filled.pdf') {
    const bytes = await exportToPdf(originalFile)
    if (!bytes) return
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
    saveAs(blob, filename)
  }

  return { exportJSON, exportToPdf, downloadJson, downloadPdf, loadPdfSafely }
}
