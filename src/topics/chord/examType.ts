import { ExamChoicePicker } from '../../components/ExamChoicePicker';
import { EXAM_RECOGNITION_SETTINGS_SCHEMA, gradeRecognitionSingle, playRepetitions } from '../../exam/exam-machine';
import { playChordBlock, playNoteSequence } from '../../exam/playback';
import type { ExamPlayContext, ExamTypeDefinition, RecognitionExamQuestion } from '../../exam/types';
import { audio } from '../../lib/audio/engine';
import { buildChordQuestion, getChordRecognitionMidis } from '../../lib/recognition/chords';
import { midiToNoteName } from '../../lib/theory';
import { useChordRecognitionSettings } from '../../state/settings/chord-recognition';

// Ported from legacy ChordRecognitionExam (docs/06-exam-mode.md §A).
function buildPaper(settings: Record<string, number>): RecognitionExamQuestion[] {
  const chordSettings = useChordRecognitionSettings.getState();
  if (!chordSettings.enabledTypes.length) return [];
  const questions: RecognitionExamQuestion[] = [];
  for (let i = 0; i < settings.count; i++) {
    const q = buildChordQuestion(chordSettings);
    if (q) questions.push({ ...q, typeId: 'chordRecognition' });
  }
  return questions;
}

async function playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void> {
  const rootMidi = question.rootMidi as number;
  const quality = question.quality as string;
  const playback = question.playback as {
    style: 'block' | 'arp';
    holdLen: number;
    arpNoteLen: number;
    arpGap: number;
  };
  const midis = getChordRecognitionMidis(rootMidi, quality);
  await playRepetitions(
    async () => {
      if (playback.style === 'arp') {
        await playNoteSequence(
          audio.sampler,
          ctx.channel,
          audio.now(),
          midis,
          playback.arpNoteLen,
          playback.arpGap,
          ctx.aborted,
        );
      } else {
        await playChordBlock(
          audio.sampler,
          ctx.channel,
          audio.now(),
          midis.map(midiToNoteName),
          playback.holdLen,
          ctx.aborted,
        );
      }
    },
    ctx.typeConfig.reps,
    ctx.typeConfig.spacingSec,
    ctx.aborted,
    ctx.onPhase,
  );
}

export const ChordRecognitionExam: ExamTypeDefinition = {
  kind: 'recognition',
  id: 'chordRecognition',
  label: 'Chord quality identification',
  originTopicId: 'chord-recognition',
  settingsSchema: EXAM_RECOGNITION_SETTINGS_SCHEMA,
  setupHelp: 'Uses chord types and block/arpeggio playback from the Chord Recognition topic.',
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
