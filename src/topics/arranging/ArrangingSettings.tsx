import type { StoreApi, UseBoundStore } from 'zustand';
import type { ArrangingExercise, ArrSettings, OptionControl } from './exerciseTypes';

interface ArrangingSettingsProps {
  exercise: ArrangingExercise;
  store: UseBoundStore<StoreApi<ArrSettings>>;
}

function MultiControl({ control, value, onChange }: { control: Extract<OptionControl, { kind: 'multi' }>; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(v: string) {
    const has = value.includes(v);
    const next = has ? value.filter((x) => x !== v) : [...value, v];
    if (!next.length) return; // never allow an empty multi-select
    onChange(next);
  }
  return (
    <div className="field">
      <label>{control.label}</label>
      <div className="theory-check-grid">
        {control.options.map((o) => (
          <label key={o.value}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}
          </label>
        ))}
      </div>
      {control.note && <p className="help" style={{ margin: '0.3rem 0 0' }}>{control.note}</p>}
    </div>
  );
}

// Schema-driven options panel — renders each exercise's declared controls into
// the same .card / .field / .toggle-switch primitives every other topic uses.
export function ArrangingSettings({ exercise, store }: ArrangingSettingsProps) {
  const settings = store();
  const setState = store.setState;

  return (
    <section className="card">
      <h2>{exercise.title} settings</h2>
      {exercise.settingsNotice && (
        <p className="sub" style={{ marginBottom: '0.75rem', color: 'var(--warn)' }}>
          {exercise.settingsNotice}
        </p>
      )}
      <div className="grid">
        {exercise.settingsSchema.map((control) => {
          const value = settings[control.key];
          switch (control.kind) {
            case 'toggle':
              return (
                <div className="field field-toggle-header" key={control.key}>
                  <span className="field-toggle-title" id={`${exercise.id}-${control.key}`}>
                    {control.label}
                    {control.note && <span className="help" style={{ display: 'block', fontWeight: 400 }}>{control.note}</span>}
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      aria-labelledby={`${exercise.id}-${control.key}`}
                      checked={Boolean(value)}
                      onChange={(e) => setState({ [control.key]: e.target.checked } as Partial<ArrSettings>)}
                    />
                    <span className="toggle-slider" aria-hidden="true" />
                  </label>
                </div>
              );
            case 'select':
              return (
                <div className="field" key={control.key}>
                  <label htmlFor={`${exercise.id}-${control.key}`}>{control.label}</label>
                  <select
                    id={`${exercise.id}-${control.key}`}
                    value={String(value)}
                    onChange={(e) => setState({ [control.key]: e.target.value } as Partial<ArrSettings>)}
                  >
                    {control.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            case 'multi':
              return (
                <MultiControl
                  key={control.key}
                  control={control}
                  value={(value as string[]) ?? []}
                  onChange={(v) => setState({ [control.key]: v } as Partial<ArrSettings>)}
                />
              );
            case 'stepper':
              return (
                <div className="field" key={control.key}>
                  <label htmlFor={`${exercise.id}-${control.key}`}>{control.label}</label>
                  <input
                    id={`${exercise.id}-${control.key}`}
                    type="number"
                    min={control.min}
                    max={control.max}
                    value={Number(value)}
                    onChange={(e) => setState({ [control.key]: Math.max(control.min, Math.min(control.max, Number(e.target.value))) } as Partial<ArrSettings>)}
                  />
                </div>
              );
            case 'range':
              return (
                <div className="field" key={control.key}>
                  <label htmlFor={`${exercise.id}-${control.key}`}>{control.label}</label>
                  <input
                    id={`${exercise.id}-${control.key}`}
                    type="range"
                    min={control.min}
                    max={control.max}
                    value={Number(value)}
                    onChange={(e) => setState({ [control.key]: Number(e.target.value) } as Partial<ArrSettings>)}
                  />
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </section>
  );
}
