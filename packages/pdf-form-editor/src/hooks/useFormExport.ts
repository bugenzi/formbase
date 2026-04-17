import { PDFDocument, PDFName, PDFDict, PDFArray, rgb } from 'pdf-lib'
import pdfMake from 'pdfmake/build/pdfmake'
import 'pdfmake/build/vfs_fonts'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { FormSchema, Field } from '../store/types'
import type { TDocumentDefinitions, Content, ContentCanvas, ContentColumns, ContentText } from 'pdfmake/interfaces'
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

  /**
   * Export fields as a pdfmake document definition.
   * Produces a standalone form template (no original PDF background).
   * Fields are grouped by page and rendered as labeled input areas.
   */
  function exportToPdfMakeDefinition(): TDocumentDefinitions {
    const fields = useFieldStore.getState().fields
    const pageEntries = [...engine.pages.entries()].sort(([a], [b]) => a - b)

    // Group fields by page
    const fieldsByPage: Record<number, Field[]> = {}
    for (const f of Object.values(fields)) {
      if (!fieldsByPage[f.pageIdx]) fieldsByPage[f.pageIdx] = []
      fieldsByPage[f.pageIdx].push(f)
    }

    const content: Content[] = []

    for (let pi = 0; pi < pageEntries.length; pi++) {
      const [pageIdx, pageReg] = pageEntries[pi]
      const pageFields = fieldsByPage[pageIdx] ?? []

      if (pi > 0) {
        content.push({ text: '', pageBreak: 'before' } as ContentText)
      }

      content.push({
        text: `Page ${pageIdx + 1}`,
        style: 'pageHeader',
        margin: [0, 0, 0, 12],
      } as ContentText)

      if (pageFields.length === 0) {
        content.push({ text: '(no fields on this page)', italics: true, color: '#999999', margin: [0, 0, 0, 8] } as ContentText)
        continue
      }

      // Sort fields top-to-bottom, left-to-right (in screen order)
      // Since ptY is bottom-left origin, higher ptY = higher on page
      const sorted = [...pageFields].sort((a, b) => {
        const ay = pageReg.pdfHeightPt - a.ptY - a.ptH
        const by = pageReg.pdfHeightPt - b.ptY - b.ptH
        if (Math.abs(ay - by) > 10) return ay - by
        return a.ptX - b.ptX
      })

      for (const field of sorted) {
        const fieldContent = buildFieldContent(field)
        content.push(...fieldContent)
      }
    }

    return {
      content,
      styles: {
        pageHeader: { fontSize: 16, bold: true, color: '#1a1a2e' },
        fieldLabel: { fontSize: 10, bold: true, color: '#374151', margin: [0, 8, 0, 2] },
        fieldHint: { fontSize: 8, italics: true, color: '#9ca3af' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 12 },
      pageSize: pageEntries.length > 0
        ? { width: pageEntries[0][1].pdfWidthPt, height: pageEntries[0][1].pdfHeightPt }
        : 'A4',
      pageMargins: [40, 40, 40, 40],
      info: {
        title: 'Form Template',
        producer: 'FormPDF Editor (pdfmake)',
      },
    }
  }

  function buildFieldContent(field: Field): Content[] {
    const label = field.label || field.type
    const required = field.required ? ' *' : ''
    const assignee = field.assignee ? ` [${field.assignee}]` : ''
    const fontSize = field.fontSize ?? 12
    const w = Math.min(field.ptW, 500) // cap width to page
    const h = field.ptH

    const items: Content[] = []

    // Label row
    items.push({
      text: `${label}${required}${assignee}`,
      style: 'fieldLabel',
    } as ContentText)

    switch (field.type) {
      case 'checkbox': {
        const cols: ContentColumns = {
          columns: [
            {
              canvas: [
                { type: 'rect', x: 0, y: 0, w: 14, h: 14, lineWidth: 1, lineColor: '#6b7280' },
              ],
              width: 20,
            } as ContentCanvas,
            { text: label, fontSize, width: '*', margin: [4, 0, 0, 0] } as ContentText,
          ],
          margin: [0, 2, 0, 8],
        }
        items.push(cols)
        break
      }
      case 'signature':
      case 'initials': {
        const boxH = Math.max(h, field.type === 'signature' ? 48 : 36)
        items.push({
          canvas: [
            { type: 'rect', x: 0, y: 0, w, h: boxH, r: 3, lineWidth: 1, lineColor: '#d1d5db', dash: { length: 4, space: 2 } },
            { type: 'line', x1: 10, y1: boxH - 12, x2: w - 10, y2: boxH - 12, lineWidth: 0.5, lineColor: '#e5e7eb' },
          ],
          margin: [0, 2, 0, 8],
        } as ContentCanvas)
        items.push({ text: field.type === 'signature' ? 'Sign here' : 'Initials', style: 'fieldHint', margin: [0, -6, 0, 8] } as ContentText)
        break
      }
      case 'dropdown': {
        // Dropdown rendered as a bordered box with a down arrow indicator
        items.push({
          canvas: [
            { type: 'rect', x: 0, y: 0, w, h: Math.max(h, 24), r: 2, lineWidth: 1, lineColor: '#d1d5db' },
            // Arrow indicator
            { type: 'polyline', points: [{ x: w - 18, y: 8 }, { x: w - 12, y: 16 }, { x: w - 6, y: 8 }], lineWidth: 1, lineColor: '#6b7280', closePath: false },
          ],
          margin: [0, 2, 0, 8],
        } as ContentCanvas)
        if (field.placeholder) {
          items.push({ text: field.placeholder, style: 'fieldHint', margin: [4, -20, 0, 12] } as ContentText)
        }
        break
      }
      default: {
        // text, date — bordered input box
        items.push({
          canvas: [
            { type: 'rect', x: 0, y: 0, w, h: Math.max(h, 24), r: 2, lineWidth: 1, lineColor: '#d1d5db' },
          ],
          margin: [0, 2, 0, 8],
        } as ContentCanvas)
        if (field.placeholder) {
          items.push({ text: field.placeholder, style: 'fieldHint', margin: [4, -20, 0, 12] } as ContentText)
        }
        break
      }
    }

    return items
  }

  function exportPdfMakeDocDef(): TDocumentDefinitions {
    return exportToPdfMakeDefinition()
  }

  async function downloadPdfMake(filename = 'form-template.pdf') {
    const docDef = exportToPdfMakeDefinition()
    const pdfDocGenerator = pdfMake.createPdf(docDef)
    pdfDocGenerator.download(filename)
  }

  async function downloadPdfMakeJson(filename = 'form-template-pdfmake.json') {
    const docDef = exportToPdfMakeDefinition()
    const blob = new Blob([JSON.stringify(docDef, null, 2)], { type: 'application/json' })
    saveAs(blob, filename)
  }

  return {
    exportJSON,
    exportToPdf,
    exportPdfMakeDocDef,
    downloadJson,
    downloadPdf,
    downloadPdfMake,
    downloadPdfMakeJson,
    loadPdfSafely,
  }
}
