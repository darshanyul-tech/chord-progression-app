# 03 — Audio Engine

Binding design for `src/lib/audio/` (`engine.ts`, `playback.ts`, `percussion.ts`). Everything here is a port of working legacy behavior plus two deliberate changes: **npm-bundled Tone.js** and **self-hosted samples** (decision D4). All of it is Tier-1 code: framework-free, living outside React, exposed to components only through the hooks in §5.

---

## 1. Library & version

- `tone@14.8.49`, exact pin, imported as `import * as Tone from "tone"`.
- Do **not** upgrade to Tone 15.x during this project — the legacy scheduling code is written and verified against the 14.x API (`Tone.Sampler`, `Tone.start()`, `Tone.loaded()`, `.triggerAttackRelease`, `.releaseAll`).
- Delete the legacy triple-CDN `<script>` loader (`TONE_JS_SOURCES`) entirely; bundling makes it obsolete.

## 2. Piano sampler (shared, singleton)

Port `initAudio()` (legacy line ~3297 in the non-rhythm file; same function in the canonical file) with these properties preserved exactly:

- Triggered only from a user gesture (Initialize/Play buttons) → `await Tone.start()`.
- `Tone.Sampler` with the 17 Salamander sample points A1…A5 (A/C/D#/F# per octave), `release: 1.6`, volume `-6 dB`, `.toDestination()`.
- Guard flags `audioReady` / `loading`; per-topic load badges ("(loading samples…)" → "(ready)") and status messages, as legacy — badges render from the `useAudioReady()` hook state rather than direct DOM writes.
- **Changed:** `baseUrl` becomes `"/samples/piano/"`.

### Sample acquisition (one-time setup task, Phase 0)
Download the 17 files from `https://tonejs.github.io/audio/salamander/` — `A1.mp3, C2.mp3, Ds2.mp3, Fs2.mp3, A2.mp3, C3.mp3, Ds3.mp3, Fs3.mp3, A3.mp3, C4.mp3, Ds4.mp3, Fs4.mp3, A4.mp3, C5.mp3, Ds5.mp3, Fs5.mp3, A5.mp3` — into `public/samples/piano/`, keeping those exact filenames (the Sampler `urls` map already uses them). Salamander Grand is CC-licensed for this use; keep a `public/samples/piano/LICENSE.txt` noting the source (Alexander Holm, CC-BY 3.0).

## 3. Scheduling & cancellation pattern (the load-bearing convention)

The legacy app never uses `Tone.Transport`. All sequencing is `setTimeout`-based with an epoch/generation guard, per playing subsystem:

```ts
interface PlaybackChannel {
  playbackGen: number;      // epoch counter
  timers: number[];         // pending setTimeout ids
  isPlaying: boolean;
}
// start: const gen = ++ch.playbackGen; schedule steps with setTimeout, each callback
//        first checks (gen === ch.playbackGen) before touching audio/DOM
// stop:  ch.playbackGen++; clear all timers; sampler.releaseAll(0); isPlaying = false
```

Port this pattern per topic exactly as found (`stopPlayback`, `clearTimers`, `scheduleSamplerTrigger`, `delaySec`, `abortExamPlayback` in legacy) into `lib/audio/playback.ts` (`createPlaybackChannel()` factory). Each topic component holds its channel in a `useRef` and passes it to its Tier-1 play functions; `useStopOnDeactivate(channel)` wires the topic-switch stop (01-architecture §6). The exam adds `audioPlayGen` + pending-resolve promises for its sequenced hearings — port unchanged. **Do not** replace with Tone.Transport, `Tone.Part`, AbortController, or React state; behavioral fidelity outranks elegance here.

## 4. Percussion / metronome synthesis (rhythm + meter topics)

Port from the canonical file: `scheduleMetroClick`, `playSnareHit`, `scheduleNote`, `buildPlaybackEvents`, `runPlayback`, `disconnectScheduled`, `onPlaybackEnd`, `tick` (legacy lines ~6312–6520). Characteristics to preserve:

- Clicks/hits are synthesized with raw WebAudio nodes (oscillator/noise + gain envelopes) created on **Tone's context** (`Tone.getContext().rawContext` or the same `AudioContext` the legacy code obtains) — no additional context.
- Count-in precedes question playback; count-in length and click pattern reflect the meter (simple = quarter pulses, compound /8 = dotted-quarter pulses) via `metricPulseBeats` / `metricPulseCount`.
- Beat emphasis: downbeat/strong-beat clicks louder per the emphasis slider (0–100); metronome volume slider scales click gain.
- Sound modes: `percussive` (synthesized hits), `instrumental` (single repeated piano pitch via sampler), `melodic` (moving piano line) — port the exact behavior found in `runPlayback`/`scheduleNote`.

These functions move to `lib/audio/percussion.ts` (+ rhythm-topic-local pieces under `lib/rhythm/` as the port finds natural seams) — Meter Recognition imports the same functions (D12), so anything it needs must land in shared `lib/` modules, not inside the rhythm topic's component folder.

## 5. Public surface

```ts
// lib/audio/engine.ts — framework-free singleton
export const audio: {
  initAudio(): Promise<void>;                 // idempotent; user-gesture only
  readonly status: "idle" | "loading" | "ready" | "error";
  sampler: Tone.Sampler | null;
  subscribe(fn: () => void): () => void;      // tiny listener set for status changes
  now(): number;                              // Tone.now() passthrough
};

// src/hooks/useAudioReady.ts — the ONLY React coupling
export function useAudioReady(): typeof audio.status;  // useSyncExternalStore over audio.subscribe
```

Everything else (per-topic play functions, voicing playback, arpeggio timing) stays in the topic's Tier-1 modules, as legacy.

## 6. Mobile/browser constraints (carried assumptions)

- Audio init must remain behind a tap (iOS autoplay policy) — never auto-init on load.
- Sample files total ~2–3 MB; they load once after the init gesture with visible "(loading samples…)" badges. No preloading before the gesture.
- No Web MIDI, no microphone input anywhere in v1.
