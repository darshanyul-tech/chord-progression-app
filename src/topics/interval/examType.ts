import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { playNoteSequence } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import {
  buildIntervalExamQuestion,
  buildIntervalPracticePool,
  intervalPlaybackNotes,
} from '../../lib/recognition/intervals';
import { useIntervalRecognitionSettings } from '../../state/settings/interval-recognition';

// Ported from legacy IntervalRecognitionExam (docs/06-exam-mode.md §A).
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const practice = buildIntervalPracticePool(useIntervalRecognitionSettings.getState());
  if (!practice.pool.length) return [];
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildIntervalExamQuestion(practice);
    if (q) questions.push({ ...q, typeId: 'intervalRecognition' });
  }
  return questions;
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const notes = intervalPlaybackNotes(
    question as unknown as { rootMidi: number; semitones: number; direction: 'asc' | 'desc' },
  );
  const playback = question.playback as { noteLen: number; gap: number };
  await playRepetitions(
    () =>
      playNoteSequence(audio.sampler, ctx.channel, audio.now(), notes, playback.noteLen, playback.gap, ctx.aborted),
    ctx.typeConfig.reps,
    ctx.typeConfig.spacingSec,
    ctx.aborted,
    ctx.onPhase,
  );
}

export const IntervalRecognitionExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'intervalRecognition',
  label: 'Interval identification',
  originTopicId: 'interval-recognition',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses intervals enabled on the Interval Recognition topic (including direction filters).',
  buildPaper,
  ChoicesComponent: ExamChoicePicker,
  playQuestion,
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
