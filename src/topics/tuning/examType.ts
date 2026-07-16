import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { withEarlyAbort } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { scheduleSamplerTrigger } from '../../lib/audio/playback';
import { buildTuningQuestion, getTuningChoiceDefs, type TuningAnswerId } from '../../lib/recognition/tuning';
import { midiToNoteName } from '../../lib/theory';
import { useTuningSettings } from '../../state/settings/tuning';

function answerLabelFor(answerId: TuningAnswerId): string {
  if (answerId === 'flat') return 'Flat';
  if (answerId === 'sharp') return 'Sharp';
  return 'In tune';
}

// Uses the topic's own persisted settings (docs/05-topics/11-tuning.md §6),
// same convention as the other comparison-style exam types. The pool can
// never be empty (no chord-comparison-style "no eligible pair" case), so no
// empty-paper guard is needed here.
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const practiceSettings = useTuningSettings.getState();
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildTuningQuestion(practiceSettings);
    questions.push({
      typeId: 'tuning',
      baseMidi: q.baseMidi,
      testFrequencyHz: q.testFrequencyHz,
      detuneCents: q.detuneCents,
      answerId: q.answerId,
      answerLabel: answerLabelFor(q.answerId),
      choiceDefs: getTuningChoiceDefs(),
      promptDetail:
        q.detuneCents === 0
          ? 'Second hearing was in tune'
          : `Second hearing was ${Math.abs(q.detuneCents)}¢ ${q.detuneCents > 0 ? 'sharp' : 'flat'}`,
      playback: { noteLen: practiceSettings.noteLen, pauseSec: practiceSettings.pauseSec },
    });
  }
  return questions;
}

// Cannot reuse exam/playback.ts's playNoteSequence here — it always
// resolves each entry through midiToNoteName, but the detuned second
// hearing has no note-name spelling (it needs an exact Hz value). Mirrors
// playNoteSequence's own internal shape (withEarlyAbort + a single trailing
// timer) so "submit early" still cuts a hearing off promptly.
function playOnce(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  return withEarlyAbort(ctx.channel, ctx.aborted, () => {
    return new Promise((resolve) => {
      const playback = question.playback as { noteLen: number; pauseSec: number };
      const baseMidi = question.baseMidi as number;
      const testFrequencyHz = question.testFrequencyHz as number;
      if (!audio.sampler) {
        resolve();
        return;
      }
      try {
        audio.sampler.releaseAll(0);
      } catch {
        /* noop */
      }
      const playGen = ctx.channel.playbackGen;
      let cursor = audio.now() + 0.1;
      scheduleSamplerTrigger(audio.sampler, ctx.channel, playGen, cursor, midiToNoteName(baseMidi), playback.noteLen, 0.85);
      cursor += playback.noteLen + playback.pauseSec;
      scheduleSamplerTrigger(audio.sampler, ctx.channel, playGen, cursor, testFrequencyHz, playback.noteLen, 0.85);
      cursor += playback.noteLen;
      const totalDur = cursor - audio.now();
      const id = window.setTimeout(() => resolve(), totalDur * 1000 + 150);
      ctx.channel.timers.push(id);
    });
  });
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  await playRepetitions(() => playOnce(question, ctx), ctx.typeConfig.reps, ctx.typeConfig.spacingSec, ctx.aborted, ctx.onPhase);
}

export const TuningExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'tuning',
  label: 'Tuning',
  originTopicId: 'tuning',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses the difficulty and register enabled on the Tuning topic.',
  buildPaper,
  ChoicesComponent: ExamChoicePicker,
  playQuestion,
  replayQuestion: playOnce,
  gradeQuestion(question, answer) {
    return gradeRecognitionSingle(question, answer as { guessId: string | null; guessLabel: string } | null);
  },
  formatQuestionTitle(_question, index, total) {
    return `Question ${index + 1} of ${total} — ${this.label}`;
  },
  formatResultHeading(question) {
    return String(question.promptDetail ?? question.answerLabel ?? '');
  },
};
