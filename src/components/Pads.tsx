import type { CSSProperties } from 'react'
import { TRACKS, type TrackId } from '../audio/types'

interface PadsProps {
  onPad: (id: TrackId) => void
  mapping: TrackId[]
}

/** 4×4 MPC-style pads — big touch targets. */
export function Pads({ onPad, mapping }: PadsProps) {
  return (
    <section className="pads" aria-label="Pads">
      <h2>Pads</h2>
      <div className="pad-grid">
        {mapping.map((id, i) => {
          const tr = TRACKS.find((t) => t.id === id) ?? TRACKS[i % TRACKS.length]
          return (
            <button
              key={`${id}-${i}`}
              type="button"
              className="pad"
              style={{ '--track': tr.color } as CSSProperties}
              onPointerDown={(e) => {
                e.preventDefault()
                onPad(tr.id)
              }}
            >
              <span>{tr.label}</span>
              <em>{i + 1}</em>
            </button>
          )
        })}
      </div>
    </section>
  )
}
