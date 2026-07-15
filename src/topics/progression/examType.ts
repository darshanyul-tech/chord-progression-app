import { defaultGuessRow, type GuessRowState } from './usePractice';
import { ProgressionExamAnswer } from './ExamAnswer';
import { withEarlyAbort } from '../../exam/playback';
import { playRepetitions } from '../../exam/exam-machine';
import type {
  ExamBarResult,
  ExamPlayContext,
  ExamTypeDefinition,
  GradedAnswer,
  RecognitionExamQuestion,
} from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { degreeOptions, describeBarAnswer, describeBarGuess, gradeBarMatch } from '../../lib/progression/grading';
import { generateProgression } from '../../lib/progression/generator';
import { schedulePlayback } from '../../lib/progression/playback';
import { resolvePracticeSettings, type ResolvedProgressionSettings } from '../../lib/progression/settings';
import type { ProgChord } from '../../lib/progression/theory';
import { useProgressionSettings } from '../../state/settings/chord-progressions';

// Ported from legacy ProgressionRecognitionExam (docs/06-exam-mode.md §A). Its
// settings schema differs from the other three (adds "bars"), and its answer
// UI is the per-bar guess-row panel (ProgressionExamAnswer) rather than a
// choice grid.

function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const rawSettings = useProgressionSettings.getState();
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const resolved = resolvePracticeSettings({ ...rawSettings, bars: settings.bars });
    const progression = generateProgression(resolved);
    questions.push({ typeId: 'progressionRecognition', settings: resolved, progression });
  }
  return questions;
}

function playOnce(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const resolvedSettings = question.settings as ResolvedProgressionSettings;
  const progression = question.progression as ProgChord[];
  return withEarlyAbort(ctx.channel, ctx.aborted, () =>
    schedulePlayback(audio.sampler, ctx.channel, audio.now(), resolvedSettings, progression, {
      onBarActive: ctx.onProgress,
    }),
  );
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  await playRepetitions(() => playOnce(question, ctx), ctx.typeConfig.reps, ctx.typeConfig.spacingSec, ctx.aborted, ctx.onPhase);
}

function gradeQuestion(question: RecognitionExamQuestion, answer: unknown): GradedAnswer {
  const s = question.settings as ResolvedProgressionSettings;
  const progression = question.progression as ProgChord[];
  const rows = (answer as GuessRowState[] | null) ?? progression.map(() => defaultGuessRow(s));
  const degOpts = degreeOptions(s);
  let correctBars = 0;
  const results: ExamBarResult[] = progression.map((ch, i) => {
    const row = rows[i]!;
    const invVal = s.inversions ? row.inv : null;
    const match = gradeBarMatch(ch, row.off, row.fam, row.ext, invVal, s);
    if (match.allOk) correctBars++;
    const romanLabel = degOpts.find((o) => o.value === row.off)?.label ?? '?';
    return {
      bar: i + 1,
      ok: match.allOk,
      actual: describeBarAnswer(ch, s),
      yours: describeBarGuess(row.off, row.fam, row.ext, invVal, s, romanLabel),
    };
  });
  return {
    correctUnits: correctBars,
    totalUnits: progression.length,
    perfect: correctBars === progression.length,
    results,
  };
}

export const ProgressionRecognitionExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'progressionRecognition',
  label: 'Chord progression recognition',
  originTopicId: 'chord-progressions',
  settingsSchema: [
    { key: 'count', label: 'Number of progressions', min: 1, max: 20, step: 1, default: 5 },
    { key: 'bars', label: 'Bars per progression', min: 2, max: 12, step: 1, default: 4 },
    { key: 'reps', label: 'Repetitions per question', min: 1, max: 5, step: 1, default: 2 },
    { key: 'spacingSec', label: 'Spacing between repetitions', min: 0, max: 15, step: 1, default: 3, suffix: 's' },
    { key: 'replays', label: 'Replays after hearings', min: 0, max: 3, step: 1, default: 0 },
  ],
  setupHelp: 'Uses harmony and progression options from the Settings panel on the Chord Progressions topic.',
  buildPaper,
  ChoicesComponent: ProgressionExamAnswer,
  playQuestion,
  replayQuestion: playOnce,
  gradeQuestion,
  formatQuestionTitle(question, index, total) {
    const s = question.settings as ResolvedProgressionSettings;
    return `Question ${index + 1} of ${total} — ${this.label} — ${s.key} ${s.tonality} (${s.bars} bars)`;
  },
  formatResultHeading(question) {
    const s = question.settings as ResolvedProgressionSettings;
    return `${s.key} ${s.tonality}`;
  },
};
