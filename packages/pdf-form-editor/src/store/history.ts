import { enablePatches, type Patch } from 'immer'

// Must be called before any produceWithPatches usage
enablePatches()

interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
}

/**
 * Patch-based undo/redo stack.
 *
 * Uses immer's produceWithPatches to store structural diffs (not full copies).
 * A 15-page document with 80 fields generates a full copy on every change
 * if you use snapshot-based history. Patches store only what changed.
 *
 * Usage:
 *   const [next, patches, inverse] = produceWithPatches(state, draft => { ... })
 *   history.push(patches, inverse)
 *
 * To undo:
 *   const patches = history.undo()
 *   if (patches) setState(applyPatches(state, patches))
 */
export class HistoryStack {
  private stack: HistoryEntry[] = []
  private pointer = -1
  private readonly MAX: number

  constructor(maxEntries = 100) {
    this.MAX = maxEntries
  }

  push(patches: Patch[], inversePatches: Patch[]): void {
    // Discard any forward history when a new action is committed
    this.stack = this.stack.slice(0, this.pointer + 1)
    this.stack.push({ patches, inversePatches })

    if (this.stack.length > this.MAX) {
      this.stack.shift()
    } else {
      this.pointer++
    }
  }

  undo(): Patch[] | null {
    if (this.pointer < 0) return null
    return this.stack[this.pointer--].inversePatches
  }

  redo(): Patch[] | null {
    if (this.pointer >= this.stack.length - 1) return null
    return this.stack[++this.pointer].patches
  }

  get canUndo(): boolean {
    return this.pointer >= 0
  }

  get canRedo(): boolean {
    return this.pointer < this.stack.length - 1
  }

  clear(): void {
    this.stack = []
    this.pointer = -1
  }
}
