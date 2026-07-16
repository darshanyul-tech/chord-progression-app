import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, delaySec, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { playNoteSequence } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import {
  buildIntervalComparisonQuestion,
  comparisonMemberNotes,
  type ComparisonAnswerId,
  type ComparisonMember,
} from '../../lib/recognition/intervalComparison';
import { useIntervalComparisonSettings } from '../../state/settings/interval-comparison';

function answerLabelFor(answerId: ComparisonAnswerId): string {
  if (answerId === 'first') return 'First is larger';
  if (answerId === 'second') return 'Second is larger';
  return 'Same';
}

// Uses the topic's own persisted settings (docs/05-topics/08-interval-comparison.md §6),
// same convention as buildIntervalExamQuestion.
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const practiceSettings = useIntervalComparisonSettings.getState();
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildIntervalComparisonQuestion(practiceSettings);
    if (!q) continue;
    questions.push({
      typeId: 'intervalComparison',
      first: q.first,
      second: q.second,
      direction: q.direction,
      answerId: q.answerId,
      answerLabel: answerLabelFor(q.answerId),
      choiceDefs: q.choiceDefs,
      promptDetail: `First: ${q.first.label} · Second: ${q.second.label}`,
      playback: { noteLen: practiceSettings.noteLen, gap: practiceSettings.gapLen, pairPauseSec: practiceSettings.pairPauseSec },
    });
  }
  return questions;
}

async function playOnce(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const first = question.first as ComparisonMember;
  const second = question.second as ComparisonMember;
  const direction = question.direction as 'asc' | 'desc';
  const playback = question.playback as { noteLen: number; gap: number; pairPauseSec: number };

  await playNoteSequence(
    audio.sampler,
    ctx.channel,
    audio.now(),
    comparisonMemberNotes(first, direction),
    playback.noteLen,
    playback.gap,
    ctx.aborted,
  );
  if (ctx.aborted()) return;
  await delaySec(playback.pairPauseSec, ctx.aborted);
  if (ctx.aborted()) return;
  await playNoteSequence(
    audio.sampler,
    ctx.channel,
    audio.now(),
    comparisonMemberNotes(second, direction),
    playback.noteLen,
    playback.gap,
    ctx.aborted,
  );
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  await playRepetitions(() => playOnce(question, ctx), ctx.typeConfig.reps, ctx.typeConfig.spacingSec, ctx.aborted, ctx.onPhase);
}

export const IntervalComparisonExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'intervalComparison',
  label: 'Interval comparison',
  originTopicId: 'interval-comparison',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses the intervals, difficulty, and direction enabled on the Interval Comparison topic.',
  buildPaper,
  ChoicesComponent: ExamChoicePicker,
  playQuestion,
  replayQuestion: playOnce,
  gradeQuestion(question, answer) {
    return gradeRecognitionSingle(question, answer as { guessId: string | null; guessLabel: string } | null);
  },
  formatQuestionTitle(question, index, total) {
    const dir = question.direction === 'asc' ? 'Ascending' : 'Descending';
    return `Question ${index + 1} of ${total} — ${this.label} — ${dir}`;
  },
  formatResultHeading(question) {
    return String(question.promptDetail ?? question.answerLabel ?? '');
  },
};
