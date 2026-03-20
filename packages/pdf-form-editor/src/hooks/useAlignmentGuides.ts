/**
 * useAlignmentGuides — shows visual snap lines when dragging or resizing fields.
 *
 * During a drag, call computeGuides() on every move event.
 * It compares the dragged field's edges/center against all other fields
 * on the same page and:
 *   1. Renders thin guide lines into the field layer
 *   2. Returns snap-adjusted X/Y if within threshold
 *
 * Call clearGuides() on drag end to remove all lines.
 */

import { useRef, useCallback } from 'react'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'

const SNAP_THRESHOLD = 6 // px proximity to trigger alignment snap

export function useAlignmentGuides() {
  const { engine } = useEditorContext()
  const guideEls = useRef<HTMLElement[]>([])

  const clearGuides = useCallback(() => {
    for (const el of guideEls.current) el.remove()
    guideEls.current = []
  }, [])

  const computeGuides = useCallback((
    dragId: string,
    dragX: number,
    dragY: number,
    dragW: number,
    dragH: number,
    pageIdx: number,
    layerEl: HTMLElement | null,
  ): { snapX: number | null; snapY: number | null } => {
    clearGuides()

    if (!layerEl) return { snapX: null, snapY: null }

    const allFields = useFieldStore.getState().fields
    const others = Object.values(allFields).filter(
      f => f.pageIdx === pageIdx && f.id !== dragId,
    )

    if (others.length === 0) return { snapX: null, snapY: null }

    const dragLeft = dragX
    const dragRight = dragX + dragW
    const dragCenterX = dragX + dragW / 2
    const dragTop = dragY
    const dragBottom = dragY + dragH
    const dragCenterY = dragY + dragH / 2

    let snapX: number | null = null
    let snapY: number | null = null
    let bestDx = SNAP_THRESHOLD
    let bestDy = SNAP_THRESHOLD

    const vLines = new Set<number>()
    const hLines = new Set<number>()

    for (const other of others) {
      const s = engine.pdfToScreen(other.ptX, other.ptY, other.ptW, other.ptH, other.pageIdx)
      if (!s) continue

      const oLeft = s.x
      const oRight = s.x + s.w
      const oCenterX = s.x + s.w / 2
      const oTop = s.y
      const oBottom = s.y + s.h
      const oCenterY = s.y + s.h / 2

      // Vertical alignment checks (X axis)
      const xPairs: Array<[number, number, number]> = [
        [dragLeft, oLeft, oLeft],                                // left-left
        [dragLeft, oRight, oRight],                              // left-right
        [dragRight, oLeft, oLeft - dragW],                       // right-left
        [dragRight, oRight, oRight - dragW],                     // right-right
        [dragCenterX, oCenterX, oCenterX - dragW / 2],          // center-center
      ]

      for (const [dEdge, oEdge, snap] of xPairs) {
        const dist = Math.abs(dEdge - oEdge)
        if (dist < SNAP_THRESHOLD) {
          vLines.add(Math.round(oEdge))
          if (dist < bestDx) {
            bestDx = dist
            snapX = snap
          }
        }
      }

      // Horizontal alignment checks (Y axis)
      const yPairs: Array<[number, number, number]> = [
        [dragTop, oTop, oTop],                                   // top-top
        [dragTop, oBottom, oBottom],                              // top-bottom
        [dragBottom, oTop, oTop - dragH],                        // bottom-top
        [dragBottom, oBottom, oBottom - dragH],                  // bottom-bottom
        [dragCenterY, oCenterY, oCenterY - dragH / 2],          // center-center
      ]

      for (const [dEdge, oEdge, snap] of yPairs) {
        const dist = Math.abs(dEdge - oEdge)
        if (dist < SNAP_THRESHOLD) {
          hLines.add(Math.round(oEdge))
          if (dist < bestDy) {
            bestDy = dist
            snapY = snap
          }
        }
      }
    }

    // Render vertical guide lines
    for (const x of vLines) {
      const line = document.createElement('div')
      line.className = 'alignment-guide alignment-guide--v'
      line.style.cssText = `position:absolute;left:${x}px;top:0;width:1px;height:100%;pointer-events:none;z-index:50;`
      layerEl.appendChild(line)
      guideEls.current.push(line)
    }

    // Render horizontal guide lines
    for (const y of hLines) {
      const line = document.createElement('div')
      line.className = 'alignment-guide alignment-guide--h'
      line.style.cssText = `position:absolute;top:${y}px;left:0;height:1px;width:100%;pointer-events:none;z-index:50;`
      layerEl.appendChild(line)
      guideEls.current.push(line)
    }

    return { snapX, snapY }
  }, [engine, clearGuides])

  return { computeGuides, clearGuides }
}
