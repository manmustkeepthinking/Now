export type TrackId =
  | 'kick'
  | 'trapSnare'
  | 'rimshot'
  | 'clap'
  | 'hatClosed'
  | 'hatOpen'
  | 'crash'
  | 'perc'
  | 'synth'
  | 'eightOhEight'

export type StepLength = 16 | 32 | 64

export interface StepData {
  on: boolean
  /** 0–1 */
  velocity: number
  /** 0–1 chance to fire when on */
  probability: number
  muted: boolean
}

export interface TrackConfig {
  id: TrackId
  label: string
  color: string
  /** Default MIDI-ish pitch hint for melodic voices */
  defaultPitch?: number
}

export interface TrackMix {
  volume: number
  pan: number
  mute: boolean
  solo: boolean
}

export interface PatternState {
  steps: StepLength
  tracks: Record<TrackId, StepData[]>
  mix: Record<TrackId, TrackMix>
}

export interface TransportState {
  bpm: number
  swing: number
  metronome: boolean
  playing: boolean
  currentStep: number
}

export const TRACKS: TrackConfig[] = [
  { id: 'kick', label: 'Kick', color: '#e85d4c' },
  { id: 'trapSnare', label: 'Snare', color: '#f0a04b' },
  { id: 'rimshot', label: 'Rim', color: '#e8c547' },
  { id: 'clap', label: 'Clap', color: '#c8f542' },
  { id: 'hatClosed', label: 'CH', color: '#7dd3c0' },
  { id: 'hatOpen', label: 'OH', color: '#5ec8e8' },
  { id: 'crash', label: 'Crash', color: '#6ea8fe' },
  { id: 'perc', label: 'Perc', color: '#34d399' },
  { id: 'synth', label: 'Synth', color: '#f472b6', defaultPitch: 60 },
  { id: 'eightOhEight', label: '808', color: '#fb7185', defaultPitch: 36 },
]

export const TRACK_IDS = TRACKS.map((t) => t.id)

export function emptyStep(): StepData {
  return { on: false, velocity: 1, probability: 1, muted: false }
}

export function defaultMix(): TrackMix {
  return { volume: 0.85, pan: 0, mute: false, solo: false }
}

export function createEmptyPattern(steps: StepLength = 16): PatternState {
  const tracks = {} as Record<TrackId, StepData[]>
  const mix = {} as Record<TrackId, TrackMix>
  for (const id of TRACK_IDS) {
    tracks[id] = Array.from({ length: steps }, () => emptyStep())
    mix[id] = defaultMix()
  }
  return { steps, tracks, mix }
}

export function createStarterPattern(): PatternState {
  const p = createEmptyPattern(16)
  const on = (id: TrackId, indices: number[], velocity = 1) => {
    for (const i of indices) {
      p.tracks[id][i] = { on: true, velocity, probability: 1, muted: false }
    }
  }
  on('kick', [0, 4, 8, 12])
  on('trapSnare', [4, 12], 0.95)
  on('hatClosed', [0, 2, 4, 6, 8, 10, 12, 14], 0.7)
  on('hatOpen', [14], 0.8)
  on('clap', [12], 0.85)
  on('rimshot', [6, 14], 0.55)
  on('perc', [3, 11], 0.6)
  on('eightOhEight', [0, 8], 0.9)
  on('synth', [0, 8], 0.55)
  return p
}
