import { useMemo, useRef, useState } from 'react'
import type { StoredSample, SampleType } from '../storage/idb'
import type { TrackId } from '../audio/types'
import { TRACKS } from '../audio/types'

interface SampleBrowserProps {
  samples: StoredSample[]
  onImport: (files: FileList) => void
  onAudition: (sample: StoredSample) => void
  onAssign: (sample: StoredSample, track: TrackId) => void
  onDelete: (id: string) => void
}

const FILTERS: Array<SampleType | 'all'> = [
  'all',
  '808',
  'kick',
  'snare',
  'hat',
  'loop',
  'one-shot',
  'other',
]

export function SampleBrowser({
  samples,
  onImport,
  onAudition,
  onAssign,
  onDelete,
}: SampleBrowserProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<SampleType | 'all'>('all')
  const [assignId, setAssignId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return samples.filter((s) => {
      if (filter !== 'all' && s.type !== filter) return false
      if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [samples, filter, q])

  return (
    <section className="samples" aria-label="Sample browser">
      <div className="samples-head">
        <h2>Splice / Files</h2>
        <p>Import from Files → On My iPhone → Splice → Samples</p>
      </div>
      <button
        type="button"
        className="play import-btn"
        onClick={() => inputRef.current?.click()}
      >
        Import from Splice
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*,.wav,.mp3,.aiff,.aif,.flac,.ogg,.m4a"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onImport(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        className="search"
        type="search"
        placeholder="Search samples"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        enterKeyHint="search"
      />
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'is-on' : ''}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="sample-list">
        {filtered.length === 0 && (
          <li className="empty">No samples yet — import from Files.</li>
        )}
        {filtered.map((s) => (
          <li key={s.id}>
            <button type="button" className="sample-main" onClick={() => onAudition(s)}>
              <strong>{s.name}</strong>
              <span>
                {s.type}
                {s.rootHz ? ` · ${Math.round(s.rootHz)}Hz` : ''}
                {s.duration ? ` · ${s.duration.toFixed(2)}s` : ''}
              </span>
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setAssignId(assignId === s.id ? null : s.id)}
            >
              Load
            </button>
            <button type="button" className="ghost danger" onClick={() => onDelete(s.id)}>
              Del
            </button>
            {assignId === s.id && (
              <div className="assign-grid">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onAssign(s, t.id)
                      setAssignId(null)
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
