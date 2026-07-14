import { MelodicDictationAnswer, MelodicDictationResult, type MelodicDictationQuestion } from './ExamAnswer';
import { EXAM_DICTATION_SETTINGS_SCHEMA } from '../../exam/exam-machine';
import type { DictationExamQuestion, ExamPlayContext, ExamTypeDefinition } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { disconnectScheduled, scheduleMetroClick } from '../../lib/audio/percussion';
import { generateMelody } from '../../lib/melody/generator';
import { pitchedMeasuresEqual } from '../../lib/melody/grading';
import type { Clef, KeyDef, PitchedMeasure } from '../../lib/melody/theory';
import { metricPulseBeats, metricPulseCount } from '../../lib/rhythm/time';
import { midiToNoteName } from '../../lib/theory';
import { useMelodicDictationSettings } from '../../state/settings/melodic-dictation';

// Ported per docs/06-exam-mode.md §B3 + topic doc 07 §7: dictation exam type
// for Melodic Dictation (Answer/Result components in ExamAnswer.tsx).
// Reuses the topic's own generator/VexStaffHost.

function buildPaper(settings: Record<string, number>) {
  const md = useMelodicDictationSettings.getState();
  const questions: MelodicDictationQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const generated = generateMelody(md);
    questions.push({
      typeId: 'melodicDictation',
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: md.measures,
      measures: generated.measures,
      tempo: md.tempo,
    });
  }
  return questions.map((q) => ({ ...q }));
}

function tonicTriadMidis(key: KeyDef, clef: Clef): number[] {
  const refLow = clef === 'treble' ? 60 : 48;
  const root = refLow + key.tonicPc;
  const third = key.mode === 'major' ? root + 4 : root + 3;
  return [root, third, root + 7];
}

function playOnce(rawQuestion: DictationExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const question = rawQuestion as unknown as MelodicDictationQuestion;
  return new Promise((resolve) => {
    if (audio.status !== 'ready' || !audio.sampler) {
      resolve();
      return;
    }
    const rawCtx = audio.rawContext();
    if (rawCtx.state === 'suspended' && 'resume' in rawCtx) (rawCtx as AudioContext).resume();
    disconnectScheduled(ctx.channel.scheduledNodes);
    try {
      audio.sampler.releaseAll(0);
    } catch {
      /* noop */
    }

    const bpm = question.tempo;
    const spb = 60 / bpm;
    const pulse = metricPulseBeats(question.timeSig.beatValue, question.timeSig.beatsPerBar);
    const countInPulses = metricPulseCount(question.timeSig.measureBeats, pulse);
    const countInDurMs = countInPulses * pulse * spb * 1000;
    const TRIAD_DUR_MS = 1200;

    const schedule = (delayMs: number, fn: () => void) => {
      const id = window.setTimeout(fn, Math.max(0, delayMs));
      ctx.channel.timers.push(id);
    };

    schedule(50, () => {
      const triad = tonicTriadMidis(question.key, question.clef).map(midiToNoteName);
      audio.sampler!.triggerAttackRelease(triad, 1.2, audio.now(), 0.75);
    });
    for (let b = 0; b < countInPulses; b++) {
      schedule(50 + TRIAD_DUR_MS + b * pulse * spb * 1000, () => {
        scheduleMetroClick(rawCtx, rawCtx.currentTime, b === 0, 60, ctx.channel.scheduledNodes);
      });
    }

    const rhythmStartMs = 50 + TRIAD_DUR_MS + countInDurMs;
    let measureStartMs = rhythmStartMs;
    question.measures.forEach((bar) => {
      bar.forEach((n) => {
        if (!n.rest && n.midi !== null) {
          const noteName = midiToNoteName(n.midi);
          const whenMs = measureStartMs + n.beat * spb * 1000;
          const durSec = n.duration * spb * 0.9;
          schedule(whenMs, () => audio.sampler!.triggerAttackRelease(noteName, durSec, audio.now(), 0.85));
        }
      });
      measureStartMs += question.timeSig.measureBeats * spb * 1000;
    });

    const totalMs = rhythmStartMs + question.numMeasures * question.timeSig.measureBeats * spb * 1000;
    schedule(totalMs + 150, () => resolve());
  });
}

export const MelodicDictationExam: ExamTypeDefinition = {
  kind: 'dictation',
  id: 'melodicDictation',
  label: 'Melodic dictation',
  originTopicId: 'melodic-dictation',
  settingsSchema: EXAM_DICTATION_SETTINGS_SCHEMA,
  setupHelp: 'Uses clef, key, range, and rhythm settings from the Melodic Dictation topic.',
  buildPaper,
  AnswerComponent: MelodicDictationAnswer,
  ResultComponent: MelodicDictationResult,
  playQuestion: playOnce,
  replayQuestion: playOnce,
  gradeQuestion(question, answer) {
    const q = question as unknown as MelodicDictationQuestion;
    const userMeasures = (answer as PitchedMeasure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
    return { matched: pitchedMeasuresEqual(userMeasures, q.measures) };
  },
  formatQuestionTitle(_question, index, total) {
    return `Question ${index + 1} of ${total} — ${this.label}`;
  },
};
