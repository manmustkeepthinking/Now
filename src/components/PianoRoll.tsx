import type { CSSProperties } from 'react'
import { trackConfig, type PatternState, type TrackId } from '../audio/types'
import { isMelodic } from '../audio/types'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function noteLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12]
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

interface PianoRollProps {
  pattern: PatternState
  trackId: TrackId
  activeStep: number
  playing: boolean
  onToggleNote: (step: number, note: number) => void
  onPreviewNote: (note: number) => void
}

export function PianoRoll({
  pattern,
  trackId,
  activeStep,
  playing,
  onToggleNote,
  onPreviewNote,
}: PianoRollProps) {
  if (!isMelodic(trackId)) return null
  const cfg = trackConfig(trackId)
  const notes: number[] = []
  for (let n = cfg.noteMax; n >= cfg.noteMin; n--) notes.push(n)
  const cols = pattern.steps
  const row = pattern.tracks[trackId]

  return (
    <section className="piano-roll" aria-label={`${cfg.label} piano roll`}>
      <div className="piano-head">
        <h2>{cfg.label} roll</h2>
        <p>Tap a cell to place a note · {cfg.noteMax - cfg.noteMin + 1} keys</p>
      </div>
      <div className="piano-scroll">
        <div
          className="piano-grid"
          style={{ '--cols': cols, '--rows': notes.length } as CSSProperties}
        >
          <div className="piano-corner" />
          {Array.from({ length: cols }, (_, i) => (
            <div
              key={`h-${i}`}
              className={`piano-colhead ${playing && activeStep === i ? 'is-now' : ''} ${
                i % 4 === 0 ? 'is-bar' : ''
              }`}
            >
              {i % 4 === 0 ? i / 4 + 1 : ''}
            </div>
          ))}
          {notes.map((note) => (
            <div key={note} className="piano-row" style={{ display: 'contents' }}>
              <button
                type="button"
                className={`piano-key ${note % 12 === 0 ? 'is-c' : ''} ${
                  [1, 3, 6, 8, 10].includes(note % 12) ? 'is-black' : ''
                }`}
                onClick={() => onPreviewNote(note)}
              >
                {noteLabel(note)}
              </button>
              {Array.from({ length: cols }, (_, step) => {
                const cell = row[step]
                const on = cell.on && cell.note === note
                return (
                  <button
                    key={`${note}-${step}`}
                    type="button"
                    className={`piano-cell ${on ? 'is-on' : ''} ${
                      playing && activeStep === step ? 'is-active' : ''
                    } ${step % 4 === 0 ? 'is-bar' : ''}`}
                    style={{ '--track': cfg.color } as CSSProperties}
                    aria-pressed={on}
                    aria-label={`${noteLabel(note)} step ${step + 1}`}
                    onClick={() => onToggleNote(step, note)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
