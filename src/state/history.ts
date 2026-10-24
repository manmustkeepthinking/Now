import type { PatternState } from '../audio/types'

const MAX = 80

export class HistoryStack {
  private past: PatternState[] = []
  private future: PatternState[] = []

  push(current: PatternState): void {
    this.past.push(structuredClone(current))
    if (this.past.length > MAX) this.past.shift()
    this.future = []
  }

  undo(current: PatternState): PatternState | null {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(structuredClone(current))
    return prev
  }

  redo(current: PatternState): PatternState | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(structuredClone(current))
    return next
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }
}
