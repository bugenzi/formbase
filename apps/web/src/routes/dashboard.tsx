import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthFetch } from '../lib/useAuthFetch'
import '../styles/dashboard.css'

interface DocumentItem {
  id: string
  name: string
  fieldCount: number
  pdfUrl: string | null
  updatedAt: string
}

function useDocuments() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const authFetch = useAuthFetch()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/documents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDocs(data.documents ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  const deleteDoc = useCallback(async (id: string) => {
    await authFetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }, [authFetch])

  useEffect(() => { refresh() }, [refresh])
  return { docs, loading, error, refresh, deleteDoc }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function PdfThumbnail({ url }: { url: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!url || !canvasRef.current) return
    let cancelled = false

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await pdfjsLib.getDocument(url!).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 0.4 })

        const canvas = canvasRef.current!
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise

        if (!cancelled) setLoaded(true)
        pdf.destroy()
      } catch {
        // PDF load failed — show fallback
      }
    }

    render()
    return () => { cancelled = true }
  }, [url])

  return (
    <div className="db-card__preview">
      {url ? (
        <canvas
          ref={canvasRef}
          className="db-card__thumbnail"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      ) : null}
      {!loaded && (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
          <rect x="6" y="3" width="20" height="26" rx="3" />
          <line x1="10" y1="11" x2="22" y2="11" /><line x1="10" y1="16" x2="22" y2="16" /><line x1="10" y1="21" x2="18" y2="21" />
        </svg>
      )}
    </div>
  )
}

function DocCard({ doc, onDelete }: { doc: DocumentItem; onDelete: () => void }) {
  const nav = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="db-card" onClick={() => nav(`/editor?doc=${doc.id}`)}>
      <PdfThumbnail url={doc.pdfUrl} />
      <div className="db-card__body">
        <h4 className="db-card__name">{doc.name}</h4>
        <div className="db-card__meta">
          <span>{doc.fieldCount} field{doc.fieldCount !== 1 ? 's' : ''}</span>
          <span className="db-card__sep">&middot;</span>
          <span>{formatRelative(doc.updatedAt)}</span>
        </div>
      </div>
      <div className="db-card__actions" onClick={e => e.stopPropagation()}>
        {confirmDelete ? (
          <>
            <button className="db-card__action db-card__action--danger" onClick={onDelete}>Delete</button>
            <button className="db-card__action" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <button className="db-card__action" onClick={() => setConfirmDelete(true)} title="Delete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 4 5 13 11 13 12 4" /><line x1="3" y1="4" x2="13" y2="4" /><path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function DashboardRoute() {
  const nav = useNavigate()
  const { docs, loading, error, deleteDoc } = useDocuments()
  const [uploading, setUploading] = useState(false)
  const authFetch = useAuthFetch()

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('name', file.name.replace(/\.pdf$/i, ''))
      const res = await authFetch('/api/documents', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const data = await res.json()
      nav(`/editor?doc=${data.id}`)
    } catch (e) {
      console.error('[Dashboard] Upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  function handleFilePick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf'
    input.onchange = () => { if (input.files?.[0]) handleUpload(input.files[0]) }
    input.click()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') handleUpload(file)
  }

  return (
    <div className="db" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <nav className="db-nav">
        <div className="db-nav__inner">
          <Link className="db-nav__logo" to="/">
            <div className="db-nav__logo-mark">F</div>
            <span>Formbase</span>
          </Link>
          <div className="db-nav__right">
            <button className="db-btn db-btn--primary db-btn--sm" onClick={handleFilePick} disabled={uploading}>
              {uploading ? 'Uploading...' : 'New Document'}
            </button>
          </div>
        </div>
      </nav>

      <main className="db-main">
        <div className="db-header">
          <h1 className="db-header__title">Documents</h1>
          <p className="db-header__sub">Your PDF form projects</p>
        </div>

        {loading && <div className="db-loading"><div className="db-loading__spinner" /></div>}

        {error && (
          <div className="db-error">
            <p>Failed to load documents: {error}</p>
            <p className="db-error__hint">Make sure the server is running and you're signed in.</p>
          </div>
        )}

        {!loading && !error && docs.length === 0 && (
          <div className="db-empty">
            <div className="db-empty__icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25">
                <rect x="10" y="6" width="36" height="44" rx="4" /><line x1="18" y1="20" x2="38" y2="20" /><line x1="18" y1="27" x2="38" y2="27" /><line x1="18" y1="34" x2="32" y2="34" /><rect x="30" y="38" width="14" height="10" rx="2" strokeDasharray="3 2" />
              </svg>
            </div>
            <h3 className="db-empty__title">No documents yet</h3>
            <p className="db-empty__hint">Upload a PDF to start adding form fields</p>
            <button className="db-btn db-btn--primary" onClick={() => nav('/editor')}>Open Editor <span aria-hidden="true">&rarr;</span></button>
          </div>
        )}

        {!loading && docs.length > 0 && (
          <div className="db-grid">
            <div className="db-card db-card--upload" onClick={handleFilePick}>
              <div className="db-card--upload__icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="14" y1="8" x2="14" y2="20" /><line x1="8" y1="14" x2="20" y2="14" /></svg>
              </div>
              <span className="db-card--upload__label">New Document</span>
            </div>
            {docs.map(doc => (
              <DocCard key={doc.id} doc={doc} onDelete={() => deleteDoc(doc.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
