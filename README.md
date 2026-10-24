# NOW — Beat-making DAW

Production-oriented browser DAW for painting and playing beats. React + TypeScript + Web Audio API. Dark studio UI.

**Stage 1 (current):** transport, 10-track step sequencer, built-in kit, lookahead scheduler.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
```

## Stage 1 features

- 16 / 32 / 64-step grid across 10 tracks (kick, trap snare, rim, clap, CH, OH, crash, perc, synth, 808)
- Built-in synthesized kit — sound on first load, no user samples
- Lookahead scheduling against `AudioContext.currentTime` (no `setInterval` note clock)
- Transport: play/stop (Space), BPM 40–240, tap tempo, swing, metronome
- Per-step velocity / probability / mute; per-track volume / pan / mute / solo
- Undo / redo

## Roadmap

See Project plan: Stage 2 (808 piano roll + synths + mixer), Stage 3 (local Splice library), Stage 4 (patterns / export / PWA).
