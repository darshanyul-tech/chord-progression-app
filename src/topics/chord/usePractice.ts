import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  RECOGNITION_AUTO_ADVANCE_MS,
  RECOGNITION_MAX_GUESSES,
  buildChordExamChoiceGrouped,
  getChordRecognitionMidis,
  pickChordQuestion,
  type ChordQuestion,
  type ChordRecognitionSettings,
} from '../../lib/recognition/chords';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'chord-recognition';

// Ported state machine for legacy startChordRound / playChordQuestion /
// submitChordGuess / finalizeChordQuestion (docs/05-topics/03 §§4-6).
export function useChordPractice(settings: ChordRecognitionSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ChordQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState('Enable at least one chord type, then play to hear a random chord.');
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  const choiceGroups = buildChordExamChoiceGrouped(settings.enabledTypes);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function playQuestion(q: ChordQuestion) {
    if (audio.status !== 'ready' || !audio.sampler) {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    const midis = getChordRecognitionMidis(q.rootMidi, q.quality);
    const playGen = channelRef.current.playbackGen;
    let cursor = audio.now() + 0.1;
    if (q.playback.style === 'arp') {
      midis.forEach((midi) => {
        const note = midiToNoteName(midi);
        scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, note, q.playback.arpNoteLen, 0.88);
        cursor += q.playback.arpNoteLen + q.playback.arpGap;
      });
    } else {
      const notes = midis.map(midiToNoteName);
      scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, notes, q.playback.holdLen, 0.9);
    }
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    if (!settings.enabledTypes.length) {
      setStatusText('Enable at least one chord type.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = pickChordQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Which chord quality did you hear? (3 guesses; first guess counts for score)');
    if (q) playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    const sym = `${question.rootName} ${question.label}`;
    if (solved && firstGuessCorrect) {
      setPromptText(`✓ Correct on your first guess — ${sym}.`);
      setStatusText('Correct! Point added.');
      setStatusKind('');
    } else if (solved) {
      setPromptText(`✓ Correct — ${sym}. (No score point; only the first guess counts.)`);
      setStatusText('Correct, but not on your first try — no point added.');
      setStatusKind('');
    } else {
      setPromptText(`✗ Out of guesses — it was ${sym}.`);
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

  function submitGuess(chordId: string) {
    if (!question || answered || wrongIds.includes(chordId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = chordId === question.id;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, chordId]);
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

  function stop() {
    stopChannel(channelRef.current, audio.sampler);
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
      setStatusText('Audio ready. Press Play chord.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing enabled chord types clears the in-progress question (legacy
  // onChordSettingsChange) — but not on the initial mount. Playback-style /
  // timing changes do NOT reset the question, matching legacy.
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
    setPromptText('Settings updated. Press Play chord for a new question.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabledTypes.join(',')]);

  return {
    audioStatus,
    question,
    answered,
    choiceGroups,
    wrongIds,
    correctId: answered && question ? question.id : null,
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
