import React, { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { useEditorContext } from '../context/EditorContext'

// CRITICAL: Set workerSrc in the same file where getDocument is used.
// pdf.worker.min.mjs is copied to /public by the postinstall script.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PdfCanvasProps {
  pdfFile: File | null
  scale: number
  onPageCount?: (count: number) => void
  onPageWarning?: (pageIdx: number, message: string) => void
  onVisiblePageChange?: (pageIdx: number) => void
  children?: (pageIdx: number) => React.ReactNode
}

export function PdfCanvas({ pdfFile, scale, onPageCount, onPageWarning, onVisiblePageChange, children }: PdfCanvasProps) {
  const { engine } = useEditorContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map())
  const renderedPagesRef = useRef<Set<number>>(new Set())

  const [pageWrappers, setPageWrappers] = useState<Map<number, HTMLDivElement>>(new Map())

  const renderPage = useCallback(async (pageIdx: number) => {
    const pdfDoc = pdfDocRef.current
    if (!pdfDoc) return

    const dpr = window.devicePixelRatio || 1
    const page: PDFPageProxy = await pdfDoc.getPage(pageIdx + 1)

    if (page.rotate !== 0) {
      onPageWarning?.(
        pageIdx,
        `Page ${pageIdx + 1} is rotated ${page.rotate}°. Field placement on rotated pages is not supported in this version.`,
      )
    }

    const viewport = page.getViewport({ scale: scale * dpr, rotation: page.rotate })

    const wrapper = containerRef.current?.querySelector(`[data-page="${pageIdx}"]`)
    if (!wrapper) return

    let canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) {
      canvas = document.createElement('canvas')
      wrapper.insertBefore(canvas, wrapper.firstChild)
    }

    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = viewport.width / dpr + 'px'
    canvas.style.height = viewport.height / dpr + 'px'

    const existingTask = renderTasksRef.current.get(pageIdx)
    if (existingTask) {
      try { existingTask.cancel() } catch {}
    }

    const ctx = canvas.getContext('2d')!
    const renderTask = page.render({ canvasContext: ctx, viewport })
    renderTasksRef.current.set(pageIdx, renderTask)

    try {
      await renderTask.promise
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'RenderingCancelledException') throw e
      return
    }

    renderTasksRef.current.delete(pageIdx)
    renderedPagesRef.current.add(pageIdx)

    ;(wrapper as HTMLElement).style.minHeight = viewport.height / dpr + 'px'

    const cssW = viewport.width / dpr
    const cssH = viewport.height / dpr
    engine.registerPage(
      pageIdx,
      cssW / scale,
      cssH / scale,
      cssW,
      cssH,
      page.rotate,
    )
  }, [scale, engine, onPageWarning])

  const destroyPage = useCallback((pageIdx: number) => {
    const task = renderTasksRef.current.get(pageIdx)
    if (task) { try { task.cancel() } catch {} }
    renderTasksRef.current.delete(pageIdx)
    renderedPagesRef.current.delete(pageIdx)
    engine.deregisterPage(pageIdx)

    const wrapper = containerRef.current?.querySelector(`[data-page="${pageIdx}"]`)
    const canvas = wrapper?.querySelector('canvas')
    if (canvas) canvas.remove()
  }, [engine])

  useEffect(() => {
    if (!pdfFile) return

    let cancelled = false

    async function load() {
      const arrayBuffer = await pdfFile.arrayBuffer()

      // Security hardening for untrusted PDFs:
      // - use TypedArray input as recommended by PDF.js
      // - keep XFA disabled unless we deliberately support it
      // - stop at parse errors instead of attempting aggressive recovery
      // - explicitly disable eval support as a defense-in-depth measure
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        enableXfa: false,
        stopAtErrors: true,
        isEvalSupported: false,
      } as unknown as Parameters<typeof pdfjsLib.getDocument>[0])

      const pdfDoc = await loadingTask.promise
      if (cancelled) {
        pdfDoc.destroy()
        return
      }

      pdfDocRef.current = pdfDoc
      onPageCount?.(pdfDoc.numPages)

      const container = containerRef.current
      if (!container) return
      container.innerHTML = ''

      const wrappers = new Map<number, HTMLDivElement>()
      for (let i = 0; i < pdfDoc.numPages; i++) {
        const wrapper = document.createElement('div')
        wrapper.className = 'pdf-page-wrapper'
        wrapper.dataset.page = String(i)
        wrapper.style.minHeight = '800px'
        wrapper.style.position = 'relative'
        container.appendChild(wrapper)
        wrappers.set(i, wrapper)
      }

      setPageWrappers(wrappers)

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const idx = parseInt((entry.target as HTMLElement).dataset.page!)
          if (entry.isIntersecting) {
            onVisiblePageChange?.(idx)
            if (!renderedPagesRef.current.has(idx)) renderPage(idx)
          } else {
            const current = [...renderedPagesRef.current].sort()[0] ?? 0
            if (Math.abs(idx - current) > 1) destroyPage(idx)
          }
        })
      }, { rootMargin: '200px' })

      container.querySelectorAll('[data-page]').forEach(el => observer.observe(el))

      return () => observer.disconnect()
    }

    load()
    return () => { cancelled = true }
  }, [pdfFile, renderPage, destroyPage, onPageCount, onVisiblePageChange])

  return (
    <div ref={containerRef} className="pdf-canvas-container">
      {children && Array.from(pageWrappers.entries()).map(([pageIdx, wrapperEl]) =>
        createPortal(children(pageIdx), wrapperEl, `page-overlay-${pageIdx}`)
      )}
    </div>
  )
}
