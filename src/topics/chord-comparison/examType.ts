import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, delaySec, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { playChordBlock, playNoteSequence } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { getChordRecognitionMidis } from '../../lib/recognition/chords';
import {
  CHORD_COMPARISON_ARP_GAP,
  buildChordComparisonQuestion,
  getChordComparisonChoiceDefs,
  type ChordComparisonAnswerId,
  type ChordComparisonMember,
} from '../../lib/recognition/chordComparison';
import { midiToNoteName } from '../../lib/theory';
import { useChordComparisonSettings } from '../../state/settings/chord-comparison';

function answerLabelFor(answerId: ChordComparisonAnswerId): string {
  return answerId === 'same' ? 'Same' : 'Different';
}

// Uses the topic's own persisted settings (docs/05-topics/09-chord-comparison.md §6),
// same convention as the other comparison exam types.
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const practiceSettings = useChordComparisonSettings.getState();
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildChordComparisonQuestion(practiceSettings);
    if (!q) continue;
    questions.push({
      typeId: 'chordComparison',
      first: q.first,
      second: q.second,
      answerId: q.answerId,
      answerLabel: answerLabelFor(q.answerId),
      choiceDefs: getChordComparisonChoiceDefs(),
      promptDetail: `First: ${q.first.label} · Second: ${q.second.label}`,
      playback: { playbackStyle: practiceSettings.playbackStyle, holdLen: practiceSettings.holdLen, pairPauseSec: practiceSettings.pairPauseSec },
    });
  }
  return questions;
}

async function playMember(
  member: ChordComparisonMember,
  playbackStyle: 'block' | 'arp',
  holdLen: number,
  ctx: ExamPlayContext,
): Promise<void> {
  const midis = getChordRecognitionMidis(member.rootMidi, member.typeId);
  if (playbackStyle === 'arp') {
    await playNoteSequence(audio.sampler, ctx.channel, audio.now(), midis, holdLen, CHORD_COMPARISON_ARP_GAP, ctx.aborted);
  } else {
    await playChordBlock(audio.sampler, ctx.channel, audio.now(), midis.map(midiToNoteName), holdLen, ctx.aborted);
  }
}

async function playOnce(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const first = question.first as ChordComparisonMember;
  const second = question.second as ChordComparisonMember;
  const playback = question.playback as { playbackStyle: 'block' | 'arp'; holdLen: number; pairPauseSec: number };

  await playMember(first, playback.playbackStyle, playback.holdLen, ctx);
  if (ctx.aborted()) return;
  await delaySec(playback.pairPauseSec, ctx.aborted);
  if (ctx.aborted()) return;
  await playMember(second, playback.playbackStyle, playback.holdLen, ctx);
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  await playRepetitions(() => playOnce(question, ctx), ctx.typeConfig.reps, ctx.typeConfig.spacingSec, ctx.aborted, ctx.onPhase);
}

export const ChordComparisonExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'chordComparison',
  label: 'Chord comparison',
  originTopicId: 'chord-comparison',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses the chord pool, difficulty, and root relationship enabled on the Chord Comparison topic.',
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
