import { useEffect, useRef, useCallback } from 'react'
import { useFieldStore } from '../store/useFieldStore'
import { useFormExport } from './useFormExport'

const SAVE_INTERVAL_MS = 15_000

/**
 * Auto-saves the form schema to the server.
 *
 * @param docId — document ID (auto-save disabled when undefined)
 * @param fetchFn — optional custom fetch (e.g. with auth headers). Defaults to window.fetch.
 */
export function useAutoSave(
  docId: string | undefined,
  fetchFn?: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const isDirty = useRef(false)
  const { exportJSON } = useFormExport()
  const fetcher = fetchFn ?? fetch

  const save = useCallback(() => {
    if (!isDirty.current || !docId) return
    const schema = exportJSON()
    fetcher(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema }),
    }).then(() => {
      isDirty.current = false
    }).catch((err) => {
      console.error('[useAutoSave] Save failed:', err)
    })
  }, [docId, exportJSON, fetcher])

  useEffect(() => {
    if (!docId) return

    const unsub = useFieldStore.subscribe(() => {
      isDirty.current = true
    })

    const interval = setInterval(save, SAVE_INTERVAL_MS)

    function handleUnload() {
      if (!isDirty.current || !docId) return
      const schema = exportJSON()
      navigator.sendBeacon(
        `/api/documents/${docId}`,
        JSON.stringify({ schema }),
      )
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      unsub()
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      save() // Save on unmount
    }
  }, [docId, exportJSON, save])
}
