import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, scheduleChannelDone, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import {
  comparisonMemberNotes,
  buildIntervalComparisonQuestion,
  type IntervalComparisonQuestion,
  type IntervalComparisonSettings,
} from '../../lib/recognition/intervalComparison';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'interval-comparison';

// New topic, no legacy source (docs/05-topics/08-interval-comparison.md §4-5)
// — same recognition-topic shape as interval/usePractice.ts but the
// "hearing" is a pair of intervals separated by pairPauseSec.
export function useIntervalComparisonPractice(settings: IntervalComparisonSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<IntervalComparisonQuestion | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState('Play a pair, then say which interval is larger.');
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function playQuestion(q: IntervalComparisonQuestion) {
    if (audio.status !== 'ready' || !audio.sampler) {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    const playGen = channelRef.current.playbackGen;
    let cursor = audio.now() + 0.12;

    function scheduleMember(notes: [number, number]) {
      notes.forEach((midi) => {
        const note = midiToNoteName(midi);
        scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, note, settings.noteLen, 0.88);
        cursor += settings.noteLen + settings.gapLen;
      });
    }

    scheduleMember(comparisonMemberNotes(q.first, q.direction));
    cursor += settings.pairPauseSec;
    scheduleMember(comparisonMemberNotes(q.second, q.direction));

    setIsPlaying(true);
    scheduleChannelDone(channelRef.current, cursor - audio.now(), () => setIsPlaying(false));
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    clearAdvanceTimer();
    const q = buildIntervalComparisonQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    if (!q) {
      setStatusText(
        'Enable at least two intervals whose sizes differ enough for the current difficulty (or lower the difficulty).',
      );
      setStatusKind('warn');
      setPromptText('Adjust settings above, then press Play pair.');
      return;
    }
    setPromptText('Which interval is larger? (3 guesses; first guess counts for score)');
    playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    const answerText = `First: ${question.first.label} · Second: ${question.second.label}`;
    if (solved && firstGuessCorrect) {
      setPromptText(`✓ Correct on your first guess — ${answerText}.`);
      setStatusText('Correct! Point added.');
      setStatusKind('');
    } else if (solved) {
      setPromptText(`✓ Correct — ${answerText}. (No score point; only the first guess counts.)`);
      setStatusText('Correct, but not on your first try — no point added.');
      setStatusKind('');
    } else {
      setPromptText(`✗ Out of guesses — ${answerText}.`);
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

  function submitGuess(answerId: string) {
    if (!question || answered || wrongIds.includes(answerId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = answerId === question.answerId;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, answerId]);
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
    if (!question || isPlaying) return;
    playQuestion(question);
  }

  function stop() {
    stopChannel(channelRef.current, audio.sampler);
    setIsPlaying(false);
    setStatusText('Stopped.');
    setStatusKind('');
  }

  async function init() {
    if (audio.status === 'ready' || audio.status === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
  }

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText('Audio ready. Press Play pair.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing settings clears the in-progress question (same convention as
  // interval recognition) — but not on the initial mount.
  const enabledIntervalsKey = JSON.stringify(settings.enabledIntervals);
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
    setPromptText('Settings updated. Press Play pair for a new question.');
    setStatusText('Settings updated.');
    setStatusKind('');
  }, [settings.direction, settings.difficulty, settings.allowSame, settings.rootRelationship, enabledIntervalsKey]);

  return {
    audioStatus,
    question,
    isPlaying,
    answered,
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
