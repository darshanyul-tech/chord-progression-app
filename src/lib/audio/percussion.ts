import type { Measure } from '../rhythm/time';
import { sortNotes } from '../rhythm/time';

// Ported verbatim from legacy rhythm-dictation IIFE (percussion/metronome
// synthesis + playback-event building, lines ~6312-6432,
// docs/03-audio-engine.md §4). Runs on Tone's shared raw AudioContext, not
// a separate one (see lib/audio/engine.ts).

export type ScheduledNode = { stop?: (when?: number) => void; disconnect?: () => void };

export function disconnectScheduled(nodes: ScheduledNode[]): void {
  nodes.forEach((n) => {
    try {
      if (n.stop) n.stop(0);
      if (n.disconnect) n.disconnect();
    } catch {
      /* noop */
    }
  });
  nodes.length = 0;
}

export function scheduleMetroClick(
  ctx: BaseAudioContext,
  startTime: number,
  isBeat1: boolean,
  metroVolume: number,
  scheduledNodes: ScheduledNode[],
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isBeat1 ? 320 : 260, startTime);
  const vol = (metroVolume / 100) * 0.22;
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.05);
  scheduledNodes.push(osc, gain);
}

export function playSnareHit(
  ctx: BaseAudioContext,
  startTime: number,
  isBeat1: boolean,
  beatEmphasis: number,
  scheduledNodes: ScheduledNode[],
): void {
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const vol = isBeat1 ? 0.62 + beatEmphasis * 0.003 : 0.42;

  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(185, startTime);
  bodyOsc.frequency.exponentialRampToValueAtTime(95, startTime + 0.045);
  bodyGain.gain.setValueAtTime(vol * 0.75, startTime);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
  bodyOsc.connect(bodyGain);
  bodyGain.connect(master);
  bodyOsc.start(startTime);
  bodyOsc.stop(startTime + 0.15);

  const len = Math.floor(ctx.sampleRate * 0.16);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.028));
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 2800;
  filt.Q.value = 0.65;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.9, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
  noise.connect(filt);
  filt.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(startTime);

  scheduledNodes.push(bodyOsc, bodyGain, noise, filt, noiseGain, master);
}

export type SoundType = 'percussive' | 'instrumental' | 'melodic';

export function scheduleNote(
  ctx: BaseAudioContext,
  startTime: number,
  duration: number,
  isRest: boolean,
  isBeat1: boolean,
  soundType: SoundType,
  bpm: number,
  beatEmphasis: number,
  scheduledNodes: ScheduledNode[],
): void {
  if (isRest) return;

  if (soundType === 'percussive') {
    playSnareHit(ctx, startTime, isBeat1, beatEmphasis, scheduledNodes);
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  const osc = ctx.createOscillator();
  if (soundType === 'instrumental') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isBeat1 ? 523.25 : 440, startTime);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 + (isBeat1 ? 0 : 30), startTime);
  }
  osc.connect(gainNode);
  const noteDuration = ((duration * 60) / bpm) * (soundType === 'melodic' ? 0.9 : 0.85);
  gainNode.gain.setValueAtTime(0.3, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
  osc.start(startTime);
  osc.stop(startTime + noteDuration);
  scheduledNodes.push(osc, gainNode);
}

export interface PlaybackEvent {
  time: number;
  duration: number;
  isRest: boolean;
  isBeat1: boolean;
}

export function buildPlaybackEvents(
  pattern: Measure[],
  bpm: number,
  measureTotalBeats: number,
  pulseBeats: number,
  numMeasures: number,
): { events: PlaybackEvent[]; totalDuration: number } {
  const events: PlaybackEvent[] = [];
  const spb = 60 / bpm;
  let t = 0;
  pattern.forEach((measure) => {
    const sorted = sortNotes(measure);
    const measureStart = t;
    sorted.forEach((n) => {
      const isBeat1 = Math.abs(n.beat % pulseBeats) < 0.001 || n.beat < 0.001;
      events.push({ time: measureStart + n.beat * spb, duration: n.duration, isRest: n.isRest, isBeat1 });
    });
    t += measureTotalBeats * spb;
  });
  events.sort((a, b) => a.time - b.time);
  const totalDuration = numMeasures * measureTotalBeats * spb;
  return { events, totalDuration };
}
