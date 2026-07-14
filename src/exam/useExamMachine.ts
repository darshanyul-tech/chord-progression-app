import { useRef, useState } from 'react';
import {
  buildMixedExamPaper,
  EXAM_ANSWER_LIMIT_SEC,
  EXAM_DICTATION_LIMIT_SEC,
  summarizeDictationResults,
  summarizeExamResults,
  type DictationSummary,
  type EnabledExamType,
  type ExamAnswerRecord,
  type ExamPaperEntry,
  type ExamSummary,
} from './exam-machine';
import { abortExamPlayback, createExamPlaybackChannel } from './playback';
import { audio } from '../lib/audio/engine';

// Tier-2 stateful orchestrator — the React-hook counterpart of legacy's
// mutable `exam` object + ExamController (docs/06-exam-mode.md §A). Display
// state lives in useState; orchestration bookkeeping that legacy also kept
// non-reactive (question token, finalizing flag, channel, timers) lives in
// refs, mirrored alongside the useState twins so async continuations never
// read stale values (same "ref twin" pattern as topics/progression/usePractice.ts).
// Phase 8 (§B3/B4) adds: dictation-kind questions (single hearing, 120s
// answer window, matched/not-matched grading) and a shared replay budget
// for both kinds during the answer window.
export type ExamPhase = 'setup' | 'active' | 'results';

export function useExamMachine() {
  const [phase, setPhase] = useState<ExamPhase>('setup');
  const [paper, setPaper] = useState<ExamPaperEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);
  const [phaseLabel, setPhaseLabel] = useState('Preparing…');
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [remainingReplays, setRemainingReplays] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [summary, setSummary] = useState<ExamSummary | null>(null);
  const [dictationSummary, setDictationSummary] = useState<DictationSummary | null>(null);

  const channelRef = useRef(createExamPlaybackChannel());
  const questionTokenRef = useRef(0);
  const finalizingRef = useRef(false);
  const answerTimerRef = useRef<number | null>(null);
  const paperRef = useRef<ExamPaperEntry[]>([]);
  const answersRef = useRef<ExamAnswerRecord[]>([]);
  const currentAnswerRef = useRef<unknown>(null);
  const currentIndexRef = useRef(0);
  const lastEnabledRef = useRef<EnabledExamType[]>([]);

  function stopAnswerTimer() {
    if (answerTimerRef.current !== null) {
      window.clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  }

  function setAnswer(value: unknown) {
    currentAnswerRef.current = value;
    setCurrentAnswer(value);
  }

  function startAnswerTimer(token: number, limitSec: number) {
    stopAnswerTimer();
    setCanSubmit(true);
    finalizingRef.current = false;
    let remaining = limitSec;
    setRemainingSec(remaining);
    setPhaseLabel(`Submit your answer — ${remaining}s remaining (no feedback until the exam ends).`);
    answerTimerRef.current = window.setInterval(() => {
      if (questionTokenRef.current !== token) {
        stopAnswerTimer();
        return;
      }
      remaining--;
      if (remaining <= 0) {
        stopAnswerTimer();
        setPhaseLabel('Time’s up — moving to next question…');
        void finalizeQuestion({ timedOut: true, submittedEarly: false });
      } else {
        setRemainingSec(remaining);
        setPhaseLabel(`Submit your answer — ${remaining}s remaining (no feedback until the exam ends).`);
      }
    }, 1000);
  }

  async function runQuestion(index: number): Promise<void> {
    const p = paperRef.current;
    if (index >= p.length) return;
    const token = ++questionTokenRef.current;
    stopAnswerTimer();
    finalizingRef.current = false;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setAnswer(null);
    setRemainingSec(null);
    setRemainingReplays(0);
    const entry = p[index]!;
    const aborted = () => finalizingRef.current || questionTokenRef.current !== token;
    const ctx = { typeConfig: entry.typeSettings, channel: channelRef.current, aborted, onPhase: setPhaseLabel };

    setCanSubmit(true);
    setPhaseLabel(entry.type.formatQuestionTitle(entry.question, index, p.length));
    await entry.type.playQuestion(entry.question, ctx);

    if (aborted()) return;
    setRemainingReplays(entry.typeSettings.replays ?? 0);
    startAnswerTimer(token, entry.kind === 'dictation' ? EXAM_DICTATION_LIMIT_SEC : EXAM_ANSWER_LIMIT_SEC);
  }

  async function replay(): Promise<void> {
    if (remainingReplays <= 0 || isReplaying || finalizingRef.current) return;
    const token = questionTokenRef.current;
    const entry = paperRef.current[currentIndexRef.current];
    if (!entry) return;
    setIsReplaying(true);
    setRemainingReplays((n) => n - 1);
    const aborted = () => finalizingRef.current || questionTokenRef.current !== token;
    await entry.type.replayQuestion(entry.question, {
      typeConfig: entry.typeSettings,
      channel: channelRef.current,
      aborted,
      onPhase: () => {},
    });
    setIsReplaying(false);
  }

  function finish(finalAnswers: ExamAnswerRecord[]) {
    stopAnswerTimer();
    abortExamPlayback(channelRef.current, audio.sampler);
    setSummary(summarizeExamResults(finalAnswers));
    setDictationSummary(summarizeDictationResults(finalAnswers));
    setPhase('results');
  }

  async function finalizeQuestion(opts: { timedOut: boolean; submittedEarly: boolean }): Promise<void> {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    questionTokenRef.current++;
    abortExamPlayback(channelRef.current, audio.sampler);
    stopAnswerTimer();
    setCanSubmit(false);
    setRemainingSec(null);

    const index = currentIndexRef.current;
    const p = paperRef.current;
    const entry = p[index]!;
    const capturedAnswer = currentAnswerRef.current;
    const record: ExamAnswerRecord =
      entry.kind === 'recognition'
        ? {
            kind: 'recognition',
            question: entry.question,
            type: entry.type,
            answer: capturedAnswer,
            graded: entry.type.gradeQuestion(entry.question, capturedAnswer),
            timedOut: opts.timedOut,
            submittedEarly: opts.submittedEarly,
          }
        : {
            kind: 'dictation',
            question: entry.question,
            type: entry.type,
            answer: capturedAnswer,
            graded: entry.type.gradeQuestion(entry.question, capturedAnswer),
            timedOut: opts.timedOut,
            submittedEarly: opts.submittedEarly,
          };
    const nextAnswers = [...answersRef.current, record];
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);

    const isLast = index >= p.length - 1;
    finalizingRef.current = false;

    if (isLast) {
      finish(nextAnswers);
      return;
    }
    await runQuestion(index + 1);
  }

  function submitAnswer() {
    if (!canSubmit || finalizingRef.current) return;
    const submittedEarly = remainingSec === null;
    void finalizeQuestion({ timedOut: false, submittedEarly });
  }

  async function begin(enabled: EnabledExamType[]): Promise<void> {
    if (!enabled.length) {
      setSetupError('Enable at least one question type to begin the exam.');
      return;
    }
    const built = buildMixedExamPaper(enabled);
    if (!built.length) {
      setSetupError('Could not build any exam questions. Check your settings on each enabled topic.');
      return;
    }
    setSetupError('');
    lastEnabledRef.current = enabled;

    if (audio.status !== 'ready') {
      await audio.initAudio();
    }
    if (audio.status !== 'ready') return;

    paperRef.current = built;
    setPaper(built);
    answersRef.current = [];
    setAnswers([]);
    setSummary(null);
    setDictationSummary(null);
    setPhase('active');
    await runQuestion(0);
  }

  function leave() {
    questionTokenRef.current++;
    finalizingRef.current = true;
    stopAnswerTimer();
    abortExamPlayback(channelRef.current, audio.sampler);
    paperRef.current = [];
    answersRef.current = [];
    setPaper([]);
    setAnswers([]);
    setSummary(null);
    setDictationSummary(null);
    setPhase('setup');
  }

  function repeat() {
    void begin(lastEnabledRef.current);
  }

  return {
    phase,
    paper,
    currentIndex,
    currentAnswer,
    phaseLabel,
    remainingSec,
    canSubmit,
    remainingReplays,
    isReplaying,
    setupError,
    summary,
    dictationSummary,
    answers,
    setAnswer,
    begin,
    submitAnswer,
    replay,
    leave,
    repeat,
  };
}
