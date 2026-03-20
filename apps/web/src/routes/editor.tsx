import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PdfFormEditor, useFieldStore } from '@formpdf/editor'
import type { FormSchema } from '@formpdf/editor'
import { useAuthFetch } from '../lib/useAuthFetch'
import '@formpdf/editor/styles.css'

export default function EditorRoute() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const docId = params.get('doc') ?? undefined
  const authFetch = useAuthFetch()

  const [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(!!docId)
  const [error, setError] = useState<string | null>(null)

  // When docId is present, fetch the document from the API
  useEffect(() => {
    if (!docId) return

    let cancelled = false

    async function loadDocument() {
      try {
        // Fetch document metadata + schema
        const docRes = await authFetch(`/api/documents/${docId}`)
        if (!docRes.ok) {
          if (docRes.status === 404) throw new Error('Document not found')
          throw new Error(`Failed to load document: HTTP ${docRes.status}`)
        }
        const doc = await docRes.json()

        // Fetch signed PDF URL
        const urlRes = await authFetch(`/api/documents/${docId}/pdf-url`)
        if (!urlRes.ok) throw new Error('Failed to get PDF URL')
        const { url } = await urlRes.json()

        if (cancelled) return

        setPdfUrl(url)

        // Load saved fields into the store
        const schema = doc.schema as FormSchema
        if (schema?.fields?.length > 0) {
          const store = useFieldStore.getState()
          store.clearAll()

          for (const sf of schema.fields) {
            store.addField({
              id: sf.id,
              type: sf.type,
              pageIdx: (sf.page ?? 1) - 1,
              ptX: sf.positionPt.x,
              ptY: sf.positionPt.y,
              ptW: sf.positionPt.w,
              ptH: sf.positionPt.h,
              label: sf.label,
              required: sf.required,
              assignee: sf.assignee,
            }, { undoable: false })
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDocument()
    return () => { cancelled = true }
  }, [docId, authFetch])

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: 'DM Sans, system-ui, sans-serif',
        color: '#999',
      }}>
        <div style={{
          width: 28, height: 28,
          border: '2.5px solid rgba(0,0,0,0.06)',
          borderTopColor: '#e8793b',
          borderRadius: '50%',
          animation: 'spin .65s linear infinite',
        }} />
        Loading document...
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: 'DM Sans, system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 32, opacity: 0.2 }}>!</div>
        <p style={{ color: '#666' }}>{error}</p>
        <button
          onClick={() => nav('/dashboard')}
          style={{
            padding: '8px 20px',
            border: 'none',
            borderRadius: 8,
            background: '#e8793b',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <PdfFormEditor
      pdfUrl={pdfUrl}
      aiProxyUrl="/api/pdf-detect"
      docId={docId}
      fetchFn={authFetch}
      onExport={(schema) => {
        console.log('[Formbase] Schema exported:', schema)
      }}
      onSave={(bytes) => {
        console.log('[Formbase] PDF bytes ready, length:', bytes.length)
      }}
    />
  )
}
