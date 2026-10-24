import type { CSSProperties } from 'react'
import { TRACKS, type PatternState, type StepData, type TrackId } from '../audio/types'

export type StepEditMode = 'paint' | 'velocity' | 'probability' | 'mute'

interface SequencerProps {
  pattern: PatternState
  activeStep: number
  playing: boolean
  editMode: StepEditMode
  selected: TrackId
  onSelect: (id: TrackId) => void
  onBeginPaint: (id: TrackId, index: number) => void
  onContinuePaint: (id: TrackId, index: number) => void
  onPreview: (id: TrackId) => void
  onMix: (id: TrackId, patch: Partial<PatternState['mix'][TrackId]>) => void
}

function stepVisual(step: StepData, mode: StepEditMode): string {
  if (!step.on) return ''
  if (step.muted || mode === 'mute') {
    return step.muted ? 'is-on is-step-mute' : 'is-on'
  }
  return 'is-on'
}

export function Sequencer({
  pattern,
  activeStep,
  playing,
  editMode,
  selected,
  onSelect,
  onBeginPaint,
  onContinuePaint,
  onPreview,
  onMix,
}: SequencerProps) {
  const cols = pattern.steps

  return (
    <section className="sequencer" aria-label="Step sequencer">
      <div
        className="beat-ruler"
        style={{ '--cols': cols } as CSSProperties}
        aria-hidden="true"
      >
        <span className="track-spacer" />
        <span className="mix-spacer" />
        {Array.from({ length: cols }, (_, i) => (
          <span
            key={i}
            className={`beat-mark ${i % 4 === 0 ? 'is-bar' : ''} ${
              playing && activeStep === i ? 'is-now' : ''
            }`}
          >
            {i % 4 === 0 ? i / 4 + 1 : '·'}
          </span>
        ))}
      </div>

      {TRACKS.map((drum) => {
        const mix = pattern.mix[drum.id]
        return (
          <div
            className={`track ${selected === drum.id ? 'is-selected' : ''}`}
            key={drum.id}
            style={{ '--track': drum.color, '--cols': cols } as CSSProperties}
          >
            <button
              type="button"
              className="track-label"
              onClick={() => {
                onSelect(drum.id)
                onPreview(drum.id)
              }}
            >
              {drum.label}
            </button>

            <div className="mix">
              <button
                type="button"
                className={`chip ${mix.mute ? 'is-active' : ''}`}
                onClick={() => onMix(drum.id, { mute: !mix.mute })}
              >
                M
              </button>
              <button
                type="button"
                className={`chip solo ${mix.solo ? 'is-active' : ''}`}
                onClick={() => onMix(drum.id, { solo: !mix.solo })}
              >
                S
              </button>
              <input
                type="range"
                className="vol"
                min={0}
                max={100}
                value={Math.round(mix.volume * 100)}
                onChange={(e) =>
                  onMix(drum.id, { volume: Number(e.target.value) / 100 })
                }
                aria-label={`${drum.label} volume`}
              />
            </div>

            <div className="steps" role="group" aria-label={`${drum.label} steps`}>
              {pattern.tracks[drum.id].map((step, i) => {
                const isActive = playing && activeStep === i
                const height =
                  editMode === 'velocity'
                    ? `${Math.max(22, step.velocity * 100)}%`
                    : editMode === 'probability'
                      ? `${Math.max(22, step.probability * 100)}%`
                      : '100%'
                return (
                  <button
                    key={i}
                    type="button"
                    className={`step ${stepVisual(step, editMode)} ${
                      isActive ? 'is-active' : ''
                    } ${i % 4 === 0 ? 'is-bar' : ''}`}
                    aria-pressed={step.on}
                    aria-label={`${drum.label} step ${i + 1}`}
                    style={
                      step.on
                        ? ({
                            '--fill': height,
                            opacity:
                              editMode === 'probability'
                                ? 0.35 + step.probability * 0.65
                                : undefined,
                          } as CSSProperties)
                        : undefined
                    }
                    onPointerDown={(e) => {
                      e.preventDefault()
                      onBeginPaint(drum.id, i)
                    }}
                    onPointerEnter={(e) => {
                      if (e.buttons) onContinuePaint(drum.id, i)
                    }}
                    onPointerMove={(e) => {
                      // iOS: continue paint when finger moves across steps
                      if (e.buttons || e.pressure > 0) {
                        const el = document.elementFromPoint(e.clientX, e.clientY)
                        const btn = el?.closest('.step') as HTMLElement | null
                        if (btn?.dataset.track === drum.id && btn.dataset.step) {
                          onContinuePaint(drum.id, Number(btn.dataset.step))
                        }
                      }
                    }}
                    data-track={drum.id}
                    data-step={i}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
