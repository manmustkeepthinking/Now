/**
 * Tuning detection hook for sampled 808s (used when a buffer is loaded in Stage 3).
 * Estimates fundamental via autocorrelation; returns Hz or null if unclear.
 */
export function detectFundamentalHz(
  buffer: AudioBuffer,
  opts: { minHz?: number; maxHz?: number } = {},
): number | null {
  const minHz = opts.minHz ?? 25
  const maxHz = opts.maxHz ?? 120
  const channel = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  // Use up to ~1.5s from the start (body of the 808)
  const len = Math.min(channel.length, Math.floor(sr * 1.5))
  if (len < sr * 0.05) return null

  const minLag = Math.floor(sr / maxHz)
  const maxLag = Math.min(Math.floor(sr / minHz), len - 1)
  if (maxLag <= minLag) return null

  let bestLag = minLag
  let bestCorr = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    let n = 0
    const end = Math.min(len, lag + Math.floor(sr * 0.4))
    for (let i = 0; i + lag < end; i++) {
      corr += channel[i] * channel[i + lag]
      n++
    }
    corr /= Math.max(1, n)
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }

  if (bestCorr < 0.01) return null
  const hz = sr / bestLag
  if (hz < minHz || hz > maxHz) return null
  return hz
}

/** Map detected sample root Hz → MIDI (float) for retuning playback. */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}
