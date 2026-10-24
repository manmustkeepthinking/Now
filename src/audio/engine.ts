import { playKitVoice } from './kit'
import type { PatternState, TrackId } from './types'
import { TRACK_IDS } from './types'

/**
 * Lookahead scheduler against AudioContext.currentTime.
 * Uses recursive setTimeout for the scheduler tick — never setInterval —
 * so note times come from the audio clock only.
 */
export class BeatEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private trackGains = new Map<TrackId, GainNode>()
  private trackPanners = new Map<TrackId, StereoPannerNode>()
  private metroGain: GainNode | null = null

  private pattern: PatternState | null = null
  private bpm = 120
  private swing = 0
  private metronome = false
  private playing = false
  private currentStep = 0
  private nextNoteTime = 0
  private timerId: number | null = null
  private scheduleAhead = 0.1
  private lookaheadMs = 25
  private onStep: ((step: number) => void) | null = null

  async resume(): Promise<AudioContext> {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)

      this.metroGain = this.ctx.createGain()
      this.metroGain.gain.value = 0.35
      this.metroGain.connect(this.master)

      for (const id of TRACK_IDS) {
        const g = this.ctx.createGain()
        g.gain.value = 0.85
        const p = this.ctx.createStereoPanner()
        p.pan.value = 0
        g.connect(p)
        p.connect(this.master)
        this.trackGains.set(id, g)
        this.trackPanners.set(id, p)
      }
    }
    return this.ctx
  }

  setPattern(pattern: PatternState): void {
    this.pattern = pattern
    this.syncMix()
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

  private syncMix(): void {
    if (!this.pattern) return
    const anySolo = TRACK_IDS.some((id) => this.pattern!.mix[id].solo)
    for (const id of TRACK_IDS) {
      const mix = this.pattern.mix[id]
      const g = this.trackGains.get(id)
      const p = this.trackPanners.get(id)
      if (!g || !p) continue
      const silenced = mix.mute || (anySolo && !mix.solo)
      g.gain.value = silenced ? 0 : mix.volume
      p.pan.value = mix.pan
    }
  }

  async playHit(id: TrackId, velocity = 1): Promise<void> {
    const ctx = await this.resume()
    this.syncMix()
    const out = this.trackGains.get(id)
    if (!out) return
    playKitVoice(ctx, out, id, ctx.currentTime, velocity)
  }

  private secondsPerStep(): number {
    // 16th notes
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
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, time + 0.001)
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
      const cell = this.pattern.tracks[id][step]
      if (!cell?.on || cell.muted) continue
      if (Math.random() > cell.probability) continue
      const out = this.trackGains.get(id)
      if (!out) continue
      playKitVoice(this.ctx, out, id, time, cell.velocity)
    }
  }

  private advanceNote(): void {
    const step = this.currentStep
    let time = this.nextNoteTime
    // Swing delays odd 16ths (steps 1,3,5…)
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
    this.onStep?.(0)
  }

  async toggle(): Promise<void> {
    if (this.playing) {
      this.stop()
      return
    }
    await this.start()
  }
}
