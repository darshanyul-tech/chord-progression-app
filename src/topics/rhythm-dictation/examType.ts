import { RhythmDictationAnswer, RhythmDictationResult, type RhythmDictationQuestion } from './ExamAnswer';
import { EXAM_DICTATION_SETTINGS_SCHEMA } from '../../exam/exam-machine';
import type { DictationExamQuestion, ExamPlayContext, ExamTypeDefinition } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { buildPlaybackEvents, disconnectScheduled, scheduleMetroClick, scheduleNote } from '../../lib/audio/percussion';
import { fillMeasure, getActiveDurations } from '../../lib/rhythm/generator';
import { gridStep, measuresEqual, metricPulseBeats, metricPulseCount, parseTimeSig, type Measure } from '../../lib/rhythm/time';
import { useRhythmDictationSettings } from '../../state/settings/rhythm-dictation';

// Ported per docs/06-exam-mode.md §B3: dictation exam type — pre-generated
// question (built at paper time from the topic's own settings), single
// initial hearing + limited replays, matched/not-matched grading, side-by-
// side reveal on the results screen (Answer/Result components in
// ExamAnswer.tsx). Reuses the topic's RhythmStaffHost and rhythm-generation
// primitives.

function buildPaper(settings: Record<string, number>) {
  const rd = useRhythmDictationSettings.getState();
  const questions: RhythmDictationQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const sigs = rd.signatures.length ? rd.signatures : ['4/4'];
    const sig = sigs[Math.floor(Math.random() * sigs.length)]!;
    const timeSig = parseTimeSig(sig);
    const durs = getActiveDurations(rd.durations, rd.triplets, timeSig.measureBeats);
    const step = gridStep(durs);
    const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
    const pattern: Measure[] = [];
    for (let m = 0; m < rd.measures; m++) {
      pattern.push(
        fillMeasure({
          measureTotalBeats: timeSig.measureBeats,
          activeDurations: durs,
          restFrequency: rd.restFrequency,
          syncopation: rd.syncopation,
          gridStepVal: step,
          pulseBeats: pulse,
        }),
      );
    }
    questions.push({
      typeId: 'rhythmDictation',
      pattern,
      timeSig,
      numMeasures: rd.measures,
      tempo: rd.tempo,
      sound: rd.sound,
      emphasis: rd.emphasis,
      metroVolume: rd.metroVolume,
    });
  }
  return questions.map((q) => ({ ...q }));
}

function playOnce(rawQuestion: DictationExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const question = rawQuestion as unknown as RhythmDictationQuestion;
  return new Promise((resolve) => {
    if (audio.status !== 'ready') {
      resolve();
      return;
    }
    const rawCtx = audio.rawContext();
    if (rawCtx.state === 'suspended' && 'resume' in rawCtx) (rawCtx as AudioContext).resume();
    disconnectScheduled(ctx.channel.scheduledNodes);

    const bpm = question.tempo;
    const spb = 60 / bpm;
    const pulse = metricPulseBeats(question.timeSig.beatValue, question.timeSig.beatsPerBar);
    const countInPulses = metricPulseCount(question.timeSig.measureBeats, pulse);
    const countInDur = countInPulses * pulse * spb;
    const { events, totalDuration } = buildPlaybackEvents(question.pattern, bpm, question.timeSig.measureBeats, pulse, question.numMeasures);
    const startAt = rawCtx.currentTime + 0.05;

    for (let b = 0; b < countInPulses; b++) {
      scheduleMetroClick(rawCtx, startAt + b * pulse * spb, b === 0, question.metroVolume, ctx.channel.scheduledNodes);
    }
    const rhythmStart = startAt + countInDur;
    events.forEach((ev) => {
      scheduleNote(rawCtx, rhythmStart + ev.time, ev.duration, ev.isRest, ev.isBeat1, question.sound, bpm, question.emphasis, ctx.channel.scheduledNodes);
    });

    window.setTimeout(() => resolve(), (countInDur + totalDuration + 0.15) * 1000);
  });
}

export const RhythmDictationExam: ExamTypeDefinition = {
  kind: 'dictation',
  id: 'rhythmDictation',
  label: 'Rhythm dictation',
  originTopicId: 'rhythm-dictation',
  settingsSchema: EXAM_DICTATION_SETTINGS_SCHEMA,
  setupHelp: 'Uses metre, note values, and sound settings from the Rhythm Dictation topic.',
  buildPaper,
  AnswerComponent: RhythmDictationAnswer,
  ResultComponent: RhythmDictationResult,
  playQuestion: playOnce,
  replayQuestion: playOnce,
  gradeQuestion(question, answer) {
    const q = question as unknown as RhythmDictationQuestion;
    const userMeasures = (answer as Measure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
    const matched = q.pattern.every((bar, i) => measuresEqual(userMeasures[i] ?? [], bar));
    return { matched };
  },
  formatQuestionTitle(_question, index, total) {
    return `Question ${index + 1} of ${total} — ${this.label}`;
  },
};
