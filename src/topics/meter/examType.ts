import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { withEarlyAbort } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { buildPlaybackEvents, scheduleNote } from '../../lib/audio/percussion';
import { buildMeterQuestion, type MeterQuestion } from '../../lib/recognition/meter';
import { metricPulseBeats } from '../../lib/rhythm/time';
import { useMeterRecognitionSettings } from '../../state/settings/meter-recognition';

// Ported from docs/06-exam-mode.md §A adapter interface + topic doc 04 §6.
// Reuses the topic's own question builder (buildMeterQuestion) and the
// shared rhythm/percussion playback primitives, with a 1s silent lead-in and
// no metronome — same as the topic's own practice-mode playback.
const SILENT_LEAD_IN_SEC = 1;

function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const meterSettings = useMeterRecognitionSettings.getState();
  if (meterSettings.enabledSignatures.length < 2) return [];
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildMeterQuestion(meterSettings);
    if (q) questions.push({ ...q });
  }
  return questions;
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const q = question as unknown as MeterQuestion;
  await playRepetitions(
    () =>
      withEarlyAbort(ctx.channel, ctx.aborted, () => {
        return new Promise((resolve) => {
          if (audio.status !== 'ready') {
            resolve();
            return;
          }
          const rawCtx = audio.rawContext();
          if (rawCtx.state === 'suspended' && 'resume' in rawCtx) (rawCtx as AudioContext).resume();
          const pulse = metricPulseBeats(q.timeSig.beatValue, q.timeSig.beatsPerBar);
          const { events, totalDuration } = buildPlaybackEvents(
            q.pattern,
            q.tempo,
            q.timeSig.measureBeats,
            pulse,
            q.numMeasures,
          );
          const startAt = rawCtx.currentTime + SILENT_LEAD_IN_SEC;
          events.forEach((ev) => {
            scheduleNote(
              rawCtx,
              startAt + ev.time,
              ev.duration,
              ev.isRest,
              ev.isBeat1,
              q.sound,
              q.tempo,
              q.emphasisValue,
              ctx.channel.scheduledNodes,
            );
          });
          window.setTimeout(() => resolve(), (SILENT_LEAD_IN_SEC + totalDuration + 0.15) * 1000);
        });
      }),
    ctx.typeConfig.reps,
    ctx.typeConfig.spacingSec,
    ctx.aborted,
    ctx.onPhase,
  );
}

export const MeterRecognitionExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'meterRecognition',
  label: 'Meter identification',
  originTopicId: 'meter-recognition',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses the enabled time signatures and sound/tempo settings from the Meter Recognition topic.',
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
