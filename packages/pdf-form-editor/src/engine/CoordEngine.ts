/**
 * CoordEngine — converts between three coordinate spaces:
 *
 * Space 1: PDF User Space
 *   Origin: bottom-left of page. Y grows UPWARD. Units: points (1/72 inch).
 *   Used by: pdf-lib AcroForm Rect, the stored Field interface, export schema.
 *
 * Space 2: Canvas/DOM Space
 *   Origin: top-left of page overlay div. Y grows DOWNWARD. Units: CSS pixels.
 *   Used by: interact.js drag events, element.style.left/top, IntersectionObserver.
 *
 * Space 3: Relative (AI output)
 *   Origin: top-left (same as DOM). Both axes 0.0–1.0 fractions of page size.
 *   Used by: AI detection response, Figma bridge positionRel.
 *
 * THE ONLY CORRECT Y-FLIP:
 *   PDF → Screen: screenY = (pdfHeightPt - ptY - ptH) * scaleY
 *   Screen → PDF: ptY = pdfHeightPt - (screenY / scaleY) - (screenH / scaleY)
 *
 * Fields on page N are positioned relative to page N's overlay div.
 * They are NOT positioned relative to the document scroll container.
 */

export interface PageRegistration {
  pdfWidthPt: number
  pdfHeightPt: number
  canvasWidthPx: number   // CSS pixels (already divided by devicePixelRatio)
  canvasHeightPx: number
  scaleX: number          // canvasWidthPx / pdfWidthPt
  scaleY: number          // canvasHeightPx / pdfHeightPt
  rotation: number        // 0 | 90 | 180 | 270 — from page.rotate in pdfjs
}

export interface PdfRect {
  x: number  // bottom-left origin
  y: number  // bottom-left origin, grows upward
  w: number
  h: number
}

export interface ScreenRect {
  x: number  // top-left origin
  y: number  // top-left origin, grows downward
  w: number
  h: number
}

export class CoordEngine {
  readonly pages = new Map<number, PageRegistration>()

  registerPage(
    pageIdx: number,
    pdfWidthPt: number,
    pdfHeightPt: number,
    canvasWidthPx: number,
    canvasHeightPx: number,
    rotation: number = 0,
  ): void {
    this.pages.set(pageIdx, {
      pdfWidthPt,
      pdfHeightPt,
      canvasWidthPx,
      canvasHeightPx,
      scaleX: canvasWidthPx / pdfWidthPt,
      scaleY: canvasHeightPx / pdfHeightPt,
      rotation,
    })
  }

  deregisterPage(pageIdx: number): void {
    this.pages.delete(pageIdx)
  }

  getPage(pageIdx: number): PageRegistration | undefined {
    return this.pages.get(pageIdx)
  }

  /**
   * PDF points → screen pixels.
   * Applies Y-flip: PDF bottom-left origin → DOM top-left origin.
   * Call this when rendering a stored field onto the canvas overlay.
   */
  pdfToScreen(
    ptX: number,
    ptY: number,
    ptW: number,
    ptH: number,
    pageIdx: number,
  ): ScreenRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    if (p.rotation !== 0) {
      console.warn(
        `[CoordEngine] Page ${pageIdx} has rotation=${p.rotation}. ` +
        `Only 0° is supported in MVP. Field will be misplaced.`,
      )
    }

    return {
      x: ptX * p.scaleX,
      y: (p.pdfHeightPt - ptY - ptH) * p.scaleY,  // ← THE Y-FLIP
      w: ptW * p.scaleX,
      h: ptH * p.scaleY,
    }
  }

  /**
   * Screen pixels → PDF points.
   * Reverses Y-flip: DOM top-left origin → PDF bottom-left origin.
   * Call this on drag-end to persist the new position.
   */
  screenToPdf(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    pageIdx: number,
  ): PdfRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    return {
      x: sx / p.scaleX,
      y: p.pdfHeightPt - (sy / p.scaleY) - (sh / p.scaleY),  // ← Y-FLIP REVERSED
      w: sw / p.scaleX,
      h: sh / p.scaleY,
    }
  }

  /**
   * Relative 0–1 fractions → screen pixels.
   * NO Y-flip: AI returns top-left-origin coords, same as DOM.
   * Call this when placing AI-detected fields as a preview.
   * After user confirms, call screenToPdf() to get storable PDF points.
   */
  relToScreen(
    relX: number,
    relY: number,
    relW: number,
    relH: number,
    pageIdx: number,
  ): ScreenRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    return {
      x: relX * p.canvasWidthPx,
      y: relY * p.canvasHeightPx,   // No flip — AI output is already top-left
      w: relW * p.canvasWidthPx,
      h: relH * p.canvasHeightPx,
    }
  }

  /**
   * Clamps a screen rect to page bounds.
   * Use this after every drag/resize to prevent fields from leaving the page.
   */
  clamp(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    pageIdx: number,
  ): ScreenRect {
    const p = this.pages.get(pageIdx)
    if (!p) return { x: sx, y: sy, w: sw, h: sh }

    const clampedW = Math.min(sw, p.canvasWidthPx)
    const clampedH = Math.min(sh, p.canvasHeightPx)

    return {
      x: Math.max(0, Math.min(sx, p.canvasWidthPx - clampedW)),
      y: Math.max(0, Math.min(sy, p.canvasHeightPx - clampedH)),
      w: clampedW,
      h: clampedH,
    }
  }
}
