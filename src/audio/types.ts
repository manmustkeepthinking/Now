export type TrackId =
  | 'kick'
  | 'trapSnare'
  | 'rimshot'
  | 'clap'
  | 'hatClosed'
  | 'hatOpen'
  | 'crash'
  | 'perc'
  | 'bass'
  | 'lead'
  | 'pad'
  | 'eightOhEight'

export type StepLength = 16 | 32 | 64
export type FilterMode = 'off' | 'lowpass' | 'highpass'
export type MelodicId = 'bass' | 'lead' | 'pad' | 'eightOhEight'

export interface StepData {
  on: boolean
  /** 0–1 */
  velocity: number
  /** 0–1 chance to fire when on */
  probability: number
  muted: boolean
  /** MIDI note for melodic tracks */
  note: number
}

export interface TrackConfig {
  id: TrackId
  label: string
  color: string
  kind: 'drum' | 'synth' | '808'
  defaultNote: number
  /** Inclusive MIDI range for piano roll */
  noteMin: number
  noteMax: number
}

export interface TrackMix {
  volume: number
  pan: number
  mute: boolean
  solo: boolean
  /** Semitones −24…+24 */
  pitch: number
  filterMode: FilterMode
  /** Hz */
  filterFreq: number
  /** One-shot / amp decay seconds (scaled per voice) */
  decay: number
  /** 0–1 portamento amount (melodic / 808) */
  glide: number
  sendReverb: number
  sendDelay: number
}

export interface MasterState {
  volume: number
  /** Compressor/limiter engaged */
  compress: boolean
  reverbSize: number
  reverbReturn: number
  delayTime: number
  delayFeedback: number
  delayReturn: number
}

export interface PatternState {
  steps: StepLength
  tracks: Record<TrackId, StepData[]>
  mix: Record<TrackId, TrackMix>
  master: MasterState
  /**
   * Root Hz detected from a loaded 808 sample (Stage 3).
   * null = use synthesized default tuning.
   */
  eightOhEightTuningHz: number | null
}

export const TRACKS: TrackConfig[] = [
  { id: 'kick', label: 'Kick', color: '#e85d4c', kind: 'drum', defaultNote: 36, noteMin: 24, noteMax: 48 },
  { id: 'trapSnare', label: 'Snare', color: '#f0a04b', kind: 'drum', defaultNote: 40, noteMin: 24, noteMax: 48 },
  { id: 'rimshot', label: 'Rim', color: '#e8c547', kind: 'drum', defaultNote: 37, noteMin: 24, noteMax: 48 },
  { id: 'clap', label: 'Clap', color: '#c8f542', kind: 'drum', defaultNote: 39, noteMin: 24, noteMax: 48 },
  { id: 'hatClosed', label: 'CH', color: '#7dd3c0', kind: 'drum', defaultNote: 42, noteMin: 36, noteMax: 60 },
  { id: 'hatOpen', label: 'OH', color: '#5ec8e8', kind: 'drum', defaultNote: 46, noteMin: 36, noteMax: 60 },
  { id: 'crash', label: 'Crash', color: '#6ea8fe', kind: 'drum', defaultNote: 49, noteMin: 36, noteMax: 60 },
  { id: 'perc', label: 'Perc', color: '#34d399', kind: 'drum', defaultNote: 54, noteMin: 36, noteMax: 60 },
  { id: 'bass', label: 'Bass', color: '#fbbf24', kind: 'synth', defaultNote: 36, noteMin: 24, noteMax: 48 },
  { id: 'lead', label: 'Lead', color: '#f472b6', kind: 'synth', defaultNote: 60, noteMin: 48, noteMax: 72 },
  { id: 'pad', label: 'Pad', color: '#38bdf8', kind: 'synth', defaultNote: 48, noteMin: 36, noteMax: 60 },
  { id: 'eightOhEight', label: '808', color: '#fb7185', kind: '808', defaultNote: 36, noteMin: 24, noteMax: 48 },
]

export const TRACK_IDS = TRACKS.map((t) => t.id)
export const MELODIC_IDS: MelodicId[] = ['bass', 'lead', 'pad', 'eightOhEight']

export function isMelodic(id: TrackId): id is MelodicId {
  return (MELODIC_IDS as string[]).includes(id)
}

export function trackConfig(id: TrackId): TrackConfig {
  return TRACKS.find((t) => t.id === id)!
}

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export function emptyStep(note = 36): StepData {
  return { on: false, velocity: 1, probability: 1, muted: false, note }
}

export function defaultMix(kind: TrackConfig['kind'] = 'drum'): TrackMix {
  return {
    volume: kind === '808' ? 0.9 : 0.85,
    pan: 0,
    mute: false,
    solo: false,
    pitch: 0,
    filterMode: 'off',
    filterFreq: kind === 'synth' ? 1800 : 4000,
    decay: kind === '808' ? 1.2 : kind === 'synth' ? 0.45 : 0.25,
    glide: kind === '808' ? 0.35 : 0,
    sendReverb: kind === 'drum' ? 0.05 : 0.15,
    sendDelay: kind === 'synth' ? 0.12 : 0,
  }
}

export function defaultMaster(): MasterState {
  return {
    volume: 0.85,
    compress: true,
    reverbSize: 0.55,
    reverbReturn: 0.22,
    delayTime: 0.28,
    delayFeedback: 0.35,
    delayReturn: 0.15,
  }
}

export function createEmptyPattern(steps: StepLength = 16): PatternState {
  const tracks = {} as Record<TrackId, StepData[]>
  const mix = {} as Record<TrackId, TrackMix>
  for (const t of TRACKS) {
    tracks[t.id] = Array.from({ length: steps }, () => emptyStep(t.defaultNote))
    mix[t.id] = defaultMix(t.kind)
  }
  return { steps, tracks, mix, master: defaultMaster(), eightOhEightTuningHz: null }
}

export function createStarterPattern(): PatternState {
  const p = createEmptyPattern(16)
  const hit = (
    id: TrackId,
    indices: number[],
    velocity = 1,
    note?: number,
  ) => {
    for (const i of indices) {
      p.tracks[id][i] = {
        on: true,
        velocity,
        probability: 1,
        muted: false,
        note: note ?? trackConfig(id).defaultNote,
      }
    }
  }
  hit('kick', [0, 4, 8, 12])
  hit('trapSnare', [4, 12], 0.95)
  hit('hatClosed', [0, 2, 4, 6, 8, 10, 12, 14], 0.65)
  hit('hatOpen', [14], 0.75)
  hit('clap', [12], 0.85)
  hit('rimshot', [6, 14], 0.5)
  hit('perc', [3, 11], 0.55)
  hit('eightOhEight', [0, 8], 0.9, 36)
  hit('eightOhEight', [4], 0.7, 31)
  hit('bass', [0, 8], 0.7, 36)
  hit('bass', [4, 12], 0.55, 43)
  hit('lead', [2, 6, 10, 14], 0.45, 60)
  hit('pad', [0], 0.4, 48)
  p.mix.pad.sendReverb = 0.45
  p.mix.lead.sendDelay = 0.25
  p.mix.eightOhEight.glide = 0.4
  p.mix.eightOhEight.decay = 1.35
  return p
}
