// Figma plugin sandbox — no DOM, communicates with UI via postMessage.
// All coordinates in transit are PDF points (bottom-left origin).
// Y-flip happens HERE at the Figma boundary.

const TYPE_COLORS: Record<string, RGB> = {
  text:      { r: 0.15, g: 0.39, b: 0.92 },
  signature: { r: 0.06, g: 0.73, b: 0.51 },
  initials:  { r: 0.96, g: 0.62, b: 0.17 },
  date:      { r: 0.55, g: 0.36, b: 0.98 },
  checkbox:  { r: 0.94, g: 0.27, b: 0.27 },
  dropdown:  { r: 0.05, g: 0.65, b: 0.89 },
}

let pageHeights: Record<number, number> = {}

figma.showUI(__html__, { width: 360, height: 520, themeColors: true })

// ── Listen for messages from the UI iframe ──
figma.ui.onmessage = async (msg: any) => {

  // Get selected pages/frames and send their info to UI
  if (msg.type === 'get-pages') {
    const pages = figma.root.children.map((page, idx) => {
      const firstChild = page.children.length > 0 ? page.children[0] : null
      return {
        id: page.id,
        name: page.name,
        index: idx,
        width: firstChild && 'width' in firstChild ? firstChild.width : 612,
        height: firstChild && 'height' in firstChild ? firstChild.height : 792,
      }
    })
    figma.ui.postMessage({ type: 'pages', pages })
  }

  // Get selection info
  if (msg.type === 'get-selection') {
    const selection = figma.currentPage.selection.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      width: 'width' in node ? node.width : 0,
      height: 'height' in node ? node.height : 0,
    }))
    figma.ui.postMessage({ type: 'selection', selection })
  }

  // Export selected frames as images (for AI detection or preview)
  if (msg.type === 'export-frames') {
    const frames: Array<{ index: number; imageBase64: string; width: number; height: number }> = []

    for (const node of figma.currentPage.selection) {
      if ('exportAsync' in node) {
        try {
          const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } })
          const base64 = figma.base64Encode(bytes)
          frames.push({
            index: frames.length,
            imageBase64: base64,
            width: 'width' in node ? node.width : 0,
            height: 'height' in node ? node.height : 0,
          })
        } catch (e) {
          console.error('Export failed for', node.name, e)
        }
      }
    }

    figma.ui.postMessage({ type: 'exported-frames', frames })
  }

  // Store page heights for Y-flip calculations
  if (msg.type === 'set-page-heights') {
    pageHeights = msg.pageHeights
  }

  // Create form field frames from schema (import from web editor)
  if (msg.type === 'import-fields') {
    const fields: Array<{
      id: string; type: string; label: string;
      pageIdx: number; ptX: number; ptY: number; ptW: number; ptH: number;
      required: boolean
    }> = msg.fields

    let created = 0
    for (const field of fields) {
      const pageH = pageHeights[field.pageIdx] ?? 792
      createFieldFrame(field, pageH)
      created++
    }

    figma.notify(`Imported ${created} form fields`)
    figma.ui.postMessage({ type: 'import-complete', count: created })
  }

  // Apply a sync delta from the web editor
  if (msg.type === 'sync-delta') {
    const { fieldId, payload } = msg

    const node = figma.currentPage.findOne(
      n => n.getPluginData('formbaseFieldId') === fieldId
    ) as FrameNode | null

    if (!node && payload.type !== 'field:add') return

    const pageIdx = parseInt(node?.getPluginData('formbasePageIdx') ?? '0')
    const pageH = pageHeights[pageIdx] ?? 792

    switch (payload.type) {
      case 'field:move':
      case 'field:resize': {
        const pt = payload.positionPt
        node!.x = pt.x
        node!.y = pageH - pt.y - pt.h  // Y-FLIP: PDF → Figma
        node!.resize(pt.w, pt.h)
        break
      }
      case 'field:label': {
        node!.name = `[Form] ${payload.label}`
        const label = node!.findOne(n => n.name === '__label') as TextNode | null
        if (label) {
          await figma.loadFontAsync(label.fontName as FontName)
          label.characters = payload.label
        }
        break
      }
      case 'field:delete':
        node!.remove()
        break
      case 'field:add':
        createFieldFrame(payload.field, pageHeights[payload.field.pageIdx] ?? 792)
        break
    }
  }

  // Get all form field frames for export
  if (msg.type === 'export-fields') {
    const fields: Array<{
      id: string; type: string; label: string;
      pageIdx: number; ptX: number; ptY: number; ptW: number; ptH: number;
      required: boolean
    }> = []

    figma.currentPage.findAll(n => !!n.getPluginData('formbaseFieldId')).forEach(node => {
      const frame = node as FrameNode
      const pageIdx = parseInt(frame.getPluginData('formbasePageIdx') || '0')
      const pageH = pageHeights[pageIdx] ?? 792

      fields.push({
        id: frame.getPluginData('formbaseFieldId'),
        type: frame.getPluginData('formbaseFieldType') || 'text',
        label: frame.getPluginData('formbaseLabel') || frame.name.replace('[Form] ', ''),
        pageIdx,
        // Y-FLIP: Figma → PDF
        ptX: frame.x,
        ptY: pageH - frame.y - frame.height,
        ptW: frame.width,
        ptH: frame.height,
        required: frame.getPluginData('formbaseRequired') === 'true',
      })
    })

    figma.ui.postMessage({ type: 'fields-data', fields })
  }

  // Extract text content from selected frames
  if (msg.type === 'get-text-content') {
    const texts: Array<{ nodeId: string; name: string; content: string; x: number; y: number; width: number; height: number }> = []

    function walkNode(node: SceneNode) {
      if (node.type === 'TEXT') {
        texts.push({
          nodeId: node.id,
          name: node.name,
          content: node.characters,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        })
      }
      if ('children' in node) {
        for (const child of node.children) walkNode(child)
      }
    }

    for (const node of figma.currentPage.selection) walkNode(node)
    figma.ui.postMessage({ type: 'text-content', texts })
  }

  // Update text content in a specific node
  if (msg.type === 'update-text') {
    const node = figma.getNodeById(msg.nodeId) as TextNode | null
    if (node && node.type === 'TEXT') {
      await figma.loadFontAsync(node.fontName as FontName)
      node.characters = msg.content
      figma.ui.postMessage({ type: 'text-updated', nodeId: msg.nodeId })
    }
  }
}

// ── Listen for selection changes ──
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0,
  }))
  figma.ui.postMessage({ type: 'selection', selection })
})

// ── Listen for document changes (field moves in Figma → emit to web) ──
figma.on('documentchange', (event) => {
  for (const change of event.documentChanges) {
    if (change.type !== 'PROPERTY_CHANGE') continue

    const node = figma.getNodeById(change.id)
    if (!node) continue

    const fieldId = node.getPluginData('formbaseFieldId')
    if (!fieldId) continue

    const pageIdx = parseInt(node.getPluginData('formbasePageIdx') || '0')
    const pageH = pageHeights[pageIdx] ?? 792
    const frame = node as FrameNode

    // Y-FLIP: Figma → PDF
    figma.ui.postMessage({
      type: 'field-changed',
      fieldId,
      positionPt: {
        x: frame.x,
        y: pageH - frame.y - frame.height,
        w: frame.width,
        h: frame.height,
      },
    })
  }
})

// ── Create a form field frame ──
function createFieldFrame(
  field: { id: string; type: string; label: string; pageIdx: number; ptX: number; ptY: number; ptW: number; ptH: number; required: boolean },
  pageH: number,
) {
  const frame = figma.createFrame()
  frame.name = `[Form] ${field.label}`

  // Y-FLIP: PDF → Figma
  frame.x = field.ptX
  frame.y = pageH - field.ptY - field.ptH
  frame.resize(field.ptW, field.ptH)

  const color = TYPE_COLORS[field.type] ?? TYPE_COLORS.text
  frame.fills = [{ type: 'SOLID', color, opacity: 0.08 }]
  frame.strokes = [{ type: 'SOLID', color }]
  frame.strokeWeight = 1.5
  frame.dashPattern = [6, 4]
  frame.cornerRadius = 3
  frame.clipsContent = false

  // Store metadata as plugin data
  frame.setPluginData('formbaseFieldId', field.id)
  frame.setPluginData('formbaseFieldType', field.type)
  frame.setPluginData('formbaseLabel', field.label)
  frame.setPluginData('formbasePageIdx', String(field.pageIdx))
  frame.setPluginData('formbaseRequired', String(field.required))

  figma.currentPage.appendChild(frame)
  return frame
}
