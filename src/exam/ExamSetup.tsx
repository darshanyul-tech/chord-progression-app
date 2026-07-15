import { useState } from 'react';
import type { EnabledExamType } from './exam-machine';
import type { ExamTypeDefinition } from './types';
import { useExamSettings, type ExamTypeConfig } from '../state/settings/exam';
import { useUIStore } from '../state/ui';
import { TOPICS } from '../topics/registry';

function schemaDefaults(type: ExamTypeDefinition): Record<string, number> {
  const out: Record<string, number> = {};
  type.settingsSchema.forEach((f) => {
    out[f.key] = f.default;
  });
  return out;
}

interface ExamSetupProps {
  onBegin(enabled: EnabledExamType[]): void;
  onCancel(): void;
  setupError: string;
}

// Ported from legacy ExamSetupUI (docs/06-exam-mode.md §A) — per-type enable
// toggle + settings sliders, sourced from every active topic's registered
// examTypes rather than a hardcoded map (§B1). Recognition and dictation
// types (§B3) share the same rendering here since both are just a
// settingsSchema of numeric sliders — only the settings VALUES differ
// (count/reps/spacing/replays vs. count/replays).
export function ExamSetup({ onBegin, onCancel, setupError }: ExamSetupProps) {
  const lastActiveTopicId = useUIStore((s) => s.lastActiveTopicId);
  const persisted = useExamSettings();
  const setPersisted = useExamSettings.setState;

  const examTypes = TOPICS.flatMap((t) => t.examTypes ?? []);

  const [configs, setConfigs] = useState<Record<string, ExamTypeConfig>>(() => {
    const out: Record<string, ExamTypeConfig> = {};
    examTypes.forEach((t) => {
      out[t.id] = persisted.types[t.id] ?? {
        enabled: t.originTopicId === lastActiveTopicId,
        settings: schemaDefaults(t),
      };
    });
    return out;
  });
  const [perTypeErrors, setPerTypeErrors] = useState<Record<string, string>>({});

  function toggle(id: string, enabled: boolean) {
    setConfigs((prev) => ({ ...prev, [id]: { ...prev[id]!, enabled } }));
    setPerTypeErrors((prev) => (prev[id] ? { ...prev, [id]: '' } : prev));
  }

  function updateField(id: string, key: string, value: number) {
    setConfigs((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, settings: { ...prev[id]!.settings, [key]: value } },
    }));
    setPerTypeErrors((prev) => (prev[id] ? { ...prev, [id]: '' } : prev));
  }

  function handleBegin() {
    setPersisted({ types: configs });
    const enabledTypes = examTypes.filter((t) => configs[t.id]?.enabled);

    // Probe each enabled type's own buildPaper before committing to the run
    // (§B1) — an empty-settings topic (e.g. no time signatures enabled)
    // used to only surface as a generic "could not build any questions"
    // message at the bottom; this names which type(s) need attention.
    const errors: Record<string, string> = {};
    enabledTypes.forEach((t) => {
      if (!t.buildPaper(configs[t.id]!.settings).length) {
        const topicTitle = TOPICS.find((topic) => topic.id === t.originTopicId)?.title ?? t.label;
        errors[t.id] = `${t.label} produced no questions — check its settings on the ${topicTitle} practice topic (e.g. at least one option enabled) and try again.`;
      }
    });
    setPerTypeErrors(errors);
    if (Object.keys(errors).length) return;

    const enabled: EnabledExamType[] = enabledTypes.map((t) =>
      t.kind === 'recognition'
        ? { kind: 'recognition' as const, type: t, settings: configs[t.id]!.settings }
        : { kind: 'dictation' as const, type: t, settings: configs[t.id]!.settings },
    );
    onBegin(enabled);
  }

  return (
    <section className="card exam-panel exam-panel-setup">
      <h2>Exam mode setup</h2>
      <p className="sub">
        Simulated exam conditions: limited hearings, and no feedback until the end. Enable one or more question
        types below — each uses the enabled options and playback settings from its own topic.
      </p>
      <div className="exam-types-container">
        {examTypes.map((t) => {
          const cfg = configs[t.id]!;
          return (
            <div className="exam-type-cell" key={t.id}>
              <div className="exam-type-block">
                <label className="exam-type-toggle">
                  <input type="checkbox" checked={cfg.enabled} onChange={(e) => toggle(t.id, e.target.checked)} />
                  <span>{t.label}</span>
                </label>
                <div className={`exam-type-settings-wrap${cfg.enabled ? '' : ' is-disabled'}`}>
                  <div className="grid exam-setup-grid exam-type-settings-grid">
                    {t.settingsSchema.map((field) => (
                      <div className="field" key={field.key}>
                        <label>
                          {field.label}:{' '}
                          <span className="valtag">
                            {cfg.settings[field.key]}
                            {field.suffix ?? ''}
                          </span>
                        </label>
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={cfg.settings[field.key]}
                          onChange={(e) => updateField(t.id, field.key, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                  {t.setupHelp && (
                    <p className="help" style={{ marginTop: '0.45rem' }}>
                      {t.setupHelp}
                    </p>
                  )}
                  {perTypeErrors[t.id] && (
                    <p className="status error" style={{ marginTop: '0.45rem' }}>
                      {perTypeErrors[t.id]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {setupError && (
        <p className="status error" style={{ marginTop: '0.65rem' }}>
          {setupError}
        </p>
      )}
      <p className="help" style={{ marginTop: '0.6rem' }}>
        You may <strong>submit early</strong> during hearings to skip remaining repetitions. Recognition questions
        get a <strong>30 second</strong> answer timer; dictation questions get <strong>120 seconds</strong>. The
        next question begins when you submit or when time runs out.
      </p>
      <div className="buttons" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={handleBegin}>
          Begin exam
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
