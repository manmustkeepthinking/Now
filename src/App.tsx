import { useCallback, useEffect, useRef, useState } from 'react'
import { BeatEngine } from './audio/engine'
import {
  createEmptyPattern,
  createStarterPattern,
  type PatternState,
  type StepLength,
  type TrackId,
} from './audio/types'
import { Sequencer, type StepEditMode } from './components/Sequencer'
import { Transport } from './components/Transport'
import { HistoryStack } from './state/history'
import './App.css'

export default function App() {
  const engineRef = useRef<BeatEngine | null>(null)
  const historyRef = useRef(new HistoryStack())
  const painting = useRef<{ value: boolean } | null>(null)
  const tapTimes = useRef<number[]>([])

  const [pattern, setPattern] = useState<PatternState>(() => createStarterPattern())
  const [bpm, setBpm] = useState(140)
  const [swing, setSwing] = useState(0)
  const [metronome, setMetronome] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [editMode, setEditMode] = useState<StepEditMode>('paint')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncHistoryFlags = () => {
    setCanUndo(historyRef.current.canUndo)
    setCanRedo(historyRef.current.canRedo)
  }

  const commit = useCallback((next: PatternState | ((p: PatternState) => PatternState)) => {
    setPattern((prev) => {
      historyRef.current.push(prev)
      const resolved = typeof next === 'function' ? next(prev) : next
      queueMicrotask(syncHistoryFlags)
      return resolved
    })
  }, [])

  useEffect(() => {
    const engine = new BeatEngine()
    engineRef.current = engine
    engine.setOnStep((step) => setActiveStep(step))
    return () => {
      engine.stop()
      engine.setOnStep(null)
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setPattern(pattern)
  }, [pattern])

  useEffect(() => {
    engineRef.current?.setBpm(bpm)
  }, [bpm])

  useEffect(() => {
    engineRef.current?.setSwing(swing)
  }, [swing])

  useEffect(() => {
    engineRef.current?.setMetronome(metronome)
  }, [metronome])

  useEffect(() => {
    const endPaint = () => {
      painting.current = null
    }
    window.addEventListener('pointerup', endPaint)
    window.addEventListener('pointercancel', endPaint)
    return () => {
      window.removeEventListener('pointerup', endPaint)
      window.removeEventListener('pointercancel', endPaint)
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    await engine.toggle()
    setPlaying(engine.isPlaying())
    if (!engine.isPlaying()) setActiveStep(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        void togglePlay()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        setPattern((prev) => {
          const u = historyRef.current.undo(prev)
          queueMicrotask(syncHistoryFlags)
          return u ?? prev
        })
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        setPattern((prev) => {
          const r = historyRef.current.redo(prev)
          queueMicrotask(syncHistoryFlags)
          return r ?? prev
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  const mutateStep = (
    id: TrackId,
    index: number,
    fn: (step: PatternState['tracks'][TrackId][number]) => PatternState['tracks'][TrackId][number],
  ) => {
    commit((prev) => {
      const row = [...prev.tracks[id]]
      row[index] = fn(row[index])
      return { ...prev, tracks: { ...prev.tracks, [id]: row } }
    })
  }

  const beginPaint = async (id: TrackId, index: number) => {
    const step = pattern.tracks[id][index]
    if (editMode === 'paint') {
      const nextValue = !step.on
      painting.current = { value: nextValue }
      mutateStep(id, index, (s) => ({ ...s, on: nextValue }))
      if (nextValue) void engineRef.current?.playHit(id, step.velocity)
      return
    }
    if (editMode === 'mute') {
      mutateStep(id, index, (s) => ({ ...s, muted: !s.muted, on: s.on || !s.muted }))
      return
    }
    if (editMode === 'velocity') {
      const next = Math.min(1, Math.max(0.1, step.velocity - 0.15 + (step.on ? 0 : 0.5)))
      // cycle: click raises then wraps
      const cycled = step.on ? (step.velocity >= 0.95 ? 0.35 : Math.min(1, step.velocity + 0.2)) : 1
      mutateStep(id, index, (s) => ({ ...s, on: true, velocity: step.on ? cycled : next }))
      void engineRef.current?.playHit(id, step.on ? cycled : next)
      return
    }
    if (editMode === 'probability') {
      const cycled = step.on
        ? step.probability <= 0.35
          ? 1
          : Math.max(0.25, +(step.probability - 0.25).toFixed(2))
        : 0.75
      mutateStep(id, index, (s) => ({ ...s, on: true, probability: cycled }))
    }
  }

  const continuePaint = (id: TrackId, index: number) => {
    if (editMode !== 'paint' || !painting.current) return
    const value = painting.current.value
    // Mid-drag updates skip history — beginPaint already pushed once.
    setPattern((prev) => {
      if (prev.tracks[id][index].on === value) return prev
      const row = [...prev.tracks[id]]
      row[index] = { ...row[index], on: value }
      return { ...prev, tracks: { ...prev.tracks, [id]: row } }
    })
  }

  const onMix = (
    id: TrackId,
    patch: Partial<PatternState['mix'][TrackId]>,
  ) => {
    commit((prev) => ({
      ...prev,
      mix: { ...prev.mix, [id]: { ...prev.mix[id], ...patch } },
    }))
  }

  const resizeSteps = (steps: StepLength) => {
    commit((prev) => {
      const next = createEmptyPattern(steps)
      next.mix = structuredClone(prev.mix)
      for (const id of Object.keys(prev.tracks) as TrackId[]) {
        for (let i = 0; i < steps; i++) {
          next.tracks[id][i] = structuredClone(
            prev.tracks[id][i % prev.steps] ?? next.tracks[id][i],
          )
        }
      }
      return next
    })
  }

  const onTap = () => {
    const now = performance.now()
    const taps = tapTimes.current.filter((t) => now - t < 2500)
    taps.push(now)
    tapTimes.current = taps
    if (taps.length < 2) return
    const intervals: number[] = []
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1])
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const next = Math.round(60000 / avg)
    setBpm(Math.min(240, Math.max(40, next)))
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="masthead">
        <p className="brand">NOW</p>
        <h1 className="headline">Beat lab</h1>
        <p className="lede">
          Ten-track kit. Lookahead clock. Paint a pattern and hit play.
        </p>
      </header>

      <Transport
        playing={playing}
        bpm={bpm}
        swing={swing}
        metronome={metronome}
        steps={pattern.steps}
        canUndo={canUndo}
        canRedo={canRedo}
        onTogglePlay={() => void togglePlay()}
        onBpm={setBpm}
        onSwing={setSwing}
        onMetronome={setMetronome}
        onSteps={resizeSteps}
        onTap={onTap}
        onUndo={() =>
          setPattern((prev) => {
            const u = historyRef.current.undo(prev)
            queueMicrotask(syncHistoryFlags)
            return u ?? prev
          })
        }
        onRedo={() =>
          setPattern((prev) => {
            const r = historyRef.current.redo(prev)
            queueMicrotask(syncHistoryFlags)
            return r ?? prev
          })
        }
        onClear={() => commit(createEmptyPattern(pattern.steps))}
        onStarter={() => commit(createStarterPattern())}
      />

      <div className="edit-modes" role="group" aria-label="Step edit mode">
        {(
          [
            ['paint', 'Paint'],
            ['velocity', 'Velocity'],
            ['probability', 'Probability'],
            ['mute', 'Step mute'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={editMode === id ? 'is-on' : ''}
            onClick={() => setEditMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Sequencer
        pattern={pattern}
        activeStep={activeStep}
        playing={playing}
        editMode={editMode}
        onBeginPaint={(id, i) => void beginPaint(id, i)}
        onContinuePaint={continuePaint}
        onPreview={(id) => void engineRef.current?.playHit(id)}
        onMix={onMix}
      />

      <p className="hint">
        Space play/stop · drag to paint · ⌘Z undo · kit sounds on load — no samples required
      </p>
    </div>
  )
}
