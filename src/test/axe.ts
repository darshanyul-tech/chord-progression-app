import axe from 'axe-core';
import { expect } from 'vitest';

// Phase 14 gate (09-improvement-plan.md): axe-core pass with no serious/
// critical violations on each topic view and all three exam phases.
// happy-dom (this project's vitest environment) doesn't compute real layout
// (getBoundingClientRect/getComputedStyle return zeros), so rules that
// depend on actual rendered geometry or paint (color-contrast, target-size,
// focus-order-semantics's visibility check, etc.) produce noise unrelated to
// real markup bugs — those tokens were already hand-audited separately
// (09-improvement-plan.md §14.4). This runs everything else: labelling,
// roles/ARIA validity, landmark/heading structure, name-from-content, etc.
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'target-size', 'focus-order-semantics'];

export async function expectNoSeriousViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
  });
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) {
    const detail = serious
      .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      .join('\n');
    expect.fail(`axe found ${serious.length} serious/critical violation(s):\n${detail}`);
  }
}
