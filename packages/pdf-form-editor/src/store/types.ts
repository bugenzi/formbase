/**
 * Field — a form field placed on a PDF page.
 *
 * IMPORTANT: ptX, ptY, ptW, ptH are in PDF User Space (bottom-left origin, points).
 * Screen position is NEVER stored here. It is derived at render time via CoordEngine.pdfToScreen().
 * This is what makes the system zoom-stable and export-correct.
 */
export interface Field {
  id: string
  type: 'text' | 'signature' | 'initials' | 'date' | 'checkbox' | 'dropdown'
  pageIdx: number

  // PDF User Space coordinates — bottom-left origin, Y grows upward, units: points
  ptX: number
  ptY: number
  ptW: number
  ptH: number

  label: string
  required: boolean
  assignee: string
  aiPending?: boolean

  // Text styling (used in export and field preview)
  fontSize?: number
  fontColor?: string
  placeholder?: string
}

export interface TextOverlay {
  id: string
  pageIdx: number
  ptX: number
  ptY: number
  ptW: number
  ptH: number
  content: string
  fontSize: number
  fontFamily: string
  color: string
}

export interface FieldState {
  fields: Record<string, Field>
  textOverlays: Record<string, TextOverlay>
  selectedId: string | null
  selectedType: 'field' | 'text' | null
}

export interface FormSchema {
  version: '2.0'
  pages: Array<{ page: number; widthPt: number; heightPt: number }>
  fields: Array<{
    id: string
    type: Field['type']
    label: string
    page: number
    required: boolean
    assignee: string
    fontSize?: number
    fontColor?: string
    placeholder?: string
    positionPt: { x: number; y: number; w: number; h: number }
    // positionRel uses TOP-LEFT origin for front-end consumption compatibility
    // relY = (pageHeightPt - ptY - ptH) / pageHeightPt
    positionRel: { x: number; y: number; w: number; h: number }
  }>
  textOverlays?: Array<{
    id: string
    page: number
    positionPt: { x: number; y: number; w: number; h: number }
    content: string
    fontSize?: number
    fontFamily?: string
    color?: string
  }>
}

// Default sizes per field type (in PDF points, 72pt = 1 inch)
export const FIELD_DEFAULTS: Record<Field['type'], { ptW: number; ptH: number }> = {
  text:      { ptW: 180, ptH: 24 },
  signature: { ptW: 240, ptH: 48 },
  initials:  { ptW:  60, ptH: 40 },
  date:      { ptW: 100, ptH: 24 },
  checkbox:  { ptW:  14, ptH: 14 },
  dropdown:  { ptW: 160, ptH: 24 },
}
