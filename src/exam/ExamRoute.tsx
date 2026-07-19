import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExamActive } from './ExamActive';
import { ExamResults } from './ExamResults';
import { ExamSetup } from './ExamSetup';
import { useExamMachine } from './useExamMachine';
import { useUIStore } from '../state/ui';
import { topicPath } from '../topics/registry';
// Exam mode can be reached without TopicHost ever mounting (D9a only keeps
// topics mounted from the /topic/:id route), so these shared classes
// (.bars/.guess-row, .chord-choice-grid/.chord-answer-group) are pulled in
// here rather than assumed already loaded by ChordTopic/ProgressionTopic.
import '../styles/topics/chord-progressions.css';
import '../styles/topics/chord-recognition.css';
import '../styles/exam.css';

// Ported from legacy ExamController's overlay-swap flow (docs/06-exam-mode.md
// §A) — here expressed as the /exam route's own phase switch instead of
// overlay visibility toggling. examActive only gates topic nav during the
// in-progress question phase (matches legacy: setup/results don't set
// exam.active), and leaving always restores the topic the user came from.
export function ExamRoute() {
  const navigate = useNavigate();
  const machine = useExamMachine();
  const setExamActive = useUIStore((s) => s.setExamActive);
  const lastActiveTopicId = useUIStore((s) => s.lastActiveTopicId);

  useEffect(() => {
    setExamActive(machine.phase === 'active');
  }, [machine.phase, setExamActive]);

  useEffect(() => () => setExamActive(false), [setExamActive]);

  function goToLastTopic() {
    navigate(topicPath(lastActiveTopicId));
  }

  if (machine.phase === 'setup') {
    return <ExamSetup onBegin={machine.begin} onCancel={goToLastTopic} setupError={machine.setupError} />;
  }

  if (machine.phase === 'active') {
    const entry = machine.paper[machine.currentIndex];
    if (!entry) return null;
    return (
      <ExamActive
        entry={entry}
        index={machine.currentIndex}
        total={machine.paper.length}
        phaseLabel={machine.phaseLabel}
        remainingSec={machine.remainingSec}
        canSubmit={machine.canSubmit}
        remainingReplays={machine.remainingReplays}
        isReplaying={machine.isReplaying}
        answer={machine.currentAnswer}
        activeBarIndex={machine.activeBarIndex}
        onAnswer={machine.setAnswer}
        onSubmit={machine.submitAnswer}
        onReplay={machine.replay}
        onLeave={() => {
          machine.leave();
          goToLastTopic();
        }}
      />
    );
  }

  if (machine.summary && machine.dictationSummary) {
    return (
      <ExamResults
        summary={machine.summary}
        dictationSummary={machine.dictationSummary}
        answers={machine.answers}
        onRepeat={machine.repeat}
        onLeave={() => {
          machine.leave();
          goToLastTopic();
        }}
      />
    );
  }

  return null;
}
