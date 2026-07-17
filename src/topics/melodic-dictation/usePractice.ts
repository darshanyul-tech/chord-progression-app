import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { audio } from '../../lib/audio/engine';
import { disconnectScheduled, scheduleMetroClick, type ScheduledNode } from '../../lib/audio/percussion';
import { generateMelody } from '../../lib/melody/generator';
import { firstDifferingMeasure, pitchedMeasuresEqual } from '../../lib/melody/grading';
import { resolvePlacementBeat } from '../../lib/melody/placement';
import type { MelodicDictationSettings } from '../../lib/melody/settings';
import { keyById, resolveRangeWindow, type Clef, type KeyDef, type PitchedMeasure } from '../../lib/melody/theory';
import { candidateBeats, DUR_LABELS, getActiveDurations } from '../../lib/rhythm/generator';
import {
  durationClose,
  durationFitsBar,
  gridStep,
  maxNotesOfDuration,
  metricPulseBeats,
  metricPulseCount,
  type TimeSigInfo,
} from '../../lib/rhythm/time';
import { midiToNoteName } from '../../lib/theory';
import { prefersReducedMotion, REDUCED_MOTION_INTERVAL_SEC } from '../../lib/motion';
import type { StatusKind } from '../../components/StatusLine';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'melodic-dictation';
const TRIAD_DUR_MS = 1200;

interface PlacementRecord {
  measureIndex: number;
  beat: number;
}

interface MelodyChannel {
  playbackGen: number;
  timers: number[];
  scheduledNodes: ScheduledNode[];
  rafId: number | null;
}

function newChannel(): MelodyChannel {
  return { playbackGen: 0, timers: [], scheduledNodes: [], rafId: null };
}

interface PlaybackModel {
  key: KeyDef;
  clef: Clef;
  timeSig: TimeSigInfo;
  numMeasures: number;
  measures: PitchedMeasure[];
}

/** Tonic (I/i) triad anchored to the clef's reference octave (§4 key orientation). */
function tonicTriadMidis(key: KeyDef, clef: Clef): number[] {
  const refLow = clef === 'treble' ? 60 : 48;
  const root = refLow + key.tonicPc;
  const third = key.mode === 'major' ? root + 4 : root + 3;
  return [root, third, root + 7];
}

export function useMelodicPractice(settings: MelodicDictationSettings) {
  const audioStatus = useAudioReady();
  const isActive = useIsActiveTopic(TOPIC_ID);
  const channelRef = useRef<MelodyChannel>(newChannel());

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [key, setKey] = useState<KeyDef>(() => keyById(settings.key));
  const [clef, setClef] = useState<Clef>(settings.clef === 'random' ? 'treble' : settings.clef);
  const [timeSig, setTimeSig] = useState<TimeSigInfo>({ beatsPerBar: 4, beatValue: 4, measureBeats: 4 });
  const [numMeasures, setNumMeasures] = useState(settings.measures);
  const [correctMeasures, setCorrectMeasures] = useState<PitchedMeasure[]>([]);
  const [userMeasures, setUserMeasures] = useState<PitchedMeasure[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [cursorBeat, setCursorBeat] = useState<number | null>(null);
  const [cursorMidi, setCursorMidi] = useState<number | null>(null);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const [placementHistory, setPlacementHistory] = useState<PlacementRecord[]>([]);
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const [isDotActive, setIsDotActive] = useState(false);
  const [armedAccidental, setArmedAccidental] = useState<'' | '#' | 'b'>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [playbackFraction, setPlaybackFraction] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');

  const activeDurations = getActiveDurations(settings.durations, false, timeSig.measureBeats); // triplets off (§3.2)
  const gridStepVal = gridStep(activeDurations);

  function clearAllTimers() {
    const ch = channelRef.current;
    ch.timers.forEach((t) => clearTimeout(t));
    ch.timers = [];
  }

  function stopPlayback() {
    channelRef.current.playbackGen++;
    clearAllTimers();
    disconnectScheduled(channelRef.current.scheduledNodes);
    if (channelRef.current.rafId !== null) {
      cancelAnimationFrame(channelRef.current.rafId);
      channelRef.current.rafId = null;
    }
    try {
      audio.sampler?.releaseAll(0);
    } catch {
      /* noop */
    }
    setIsPlaying(false);
    setPlaybackFraction(null);
  }

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) stopPlayback();
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stopPlayback, []);

  function runPlayback(model: PlaybackModel) {
    if (audio.status !== 'ready' || !audio.sampler) return;
    stopPlayback();
    const channel = channelRef.current;
    const playGen = channel.playbackGen;
    const ctx = audio.rawContext();
    if (ctx.state === 'suspended' && 'resume' in ctx) (ctx as AudioContext).resume();
    setIsPlaying(true);
    setHasListened(true);

    const bpm = settings.tempo;
    const spb = 60 / bpm;
    const pulse = metricPulseBeats(model.timeSig.beatValue, model.timeSig.beatsPerBar);
    const countInPulses = metricPulseCount(model.timeSig.measureBeats, pulse);
    const countInDurMs = countInPulses * pulse * spb * 1000;

    const schedule = (delayMs: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (channel.playbackGen !== playGen) return;
        fn();
      }, Math.max(0, delayMs));
      channel.timers.push(id);
    };

    // Key orientation: tonic triad (§4), then a meter-aware one-bar count-in.
    schedule(50, () => {
      const triad = tonicTriadMidis(model.key, model.clef).map(midiToNoteName);
      audio.sampler!.triggerAttackRelease(triad, 1.2, audio.now(), 0.75);
    });
    for (let b = 0; b < countInPulses; b++) {
      schedule(50 + TRIAD_DUR_MS + b * pulse * spb * 1000, () => {
        scheduleMetroClick(ctx, ctx.currentTime, b === 0, 60, channel.scheduledNodes);
      });
    }

    const rhythmStartMs = 50 + TRIAD_DUR_MS + countInDurMs;
    let measureStartMs = rhythmStartMs;
    model.measures.forEach((bar) => {
      bar.forEach((n) => {
        if (!n.rest && n.midi !== null) {
          const noteName = midiToNoteName(n.midi);
          const whenMs = measureStartMs + n.beat * spb * 1000;
          const durSec = n.duration * spb * 0.9;
          schedule(whenMs, () => {
            audio.sampler!.triggerAttackRelease(noteName, durSec, audio.now(), 0.85);
          });
        }
      });
      measureStartMs += model.timeSig.measureBeats * spb * 1000;
    });

    const totalMs = rhythmStartMs + model.numMeasures * model.timeSig.measureBeats * spb * 1000;
    schedule(totalMs + 150, () => {
      setIsPlaying(false);
      setPlaybackFraction(null);
    });

    const perfStart = performance.now();
    let lastCursorUpdateMs = -Infinity;
    const tick = () => {
      if (channel.playbackGen !== playGen) return;
      const elapsed = performance.now() - perfStart;
      if (elapsed >= rhythmStartMs && elapsed <= totalMs) {
        if (!prefersReducedMotion() || elapsed - lastCursorUpdateMs >= REDUCED_MOTION_INTERVAL_SEC * 1000) {
          lastCursorUpdateMs = elapsed;
          setPlaybackFraction(Math.min(1, Math.max(0, (elapsed - rhythmStartMs) / (totalMs - rhythmStartMs))));
        }
      } else {
        setPlaybackFraction(null);
      }
      if (elapsed < totalMs) {
        channel.rafId = requestAnimationFrame(tick);
      } else {
        channel.rafId = null;
      }
    };
    channel.rafId = requestAnimationFrame(tick);
  }

  function startPlayback() {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (audioStatus !== 'ready') return;
    runPlayback({ key, clef, timeSig, numMeasures, measures: correctMeasures });
  }

  function replay() {
    stopPlayback();
    if (audioStatus !== 'ready') return;
    runPlayback({ key, clef, timeSig, numMeasures, measures: correctMeasures });
  }

  function generateQuestion(autoPlay = true) {
    stopPlayback();
    const generated = generateMelody(settings);
    setKey(generated.key);
    setClef(generated.clef);
    setTimeSig(generated.timeSig);
    setNumMeasures(settings.measures);
    setCorrectMeasures(generated.measures);
    setUserMeasures(Array.from({ length: settings.measures }, () => []));
    setHasSubmitted(false);
    setIsCorrect(false);
    setActiveMeasureIndex(0);
    setPlacementHistory([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    setHasListened(false);
    if (autoPlay && audio.status === 'ready') {
      window.setTimeout(
        () =>
          runPlayback({
            key: generated.key,
            clef: generated.clef,
            timeSig: generated.timeSig,
            numMeasures: settings.measures,
            measures: generated.measures,
          }),
        450,
      );
    }
  }

  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    generateQuestion(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText('Audio ready. Press Play melody.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  function effectiveDuration(base: number): number {
    return isDotActive ? base * 1.5 : base;
  }

  function previewPitch(midi: number) {
    if (!settings.previewOnPlace || audio.status !== 'ready' || !audio.sampler) return;
    audio.sampler.triggerAttackRelease(midiToNoteName(midi), 0.35, audio.now());
  }

  function placeNoteAt(measureIndex: number, rawBeat: number, duration: number, isRest: boolean, midi: number | null) {
    if (hasSubmitted) return;
    const dur = effectiveDuration(duration);
    const measure = userMeasures[measureIndex];
    if (!measure) return;
    const cap = timeSig.measureBeats;
    const reject = () => {
      setFlashMeasure(measureIndex);
      window.setTimeout(() => setFlashMeasure(null), 280);
    };
    if (!durationFitsBar(dur, cap)) {
      reject();
      return;
    }
    // Resolve the click/cursor's raw beat estimate into either a direct hit
    // on an existing note (edit in place) or the nearest free slot the armed
    // duration actually fits in — never silently replaces a neighbour to
    // make room (docs/12-melodic-dictation-fixes.md MD-3 / RC-3).
    const resolved = resolvePlacementBeat(measure, rawBeat, dur, cap, gridStepVal);
    if (!resolved) {
      reject();
      return;
    }
    const { beat, isReplace } = resolved;
    if (isReplace) {
      const end = beat + dur;
      const collidesWithOther = measure.some(
        (n) => !durationClose(n.beat, beat) && beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001,
      );
      if (collidesWithOther || end > cap + 0.001) {
        reject();
        return;
      }
    }
    // Clamp clicks far above/below the staff to the current range window
    // instead of placing an absurd pitch — flash to signal the clamp.
    let placedMidi = midi;
    if (!isRest && midi !== null) {
      const rangeWindow = resolveRangeWindow(key, clef, settings.range);
      const clamped = Math.max(rangeWindow.lowMidi, Math.min(rangeWindow.highMidi, midi));
      if (clamped !== midi) {
        placedMidi = clamped;
        setFlashMeasure(measureIndex);
        window.setTimeout(() => setFlashMeasure(null), 280);
      }
    }
    setUserMeasures((prev) =>
      prev.map((m, i) =>
        i === measureIndex
          ? [
              ...m.filter((n) => !durationClose(n.beat, beat)),
              { beat, duration: dur, rest: isRest, midi: isRest ? null : placedMidi },
            ]
          : m,
      ),
    );
    setPlacementHistory((prev) => [
      ...prev.filter((p) => !(p.measureIndex === measureIndex && durationClose(p.beat, beat))),
      { measureIndex, beat },
    ]);
    setActiveMeasureIndex(measureIndex);
    if (!isRest && placedMidi !== null) previewPitch(placedMidi);
  }

  // Keyboard placement fallback (09-improvement-plan.md §14.1): mirrors
  // rhythm-dictation's insertion cursor, plus a pitch dimension (Up/Down
  // select a staff line before Enter commits, per the plan's melodic note).
  //
  // Steps through the union of (a) free beats the armed duration could fill
  // and (b) existing notes' own beats (so the cursor can still reach a note
  // to replace it), always moving to the single nearest steppable beat in
  // the travel direction — never "nearest overall, then +1" (that skipped
  // the very next beat whenever the cursor wasn't itself sitting on a
  // candidate, e.g. right after a placement; docs/12-melodic-dictation-
  // fixes.md MD-3 item 4, found via live verification of this fix).
  function moveCursorBeat(delta: number) {
    if (hasSubmitted) return;
    setCursorBeat((prev) => {
      const cur = prev ?? 0;
      const cap = timeSig.measureBeats;
      const measure = userMeasures[activeMeasureIndex] ?? [];
      const spans = measure.map((n) => ({ start: n.beat, end: n.beat + n.duration }));
      const dur = effectiveDuration(armedDuration);
      const freeCandidates = candidateBeats(dur, spans, cap, gridStepVal);
      const steppable = Array.from(new Set([...freeCandidates, ...measure.map((n) => n.beat)])).sort((a, b) => a - b);

      const next =
        delta > 0
          ? steppable.find((c) => c > cur + 0.001)
          : steppable
              .slice()
              .reverse()
              .find((c) => c < cur - 0.001);
      if (next !== undefined) return next;

      if (delta > 0) {
        const nextIndex = activeMeasureIndex + 1;
        if (nextIndex < numMeasures) {
          setActiveMeasureIndex(nextIndex);
          return 0;
        }
        return steppable.length ? steppable[steppable.length - 1]! : Math.max(0, cap - gridStepVal);
      }
      const prevIndex = activeMeasureIndex - 1;
      if (prevIndex >= 0) {
        setActiveMeasureIndex(prevIndex);
        return Math.max(0, cap - gridStepVal);
      }
      return steppable.length ? steppable[0]! : 0;
    });
  }

  function moveCursorPitch(delta: number) {
    if (hasSubmitted) return;
    setCursorMidi((prev) => {
      const rangeWindow = resolveRangeWindow(key, clef, settings.range);
      const cur = prev ?? rangeWindow.lowMidi;
      const next = Math.max(rangeWindow.lowMidi, Math.min(rangeWindow.highMidi, cur + delta));
      previewPitch(next);
      return next;
    });
  }

  function placeAtCursor() {
    if (cursorBeat === null) return;
    placeNoteAt(activeMeasureIndex, cursorBeat, armedDuration, armedIsRest, armedIsRest ? null : cursorMidi);
  }

  function focusCursor() {
    if (hasSubmitted) return;
    setCursorBeat(0);
    setCursorMidi((prev) => {
      if (prev !== null) return prev;
      return resolveRangeWindow(key, clef, settings.range).lowMidi;
    });
  }

  function blurCursor() {
    setCursorBeat(null);
  }

  function removeLastNote() {
    if (hasSubmitted) return;
    setPlacementHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1]!;
      setUserMeasures((prevMeasures) =>
        prevMeasures.map((m, i) => {
          if (i !== last.measureIndex) return m;
          const idx = m.findIndex((n) => durationClose(n.beat, last.beat));
          if (idx < 0) return m;
          const next = m.slice();
          next.splice(idx, 1);
          return next;
        }),
      );
      setActiveMeasureIndex(last.measureIndex);
      return prev.slice(0, -1);
    });
  }

  function clearActiveMeasure() {
    if (hasSubmitted) return;
    setUserMeasures((prev) => prev.map((m, i) => (i === activeMeasureIndex ? [] : m)));
    setPlacementHistory((prev) => prev.filter((p) => p.measureIndex !== activeMeasureIndex));
  }

  function nudgeLastNote(delta: number) {
    if (hasSubmitted || !placementHistory.length) return;
    const last = placementHistory[placementHistory.length - 1]!;
    const note = userMeasures[last.measureIndex]?.find(
      (n) => durationClose(n.beat, last.beat) && !n.rest && n.midi !== null,
    );
    if (!note || note.midi === null) return;
    const newMidi = note.midi + delta;
    setUserMeasures((prev) =>
      prev.map((m, i) => {
        if (i !== last.measureIndex) return m;
        return m.map((n) => (durationClose(n.beat, last.beat) && !n.rest && n.midi !== null ? { ...n, midi: newMidi } : n));
      }),
    );
    previewPitch(newMidi);
  }

  function checkAnswer() {
    setHasSubmitted(true);
    const correct = pitchedMeasuresEqual(userMeasures, correctMeasures);
    setIsCorrect(correct);
    recordAttempt(TOPIC_ID, correct);
    if (correct) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      const diffIdx = firstDifferingMeasure(userMeasures, correctMeasures);
      setFeedbackKind('bad');
      setFeedbackMsg(
        diffIdx !== null ? `Incorrect — Measure ${diffIdx + 1} differs. See staff for corrections.` : 'Incorrect.',
      );
    }
  }

  function armDuration(dur: number) {
    setArmedDuration(dur);
  }
  function toggleRest() {
    setArmedIsRest((p) => !p);
  }
  function toggleDot() {
    setIsDotActive((p) => !p);
  }
  function toggleSharp() {
    setArmedAccidental((p) => (p === '#' ? '' : '#'));
  }
  function toggleFlat() {
    setArmedAccidental((p) => (p === 'b' ? '' : 'b'));
  }

  async function init() {
    if (audio.status === 'ready' || audio.status === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
  }

  const totalBeatsPlaced = (m: PitchedMeasure) => m.reduce((s, n) => s + n.duration, 0);
  const allMeasuresFull = userMeasures.length > 0 && userMeasures.every((m) => Math.abs(totalBeatsPlaced(m) - timeSig.measureBeats) < 0.01);
  const submitEnabled = !hasSubmitted && allMeasuresFull && hasListened;

  const capacityHint = (() => {
    const sigLabel = `${timeSig.beatsPerBar}/${timeSig.beatValue}`;
    const parts: string[] = [];
    activeDurations.forEach((d) => {
      const n = maxNotesOfDuration(d, timeSig.measureBeats);
      if (n > 0) parts.push(`${n} ${DUR_LABELS[d] ?? d}${n === 1 ? '' : 's'}`);
    });
    return `${sigLabel} — ${parts.length ? `${parts.join(', ')} per bar.` : 'adjust settings to fit this metre.'}`;
  })();

  return {
    audioStatus,
    key,
    clef,
    timeSig,
    numMeasures,
    correctMeasures,
    userMeasures,
    hasSubmitted,
    isCorrect,
    activeMeasureIndex,
    setActiveMeasureIndex,
    cursorBeat,
    cursorMidi,
    moveCursorBeat,
    moveCursorPitch,
    placeAtCursor,
    focusCursor,
    blurCursor,
    flashMeasure,
    playbackFraction,
    isPlaying,
    armedDuration,
    armedIsRest,
    isDotActive,
    armedAccidental,
    activeDurations,
    gridStepVal,
    capacityHint,
    submitEnabled,
    statusText,
    statusKind,
    feedbackMsg,
    feedbackKind,
    score,
    effectiveDuration,
    generateQuestion: () => generateQuestion(true),
    startPlayback,
    stopPlayback,
    replay,
    placeNoteAt,
    removeLastNote,
    clearActiveMeasure,
    nudgeLastNote,
    checkAnswer,
    armDuration,
    toggleRest,
    toggleDot,
    toggleSharp,
    toggleFlat,
    init,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
