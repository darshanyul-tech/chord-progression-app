import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { playNoteSequence } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { buildScalePlaybackMidis, buildScaleQuestion } from '../../lib/recognition/scales';
import { useScaleRecognitionSettings } from '../../state/settings/scales';

// Ported from legacy ScaleRecognitionExam (docs/06-exam-mode.md §A).
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const scaleSettings = useScaleRecognitionSettings.getState();
  if (!scaleSettings.enabledScales.length) return [];
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildScaleQuestion(scaleSettings);
    if (q) questions.push({ ...q, typeId: 'scaleRecognition' });
  }
  return questions;
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const rootMidi = question.rootMidi as number;
  const intervals = question.intervals as number[];
  const playback = question.playback as { noteLen: number; gap: number; descend: boolean };
  const midis = buildScalePlaybackMidis(rootMidi, intervals, playback.descend);
  await playRepetitions(
    () => playNoteSequence(audio.sampler, ctx.channel, audio.now(), midis, playback.noteLen, playback.gap, ctx.aborted),
    ctx.typeConfig.reps,
    ctx.typeConfig.spacingSec,
    ctx.aborted,
    ctx.onPhase,
  );
}

export const ScaleRecognitionExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'scaleRecognition',
  label: 'Scale identification',
  originTopicId: 'scales',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses scale types and playback options from the Scales topic.',
  buildPaper,
  ChoicesComponent: ExamChoicePicker,
  playQuestion,
  gradeQuestion(question, answer) {
    return gradeRecognitionSingle(question, answer as { guessId: string | null; guessLabel: string } | null);
  },
  formatQuestionTitle(_question, index, total) {
    return `Question ${index + 1} of ${total} — ${this.label}`;
  },
  formatResultHeading(question) {
    return String(question.answerLabel ?? '');
  },
};
