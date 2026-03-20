import { describe, it, expect, beforeEach } from 'vitest'
import { CoordEngine } from '../engine/CoordEngine'

describe('CoordEngine', () => {
  let engine: CoordEngine

  beforeEach(() => {
    engine = new CoordEngine()
  })

  describe('registerPage / getPage / deregisterPage', () => {
    it('registers a page and computes scale factors', () => {
      engine.registerPage(0, 612, 792, 612, 792, 0)
      const p = engine.getPage(0)
      expect(p).toBeDefined()
      expect(p!.scaleX).toBe(1)
      expect(p!.scaleY).toBe(1)
    })

    it('computes correct scale for zoomed page', () => {
      // US Letter at 2x zoom: 612pt → 1224px
      engine.registerPage(0, 612, 792, 1224, 1584, 0)
      const p = engine.getPage(0)
      expect(p!.scaleX).toBe(2)
      expect(p!.scaleY).toBe(2)
    })

    it('deregisters a page', () => {
      engine.registerPage(0, 612, 792, 612, 792, 0)
      engine.deregisterPage(0)
      expect(engine.getPage(0)).toBeUndefined()
    })

    it('returns undefined for unregistered page', () => {
      expect(engine.getPage(99)).toBeUndefined()
    })
  })

  describe('pdfToScreen (Y-flip)', () => {
    beforeEach(() => {
      // US Letter, 1:1 scale (no zoom)
      engine.registerPage(0, 612, 792, 612, 792, 0)
    })

    it('flips Y axis: bottom-left origin → top-left origin', () => {
      // Field at PDF bottom-left corner: ptX=0, ptY=0, 100x50
      const s = engine.pdfToScreen(0, 0, 100, 50, 0)
      expect(s).not.toBeNull()
      // screenY = (792 - 0 - 50) * 1 = 742
      expect(s!.y).toBe(742)
      expect(s!.x).toBe(0)
      expect(s!.w).toBe(100)
      expect(s!.h).toBe(50)
    })

    it('field at PDF top-left maps to screen top-left', () => {
      // ptY = 792 - 50 = 742 (PDF top), ptH = 50
      const s = engine.pdfToScreen(0, 742, 100, 50, 0)
      // screenY = (792 - 742 - 50) * 1 = 0
      expect(s!.y).toBe(0)
    })

    it('field at PDF center maps to screen center', () => {
      const s = engine.pdfToScreen(256, 371, 100, 50, 0)
      // screenY = (792 - 371 - 50) * 1 = 371
      expect(s!.y).toBe(371)
      expect(s!.x).toBe(256)
    })

    it('applies scale correctly', () => {
      engine.registerPage(1, 612, 792, 1224, 1584, 0) // 2x zoom
      const s = engine.pdfToScreen(100, 200, 50, 30, 1)
      expect(s!.x).toBe(200)  // 100 * 2
      expect(s!.w).toBe(100)  // 50 * 2
      expect(s!.h).toBe(60)   // 30 * 2
      // screenY = (792 - 200 - 30) * 2 = 562 * 2 = 1124
      expect(s!.y).toBe(1124)
    })

    it('returns null for unregistered page', () => {
      expect(engine.pdfToScreen(0, 0, 10, 10, 99)).toBeNull()
    })
  })

  describe('screenToPdf (reverse Y-flip)', () => {
    beforeEach(() => {
      engine.registerPage(0, 612, 792, 612, 792, 0)
    })

    it('reverses the Y-flip correctly', () => {
      // Screen top-left (0, 0), size 100x50
      const p = engine.screenToPdf(0, 0, 100, 50, 0)
      // ptY = 792 - (0/1) - (50/1) = 742
      expect(p!.y).toBe(742)
      expect(p!.x).toBe(0)
      expect(p!.w).toBe(100)
      expect(p!.h).toBe(50)
    })

    it('round-trips correctly: pdf → screen → pdf', () => {
      const ptX = 150, ptY = 300, ptW = 200, ptH = 40
      const screen = engine.pdfToScreen(ptX, ptY, ptW, ptH, 0)!
      const pdf = engine.screenToPdf(screen.x, screen.y, screen.w, screen.h, 0)!
      expect(pdf.x).toBeCloseTo(ptX, 10)
      expect(pdf.y).toBeCloseTo(ptY, 10)
      expect(pdf.w).toBeCloseTo(ptW, 10)
      expect(pdf.h).toBeCloseTo(ptH, 10)
    })

    it('round-trips with zoom', () => {
      engine.registerPage(1, 612, 792, 918, 1188, 0) // 1.5x
      const ptX = 100, ptY = 500, ptW = 180, ptH = 24
      const screen = engine.pdfToScreen(ptX, ptY, ptW, ptH, 1)!
      const pdf = engine.screenToPdf(screen.x, screen.y, screen.w, screen.h, 1)!
      expect(pdf.x).toBeCloseTo(ptX, 10)
      expect(pdf.y).toBeCloseTo(ptY, 10)
      expect(pdf.w).toBeCloseTo(ptW, 10)
      expect(pdf.h).toBeCloseTo(ptH, 10)
    })
  })

  describe('relToScreen', () => {
    beforeEach(() => {
      engine.registerPage(0, 612, 792, 612, 792, 0)
    })

    it('converts 0-1 fractions to screen pixels (no Y-flip)', () => {
      const s = engine.relToScreen(0.5, 0.5, 0.1, 0.05, 0)
      expect(s!.x).toBe(306)  // 0.5 * 612
      expect(s!.y).toBe(396)  // 0.5 * 792 — no flip
      expect(s!.w).toBeCloseTo(61.2)
      expect(s!.h).toBeCloseTo(39.6)
    })

    it('full page rect', () => {
      const s = engine.relToScreen(0, 0, 1, 1, 0)
      expect(s!.x).toBe(0)
      expect(s!.y).toBe(0)
      expect(s!.w).toBe(612)
      expect(s!.h).toBe(792)
    })
  })

  describe('clamp', () => {
    beforeEach(() => {
      engine.registerPage(0, 612, 792, 612, 792, 0)
    })

    it('does nothing for in-bounds rect', () => {
      const c = engine.clamp(100, 100, 50, 50, 0)
      expect(c).toEqual({ x: 100, y: 100, w: 50, h: 50 })
    })

    it('clamps negative x/y to zero', () => {
      const c = engine.clamp(-10, -20, 50, 50, 0)
      expect(c.x).toBe(0)
      expect(c.y).toBe(0)
    })

    it('clamps overflowing x/y to page bounds', () => {
      const c = engine.clamp(600, 780, 50, 50, 0)
      expect(c.x).toBe(562) // 612 - 50
      expect(c.y).toBe(742) // 792 - 50
    })

    it('shrinks oversized rect to page size', () => {
      const c = engine.clamp(0, 0, 1000, 1000, 0)
      expect(c.w).toBe(612)
      expect(c.h).toBe(792)
    })

    it('returns original for unregistered page', () => {
      const c = engine.clamp(10, 20, 30, 40, 99)
      expect(c).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    })
  })
})
