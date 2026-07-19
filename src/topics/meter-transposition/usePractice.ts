import { useRef, useState } from 'react';
import { defaultRestMeasure, fillGaps, type RestAdapter } from '../../lib/notation/gaps';
import { resolvePlacementBeat } from '../../lib/notation/placement';
import {
  buildMeterTranspositionQuestion,
  type MeterTranspositionQuestion,
  type MeterTranspositionSettings,
} from '../../lib/written-theory/meterTransposition';
import {
  durationClose,
  durationFitsBar,
  gridStep,
  measuresEqual,
  metricPulseBeats,
  type Measure,
  type RhythmNote,
} from '../../lib/rhythm/time';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'meter-transposition';

const rhythmRestAdapter: RestAdapter<RhythmNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.isRest,
  makeRest: (beat, duration) => ({ beat, duration, isRest: true }),
};

interface PlacementRecord {
  measureIndex: number;
  beat: number;
}

export function useMeterTranspositionPractice(settings: MeterTranspositionSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<MeterTranspositionQuestion | null>(() => buildMeterTranspositionQuestion(settings));
  const [userMeasures, setUserMeasures] = useState<Measure[]>(() => initUserMeasures(question));
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [measureResults, setMeasureResults] = useState<boolean[]>([]);
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');
  const [questionScoreText, setQuestionScoreText] = useState('');
  const [armedIndex, setArmedIndex] = useState(0);
  const [placementHistory, setPlacementHistory] = useState<PlacementRecord[]>([]);
  const flashTimerRef = useRef<number | null>(null);

  function initUserMeasures(q: MeterTranspositionQuestion | null): Measure[] {
    if (!q) return [];
    const pulse = metricPulseBeats(q.targetSig.beatValue, q.targetSig.beatsPerBar);
    return Array.from({ length: q.bars }, () => defaultRestMeasure(q.targetSig.measureBeats, pulse, rhythmRestAdapter));
  }

  function generateQuestion() {
    const q = buildMeterTranspositionQuestion(settings);
    setQuestion(q);
    setUserMeasures(initUserMeasures(q));
    setHasSubmitted(false);
    setMeasureResults([]);
    setActiveMeasureIndex(0);
    setPlacementHistory([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    setQuestionScoreText('');
    setArmedIndex(0);
  }

  const armed = question?.paletteDurations[armedIndex] ?? { duration: 1, isRest: false };
  const gridStepVal = question ? gridStep(question.paletteDurations.map((p) => p.duration)) : 1;

  function placeAt(measureIndex: number, rawBeat: number) {
    if (!question || hasSubmitted) return;
    const measure = userMeasures[measureIndex];
    if (!measure) return;
    const cap = question.targetSig.measureBeats;
    const reject = () => {
      setFlashMeasure(measureIndex);
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setFlashMeasure(null), 280);
    };
    if (!durationFitsBar(armed.duration, cap)) {
      reject();
      return;
    }
    const resolved = resolvePlacementBeat(measure, rawBeat, armed.duration, cap, gridStepVal);
    if (!resolved) {
      reject();
      return;
    }
    const { beat, isReplace } = resolved;
    const end = beat + armed.duration;
    if (isReplace && end > cap + 0.001) {
      reject();
      return;
    }
    const overlaps = (n: { beat: number; duration: number }) => beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001;
    const pulse = metricPulseBeats(question.targetSig.beatValue, question.targetSig.beatsPerBar);
    setUserMeasures((prev) =>
      prev.map((m, i) =>
        i === measureIndex
          ? fillGaps([...m.filter((n) => !overlaps(n)), { beat, duration: armed.duration, isRest: armed.isRest }], cap, pulse, rhythmRestAdapter)
          : m,
      ),
    );
    setPlacementHistory((prev) => [...prev.filter((p) => !(p.measureIndex === measureIndex && durationClose(p.beat, beat))), { measureIndex, beat }]);
    setActiveMeasureIndex(measureIndex);
  }

  function removeLastNote() {
    if (!question || hasSubmitted) return;
    const pulse = metricPulseBeats(question.targetSig.beatValue, question.targetSig.beatsPerBar);
    setPlacementHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1]!;
      setUserMeasures((prevMeasures) =>
        prevMeasures.map((m, i) => {
          if (i !== last.measureIndex) return m;
          const idx = m.findIndex((n) => durationClose(n.beat, last.beat));
          if (idx < 0) return m;
          return fillGaps(m.filter((_, i2) => i2 !== idx), question.targetSig.measureBeats, pulse, rhythmRestAdapter);
        }),
      );
      setActiveMeasureIndex(last.measureIndex);
      return prev.slice(0, -1);
    });
  }

  function clearActiveMeasure() {
    if (!question || hasSubmitted) return;
    const pulse = metricPulseBeats(question.targetSig.beatValue, question.targetSig.beatsPerBar);
    setUserMeasures((prev) =>
      prev.map((m, i) => (i === activeMeasureIndex ? defaultRestMeasure(question.targetSig.measureBeats, pulse, rhythmRestAdapter) : m)),
    );
    setPlacementHistory((prev) => prev.filter((p) => p.measureIndex !== activeMeasureIndex));
  }

  function checkAnswer() {
    if (!question) return;
    setHasSubmitted(true);
    let correctBars = 0;
    const results = question.expectedMeasures.map((_pat, i) => {
      const ok = measuresEqual(userMeasures[i] ?? [], question.expectedMeasures[i] ?? []);
      if (ok) correctBars++;
      return ok;
    });
    setMeasureResults(results);
    const allCorrect = correctBars === question.bars;
    recordAttempt(TOPIC_ID, allCorrect);
    if (allCorrect) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg('Incorrect — see staff for corrections.');
    }
    setQuestionScoreText(`${correctBars} of ${question.bars} bar${question.bars === 1 ? '' : 's'} correct`);
  }

  const totalPlaced = placementHistory.length;
  const submitEnabled = !hasSubmitted && !!question && totalPlaced > 0;

  return {
    question,
    userMeasures,
    hasSubmitted,
    measureResults,
    activeMeasureIndex,
    setActiveMeasureIndex,
    flashMeasure,
    armedIndex,
    armDuration: setArmedIndex,
    gridStepVal,
    submitEnabled,
    feedbackMsg,
    feedbackKind,
    questionScoreText,
    score,
    placeAt,
    removeLastNote,
    clearActiveMeasure,
    checkAnswer,
    next: generateQuestion,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
