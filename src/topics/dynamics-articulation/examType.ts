import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { withEarlyAbort } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { scheduleSamplerTrigger } from '../../lib/audio/playback';
import {
  articulationById,
  buildDynamicsArticulationQuestion,
  type ArticulationId,
  type DAQuestion,
  type DynamicsAnswerId,
} from '../../lib/recognition/dynamicsArticulation';
import { midiToNoteName } from '../../lib/theory';
import { useDynamicsArticulationSettings } from '../../state/settings/dynamics-articulation';

function answerLabelFor(question: DAQuestion): string {
  if (question.mode === 'dynamics') {
    if (question.answerId === 'louder') return 'Second louder';
    if (question.answerId === 'softer') return 'Second softer';
    return 'Same';
  }
  return articulationById(question.articulationId)?.label ?? question.articulationId;
}

function promptDetailFor(question: DAQuestion): string {
  if (question.mode === 'dynamics') {
    return question.answerId === 'same' ? 'Second hearing was the same loudness' : `Second hearing was ${question.answerId}`;
  }
  const def = articulationById(question.articulationId);
  return def ? `${def.label} — ${def.description}` : question.articulationId;
}

// Uses the topic's own persisted settings, including its current mode
// (docs/05-topics/12-dynamics-articulation.md §6).
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const practiceSettings = useDynamicsArticulationSettings.getState();
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildDynamicsArticulationQuestion(practiceSettings);
    if (!q) continue;
    questions.push({
      typeId: 'dynamicsArticulation',
      mode: q.mode,
      phraseMidis: q.phraseMidis,
      velocityA: q.mode === 'dynamics' ? q.velocityA : undefined,
      velocityB: q.mode === 'dynamics' ? q.velocityB : undefined,
      articulationId: q.mode === 'articulation' ? q.articulationId : undefined,
      answerId: q.answerId,
      answerLabel: answerLabelFor(q),
      choiceDefs: q.choiceDefs,
      promptDetail: promptDetailFor(q),
      tempo: practiceSettings.tempo,
    });
  }
  return questions;
}

// Cannot reuse exam/playback.ts's playNoteSequence here — it hardcodes a
// single velocity for the whole sequence, but dynamics needs two different
// velocities and articulation needs a duration fraction per the table.
// Mirrors playNoteSequence's own internal shape (withEarlyAbort + a single
// trailing timer).
function playOnce(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  return withEarlyAbort(ctx.channel, ctx.aborted, () => {
    return new Promise((resolve) => {
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
      const beatLen = 60 / (question.tempo as number);
      let cursor = audio.now() + 0.1;
      const phraseMidis = question.phraseMidis as number[];

      function schedulePhrase(noteLen: number, velocity: number) {
        phraseMidis.forEach((midi) => {
          scheduleSamplerTrigger(audio.sampler, ctx.channel, playGen, cursor, midiToNoteName(midi), noteLen, velocity);
          cursor += beatLen;
        });
      }

      if (question.mode === 'dynamics') {
        schedulePhrase(beatLen * 0.9, question.velocityA as number);
        cursor += beatLen;
        schedulePhrase(beatLen * 0.9, question.velocityB as number);
      } else {
        const def = articulationById(question.articulationId as ArticulationId)!;
        schedulePhrase(beatLen * def.noteLenFraction, def.velocity);
      }

      const totalDur = cursor - audio.now();
      const id = window.setTimeout(() => resolve(), totalDur * 1000 + 150);
      ctx.channel.timers.push(id);
    });
  });
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  await playRepetitions(() => playOnce(question, ctx), ctx.typeConfig.reps, ctx.typeConfig.spacingSec, ctx.aborted, ctx.onPhase);
}

export const DynamicsArticulationExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'dynamicsArticulation',
  label: 'Dynamics & articulation',
  originTopicId: 'dynamics-articulation',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses the mode, difficulty/pool, and tempo enabled on the Dynamics & Articulation topic.',
  buildPaper,
  ChoicesComponent: ExamChoicePicker,
  playQuestion,
  replayQuestion: playOnce,
  gradeQuestion(question, answer) {
    return gradeRecognitionSingle(question, answer as { guessId: DynamicsAnswerId | ArticulationId | null; guessLabel: string } | null);
  },
  formatQuestionTitle(_question, index, total) {
    return `Question ${index + 1} of ${total} — ${this.label}`;
  },
  formatResultHeading(question) {
    return String(question.promptDetail ?? question.answerLabel ?? '');
  },
};
