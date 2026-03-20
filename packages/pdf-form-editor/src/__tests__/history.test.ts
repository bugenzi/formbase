import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryStack } from '../store/history'

describe('HistoryStack', () => {
  let history: HistoryStack

  beforeEach(() => {
    history = new HistoryStack(5)
  })

  const makePatch = (val: string) => ({
    patches: [{ op: 'replace' as const, path: ['x'], value: val }],
    inverse: [{ op: 'replace' as const, path: ['x'], value: `old-${val}` }],
  })

  it('starts empty with no undo/redo', () => {
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBeNull()
  })

  it('push makes undo available', () => {
    const { patches, inverse } = makePatch('a')
    history.push(patches, inverse)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('undo returns inverse patches', () => {
    const { patches, inverse } = makePatch('a')
    history.push(patches, inverse)
    const result = history.undo()
    expect(result).toEqual(inverse)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
  })

  it('redo returns forward patches', () => {
    const { patches, inverse } = makePatch('a')
    history.push(patches, inverse)
    history.undo()
    const result = history.redo()
    expect(result).toEqual(patches)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('new push after undo discards forward history', () => {
    history.push(makePatch('a').patches, makePatch('a').inverse)
    history.push(makePatch('b').patches, makePatch('b').inverse)
    history.undo() // undo 'b'
    history.push(makePatch('c').patches, makePatch('c').inverse)
    expect(history.canRedo).toBe(false)
    // Undo should get 'c' inverse, then 'a' inverse
    expect(history.undo()).toEqual(makePatch('c').inverse)
    expect(history.undo()).toEqual(makePatch('a').inverse)
    expect(history.undo()).toBeNull()
  })

  it('respects max entries', () => {
    for (let i = 0; i < 10; i++) {
      const { patches, inverse } = makePatch(String(i))
      history.push(patches, inverse)
    }
    // Max is 5, so only last 5 should remain
    let count = 0
    while (history.undo()) count++
    expect(count).toBe(5)
  })

  it('clear resets everything', () => {
    history.push(makePatch('a').patches, makePatch('a').inverse)
    history.push(makePatch('b').patches, makePatch('b').inverse)
    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
