import type { TrackId } from './types'

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
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack)
  g.exponentialRampToValueAtTime(0.0001, time + attack + decay)
}

/** Play a built-in kit voice into `out` at audio time `when`. */
export function playKitVoice(
  ctx: AudioContext,
  out: AudioNode,
  id: TrackId,
  when: number,
  velocity: number,
): void {
  const v = Math.max(0.05, Math.min(1, velocity))
  switch (id) {
    case 'kick':
      playKick(ctx, out, when, v)
      break
    case 'trapSnare':
      playTrapSnare(ctx, out, when, v)
      break
    case 'rimshot':
      playRim(ctx, out, when, v)
      break
    case 'clap':
      playClap(ctx, out, when, v)
      break
    case 'hatClosed':
      playHat(ctx, out, when, v, 0.045)
      break
    case 'hatOpen':
      playHat(ctx, out, when, v, 0.32)
      break
    case 'crash':
      playCrash(ctx, out, when, v)
      break
    case 'perc':
      playPerc(ctx, out, when, v)
      break
    case 'synth':
      playSynth(ctx, out, when, v, 523.25)
      break
    case 'eightOhEight':
      play808(ctx, out, when, v, 55)
      break
  }
}

function playKick(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.14)
  env(gain, t, 1 * v, 0.001, 0.38)
  osc.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(t + 0.45)

  const click = ctx.createOscillator()
  const cg = ctx.createGain()
  click.type = 'triangle'
  click.frequency.setValueAtTime(280, t)
  env(cg, t, 0.4 * v, 0.001, 0.025)
  click.connect(cg)
  cg.connect(out)
  click.start(t)
  click.stop(t + 0.04)
}

function playTrapSnare(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 0.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200
  bp.Q.value = 0.7
  const ng = ctx.createGain()
  env(ng, t, 0.95 * v, 0.001, 0.16)
  noise.connect(bp)
  bp.connect(ng)
  ng.connect(out)
  noise.start(t)
  noise.stop(t + 0.22)

  const tone = ctx.createOscillator()
  const tg = ctx.createGain()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(190, t)
  tone.frequency.exponentialRampToValueAtTime(120, t + 0.08)
  env(tg, t, 0.5 * v, 0.001, 0.1)
  tone.connect(tg)
  tg.connect(out)
  tone.start(t)
  tone.stop(t + 0.14)
}

function playRim(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(880, t)
  env(gain, t, 0.35 * v, 0.001, 0.04)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 600
  osc.connect(hp)
  hp.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(t + 0.06)
}

function playClap(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
): void {
  const offsets = [0, 0.011, 0.023, 0.038]
  offsets.forEach((off, i) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, 0.25)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 1.1
    const g = ctx.createGain()
    const peak = (i === offsets.length - 1 ? 0.75 : 0.3) * v
    const decay = i === offsets.length - 1 ? 0.2 : 0.035
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
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, decay + 0.05)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7500
  const g = ctx.createGain()
  env(g, t, 0.32 * v, 0.001, decay)
  noise.connect(hp)
  hp.connect(g)
  g.connect(out)
  noise.start(t)
  noise.stop(t + decay + 0.02)
}

function playCrash(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
): void {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 1.2)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 4500
  bp.Q.value = 0.4
  const g = ctx.createGain()
  env(g, t, 0.45 * v, 0.002, 1.0)
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
): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(640, t)
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.08)
  env(g, t, 0.55 * v, 0.001, 0.12)
  osc.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + 0.15)
}

function playSynth(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  freq: number,
): void {
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc2.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, t)
  osc2.frequency.setValueAtTime(freq * 1.005, t)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2200, t)
  filter.frequency.exponentialRampToValueAtTime(400, t + 0.35)
  env(g, t, 0.28 * v, 0.01, 0.4)
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(g)
  g.connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + 0.45)
  osc2.stop(t + 0.45)
}

function play808(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  v: number,
  freq: number,
): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06)
  // Long sub decay — dedicated 808
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.95 * v, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
  osc.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + 1.5)

  const click = ctx.createOscillator()
  const cg = ctx.createGain()
  click.type = 'sine'
  click.frequency.setValueAtTime(freq * 4, t)
  env(cg, t, 0.25 * v, 0.001, 0.03)
  click.connect(cg)
  cg.connect(out)
  click.start(t)
  click.stop(t + 0.05)
}
