import type { CSSProperties } from 'react'
import type { MasterState, TrackId, TrackMix, FilterMode } from '../audio/types'
import { TRACKS } from '../audio/types'

interface MasterBarProps {
  master: MasterState
  mix: Record<TrackId, TrackMix>
  selected: TrackId
  onMaster: (patch: Partial<MasterState>) => void
  onTrack: (id: TrackId, patch: Partial<TrackMix>) => void
  onSelect: (id: TrackId) => void
}

export function MasterBar({
  master,
  mix,
  selected,
  onMaster,
  onTrack,
  onSelect,
}: MasterBarProps) {
  const t = mix[selected]
  return (
    <section className="mixer" aria-label="Mixer">
      <div className="mixer-block">
        <h2>Master</h2>
        <label className="slider-row">
          <span>Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(master.volume * 100)}
            onChange={(e) => onMaster({ volume: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="check big">
          <input
            type="checkbox"
            checked={master.compress}
            onChange={(e) => onMaster({ compress: e.target.checked })}
          />
          Limit / compress
        </label>
        <label className="slider-row">
          <span>Verb</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(master.reverbReturn * 100)}
            onChange={(e) => onMaster({ reverbReturn: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="slider-row">
          <span>Size</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(master.reverbSize * 100)}
            onChange={(e) => onMaster({ reverbSize: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="slider-row">
          <span>Delay</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(master.delayReturn * 100)}
            onChange={(e) => onMaster({ delayReturn: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="slider-row">
          <span>Time</span>
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(master.delayTime * 100)}
            onChange={(e) => onMaster({ delayTime: Number(e.target.value) / 100 })}
          />
        </label>
      </div>

      <div className="mixer-block">
        <h2>Track</h2>
        <div className="track-pills">
          {TRACKS.map((tr) => (
            <button
              key={tr.id}
              type="button"
              className={selected === tr.id ? 'is-on' : ''}
              style={{ '--track': tr.color } as CSSProperties}
              onClick={() => onSelect(tr.id)}
            >
              {tr.label}
            </button>
          ))}
        </div>
        <label className="slider-row">
          <span>Pitch</span>
          <input
            type="range"
            min={-24}
            max={24}
            value={t.pitch}
            onChange={(e) => onTrack(selected, { pitch: Number(e.target.value) })}
          />
          <em>{t.pitch > 0 ? `+${t.pitch}` : t.pitch}</em>
        </label>
        <label className="slider-row">
          <span>Decay</span>
          <input
            type="range"
            min={5}
            max={200}
            value={Math.round(t.decay * 100)}
            onChange={(e) => onTrack(selected, { decay: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="slider-row">
          <span>Glide</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(t.glide * 100)}
            onChange={(e) => onTrack(selected, { glide: Number(e.target.value) / 100 })}
          />
        </label>
        <div className="seg filter-seg" role="group" aria-label="Filter">
          {(['off', 'lowpass', 'highpass'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={t.filterMode === mode ? 'is-on' : ''}
              onClick={() => onTrack(selected, { filterMode: mode })}
            >
              {mode === 'off' ? 'Flat' : mode === 'lowpass' ? 'LP' : 'HP'}
            </button>
          ))}
        </div>
        <label className="slider-row">
          <span>Freq</span>
          <input
            type="range"
            min={80}
            max={12000}
            value={t.filterFreq}
            onChange={(e) => onTrack(selected, { filterFreq: Number(e.target.value) })}
          />
        </label>
        <label className="slider-row">
          <span>Send V</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(t.sendReverb * 100)}
            onChange={(e) =>
              onTrack(selected, { sendReverb: Number(e.target.value) / 100 })
            }
          />
        </label>
        <label className="slider-row">
          <span>Send D</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(t.sendDelay * 100)}
            onChange={(e) =>
              onTrack(selected, { sendDelay: Number(e.target.value) / 100 })
            }
          />
        </label>
      </div>
    </section>
  )
}
