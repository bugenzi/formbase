// Figma Plugin UI — runs in iframe with full DOM + network access.
// Communicates with sandbox (code.ts) via parent.postMessage.
// Connects to sync server via WebSocket.

const FIELD_TYPES = [
  { type: 'text', label: 'Text', color: '#3b82f6' },
  { type: 'signature', label: 'Signature', color: '#10b981' },
  { type: 'initials', label: 'Initials', color: '#f59e0b' },
  { type: 'date', label: 'Date', color: '#8b5cf6' },
  { type: 'checkbox', label: 'Checkbox', color: '#ef4444' },
  { type: 'dropdown', label: 'Dropdown', color: '#06b6d4' },
]

// ── State ──
let ws: WebSocket | null = null
let currentDocId = ''
let connected = false
let currentTab = 'pages'
let selection: Array<{ id: string; name: string; type: string; width: number; height: number }> = []
let texts: Array<{ nodeId: string; name: string; content: string }> = []

// ── DOM ──
const app = document.getElementById('app')!

function render() {
  app.innerHTML = `
    <div class="header">
      <div class="header__logo">F</div>
      <span class="header__title">Formbase</span>
      <div class="header__status header__status--${connected ? 'connected' : 'disconnected'}" title="${connected ? 'Connected' : 'Disconnected'}"></div>
    </div>

    <div class="tabs">
      <button class="tab ${currentTab === 'pages' ? 'tab--active' : ''}" data-tab="pages">Pages</button>
      <button class="tab ${currentTab === 'fields' ? 'tab--active' : ''}" data-tab="fields">Fields</button>
      <button class="tab ${currentTab === 'text' ? 'tab--active' : ''}" data-tab="text">Text</button>
      <button class="tab ${currentTab === 'sync' ? 'tab--active' : ''}" data-tab="sync">Sync</button>
      <button class="tab ${currentTab === 'export' ? 'tab--active' : ''}" data-tab="export">Export</button>
    </div>

    <!-- Pages Tab -->
    <div class="panel ${currentTab === 'pages' ? 'panel--active' : ''}">
      <div class="section">
        <div class="section__title">Selected Frames</div>
        ${selection.length === 0 ? `
          <div class="empty">
            <div class="empty__icon">&#9633;</div>
            <div class="empty__text">Select frames on the canvas<br>to work with them</div>
          </div>
        ` : `
          <div class="sel-list">
            ${selection.map(s => `
              <div class="sel-item">
                <svg class="sel-item__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>
                <span class="sel-item__name">${s.name}</span>
                <span class="sel-item__size">${Math.round(s.width)}&times;${Math.round(s.height)}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      ${selection.length > 0 ? `
        <button class="btn btn--primary" id="btn-export-frames">
          Export as Images for AI Detection
        </button>
      ` : ''}
    </div>

    <!-- Fields Tab -->
    <div class="panel ${currentTab === 'fields' ? 'panel--active' : ''}">
      <div class="section">
        <div class="section__title">Add Form Field</div>
        <div class="field-types">
          ${FIELD_TYPES.map(ft => `
            <button class="field-chip" data-add-field="${ft.type}">
              <span class="field-chip__dot" style="background:${ft.color}"></span>
              ${ft.label}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="section">
        <button class="btn btn--secondary" id="btn-get-fields">List All Form Fields</button>
      </div>
    </div>

    <!-- Text Tab -->
    <div class="panel ${currentTab === 'text' ? 'panel--active' : ''}">
      <div class="section">
        <div class="section__title">Text in Selection</div>
        <button class="btn btn--secondary btn--small" id="btn-get-text" style="margin-bottom:8px">Scan Selected Frames</button>
        ${texts.length > 0 ? `
          <div class="text-list">
            ${texts.map(t => `
              <div class="text-item">
                <div class="text-item__name">${t.name}</div>
                <textarea class="text-item__input" data-node-id="${t.nodeId}" rows="2">${t.content}</textarea>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty">
            <div class="empty__text">Select frames and click scan to find editable text</div>
          </div>
        `}
      </div>
    </div>

    <!-- Sync Tab -->
    <div class="panel ${currentTab === 'sync' ? 'panel--active' : ''}">
      <div class="section">
        <div class="section__title">Connect to Web Editor</div>
        <div class="sync-url">
          <input type="text" id="sync-url" placeholder="ws://localhost:3002" value="ws://localhost:3002" />
        </div>
        <div class="sync-url">
          <input type="text" id="sync-doc-id" placeholder="Document ID" value="${currentDocId}" />
        </div>
        <button class="btn ${connected ? 'btn--secondary' : 'btn--primary'}" id="btn-sync">
          ${connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </div>

    <!-- Export Tab -->
    <div class="panel ${currentTab === 'export' ? 'panel--active' : ''}">
      <div class="section">
        <div class="section__title">Export Form Fields</div>
        <div class="btn-row">
          <button class="btn btn--primary" id="btn-export-json">Export JSON</button>
          <button class="btn btn--secondary" id="btn-export-pdf">Export PDF</button>
        </div>
      </div>
      <div class="section">
        <div class="section__title">Import</div>
        <button class="btn btn--secondary" id="btn-import-json">Import JSON Schema</button>
      </div>
    </div>
  `

  bindEvents()
}

// ── Event Binding ──
function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = (tab as HTMLElement).dataset.tab!
      render()
    })
  })

  // Export frames as images
  document.getElementById('btn-export-frames')?.addEventListener('click', () => {
    postToPlugin({ type: 'export-frames' })
  })

  // Add field
  document.querySelectorAll('[data-add-field]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.addField!
      const id = crypto.randomUUID()
      // Add field at center of first selected frame or at 100,100
      const target = selection[0]
      const ptW = type === 'signature' ? 240 : type === 'checkbox' ? 14 : 180
      const ptH = type === 'signature' ? 48 : type === 'checkbox' ? 14 : 24

      postToPlugin({
        type: 'sync-delta',
        fieldId: id,
        payload: {
          type: 'field:add',
          field: {
            id,
            type,
            label: type,
            pageIdx: 0,
            ptX: target ? target.width / 2 - ptW / 2 : 100,
            ptY: target ? target.height / 2 : 400,
            ptW,
            ptH,
            required: false,
            assignee: '',
          },
        },
      })

      // Also emit to sync server
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          docId: currentDocId,
          fieldId: id,
          origin: 'figma',
          timestamp: Date.now(),
          payload: { type: 'field:add', field: { id, type, label: type, pageIdx: 0, ptX: 100, ptY: 400, ptW, ptH, required: false, assignee: '' } },
        }))
      }

      showToast(`Added ${type} field`)
    })
  })

  // Get fields
  document.getElementById('btn-get-fields')?.addEventListener('click', () => {
    postToPlugin({ type: 'export-fields' })
  })

  // Get text
  document.getElementById('btn-get-text')?.addEventListener('click', () => {
    postToPlugin({ type: 'get-text-content' })
  })

  // Text editing
  document.querySelectorAll('.text-item__input').forEach(textarea => {
    textarea.addEventListener('blur', (e) => {
      const el = e.target as HTMLTextAreaElement
      postToPlugin({ type: 'update-text', nodeId: el.dataset.nodeId, content: el.value })
    })
  })

  // Sync connect/disconnect
  document.getElementById('btn-sync')?.addEventListener('click', () => {
    if (connected) {
      ws?.close()
      return
    }
    const url = (document.getElementById('sync-url') as HTMLInputElement).value
    const docId = (document.getElementById('sync-doc-id') as HTMLInputElement).value
    if (!url || !docId) { showToast('Enter URL and Document ID'); return }
    currentDocId = docId
    connectSync(url, docId)
  })

  // Export JSON
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    postToPlugin({ type: 'export-fields' })
    // The response handler will trigger download
    pendingExport = 'json'
  })

  // Export PDF
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
    postToPlugin({ type: 'export-fields' })
    pendingExport = 'pdf'
  })

  // Import JSON
  document.getElementById('btn-import-json')?.addEventListener('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const schema = JSON.parse(text)
        if (schema.fields) {
          const fields = schema.fields.map((f: any) => ({
            id: f.id || crypto.randomUUID(),
            type: f.type || 'text',
            label: f.label || f.type,
            pageIdx: (f.page ?? 1) - 1,
            ptX: f.positionPt?.x ?? 0,
            ptY: f.positionPt?.y ?? 0,
            ptW: f.positionPt?.w ?? 180,
            ptH: f.positionPt?.h ?? 24,
            required: f.required ?? false,
          }))
          postToPlugin({ type: 'import-fields', fields })
        }
      } catch {
        showToast('Invalid JSON file')
      }
    }
    input.click()
  })
}

let pendingExport: 'json' | 'pdf' | null = null

// ── Plugin Message Handler ──
window.onmessage = (event) => {
  const msg = event.data.pluginMessage
  if (!msg) return

  if (msg.type === 'selection') {
    selection = msg.selection
    render()
  }

  if (msg.type === 'text-content') {
    texts = msg.texts
    render()
  }

  if (msg.type === 'fields-data') {
    if (pendingExport === 'json') {
      const schema = {
        version: '2.0',
        pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
        fields: msg.fields.map((f: any) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          page: f.pageIdx + 1,
          required: f.required,
          assignee: '',
          positionPt: { x: f.ptX, y: f.ptY, w: f.ptW, h: f.ptH },
        })),
      }
      downloadJSON(schema, 'formbase-schema.json')
      showToast(`Exported ${msg.fields.length} fields as JSON`)
    } else if (pendingExport === 'pdf') {
      // Send to server for PDF generation
      exportAsPdf(msg.fields)
    } else {
      showToast(`Found ${msg.fields.length} form fields`)
    }
    pendingExport = null
  }

  if (msg.type === 'exported-frames') {
    showToast(`Exported ${msg.frames.length} frame(s) as images`)
  }

  if (msg.type === 'import-complete') {
    showToast(`Imported ${msg.count} fields`)
  }

  if (msg.type === 'field-changed' && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      docId: currentDocId,
      fieldId: msg.fieldId,
      origin: 'figma',
      timestamp: Date.now(),
      payload: { type: 'field:move', positionPt: msg.positionPt },
    }))
  }

  if (msg.type === 'text-updated') {
    showToast('Text updated')
  }
}

// ── Sync WebSocket ──
function connectSync(url: string, docId: string) {
  ws = new WebSocket(`${url}/${docId}`)

  ws.onopen = () => {
    connected = true
    render()
    showToast('Connected to web editor')
    // Send page heights to sandbox
    postToPlugin({ type: 'set-page-heights', pageHeights: { 0: 792 } })
  }

  ws.onmessage = (event) => {
    const delta = JSON.parse(event.data)
    if (delta.origin === 'figma') return // ignore own echoes
    // Forward to sandbox to apply
    postToPlugin({ type: 'sync-delta', fieldId: delta.fieldId, payload: delta.payload })
  }

  ws.onclose = () => {
    connected = false
    render()
  }

  ws.onerror = () => {
    showToast('Connection failed')
  }
}

// ── Export helpers ──
function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportAsPdf(fields: any[]) {
  try {
    const schema = {
      version: '2.0',
      pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
      fields: fields.map((f: any) => ({
        id: f.id, type: f.type, label: f.label,
        page: f.pageIdx + 1, required: f.required, assignee: '',
        positionPt: { x: f.ptX, y: f.ptY, w: f.ptW, h: f.ptH },
      })),
    }
    // For now, download as JSON — PDF generation requires the original PDF file
    // which would need to be uploaded to the server first
    downloadJSON(schema, 'formbase-schema.json')
    showToast('Exported schema (PDF export requires web editor)')
  } catch {
    showToast('Export failed')
  }
}

// ── Helpers ──
function postToPlugin(msg: any) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

function showToast(message: string) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

// ── Init ──
postToPlugin({ type: 'get-selection' })
render()
