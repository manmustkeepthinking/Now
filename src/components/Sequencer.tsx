import type { CSSProperties } from 'react'
import { TRACKS, type PatternState, type StepData, type TrackId } from '../audio/types'

export type StepEditMode = 'paint' | 'velocity' | 'probability' | 'mute'

interface SequencerProps {
  pattern: PatternState
  activeStep: number
  playing: boolean
  editMode: StepEditMode
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
            className="track"
            key={drum.id}
            style={{ '--track': drum.color, '--cols': cols } as CSSProperties}
          >
            <button
              type="button"
              className="track-label"
              onClick={() => onPreview(drum.id)}
              title={`Preview ${drum.label}`}
            >
              {drum.label}
            </button>

            <div className="mix">
              <button
                type="button"
                className={`chip ${mix.mute ? 'is-active' : ''}`}
                onClick={() => onMix(drum.id, { mute: !mix.mute })}
                title="Mute"
              >
                M
              </button>
              <button
                type="button"
                className={`chip solo ${mix.solo ? 'is-active' : ''}`}
                onClick={() => onMix(drum.id, { solo: !mix.solo })}
                title="Solo"
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
                title="Volume"
                aria-label={`${drum.label} volume`}
              />
              <input
                type="range"
                className="pan"
                min={-100}
                max={100}
                value={Math.round(mix.pan * 100)}
                onChange={(e) =>
                  onMix(drum.id, { pan: Number(e.target.value) / 100 })
                }
                title="Pan"
                aria-label={`${drum.label} pan`}
              />
            </div>

            <div
              className="steps"
              role="group"
              aria-label={`${drum.label} steps`}
            >
              {pattern.tracks[drum.id].map((step, i) => {
                const isActive = playing && activeStep === i
                const height =
                  editMode === 'velocity'
                    ? `${Math.max(18, step.velocity * 100)}%`
                    : editMode === 'probability'
                      ? `${Math.max(18, step.probability * 100)}%`
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
                    onPointerEnter={() => onContinuePaint(drum.id, i)}
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
