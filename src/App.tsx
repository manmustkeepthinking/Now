import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BeatEngine } from './audio/engine'
import {
  createEmptyPattern,
  createStarterPattern,
  isMelodic,
  TRACK_IDS,
  type PatternState,
  type StepLength,
  type TrackId,
} from './audio/types'
import { MasterBar } from './components/MasterBar'
import { Pads } from './components/Pads'
import { PatternBank, BANKS } from './components/PatternBank'
import { PianoRoll } from './components/PianoRoll'
import { SampleBrowser } from './components/SampleBrowser'
import { Sequencer, type StepEditMode } from './components/Sequencer'
import { Transport } from './components/Transport'
import { HistoryStack } from './state/history'
import {
  deleteSample,
  importFiles,
  listSamples,
  saveProject,
  shareOrDownload,
  type StoredSample,
} from './storage/idb'
import './App.css'

type Tab = 'seq' | 'roll' | 'mix' | 'samples' | 'pads' | 'patterns'

const PAD_MAP: TrackId[] = [
  'kick',
  'trapSnare',
  'rimshot',
  'clap',
  'hatClosed',
  'hatOpen',
  'crash',
  'perc',
  'bass',
  'lead',
  'pad',
  'eightOhEight',
  'kick',
  'trapSnare',
  'hatClosed',
  'eightOhEight',
]

function emptyBanks(): Record<string, PatternState> {
  const banks: Record<string, PatternState> = {}
  for (const id of BANKS) {
    banks[id] = id === 'A' ? createStarterPattern() : createEmptyPattern(16)
  }
  return banks
}

export default function App() {
  const engineRef = useRef<BeatEngine | null>(null)
  const historyRef = useRef(new HistoryStack())
  const painting = useRef<{ value: boolean } | null>(null)
  const tapTimes = useRef<number[]>([])
  const clipboard = useRef<PatternState | null>(null)
  const sampleCache = useRef<
    Partial<Record<TrackId, { buffer: AudioBuffer; rootHz: number }>>
  >({})

  const [unlocked, setUnlocked] = useState(false)
  const [banks, setBanks] = useState(emptyBanks)
  const [activeBank, setActiveBank] = useState('A')
  const [song, setSong] = useState<string[]>([])
  const [songMode, setSongMode] = useState(false)
  const pattern = banks[activeBank]
  const [bpm, setBpm] = useState(140)
  const [swing, setSwing] = useState(0)
  const [metronome, setMetronome] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [editMode, setEditMode] = useState<StepEditMode>('paint')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [tab, setTab] = useState<Tab>('seq')
  const [selected, setSelected] = useState<TrackId>('eightOhEight')
  const [samples, setSamples] = useState<StoredSample[]>([])
  const [status, setStatus] = useState('')

  const syncHistoryFlags = () => {
    setCanUndo(historyRef.current.canUndo)
    setCanRedo(historyRef.current.canRedo)
  }

  const setPattern = useCallback(
    (next: PatternState | ((p: PatternState) => PatternState), record = true) => {
      setBanks((prev) => {
        const cur = prev[activeBank]
        const resolved = typeof next === 'function' ? next(cur) : next
        if (record) {
          historyRef.current.push(cur)
          queueMicrotask(syncHistoryFlags)
        }
        return { ...prev, [activeBank]: resolved }
      })
    },
    [activeBank],
  )

  const commit = useCallback(
    (next: PatternState | ((p: PatternState) => PatternState)) => {
      setPattern(next, true)
    },
    [setPattern],
  )

  useEffect(() => {
    const engine = new BeatEngine()
    engineRef.current = engine
    engine.setOnStep((step) => {
      setActiveStep(step)
      // Song mode: advance bank at loop boundary
      if (songMode && song.length > 0 && step === 0) {
        // handled via ref below — see songStepRef
      }
    })
    void listSamples().then(setSamples)
    return () => {
      engine.stop()
      engine.setOnStep(null)
    }
  }, [])

  const songIndex = useRef(0)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setOnStep((step) => {
      setActiveStep(step)
      if (!songMode || song.length === 0) return
      if (step === 0 && engine.isPlaying()) {
        // At start of each loop after first, advance — detect via a flag
      }
    })
  }, [songMode, song, activeBank])

  // Advance song chain when a full pattern loop completes
  const prevStep = useRef(0)
  useEffect(() => {
    if (!playing || !songMode || song.length === 0) return
    if (prevStep.current > 0 && activeStep === 0) {
      songIndex.current = (songIndex.current + 1) % song.length
      const next = song[songIndex.current]
      if (next && next !== activeBank) setActiveBank(next)
    }
    prevStep.current = activeStep
  }, [activeStep, playing, songMode, song, activeBank])

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

  const unlock = async () => {
    await engineRef.current?.unlock()
    setUnlocked(true)
  }

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (!engine.isUnlocked()) await engine.unlock()
    setUnlocked(true)
    songIndex.current = Math.max(0, song.indexOf(activeBank))
    await engine.toggle()
    setPlaying(engine.isPlaying())
    if (!engine.isPlaying()) setActiveStep(0)
  }, [activeBank, song])

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
    setSelected(id)
    const step = pattern.tracks[id][index]
    if (editMode === 'paint') {
      const nextValue = !step.on
      painting.current = { value: nextValue }
      mutateStep(id, index, (s) => ({ ...s, on: nextValue }))
      if (nextValue) void engineRef.current?.playHit(id, step.velocity, step.note)
      return
    }
    if (editMode === 'mute') {
      mutateStep(id, index, (s) => ({ ...s, muted: !s.muted, on: s.on || !s.muted }))
      return
    }
    if (editMode === 'velocity') {
      const cycled = step.on ? (step.velocity >= 0.95 ? 0.35 : Math.min(1, step.velocity + 0.2)) : 1
      mutateStep(id, index, (s) => ({ ...s, on: true, velocity: cycled }))
      void engineRef.current?.playHit(id, cycled, step.note)
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
    setPattern((prev) => {
      if (prev.tracks[id][index].on === value) return prev
      const row = [...prev.tracks[id]]
      row[index] = { ...row[index], on: value }
      return { ...prev, tracks: { ...prev.tracks, [id]: row } }
    }, false)
  }

  const resizeSteps = (steps: StepLength) => {
    commit((prev) => {
      const next = createEmptyPattern(steps)
      next.mix = structuredClone(prev.mix)
      next.master = structuredClone(prev.master)
      next.eightOhEightTuningHz = prev.eightOhEightTuningHz
      for (const id of TRACK_IDS) {
        for (let i = 0; i < steps; i++) {
          next.tracks[id][i] = structuredClone(prev.tracks[id][i % prev.steps])
        }
      }
      return next
    })
  }

  const setBpmSafe = (raw: number) => {
    if (!Number.isFinite(raw)) return
    setBpm(Math.min(240, Math.max(40, Math.round(raw))))
  }

  const clearSteps = () => {
    commit((prev) => {
      const next = structuredClone(prev)
      for (const id of TRACK_IDS) {
        next.tracks[id] = next.tracks[id].map((s) => ({
          ...s,
          on: false,
          muted: false,
          velocity: 1,
          probability: 1,
        }))
      }
      return next
    })
    setStatus(`Cleared pattern ${activeBank}`)
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
    setBpmSafe(60000 / avg)
  }

  const decodeSample = async (ab: ArrayBuffer) => {
    const ctx = await engineRef.current!.resume()
    return ctx.decodeAudioData(ab.slice(0))
  }

  const handleImport = async (files: FileList) => {
    setStatus('Importing…')
    const added = await importFiles(files, decodeSample)
    const all = await listSamples()
    setSamples(all)
    setStatus(`Imported ${added.length} sample${added.length === 1 ? '' : 's'}`)
  }

  const audition = async (sample: StoredSample) => {
    const ctx = await engineRef.current!.resume()
    const buf = await ctx.decodeAudioData(sample.data.slice(0))
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
  }

  const assignSample = async (sample: StoredSample, track: TrackId) => {
    const ctx = await engineRef.current!.resume()
    const buf = await ctx.decodeAudioData(sample.data.slice(0))
    const rootHz = sample.rootHz ?? 55
    sampleCache.current[track] = { buffer: buf, rootHz }
    engineRef.current?.setSamples({ ...sampleCache.current })
    if (track === 'eightOhEight' && sample.rootHz) {
      commit((p) => ({ ...p, eightOhEightTuningHz: sample.rootHz }))
    }
    setStatus(`Loaded ${sample.name} → ${track}`)
  }

  const exportWav = async () => {
    setStatus('Rendering…')
    try {
      const ab = await engineRef.current!.renderWav(songMode && song.length ? song.length : 1)
      await shareOrDownload(new Blob([ab], { type: 'audio/wav' }), `now-beat-${activeBank}.wav`)
      setStatus('Export ready')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const save = async () => {
    await saveProject({
      id: 'default',
      name: 'NOW Beat',
      updatedAt: Date.now(),
      pattern,
      song,
      activePattern: activeBank,
      patterns: banks,
      trackSamples: {},
    })
    const json = JSON.stringify({ banks, song, activeBank, bpm, swing }, null, 2)
    await shareOrDownload(
      new Blob([json], { type: 'application/json' }),
      'now-beat-project.json',
    )
    setStatus('Project saved')
  }

  const melodicSelected = useMemo(() => isMelodic(selected), [selected])

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />

      {!unlocked && (
        <button type="button" className="unlock" onClick={() => void unlock()}>
          <span className="brand">NOW</span>
          <strong>Tap to unlock audio</strong>
          <em>Built-in kit ready · works offline after install</em>
        </button>
      )}

      <header className="masthead">
        <p className="brand">NOW</p>
        <h1 className="headline">Beat lab</h1>
        <p className="lede">iPhone beat machine — paint, glide 808s, import Splice.</p>
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
        onBpm={setBpmSafe}
        onSwing={setSwing}
        onMetronome={setMetronome}
        onSteps={resizeSteps}
        onTap={onTap}
        onUndo={() =>
          setPattern((prev) => {
            const u = historyRef.current.undo(prev)
            queueMicrotask(syncHistoryFlags)
            return u ?? prev
          }, false)
        }
        onRedo={() =>
          setPattern((prev) => {
            const r = historyRef.current.redo(prev)
            queueMicrotask(syncHistoryFlags)
            return r ?? prev
          }, false)
        }
        onClear={clearSteps}
        onStarter={() => {
          commit(createStarterPattern())
          setStatus('Loaded starter')
        }}
        onExport={() => void exportWav()}
        onSave={() => void save()}
      />

      <div className="sticky-transport" aria-label="Quick transport">
        <button
          type="button"
          className={`play sticky-play ${playing ? 'is-playing' : ''}`}
          onClick={() => void togglePlay()}
          aria-pressed={playing}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <label className="ctrl sticky-bpm">
          <span>BPM</span>
          <input
            type="range"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpmSafe(Number(e.target.value))}
          />
          <span className="val">{bpm}</span>
        </label>
      </div>

      <nav className="tabs" aria-label="Views">
        {(
          [
            ['seq', 'Seq'],
            ['roll', '808'],
            ['mix', 'Mix'],
            ['samples', 'Splice'],
            ['pads', 'Pads'],
            ['patterns', 'Patterns'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'is-on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'seq' && (
        <>
          <div className="edit-modes" role="group" aria-label="Step edit mode">
            {(
              [
                ['paint', 'Paint'],
                ['velocity', 'Vel'],
                ['probability', 'Prob'],
                ['mute', 'Mute'],
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
            selected={selected}
            onSelect={setSelected}
            onBeginPaint={(id, i) => void beginPaint(id, i)}
            onContinuePaint={continuePaint}
            onPreview={(id) => void engineRef.current?.playHit(id)}
            onMix={(id, patch) =>
              commit((prev) => ({
                ...prev,
                mix: { ...prev.mix, [id]: { ...prev.mix[id], ...patch } },
              }))
            }
          />
        </>
      )}

      {tab === 'roll' && (
        <PianoRoll
          pattern={pattern}
          trackId={melodicSelected ? selected : 'eightOhEight'}
          activeStep={activeStep}
          playing={playing}
          onToggleNote={(step, note) => {
            const id = melodicSelected ? selected : 'eightOhEight'
            commit((prev) => {
              const row = [...prev.tracks[id]]
              const cur = row[step]
              const same = cur.on && cur.note === note
              row[step] = same
                ? { ...cur, on: false }
                : { ...cur, on: true, note, muted: false }
              return { ...prev, tracks: { ...prev.tracks, [id]: row } }
            })
            void engineRef.current?.playHit(id, 1, note)
          }}
          onPreviewNote={(note) => {
            const id = melodicSelected ? selected : 'eightOhEight'
            void engineRef.current?.playHit(id, 1, note)
          }}
        />
      )}

      {tab === 'mix' && (
        <MasterBar
          master={pattern.master}
          mix={pattern.mix}
          selected={selected}
          onSelect={setSelected}
          onMaster={(patch) =>
            commit((prev) => ({ ...prev, master: { ...prev.master, ...patch } }))
          }
          onTrack={(id, patch) =>
            commit((prev) => ({
              ...prev,
              mix: { ...prev.mix, [id]: { ...prev.mix[id], ...patch } },
            }))
          }
        />
      )}

      {tab === 'samples' && (
        <SampleBrowser
          samples={samples}
          onImport={(f) => void handleImport(f)}
          onAudition={(s) => void audition(s)}
          onAssign={(s, t) => void assignSample(s, t)}
          onDelete={(id) => {
            void deleteSample(id).then(async () => setSamples(await listSamples()))
          }}
        />
      )}

      {tab === 'pads' && (
        <Pads
          mapping={PAD_MAP}
          onPad={(id) => {
            setSelected(id)
            void engineRef.current?.playHit(id)
          }}
        />
      )}

      {tab === 'patterns' && (
        <PatternBank
          active={activeBank}
          song={song}
          songMode={songMode}
          onSongMode={setSongMode}
          onSelect={setActiveBank}
          onCopy={() => {
            clipboard.current = structuredClone(pattern)
            setStatus(`Copied ${activeBank}`)
          }}
          onPaste={() => {
            if (!clipboard.current) return
            commit(structuredClone(clipboard.current))
            setStatus(`Pasted into ${activeBank}`)
          }}
          onDuplicate={() => {
            const next = BANKS.find((b) => b !== activeBank)
            if (!next) return
            setBanks((prev) => ({ ...prev, [next]: structuredClone(prev[activeBank]) }))
            setActiveBank(next)
            setStatus(`Duplicated → ${next}`)
          }}
          onClear={clearSteps}
          onToggleSong={(id) =>
            setSong((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onClearSong={() => setSong([])}
        />
      )}

      {status && <p className="status">{status}</p>}
      <p className="hint">Add to Home Screen for offline · Files → Splice → Samples</p>
    </div>
  )
}
