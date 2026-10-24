import type { FilterMode, TrackId } from './types'
import { midiToHz } from './types'

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function env(
  gain: GainNode,
  time: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const g = gain.gain
  g.cancelScheduledValues(time)
  g.setValueAtTime(0.0001, time)
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + Math.max(0.001, attack))
  g.exponentialRampToValueAtTime(0.0001, time + Math.max(0.001, attack) + Math.max(0.01, decay))
}

export interface VoiceOpts {
  velocity: number
  note: number
  pitchSemis: number
  decay: number
  filterMode: FilterMode
  filterFreq: number
  /** Previous note Hz for portamento; null = hard attack */
  glideFromHz: number | null
  glideSec: number
  /** Sample buffer override (Stage 3) */
  sample: AudioBuffer | null
  /** Detected root Hz of sample for retune */
  sampleRootHz: number | null
}

function insertFilter(
  ctx: AudioContext,
  src: AudioNode,
  mode: FilterMode,
  freq: number,
): AudioNode {
  if (mode === 'off') return src
  const f = ctx.createBiquadFilter()
  f.type = mode
  f.frequency.value = Math.max(40, Math.min(18000, freq))
  f.Q.value = 0.7
  src.connect(f)
  return f
}

function playSample(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: VoiceOpts,
): void {
  if (!opts.sample) return
  const src = ctx.createBufferSource()
  src.buffer = opts.sample
  const root = opts.sampleRootHz ?? 55
  const target = midiToHz(opts.note + opts.pitchSemis)
  src.playbackRate.value = target / root
  const g = ctx.createGain()
  const decay = Math.max(0.05, opts.decay)
  env(g, t, opts.velocity, 0.001, decay)
  const filtered = insertFilter(ctx, src, opts.filterMode, opts.filterFreq)
  filtered.connect(g)
  g.connect(out)
  src.start(t)
  src.stop(t + decay + 0.05)
}

/** Play a built-in (or sampled) kit voice into `out` at audio time `when`. */
export function playKitVoice(
  ctx: AudioContext,
  out: AudioNode,
  id: TrackId,
  when: number,
  opts: VoiceOpts,
): void {
  const v = Math.max(0.05, Math.min(1, opts.velocity))
  if (opts.sample) {
    playSample(ctx, out, when, { ...opts, velocity: v })
    return
  }
  switch (id) {
    case 'kick':
      playKick(ctx, out, when, v, opts)
      break
    case 'trapSnare':
      playTrapSnare(ctx, out, when, v, opts)
      break
    case 'rimshot':
      playRim(ctx, out, when, v, opts)
      break
    case 'clap':
      playClap(ctx, out, when, v, opts)
      break
    case 'hatClosed':
      playHat(ctx, out, when, v, Math.min(0.12, opts.decay * 0.2), opts)
      break
    case 'hatOpen':
      playHat(ctx, out, when, v, Math.max(0.15, opts.decay * 0.6), opts)
      break
    case 'crash':
      playCrash(ctx, out, when, v, opts)
      break
    case 'perc':
      playPerc(ctx, out, when, v, opts)
      break
    case 'bass':
      playBass(ctx, out, when, v, opts)
      break
    case 'lead':
      playLead(ctx, out, when, v, opts)
      break
    case 'pad':
      playPad(ctx, out, when, v, opts)
      break
    case 'eightOhEight':
      play808(ctx, out, when, v, opts)
      break
  }
}

function playKick(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const freq = midiToHz(36 + opts.pitchSemis)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 3.2, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 0.14)
  env(gain, t, v, 0.001, Math.max(0.12, opts.decay))
  const filtered = insertFilter(ctx, osc, opts.filterMode, opts.filterFreq)
  filtered.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(t + opts.decay + 0.2)
}

function playTrapSnare(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 0.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200 * Math.pow(2, opts.pitchSemis / 12)
  bp.Q.value = 0.7
  const ng = ctx.createGain()
  env(ng, t, 0.95 * v, 0.001, Math.max(0.08, opts.decay * 0.7))
  noise.connect(bp)
  const filtered = insertFilter(ctx, bp, opts.filterMode, opts.filterFreq)
  filtered.connect(ng)
  ng.connect(out)
  noise.start(t)
  noise.stop(t + 0.25)
}

function playRim(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(880 * Math.pow(2, opts.pitchSemis / 12), t)
  env(gain, t, 0.35 * v, 0.001, Math.max(0.03, opts.decay * 0.2))
  const filtered = insertFilter(ctx, osc, opts.filterMode, opts.filterFreq || 600)
  filtered.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(t + 0.08)
}

function playClap(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  ;[0, 0.011, 0.023, 0.038].forEach((off, i, arr) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, 0.25)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    const g = ctx.createGain()
    const peak = (i === arr.length - 1 ? 0.75 : 0.3) * v
    const decay = i === arr.length - 1 ? Math.max(0.12, opts.decay * 0.6) : 0.035
    env(g, t + off, peak, 0.001, decay)
    noise.connect(bp)
    bp.connect(g)
    g.connect(out)
    noise.start(t + off)
    noise.stop(t + off + 0.25)
  })
}

function playHat(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  decay: number,
  opts: VoiceOpts,
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, decay + 0.05)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7500 * Math.pow(2, opts.pitchSemis / 24)
  const g = ctx.createGain()
  env(g, t, 0.32 * v, 0.001, decay)
  noise.connect(hp)
  const filtered = insertFilter(ctx, hp, opts.filterMode, opts.filterFreq)
  filtered.connect(g)
  g.connect(out)
  noise.start(t)
  noise.stop(t + decay + 0.02)
}

function playCrash(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 1.2)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 4500
  const g = ctx.createGain()
  env(g, t, 0.45 * v, 0.002, Math.max(0.4, opts.decay * 2))
  noise.connect(bp)
  bp.connect(g)
  g.connect(out)
  noise.start(t)
  noise.stop(t + 1.15)
}

function playPerc(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const f = midiToHz(54 + opts.pitchSemis)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f * 1.4, t)
  osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.08)
  env(g, t, 0.55 * v, 0.001, Math.max(0.06, opts.decay * 0.4))
  const filtered = insertFilter(ctx, osc, opts.filterMode, opts.filterFreq)
  filtered.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + 0.2)
}

function schedulePitch(
  osc: OscillatorNode,
  t: number,
  targetHz: number,
  opts: VoiceOpts,
): void {
  if (opts.glideFromHz && opts.glideSec > 0.001) {
    osc.frequency.setValueAtTime(opts.glideFromHz, t)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, targetHz),
      t + opts.glideSec,
    )
  } else {
    osc.frequency.setValueAtTime(targetHz, t)
  }
}

function playBass(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const freq = midiToHz(opts.note + opts.pitchSemis)
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc2.type = 'square'
  schedulePitch(osc, t, freq, opts)
  schedulePitch(osc2, t, freq * 0.5, opts)
  filter.type = opts.filterMode === 'highpass' ? 'highpass' : 'lowpass'
  filter.frequency.setValueAtTime(
    opts.filterMode === 'off' ? 600 : opts.filterFreq,
    t,
  )
  filter.frequency.exponentialRampToValueAtTime(120, t + opts.decay)
  env(g, t, 0.4 * v, 0.005, Math.max(0.15, opts.decay))
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(g)
  g.connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + opts.decay + 0.1)
  osc2.stop(t + opts.decay + 0.1)
}

function playLead(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const freq = midiToHz(opts.note + opts.pitchSemis)
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc2.type = 'sawtooth'
  schedulePitch(osc, t, freq, opts)
  schedulePitch(osc2, t, freq * 1.005, opts)
  filter.type = opts.filterMode === 'highpass' ? 'highpass' : 'lowpass'
  filter.frequency.setValueAtTime(
    opts.filterMode === 'off' ? 3200 : opts.filterFreq,
    t,
  )
  env(g, t, 0.28 * v, 0.01, Math.max(0.12, opts.decay))
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(g)
  g.connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + opts.decay + 0.1)
  osc2.stop(t + opts.decay + 0.1)
}

function playPad(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const freq = midiToHz(opts.note + opts.pitchSemis)
  const g = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = opts.filterMode === 'off' ? 1400 : opts.filterFreq
  env(g, t, 0.22 * v, 0.08, Math.max(0.5, opts.decay * 1.5))
  ;[1, 1.25, 1.5].forEach((ratio, i) => {
    const osc = ctx.createOscillator()
    osc.type = i === 0 ? 'sawtooth' : 'triangle'
    schedulePitch(osc, t, freq * ratio, opts)
    osc.connect(filter)
    osc.start(t)
    osc.stop(t + opts.decay * 1.5 + 0.2)
  })
  filter.connect(g)
  g.connect(out)
}

function play808(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  opts: VoiceOpts,
): void {
  const freq = midiToHz(opts.note + opts.pitchSemis)
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  if (opts.glideFromHz && opts.glideSec > 0.001) {
    osc.frequency.setValueAtTime(opts.glideFromHz, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t + opts.glideSec)
  } else {
    osc.frequency.setValueAtTime(freq * 1.5, t)
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05)
  }
  const decay = Math.max(0.3, opts.decay)
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.95 * v, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  const filtered = insertFilter(ctx, osc, opts.filterMode, opts.filterFreq)
  filtered.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + decay + 0.05)

  const click = ctx.createOscillator()
  const cg = ctx.createGain()
  click.type = 'sine'
  click.frequency.setValueAtTime(freq * 4, t)
  env(cg, t, 0.22 * v, 0.001, 0.03)
  click.connect(cg)
  cg.connect(out)
  click.start(t)
  click.stop(t + 0.05)
}
