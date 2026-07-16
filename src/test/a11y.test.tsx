import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { expectNoSeriousViolations } from './axe';
import { ExamActive } from '../exam/ExamActive';
import { ExamResults } from '../exam/ExamResults';
import { ExamSetup } from '../exam/ExamSetup';
import type {
  DictationExamType,
  ExamAnswerRecord,
  ExamPaperEntry,
  ExamSummary,
  DictationSummary,
} from '../exam/exam-machine';
import type { RecognitionExamType } from '../exam/exam-machine';
import { useScoresStore } from '../state/scores';
import { ChordComparisonTopic } from '../topics/chord-comparison/ChordComparisonTopic';
import { ChordTopic } from '../topics/chord/ChordTopic';
import { IntervalComparisonTopic } from '../topics/interval-comparison/IntervalComparisonTopic';
import { IntervalTopic } from '../topics/interval/IntervalTopic';
import { MeterTopic } from '../topics/meter/MeterTopic';
import { ProgressionTopic } from '../topics/progression/ProgressionTopic';
import { ScaleTopic } from '../topics/scale/ScaleTopic';
import { MelodicDictationTopic } from '../topics/melodic-dictation/MelodicDictationTopic';
import { RhythmDictationTopic } from '../topics/rhythm-dictation/RhythmDictationTopic';

// Phase 14 gate (09-improvement-plan.md §14): axe-core reports no serious/
// critical violations on each topic view and all three exam phases.
// audio.status stays 'idle' (never 'ready') so no topic's mount-time
// autoplay path fires — every practice hook gates its own playback on
// `audio.status === 'ready'` — keeping this one mock safe across all seven
// topics without needing a per-topic raw AudioContext shape.
vi.mock('../lib/audio/engine', () => ({
  audio: {
    status: 'idle',
    sampler: null,
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
    rawContext: () => {
      throw new Error('rawContext should not be called while audio.status is idle');
    },
  },
}));

beforeEach(() => {
  localStorage.clear();
  useScoresStore.setState({ scores: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderAt(path: string, ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe('Topic views — axe accessibility pass', () => {
  it('Interval Recognition has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/interval-recognition', <IntervalTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Interval Comparison has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/interval-comparison', <IntervalComparisonTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Scales has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/scales', <ScaleTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Chord Recognition has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/chord-recognition', <ChordTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Chord Comparison has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/chord-comparison', <ChordComparisonTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Meter Recognition has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/meter-recognition', <MeterTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Rhythm Dictation has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/rhythm-dictation', <RhythmDictationTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Chord Progressions has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/chord-progressions', <ProgressionTopic />);
    await expectNoSeriousViolations(container);
  });

  it('Melodic Dictation has no serious/critical violations', async () => {
    const { container } = renderAt('/topic/melodic-dictation', <MelodicDictationTopic />);
    await expectNoSeriousViolations(container);
  });
});

// Minimal stand-ins for the type-specific slices of an exam question — these
// phases' OWN markup (progress bar, timer, summary stats, result cards) is
// what's under test here, not any particular topic's ChoicesComponent/
// AnswerComponent (already covered indirectly by the topic-view pass above
// and exercised for real by exam-machine.test.ts).
const fakeRecognitionType: RecognitionExamType = {
  kind: 'recognition',
  id: 'fake-recognition',
  label: 'Fake Recognition',
  originTopicId: 'interval-recognition',
  settingsSchema: [],
  buildPaper: () => [],
  ChoicesComponent: ({ disabled, onAnswer }) => (
    <div role="group" aria-label="Answer options">
      <button type="button" disabled={disabled} onClick={() => onAnswer('a')}>
        Option A
      </button>
    </div>
  ),
  playQuestion: async () => {},
  replayQuestion: async () => {},
  gradeQuestion: () => ({ correctUnits: 1, totalUnits: 1, perfect: true, results: [] }),
  formatQuestionTitle: () => 'Question 1 of 1',
  formatResultHeading: () => 'Fake question',
};

const fakeDictationType: DictationExamType = {
  kind: 'dictation',
  id: 'fake-dictation',
  label: 'Fake Dictation',
  originTopicId: 'rhythm-dictation',
  settingsSchema: [],
  buildPaper: () => [],
  AnswerComponent: () => <div>Answer area</div>,
  ResultComponent: () => <div>Result area</div>,
  playQuestion: async () => {},
  replayQuestion: async () => {},
  gradeQuestion: () => ({ matched: true }),
  formatQuestionTitle: () => 'Question 1 of 1',
};

describe('Exam mode phases — axe accessibility pass', () => {
  it('setup phase has no serious/critical violations', async () => {
    const { container } = render(<ExamSetup onBegin={() => {}} onCancel={() => {}} setupError="" />);
    // ExamSetup resolves every topic's examTypes() loader asynchronously
    // (Phase 13 §1) before rendering the real settings form.
    await screen.findByText('Begin exam');
    await expectNoSeriousViolations(container);
  });

  it('active phase (recognition question) has no serious/critical violations', async () => {
    const entry: ExamPaperEntry = {
      kind: 'recognition',
      question: { typeId: 'fake-recognition' },
      type: fakeRecognitionType,
      typeSettings: {},
    };
    const { container } = render(
      <ExamActive
        entry={entry}
        index={0}
        total={3}
        phaseLabel="Listening — repetition 1 of 2."
        remainingSec={25}
        canSubmit={true}
        remainingReplays={1}
        isReplaying={false}
        answer={null}
        activeBarIndex={null}
        onAnswer={() => {}}
        onSubmit={() => {}}
        onReplay={() => {}}
        onLeave={() => {}}
      />,
    );
    await expectNoSeriousViolations(container);
  });

  it('results phase has no serious/critical violations', async () => {
    const summary: ExamSummary = {
      perfectQuestions: 1,
      totalQuestions: 1,
      qPct: 100,
      byType: [{ label: 'Fake Recognition', perfect: 1, total: 1 }],
    };
    const dictationSummary: DictationSummary = { matched: 1, total: 1 };
    const answers: ExamAnswerRecord[] = [
      {
        kind: 'recognition',
        question: { typeId: 'fake-recognition' },
        type: fakeRecognitionType,
        answer: 'a',
        graded: { correctUnits: 1, totalUnits: 1, perfect: true, results: [{ bar: 1, ok: true, actual: 'A', yours: 'A' }] },
        timedOut: false,
        submittedEarly: false,
      },
      {
        kind: 'dictation',
        question: { typeId: 'fake-dictation' },
        type: fakeDictationType,
        answer: null,
        graded: { matched: true },
        timedOut: false,
        submittedEarly: false,
      },
    ];
    const { container } = render(
      <ExamResults
        summary={summary}
        dictationSummary={dictationSummary}
        answers={answers}
        onRepeat={() => {}}
        onLeave={() => {}}
      />,
    );
    await expectNoSeriousViolations(container);
  });
});
