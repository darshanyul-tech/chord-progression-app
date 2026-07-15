import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { buildPlaybackEvents, disconnectScheduled, scheduleNote, type ScheduledNode } from '../../lib/audio/percussion';
import { createPlaybackChannel, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  RECOGNITION_AUTO_ADVANCE_MS,
  RECOGNITION_MAX_GUESSES,
  buildMeterChoiceDefs,
  buildMeterQuestion,
  type MeterQuestion,
  type MeterRecognitionSettings,
} from '../../lib/recognition/meter';
import { metricPulseBeats } from '../../lib/rhythm/time';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'meter-recognition';
const SILENT_LEAD_IN_SEC = 1;

// Ported generation from lib/recognition/meter.ts (which itself reuses the
// rhythm-dictation generator); playback here is a simplified variant of
// rhythm-dictation's runPlayback with no count-in and no metronome — the
// excerpt itself is the only evidence (docs/05-topics/04-meter-recognition.md §2).
export function useMeterPractice(settings: MeterRecognitionSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  const scheduledNodesRef = useRef<ScheduledNode[]>([]);
  const playbackTimerRef = useRef<number | null>(null);
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<MeterQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState('Enable at least two time signatures, then play to hear an excerpt.');
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  const choiceDefs = buildMeterChoiceDefs(settings.enabledSignatures);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function stopPlaybackTimer() {
    if (playbackTimerRef.current !== null) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }

  function stop() {
    stopPlaybackTimer();
    disconnectScheduled(scheduledNodesRef.current);
    stopChannel(channelRef.current, audio.sampler);
    setStatusText('Stopped.');
    setStatusKind('');
  }

  function playQuestion(q: MeterQuestion) {
    if (audio.status !== 'ready') {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopPlaybackTimer();
    disconnectScheduled(scheduledNodesRef.current);
    stopChannel(channelRef.current, audio.sampler);
    const ctx = audio.rawContext();
    if (ctx.state === 'suspended' && 'resume' in ctx) (ctx as AudioContext).resume();

    const pulse = metricPulseBeats(q.timeSig.beatValue, q.timeSig.beatsPerBar);
    const { events, totalDuration } = buildPlaybackEvents(q.pattern, q.tempo, q.timeSig.measureBeats, pulse, q.numMeasures);
    if (q.sound === 'melodic' && audio.sampler) {
      // "Melodic" used to be a fixed 440 Hz sine via the percussion synth —
      // dull for longer excerpts. Route it through the piano sampler instead
      // (a repeated tonic, accented on the downbeat via velocity).
      const playGen = channelRef.current.playbackGen;
      const start = audio.now() + SILENT_LEAD_IN_SEC;
      events.forEach((ev) => {
        if (ev.isRest) return;
        const noteDurSec = ((ev.duration * 60) / q.tempo) * 0.9;
        scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, start + ev.time, 'A4', noteDurSec, ev.isBeat1 ? 0.85 : 0.65);
      });
    } else {
      const startAt = ctx.currentTime + SILENT_LEAD_IN_SEC;
      events.forEach((ev) => {
        scheduleNote(ctx, startAt + ev.time, ev.duration, ev.isRest, ev.isBeat1, q.sound, q.tempo, q.emphasisValue, scheduledNodesRef.current);
      });
    }
    playbackTimerRef.current = window.setTimeout(
      () => {
        playbackTimerRef.current = null;
      },
      (SILENT_LEAD_IN_SEC + totalDuration + 0.15) * 1000,
    );
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    if (settings.enabledSignatures.length < 2) {
      setStatusText('Enable at least two time signatures.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = buildMeterQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Which time signature did you hear? (3 guesses; first guess counts for score)');
    if (q) playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    if (solved && firstGuessCorrect) {
      setPromptText(`✓ Correct on your first guess — ${question.answerLabel}.`);
      setStatusText('Correct! Point added.');
      setStatusKind('');
    } else if (solved) {
      setPromptText(`✓ Correct — ${question.answerLabel}. (No score point; only the first guess counts.)`);
      setStatusText('Correct, but not on your first try — no point added.');
      setStatusKind('');
    } else {
      setPromptText(`✗ Out of guesses — it was ${question.answerLabel}.`);
      setStatusText('Incorrect — see highlighted answer.');
      setStatusKind('');
    }
    if (settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, RECOGNITION_AUTO_ADVANCE_MS);
    }
  }

  function submitGuess(sigId: string) {
    if (!question || answered || wrongIds.includes(sigId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = sigId === question.answerId;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, sigId]);
    if (nextGuessesUsed >= RECOGNITION_MAX_GUESSES) {
      finalize(false, false);
      return;
    }
    const left = RECOGNITION_MAX_GUESSES - nextGuessesUsed;
    setPromptText(`Not quite — ${left} guess${left === 1 ? '' : 'es'} left.`);
    setStatusText('Try again.');
    setStatusKind('warn');
  }

  function replay() {
    if (!question) return;
    playQuestion(question);
  }

  async function init() {
    if (audio.status === 'ready' || audio.status === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
  }

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText('Audio ready. Press Play excerpt.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing enabled signatures clears the in-progress question, matching
  // the other recognition topics' onSettingsChange behavior — but not on
  // the initial mount.
  useEffect(() => {
    if (skipSettingsResetRef.current) {
      skipSettingsResetRef.current = false;
      return;
    }
    clearAdvanceTimer();
    setQuestion(null);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Settings updated. Press Play excerpt for a new question.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabledSignatures.join(',')]);

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    audioStatus,
    question,
    answered,
    choiceDefs,
    wrongIds,
    correctId: answered && question ? question.answerId : null,
    statusText,
    statusKind,
    promptText,
    score,
    init,
    play: startRound,
    replay,
    stop,
    submitGuess,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
