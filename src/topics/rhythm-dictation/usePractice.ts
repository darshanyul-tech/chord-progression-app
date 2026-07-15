import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { audio } from '../../lib/audio/engine';
import {
  buildPlaybackEvents,
  disconnectScheduled,
  scheduleMetroClick,
  scheduleNote,
  type ScheduledNode,
} from '../../lib/audio/percussion';
import { DUR_LABELS, TRIPLET_DURS, fillMeasure, getActiveDurations } from '../../lib/rhythm/generator';
import {
  durationClose,
  durationFitsBar,
  gridStep,
  maxNotesOfDuration,
  measuresEqual,
  metricPulseBeats,
  metricPulseCount,
  parseTimeSig,
  type Measure,
  type TimeSigInfo,
} from '../../lib/rhythm/time';
import type { RhythmDictationSettings } from '../../lib/rhythm/settings';
import { prefersReducedMotion, REDUCED_MOTION_INTERVAL_SEC } from '../../lib/motion';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'rhythm-dictation';

interface PlacementRecord {
  measureIndex: number;
  beat: number;
}

interface RhythmChannel {
  scheduledNodes: ScheduledNode[];
  countinTimers: number[];
  playbackTimer: number | null;
  rafId: number | null;
  autoPlayTimer: number | null;
  flashTimer: number | null;
}

function newChannel(): RhythmChannel {
  return { scheduledNodes: [], countinTimers: [], playbackTimer: null, rafId: null, autoPlayTimer: null, flashTimer: null };
}

function effectiveDuration(base: number, isDotActive: boolean): number {
  if (isDotActive && !TRIPLET_DURS.some((td) => durationClose(base, td))) return base * 1.5;
  return base;
}

export function useRhythmPractice(settings: RhythmDictationSettings) {
  const audioStatus = useAudioReady();
  const isActive = useIsActiveTopic(TOPIC_ID);
  const channelRef = useRef<RhythmChannel>(newChannel());

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [timeSig, setTimeSig] = useState<TimeSigInfo>(() => parseTimeSig(settings.signatures[0] ?? '4/4'));
  const [numMeasures, setNumMeasures] = useState(settings.measures);
  const [correctPattern, setCorrectPattern] = useState<Measure[]>([]);
  const [userMeasures, setUserMeasures] = useState<Measure[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [measureResults, setMeasureResults] = useState<boolean[]>([]);
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const [, setPlacementHistory] = useState<PlacementRecord[]>([]);
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const [isDotActive, setIsDotActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [playbackFraction, setPlaybackFraction] = useState<number | null>(null);
  const [countinLit, setCountinLit] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');
  const [questionScoreText, setQuestionScoreText] = useState('');

  const activeDurations = getActiveDurations(settings.durations, settings.triplets, timeSig.measureBeats);
  const gridStepVal = gridStep(activeDurations);

  function clearAllTimers() {
    const ch = channelRef.current;
    ch.countinTimers.forEach((t) => clearTimeout(t));
    ch.countinTimers = [];
    if (ch.playbackTimer !== null) clearTimeout(ch.playbackTimer);
    ch.playbackTimer = null;
    if (ch.rafId !== null) cancelAnimationFrame(ch.rafId);
    ch.rafId = null;
    if (ch.autoPlayTimer !== null) clearTimeout(ch.autoPlayTimer);
    ch.autoPlayTimer = null;
    if (ch.flashTimer !== null) clearTimeout(ch.flashTimer);
    ch.flashTimer = null;
  }

  function stopPlayback() {
    clearAllTimers();
    disconnectScheduled(channelRef.current.scheduledNodes);
    setIsPlaying(false);
    setPlaybackFraction(null);
    setCountinLit(0);
  }

  // Deactivation contract (01-architecture §4): stop playback, never touch
  // settings/scores/in-progress notation.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) stopPlayback();
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Unmount cleanup — stopPlayback only touches the channel ref + stable
  // setters, so the closure never goes stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stopPlayback, []);

  function runPlayback(pattern: Measure[], sig: TimeSigInfo, nMeasures: number, onDone?: () => void) {
    if (audio.status !== 'ready') return;
    const ctx = audio.rawContext();
    if (ctx.state === 'suspended' && 'resume' in ctx) (ctx as AudioContext).resume();

    clearAllTimers();
    disconnectScheduled(channelRef.current.scheduledNodes);
    setIsPlaying(true);
    setHasListened(true);

    const bpm = settings.tempo;
    const spb = 60 / bpm;
    const pulse = metricPulseBeats(sig.beatValue, sig.beatsPerBar);
    const countInPulses = metricPulseCount(sig.measureBeats, pulse);
    const countInDur = countInPulses * pulse * spb;
    const { events, totalDuration } = buildPlaybackEvents(pattern, bpm, sig.measureBeats, pulse, nMeasures);
    const startAt = ctx.currentTime + 0.05;

    setCountinLit(0);
    for (let b = 0; b < countInPulses; b++) {
      const clickT = startAt + b * pulse * spb;
      scheduleMetroClick(ctx, clickT, b === 0, settings.metroVolume, channelRef.current.scheduledNodes);
      const litIndex = b;
      const id = window.setTimeout(
        () => setCountinLit(litIndex + 1),
        Math.max(0, (clickT - ctx.currentTime) * 1000),
      );
      channelRef.current.countinTimers.push(id);
    }
    channelRef.current.countinTimers.push(
      window.setTimeout(() => setCountinLit(0), countInDur * 1000 + 50),
    );

    const rhythmStart = startAt + countInDur;
    const playbackEndTime = rhythmStart + totalDuration;

    const metroEnd = rhythmStart + totalDuration;
    for (let mt = rhythmStart, pi = 0; mt < metroEnd - 0.001; mt += pulse * spb, pi++) {
      scheduleMetroClick(ctx, mt, pi % countInPulses === 0, settings.metroVolume, channelRef.current.scheduledNodes);
    }

    events.forEach((ev) => {
      const abs = rhythmStart + ev.time;
      scheduleNote(ctx, abs, ev.duration, ev.isRest, ev.isBeat1, settings.sound, bpm, settings.emphasis, channelRef.current.scheduledNodes);
    });

    let lastCursorUpdate = 0;
    function tick() {
      if (!channelRef.current) return;
      const now = ctx.currentTime;
      const dur = playbackEndTime - rhythmStart;
      if (dur > 0 && now >= rhythmStart) {
        if (!prefersReducedMotion() || now - lastCursorUpdate >= REDUCED_MOTION_INTERVAL_SEC) {
          lastCursorUpdate = now;
          setPlaybackFraction(Math.min(1, Math.max(0, (now - rhythmStart) / dur)));
        }
      }
      if (now < playbackEndTime + 0.1) {
        channelRef.current.rafId = requestAnimationFrame(tick);
      }
    }
    channelRef.current.rafId = requestAnimationFrame(tick);

    channelRef.current.playbackTimer = window.setTimeout(
      () => {
        setIsPlaying(false);
        setPlaybackFraction(null);
        if (channelRef.current.rafId !== null) cancelAnimationFrame(channelRef.current.rafId);
        channelRef.current.rafId = null;
        onDone?.();
      },
      (countInDur + totalDuration + 0.15) * 1000,
    );
  }

  function startPlayback() {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (audioStatus !== 'ready') return;
    runPlayback(correctPattern, timeSig, numMeasures);
  }

  function replay() {
    stopPlayback();
    if (audioStatus !== 'ready') return;
    runPlayback(correctPattern, timeSig, numMeasures);
  }

  function generateQuestion(autoPlay = true) {
    stopPlayback();
    const sigs = settings.signatures.length ? settings.signatures : ['4/4'];
    const sig = sigs[Math.floor(Math.random() * sigs.length)]!;
    const ts = parseTimeSig(sig);
    const nMeasures = settings.measures;
    const durs = getActiveDurations(settings.durations, settings.triplets, ts.measureBeats);
    const step = gridStep(durs);
    const pulse = metricPulseBeats(ts.beatValue, ts.beatsPerBar);

    const pattern: Measure[] = [];
    for (let i = 0; i < nMeasures; i++) {
      pattern.push(
        fillMeasure({
          measureTotalBeats: ts.measureBeats,
          activeDurations: durs,
          restFrequency: settings.restFrequency,
          syncopation: settings.syncopation,
          gridStepVal: step,
          pulseBeats: pulse,
        }),
      );
    }

    setTimeSig(ts);
    setNumMeasures(nMeasures);
    setCorrectPattern(pattern);
    setUserMeasures(Array.from({ length: nMeasures }, () => []));
    setHasSubmitted(false);
    setMeasureResults([]);
    setActiveMeasureIndex(0);
    setPlacementHistory([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    setQuestionScoreText('');
    setHasListened(false);

    if (autoPlay && audio.status === 'ready') {
      channelRef.current.autoPlayTimer = window.setTimeout(() => runPlayback(pattern, ts, nMeasures), 450);
    }
  }

  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    generateQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeNoteAt(measureIndex: number, beat: number, duration: number, isRest: boolean) {
    if (hasSubmitted) return;
    const dur = effectiveDuration(duration, isDotActive);
    const measure = userMeasures[measureIndex];
    if (!measure) return;
    const cap = timeSig.measureBeats;
    if (!durationFitsBar(dur, cap) || beat + dur > cap + 0.001) {
      setFlashMeasure(measureIndex);
      if (channelRef.current.flashTimer !== null) clearTimeout(channelRef.current.flashTimer);
      channelRef.current.flashTimer = window.setTimeout(() => setFlashMeasure(null), 280);
      return;
    }
    // Placing a note over existing ones replaces them — no need to
    // backspace first (user-requested UX change from legacy's reject-and-
    // flash-on-overlap behavior).
    const end = beat + dur;
    const overlaps = (n: { beat: number; duration: number }) => beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001;
    const replacedBeats = measure.filter(overlaps).map((n) => n.beat);
    setUserMeasures((prev) =>
      prev.map((m, i) =>
        i === measureIndex ? [...m.filter((n) => !overlaps(n)), { duration: dur, isRest: !!isRest, beat }] : m,
      ),
    );
    setPlacementHistory((prev) => [
      ...prev.filter((p) => !(p.measureIndex === measureIndex && replacedBeats.some((b) => durationClose(b, p.beat)))),
      { measureIndex, beat },
    ]);
    setActiveMeasureIndex(measureIndex);
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

  function checkAnswer() {
    setHasSubmitted(true);
    let correctMeasures = 0;
    const results = correctPattern.map((_pat, i) => {
      const ok = measuresEqual(userMeasures[i] ?? [], correctPattern[i] ?? []);
      if (ok) correctMeasures++;
      return ok;
    });
    setMeasureResults(results);
    const allCorrect = correctMeasures === numMeasures;
    recordAttempt(TOPIC_ID, allCorrect);
    if (allCorrect) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg('Incorrect — see staff for corrections.');
    }
    setQuestionScoreText(`${correctMeasures} / ${numMeasures} measures correct`);
  }

  function armDuration(dur: number) {
    setArmedDuration(dur);
    if (TRIPLET_DURS.some((td) => durationClose(dur, td)) && isDotActive) {
      setIsDotActive(false);
    }
  }

  function toggleRest() {
    setArmedIsRest((prev) => !prev);
  }

  function toggleDot() {
    if (TRIPLET_DURS.some((td) => durationClose(armedDuration, td))) return;
    setIsDotActive((prev) => !prev);
  }

  function previewPattern() {
    stopPlayback();
    const sig = settings.signatures[0] ?? '4/4';
    const ts = parseTimeSig(sig);
    const durs = getActiveDurations(settings.durations, settings.triplets, ts.measureBeats);
    const step = gridStep(durs);
    const pulse = metricPulseBeats(ts.beatValue, ts.beatsPerBar);
    const testPattern = [
      fillMeasure({
        measureTotalBeats: ts.measureBeats,
        activeDurations: durs,
        restFrequency: settings.restFrequency,
        syncopation: settings.syncopation,
        gridStepVal: step,
        pulseBeats: pulse,
      }),
    ];
    // Preview plays a throwaway one-measure pattern without disturbing the
    // current question's displayed staff (docs/05-topics/05 §4).
    runPlayback(testPattern, ts, 1);
  }

  const totalNotesPlaced = userMeasures.reduce((n, m) => n + m.length, 0);
  const submitEnabled = !hasSubmitted && totalNotesPlaced > 0 && hasListened;

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
    timeSig,
    numMeasures,
    correctPattern,
    userMeasures,
    hasSubmitted,
    measureResults,
    activeMeasureIndex,
    setActiveMeasureIndex,
    flashMeasure,
    playbackFraction,
    isPlaying,
    countinLit,
    armedDuration,
    armedIsRest,
    isDotActive,
    activeDurations,
    gridStepVal,
    capacityHint,
    submitEnabled,
    feedbackMsg,
    feedbackKind,
    questionScoreText,
    score,
    effectiveDuration: (base: number) => effectiveDuration(base, isDotActive),
    generateQuestion: () => generateQuestion(true),
    startPlayback,
    stopPlayback,
    replay,
    placeNoteAt,
    removeLastNote,
    clearActiveMeasure,
    checkAnswer,
    armDuration,
    toggleRest,
    toggleDot,
    previewPattern,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
