const BANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

interface PatternBankProps {
  active: string
  song: string[]
  onSelect: (id: string) => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onClear: () => void
  onToggleSong: (id: string) => void
  onClearSong: () => void
  songMode: boolean
  onSongMode: (on: boolean) => void
}

export function PatternBank({
  active,
  song,
  onSelect,
  onCopy,
  onPaste,
  onDuplicate,
  onClear,
  onToggleSong,
  onClearSong,
  songMode,
  onSongMode,
}: PatternBankProps) {
  return (
    <section className="patterns" aria-label="Pattern bank">
      <div className="patterns-head">
        <h2>Patterns</h2>
        <label className="check big">
          <input
            type="checkbox"
            checked={songMode}
            onChange={(e) => onSongMode(e.target.checked)}
          />
          Song mode
        </label>
      </div>
      <div className="bank-grid">
        {BANKS.map((id) => (
          <button
            key={id}
            type="button"
            className={`bank ${active === id ? 'is-on' : ''} ${
              song.includes(id) ? 'in-song' : ''
            }`}
            onClick={() => (songMode ? onToggleSong(id) : onSelect(id))}
          >
            {id}
          </button>
        ))}
      </div>
      {songMode && (
        <p className="song-chain">
          Chain: {song.length ? song.join(' → ') : 'tap patterns to chain'}
          {song.length > 0 && (
            <button type="button" className="ghost" onClick={onClearSong}>
              Clear chain
            </button>
          )}
        </p>
      )}
      <div className="transport-actions">
        <button type="button" className="ghost" onClick={onCopy}>
          Copy
        </button>
        <button type="button" className="ghost" onClick={onPaste}>
          Paste
        </button>
        <button type="button" className="ghost" onClick={onDuplicate}>
          Dup
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  )
}

export { BANKS }
