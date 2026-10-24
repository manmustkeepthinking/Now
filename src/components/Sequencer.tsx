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
      <div className="seq-row beat-ruler" aria-hidden="true">
        <div className="track-fixed">
          <span className="track-spacer">Trk</span>
        </div>
        <div className="track-scroll">
          <div className="steps ruler-steps" style={{ '--cols': cols } as CSSProperties}>
            {Array.from({ length: cols }, (_, i) => (
              <span
                key={i}
                className={`beat-mark ${i % 4 === 0 ? 'is-bar' : ''} ${
                  playing && activeStep === i ? 'is-now' : ''
                }`}
              >
                {i % 4 === 0 ? i / 4 + 1 : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {TRACKS.map((drum) => {
        const mix = pattern.mix[drum.id]
        return (
          <div
            className={`seq-row track ${selected === drum.id ? 'is-selected' : ''}`}
            key={drum.id}
            style={{ '--track': drum.color, '--cols': cols } as CSSProperties}
          >
            <div className="track-fixed">
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
              </div>
            </div>

            <div className="track-scroll">
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
                        ;(e.currentTarget as HTMLButtonElement).setPointerCapture?.(
                          e.pointerId,
                        )
                        onBeginPaint(drum.id, i)
                      }}
                      onPointerEnter={() => onContinuePaint(drum.id, i)}
                      onClick={() => {
                        // iOS fallback if pointer paint missed
                      }}
                      data-track={drum.id}
                      data-step={i}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
