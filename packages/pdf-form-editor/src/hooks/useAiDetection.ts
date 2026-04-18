import { nanoid } from 'nanoid'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { Field } from '../store/types'
import { FIELD_DEFAULTS } from '../store/types'

interface DetectionStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: { current: number; total: number; page: number } | null
  error: string | null
}

/**
 * AI detection pipeline:
 * 1. Capture each page as JPEG from its canvas
 * 2. POST to aiProxyUrl (your server — never call Anthropic directly from browser)
 * 3. Server returns relative 0–1 coords (top-left origin)
 * 4. relToScreen() converts to DOM pixels (no Y-flip — AI is already top-left)
 * 5. screenToPdf() converts to PDF points with Y-flip
 * 6. Field is added as aiPending=true for user confirmation
 */
export function useAiDetection(
  setStatus: (s: DetectionStatus) => void,
) {
  const { addField } = useFieldStore.getState()
  const { engine, aiProxyUrl } = useEditorContext()

  function assertAiProxyConfigured() {
    if (!aiProxyUrl.trim()) {
      throw new Error('AI detection is disabled. Configure aiProxyUrl to enable it.')
    }
  }

  async function detectPage(pageIdx: number): Promise<void> {
    assertAiProxyConfigured()

    const pageEl = document.querySelector<HTMLElement>(`[data-page="${pageIdx}"]`)
    const canvas = pageEl?.querySelector('canvas')
    if (!canvas) throw new Error(`Canvas not found for page ${pageIdx}`)

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

    const response = await fetch(aiProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, pageIndex: pageIdx }),
    })

    if (!response.ok) {
      throw new Error(`AI proxy returned ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const detectedFields: Array<{
      type: Field['type']
      label: string
      x: number; y: number; w: number; h: number
      required: boolean
    }> = data.fields ?? []

    for (const detected of detectedFields) {
      const screen = engine.relToScreen(detected.x, detected.y, detected.w, detected.h, pageIdx)
      if (!screen) continue

      const pts = engine.screenToPdf(screen.x, screen.y, screen.w, screen.h, pageIdx)
      if (!pts) continue

      const fieldType = detected.type in FIELD_DEFAULTS ? detected.type : 'text'

      addField({
        id: nanoid(),
        type: fieldType,
        pageIdx,
        ptX: pts.x,
        ptY: pts.y,
        ptW: pts.w,
        ptH: pts.h,
        label: detected.label || fieldType,
        required: detected.required ?? false,
        assignee: '',
        aiPending: true,
      })
    }
  }

  async function detectAll(totalPages: number): Promise<void> {
    try {
      assertAiProxyConfigured()
    } catch (error) {
      setStatus({ status: 'error', progress: null, error: (error as Error).message })
      return
    }

    setStatus({ status: 'running', progress: { current: 0, total: totalPages, page: 0 }, error: null })

    const BATCH_SIZE = 3
    for (let i = 0; i < totalPages; i += BATCH_SIZE) {
      const batch = Array.from(
        { length: Math.min(BATCH_SIZE, totalPages - i) },
        (_, j) => detectPage(i + j),
      )

      try {
        await Promise.all(batch)
      } catch (e) {
        setStatus({ status: 'error', progress: null, error: (e as Error).message })
        return
      }

      setStatus({
        status: 'running',
        progress: { current: Math.min(i + BATCH_SIZE, totalPages), total: totalPages, page: i + BATCH_SIZE },
        error: null,
      })
    }

    setStatus({ status: 'done', progress: null, error: null })
  }

  return { detectAll, detectPage }
}
