import type { StepLength } from '../audio/types'

interface TransportProps {
  playing: boolean
  bpm: number
  swing: number
  metronome: boolean
  steps: StepLength
  canUndo: boolean
  canRedo: boolean
  onTogglePlay: () => void
  onBpm: (bpm: number) => void
  onSwing: (swing: number) => void
  onMetronome: (on: boolean) => void
  onSteps: (steps: StepLength) => void
  onTap: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onStarter: () => void
}

export function Transport({
  playing,
  bpm,
  swing,
  metronome,
  steps,
  canUndo,
  canRedo,
  onTogglePlay,
  onBpm,
  onSwing,
  onMetronome,
  onSteps,
  onTap,
  onUndo,
  onRedo,
  onClear,
  onStarter,
}: TransportProps) {
  return (
    <section className="transport" aria-label="Transport">
      <button
        type="button"
        className={`play ${playing ? 'is-playing' : ''}`}
        onClick={onTogglePlay}
        aria-pressed={playing}
      >
        {playing ? 'Stop' : 'Play'}
      </button>

      <label className="ctrl">
        <span>BPM</span>
        <input
          type="range"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => onBpm(Number(e.target.value))}
        />
        <input
          className="num"
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => onBpm(Number(e.target.value))}
        />
      </label>

      <button type="button" className="ghost" onClick={onTap}>
        Tap
      </button>

      <label className="ctrl">
        <span>Swing</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(swing * 100)}
          onChange={(e) => onSwing(Number(e.target.value) / 100)}
        />
        <span className="val">{Math.round(swing * 100)}</span>
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={metronome}
          onChange={(e) => onMetronome(e.target.checked)}
        />
        Metro
      </label>

      <div className="seg" role="group" aria-label="Step length">
        {([16, 32, 64] as StepLength[]).map((n) => (
          <button
            key={n}
            type="button"
            className={steps === n ? 'is-on' : ''}
            onClick={() => onSteps(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="transport-actions">
        <button type="button" className="ghost" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="ghost" disabled={!canRedo} onClick={onRedo}>
          Redo
        </button>
        <button type="button" className="ghost" onClick={onStarter}>
          Starter
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  )
}
