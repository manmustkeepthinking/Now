import { playKitVoice, type VoiceOpts } from './kit'
import type { MasterState, PatternState, TrackId } from './types'
import { TRACK_IDS, isMelodic } from './types'

type SampleMap = Partial<Record<TrackId, { buffer: AudioBuffer; rootHz: number }>>

/**
 * Lookahead scheduler on AudioContext.currentTime.
 * Recursive setTimeout for the tick — never setInterval.
 */
export class BeatEngine {
  private ctx: AudioContext | null = null
  private unlocked = false

  private masterGain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private dryGain: GainNode | null = null
  private reverb: ConvolverNode | null = null
  private reverbGain: GainNode | null = null
  private delay: DelayNode | null = null
  private delayFeedback: GainNode | null = null
  private delayGain: GainNode | null = null

  private trackGains = new Map<TrackId, GainNode>()
  private trackPanners = new Map<TrackId, StereoPannerNode>()
  private trackReverbSend = new Map<TrackId, GainNode>()
  private trackDelaySend = new Map<TrackId, GainNode>()
  private metroGain: GainNode | null = null

  private pattern: PatternState | null = null
  private samples: SampleMap = {}
  private bpm = 120
  private swing = 0
  private metronome = false
  private playing = false
  private currentStep = 0
  private nextNoteTime = 0
  private timerId: number | null = null
  private scheduleAhead = 0.12
  private lookaheadMs = 25
  private onStep: ((step: number) => void) | null = null
  private lastMelodicHz = new Map<TrackId, number>()

  isUnlocked(): boolean {
    return this.unlocked
  }

  /** Call from first user tap — required for iOS Safari. */
  async unlock(): Promise<void> {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') await ctx.resume()
    // Silent buffer + short audible tick so Safari fully unlocks output
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = 660
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.07)
    this.unlocked = true
  }

  async resume(): Promise<AudioContext> {
    if (!this.unlocked) await this.unlock()
    const ctx = this.ensure()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      this.ctx = new AC()
      this.buildGraph(this.ctx)
    }
    return this.ctx
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      }
    }
    return buf
  }

  private buildGraph(ctx: AudioContext): void {
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.85

    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 12
    this.compressor.ratio.value = 8
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.15

    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 1

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(ctx, 2.2, 2.8)
    this.reverbGain = ctx.createGain()
    this.reverbGain.gain.value = 0.22

    this.delay = ctx.createDelay(1.5)
    this.delay.delayTime.value = 0.28
    this.delayFeedback = ctx.createGain()
    this.delayFeedback.gain.value = 0.35
    this.delayGain = ctx.createGain()
    this.delayGain.gain.value = 0.15

    this.dryGain.connect(this.compressor)
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(this.compressor)
    this.delay.connect(this.delayGain)
    this.delay.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delay)
    this.delayGain.connect(this.compressor)

    this.compressor.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    this.metroGain = ctx.createGain()
    this.metroGain.gain.value = 0.3
    this.metroGain.connect(this.dryGain)

    for (const id of TRACK_IDS) {
      const g = ctx.createGain()
      g.gain.value = 0.85
      const p = ctx.createStereoPanner()
      p.pan.value = 0
      const rev = ctx.createGain()
      rev.gain.value = 0.05
      const del = ctx.createGain()
      del.gain.value = 0
      g.connect(p)
      p.connect(this.dryGain)
      p.connect(rev)
      p.connect(del)
      rev.connect(this.reverb)
      del.connect(this.delay)
      this.trackGains.set(id, g)
      this.trackPanners.set(id, p)
      this.trackReverbSend.set(id, rev)
      this.trackDelaySend.set(id, del)
    }
  }

  setPattern(pattern: PatternState): void {
    this.pattern = pattern
    this.syncMix()
    this.syncMaster(pattern.master)
  }

  setSamples(samples: SampleMap): void {
    this.samples = samples
  }

  setBpm(bpm: number): void {
    this.bpm = Math.min(240, Math.max(40, bpm))
  }

  setSwing(swing: number): void {
    this.swing = Math.min(1, Math.max(0, swing))
  }

  setMetronome(on: boolean): void {
    this.metronome = on
  }

  setOnStep(cb: ((step: number) => void) | null): void {
    this.onStep = cb
  }

  isPlaying(): boolean {
    return this.playing
  }

  getCurrentStep(): number {
    return this.currentStep
  }

  getContext(): AudioContext | null {
    return this.ctx
  }

  private syncMaster(m: MasterState): void {
    if (!this.masterGain || !this.compressor || !this.reverbGain || !this.delay || !this.delayFeedback || !this.delayGain || !this.reverb || !this.ctx) {
      return
    }
    this.masterGain.gain.value = m.volume
    this.compressor.threshold.value = m.compress ? -18 : 0
    this.compressor.ratio.value = m.compress ? 8 : 1
    this.reverbGain.gain.value = m.reverbReturn
    this.delay.delayTime.value = Math.max(0.05, Math.min(1.2, m.delayTime))
    this.delayFeedback.gain.value = m.delayFeedback
    this.delayGain.gain.value = m.delayReturn
    // Rebuild impulse size lightly when reverbSize changes a lot
    const secs = 1.2 + m.reverbSize * 2.5
    this.reverb.buffer = this.makeImpulse(this.ctx, secs, 2.2 + m.reverbSize)
  }

  private syncMix(): void {
    if (!this.pattern) return
    const anySolo = TRACK_IDS.some((id) => this.pattern!.mix[id].solo)
    for (const id of TRACK_IDS) {
      const mix = this.pattern.mix[id]
      const g = this.trackGains.get(id)
      const p = this.trackPanners.get(id)
      const rev = this.trackReverbSend.get(id)
      const del = this.trackDelaySend.get(id)
      if (!g || !p || !rev || !del) continue
      const silenced = mix.mute || (anySolo && !mix.solo)
      g.gain.value = silenced ? 0 : mix.volume
      p.pan.value = mix.pan
      rev.gain.value = silenced ? 0 : mix.sendReverb
      del.gain.value = silenced ? 0 : mix.sendDelay
    }
  }

  private voiceOpts(id: TrackId, stepIndex: number): VoiceOpts | null {
    if (!this.pattern) return null
    const cell = this.pattern.tracks[id][stepIndex]
    if (!cell?.on || cell.muted) return null
    if (Math.random() > cell.probability) return null
    const mix = this.pattern.mix[id]
    const sample = this.samples[id]
    const note = cell.note
    const targetHz =
      440 * Math.pow(2, (note + mix.pitch - 69) / 12)
    let glideFromHz: number | null = null
    let glideSec = 0
    if (isMelodic(id) && mix.glide > 0) {
      const prev = this.lastMelodicHz.get(id)
      if (prev && Math.abs(prev - targetHz) > 0.5) {
        glideFromHz = prev
        glideSec = 0.02 + mix.glide * 0.35
      }
      this.lastMelodicHz.set(id, targetHz)
    }
    const rootHz =
      id === 'eightOhEight'
        ? (sample?.rootHz ?? this.pattern.eightOhEightTuningHz ?? null)
        : (sample?.rootHz ?? null)
    return {
      velocity: cell.velocity,
      note,
      pitchSemis: mix.pitch,
      decay: mix.decay,
      filterMode: mix.filterMode,
      filterFreq: mix.filterFreq,
      glideFromHz,
      glideSec,
      sample: sample?.buffer ?? null,
      sampleRootHz: rootHz,
    }
  }

  async playHit(id: TrackId, velocity = 1, note?: number): Promise<void> {
    const ctx = await this.resume()
    this.syncMix()
    if (this.pattern) this.syncMaster(this.pattern.master)
    const out = this.trackGains.get(id)
    if (!out || !this.pattern) return
    const mix = this.pattern.mix[id]
    const sample = this.samples[id]
    const n = note ?? this.pattern.tracks[id].find((s) => s.on)?.note ?? 36
    playKitVoice(ctx, out, id, ctx.currentTime, {
      velocity,
      note: n,
      pitchSemis: mix.pitch,
      decay: mix.decay,
      filterMode: mix.filterMode,
      filterFreq: mix.filterFreq,
      glideFromHz: null,
      glideSec: 0,
      sample: sample?.buffer ?? null,
      sampleRootHz:
        id === 'eightOhEight'
          ? (sample?.rootHz ?? this.pattern.eightOhEightTuningHz)
          : (sample?.rootHz ?? null),
    })
  }

  private secondsPerStep(): number {
    return 60 / this.bpm / 4
  }

  private scheduleMetronome(time: number, step: number): void {
    if (!this.metronome || !this.ctx || !this.metroGain) return
    if (step % 4 !== 0) return
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    const accent = step % 16 === 0
    osc.frequency.value = accent ? 1200 : 900
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(accent ? 0.45 : 0.25, time + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)
    osc.connect(g)
    g.connect(this.metroGain)
    osc.start(time)
    osc.stop(time + 0.05)
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.pattern || !this.ctx) return
    this.scheduleMetronome(time, step)
    this.syncMix()
    for (const id of TRACK_IDS) {
      const opts = this.voiceOpts(id, step)
      if (!opts) continue
      const out = this.trackGains.get(id)
      if (!out) continue
      playKitVoice(this.ctx, out, id, time, opts)
    }
  }

  private advanceNote(): void {
    const step = this.currentStep
    let time = this.nextNoteTime
    if (step % 2 === 1 && this.swing > 0) {
      time += this.secondsPerStep() * this.swing * 0.5
    }
    this.scheduleStep(step, time)
    this.onStep?.(step)
    const len = this.pattern?.steps ?? 16
    this.currentStep = (step + 1) % len
    this.nextNoteTime += this.secondsPerStep()
  }

  private scheduler = (): void => {
    if (!this.playing || !this.ctx) return
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      this.advanceNote()
    }
    this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs)
  }

  async start(): Promise<void> {
    const ctx = await this.resume()
    if (this.playing) return
    this.playing = true
    this.currentStep = 0
    this.lastMelodicHz.clear()
    this.nextNoteTime = ctx.currentTime + 0.06
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    this.scheduler()
  }

  stop(): void {
    this.playing = false
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    this.currentStep = 0
    this.lastMelodicHz.clear()
    this.onStep?.(0)
  }

  async toggle(): Promise<void> {
    if (this.playing) {
      this.stop()
      return
    }
    await this.start()
  }

  /** Offline bounce of current pattern loops to WAV ArrayBuffer. */
  async renderWav(loops = 1): Promise<ArrayBuffer> {
    if (!this.pattern) throw new Error('No pattern')
    const sr = 44100
    const stepSec = 60 / this.bpm / 4
    const duration = this.pattern.steps * stepSec * loops + 1.5
    const offline = new OfflineAudioContext(2, Math.ceil(sr * duration), sr)
    // Minimal offline graph: dry only for reliable bounce
    const master = offline.createGain()
    master.gain.value = this.pattern.master.volume
    master.connect(offline.destination)
    const gains = new Map<TrackId, GainNode>()
    for (const id of TRACK_IDS) {
      const g = offline.createGain()
      const mix = this.pattern.mix[id]
      const anySolo = TRACK_IDS.some((t) => this.pattern!.mix[t].solo)
      g.gain.value = mix.mute || (anySolo && !mix.solo) ? 0 : mix.volume
      g.connect(master)
      gains.set(id, g)
    }
    const savedLast = new Map(this.lastMelodicHz)
    this.lastMelodicHz.clear()
    for (let loop = 0; loop < loops; loop++) {
      for (let step = 0; step < this.pattern.steps; step++) {
        let t = (loop * this.pattern.steps + step) * stepSec + 0.05
        if (step % 2 === 1 && this.swing > 0) t += stepSec * this.swing * 0.5
        for (const id of TRACK_IDS) {
          const opts = this.voiceOpts(id, step)
          if (!opts) continue
          const out = gains.get(id)!
          playKitVoice(offline as unknown as AudioContext, out, id, t, opts)
        }
      }
    }
    this.lastMelodicHz = savedLast
    const rendered = await offline.startRendering()
    return audioBufferToWav(rendered)
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return ab
}
