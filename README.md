# NOW — Beat Lab (iPhone-first DAW)

Touch-first beat-making DAW for Safari on iPhone. React + TypeScript + Web Audio. Dark studio UI.

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build && npm run preview
```

## Features

- **Stage 1:** 16/32/64-step sequencer, 12-track kit, lookahead clock, transport, undo
- **Stage 2:** 808 piano roll (≥2 octaves), glide/decay, bass/lead/pad, per-track pitch/LP/HP/decay, master compress + reverb/delay
- **Stage 3:** Import from iOS Files (`input type=file` → Splice Samples), IndexedDB persistence, browser, 4×4 pads
- **Stage 4:** Patterns A–H, song chain, project save/share, WAV bounce via share sheet, PWA offline

## iPhone notes

- Tap the unlock screen once to start audio (Safari requirement)
- Add to Home Screen for standalone / offline
- Splice: Files → On My iPhone → Splice → Samples → multi-select import
- No File System Access API; no Splice login
