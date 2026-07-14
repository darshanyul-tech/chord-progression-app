import { useRef, useState } from 'react';
import {
  buildMixedExamPaper,
  EXAM_ANSWER_LIMIT_SEC,
  summarizeExamResults,
  type EnabledExamType,
  type ExamAnswerRecord,
  type ExamPaperQuestion,
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
export type ExamPhase = 'setup' | 'active' | 'results';

export function useExamMachine() {
  const [phase, setPhase] = useState<ExamPhase>('setup');
  const [paper, setPaper] = useState<ExamPaperQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);
  const [phaseLabel, setPhaseLabel] = useState('Preparing…');
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [summary, setSummary] = useState<ExamSummary | null>(null);

  const channelRef = useRef(createExamPlaybackChannel());
  const questionTokenRef = useRef(0);
  const finalizingRef = useRef(false);
  const answerTimerRef = useRef<number | null>(null);
  const paperRef = useRef<ExamPaperQuestion[]>([]);
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

  function startAnswerTimer(token: number) {
    stopAnswerTimer();
    setCanSubmit(true);
    finalizingRef.current = false;
    let remaining = EXAM_ANSWER_LIMIT_SEC;
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
    const entry = p[index]!;
    const aborted = () => finalizingRef.current || questionTokenRef.current !== token;

    setPhaseLabel(entry.type.formatQuestionTitle(entry.question, index, p.length));
    setCanSubmit(true);

    await entry.type.playQuestion(entry.question, {
      typeConfig: entry.typeSettings,
      channel: channelRef.current,
      aborted,
      onPhase: setPhaseLabel,
    });

    if (aborted()) return;
    startAnswerTimer(token);
  }

  function finish(finalAnswers: ExamAnswerRecord[]) {
    stopAnswerTimer();
    abortExamPlayback(channelRef.current, audio.sampler);
    setSummary(summarizeExamResults(finalAnswers));
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
    const graded = entry.type.gradeQuestion(entry.question, currentAnswerRef.current);
    const record: ExamAnswerRecord = {
      question: entry.question,
      type: entry.type,
      graded,
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
    setupError,
    summary,
    answers,
    setAnswer,
    begin,
    submitAnswer,
    leave,
    repeat,
  };
}
