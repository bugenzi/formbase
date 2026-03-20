import { useEffect, useRef, useCallback } from 'react'
import { useFieldStore } from '../store/useFieldStore'
import type { SyncEvent } from '../sync/types'

/**
 * Bilateral sync between the web editor and external clients (e.g. Figma plugin).
 *
 * Connects to a WebSocket server at `syncServerUrl/${docId}`.
 * Incoming events from other origins are applied to the store (non-undoable).
 * Local changes can be emitted via the returned `emit()` function.
 *
 * Only active when both docId and syncServerUrl are provided.
 */
export function useFieldSync(docId: string | undefined, syncServerUrl: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const { updateField, addField, deleteField } = useFieldStore()

  useEffect(() => {
    if (!docId || !syncServerUrl) return

    const ws = new WebSocket(`${syncServerUrl}/${docId}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`[Sync] Connected to ${syncServerUrl}/${docId}`)
    }

    ws.onmessage = (event) => {
      let delta: SyncEvent
      try {
        delta = JSON.parse(event.data)
      } catch {
        return
      }

      // Ignore events from our own origin
      if (delta.origin === 'web') return

      // Remote changes are NOT pushed to undo history
      switch (delta.payload.type) {
        case 'field:move':
        case 'field:resize':
          updateField(delta.fieldId, {
            ptX: delta.payload.positionPt.x,
            ptY: delta.payload.positionPt.y,
            ptW: delta.payload.positionPt.w,
            ptH: delta.payload.positionPt.h,
          }, { undoable: false })
          break
        case 'field:label':
          updateField(delta.fieldId, { label: delta.payload.label }, { undoable: false })
          break
        case 'field:required':
          updateField(delta.fieldId, { required: delta.payload.required }, { undoable: false })
          break
        case 'field:add':
          addField(delta.payload.field, { undoable: false })
          break
        case 'field:delete':
          deleteField(delta.fieldId)
          break
      }
    }

    ws.onclose = () => {
      console.log('[Sync] Disconnected')
    }

    ws.onerror = (err) => {
      console.error('[Sync] WebSocket error:', err)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [docId, syncServerUrl, updateField, addField, deleteField])

  const emit = useCallback((event: Omit<SyncEvent, 'origin'>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...event, origin: 'web' }))
    }
  }, [])

  const connected = wsRef.current?.readyState === WebSocket.OPEN

  return { emit, connected }
}
