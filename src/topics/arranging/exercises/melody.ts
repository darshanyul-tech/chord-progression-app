import {
  APPROACH_NOTE_TYPES,
  buildVoicing,
  checkFaults,
  classifyMotion,
  isCompatible,
  midiToDisplay,
  parseChord,
  REHARMONISATION_TECHNIQUES,
  type ApproachNoteType,
  type MotionType,
  type ReharmTechnique,
  type Voicing,
} from '../../../lib/arranging';
import type { ArrangingExercise, ArrQuestion, ChoiceDef } from '../exerciseTypes';
import { formatVoicingList, ROOTS } from '../arrCommon';
import { pick } from '../rand';

const APPROACH_OPTIONS = APPROACH_NOTE_TYPES.map((a) => ({ value: a.id, label: a.label }));
const APPROACH_LABEL: Record<ApproachNoteType, string> = Object.fromEntries(
  APPROACH_NOTE_TYPES.map((a) => [a.id, a.label]),
) as Record<ApproachNoteType, string>;

// ---- ARR-13 Identify an Approach Note (MC) ----
function buildApproach(type: ApproachNoteType, target: number): number[] {
  const up = Math.random() < 0.5 ? 1 : -1;
  switch (type) {
    case 'chromatic':
      return [target + up, target];
    case 'scale':
      return [target + up * 2, target];
    case 'double-chromatic':
      return [target + up * 2, target + up, target];
    case 'indirect':
      return [target + 1, target - 1, target];
    default:
      return [target - 1, target];
  }
}

export const ARR_13: ArrangingExercise = {
  id: 'arr-approach-identify',
  title: 'Identify an Approach Note',
  instruction:
    'The target note is marked (it’s the last note). Identify how the melody approaches it. Chromatic — a half step. Scale — diatonically, from the chord scale. Double chromatic — two chromatic steps in a row. Indirect — approached from both sides.',
  settingsSchema: [
    { kind: 'multi', key: 'types', label: 'Approach types', options: APPROACH_OPTIONS },
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play the fragment' },
  ],
  defaultSettings: { types: ['chromatic', 'scale', 'double-chromatic', 'indirect'], presentation: 'staff', play: true },
  generate(settings): ArrQuestion | null {
    const types = (settings.types as ApproachNoteType[]) ?? [];
    if (!types.length) return null;
    const type = pick(types);
    const target = pick([60, 62, 64, 65, 67, 69]);
    const fragment = buildApproach(type, target);
    const choices: ChoiceDef[] = types.map((t) => ({ id: APPROACH_LABEL[t], label: APPROACH_LABEL[t] }));
    return {
      kind: 'mc',
      prompt: {
        text: `Fragment: ${fragment.map((m) => midiToDisplay(m, 'sharp')).join(' → ')} (target: ${midiToDisplay(target, 'sharp')})`,
        melody: settings.presentation === 'staff' ? fragment : undefined,
      },
      choices,
      answerIds: [APPROACH_LABEL[type]],
      explanation: `That’s a ${APPROACH_LABEL[type].toLowerCase()} approach.`,
      play: settings.play ? fragment : undefined,
      playMode: 'sequence',
    };
  },
};

// ---- ARR-15 Melodic Motion (MC) ----
const MOTION_LABEL: Record<MotionType, string> = { parallel: 'Parallel', similar: 'Similar', oblique: 'Oblique', contrary: 'Contrary' };

export const ARR_15: ArrangingExercise = {
  id: 'arr-melodic-motion',
  title: 'Melodic Motion',
  instruction:
    'Two voices each move from one note to the next. Identify the type of motion. Parallel — same direction, same interval kept. Similar — same direction, interval changes. Oblique — one voice moves, the other stays put. Contrary — opposite directions.',
  settingsSchema: [
    { kind: 'multi', key: 'types', label: 'Motion types', options: (['parallel', 'similar', 'oblique', 'contrary'] as MotionType[]).map((m) => ({ value: m, label: MOTION_LABEL[m] })) },
    { kind: 'toggle', key: 'play', label: 'Play both voices' },
  ],
  defaultSettings: { types: ['parallel', 'similar', 'oblique', 'contrary'], play: true },
  generate(settings): ArrQuestion | null {
    const types = (settings.types as MotionType[]) ?? [];
    if (!types.length) return null;
    const target = pick(types);
    const a1 = 67;
    const b1 = 60;
    let a2 = a1;
    let b2 = b1;
    switch (target) {
      case 'parallel': { const d = pick([2, -2, 3, -3]); a2 = a1 + d; b2 = b1 + d; break; }
      case 'similar': { a2 = a1 + 2; b2 = b1 + 4; break; }
      case 'oblique': { a2 = a1 + pick([2, -2]); b2 = b1; break; }
      case 'contrary': { a2 = a1 + 2; b2 = b1 - 2; break; }
    }
    const answer = MOTION_LABEL[classifyMotion([a1, a2], [b1, b2])];
    const choices = types.map((t) => ({ id: MOTION_LABEL[t], label: MOTION_LABEL[t] }));
    return {
      kind: 'mc',
      prompt: {
        text: `Upper voice: ${midiToDisplay(a1, 'sharp')} → ${midiToDisplay(a2, 'sharp')}. Lower voice: ${midiToDisplay(b1, 'sharp')} → ${midiToDisplay(b2, 'sharp')}.`,
      },
      choices,
      answerIds: [answer],
      explanation: `Upper ${a2 > a1 ? 'up' : a2 < a1 ? 'down' : 'static'}, lower ${b2 > b1 ? 'up' : b2 < b1 ? 'down' : 'static'} → ${answer.toLowerCase()} motion.`,
      play: settings.play ? [a1, b1, a2, b2] : undefined,
      playMode: 'sequence',
    };
  },
};

// ---- ARR-16 Melodic Manipulation (MC, pitch operations) ----
type PitchOp = 'retrograde' | 'inversion' | 'transposition';
const OP_LABEL: Record<PitchOp, string> = { retrograde: 'Retrograde', inversion: 'Inversion', transposition: 'Transposition' };

function applyOp(motif: number[], op: PitchOp): number[] {
  switch (op) {
    case 'retrograde':
      return [...motif].reverse();
    case 'inversion':
      return motif.map((m) => 2 * motif[0]! - m);
    case 'transposition':
      return motif.map((m) => m + 5);
  }
}

export const ARR_16: ArrangingExercise = {
  id: 'arr-melodic-manipulation',
  title: 'Melodic Manipulation',
  instruction:
    'You’ll see a short motif and then a transformed version of it. Identify which operation was applied. (This drill covers the pitch operations — retrograde, inversion, transposition — on a whole-note staff.)',
  settingsSchema: [
    { kind: 'multi', key: 'ops', label: 'Operations', options: (['retrograde', 'inversion', 'transposition'] as PitchOp[]).map((o) => ({ value: o, label: OP_LABEL[o] })) },
    { kind: 'stepper', key: 'motifLength', label: 'Motif length', min: 3, max: 8 },
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play both' },
  ],
  defaultSettings: { ops: ['retrograde', 'inversion', 'transposition'], motifLength: 5, presentation: 'staff', play: true },
  generate(settings): ArrQuestion | null {
    const ops = (settings.ops as PitchOp[]) ?? [];
    if (!ops.length) return null;
    const len = Math.max(3, Math.min(8, Number(settings.motifLength) || 5));
    // Regenerate until the applied op is uniquely identifiable among enabled ops.
    for (let attempt = 0; attempt < 40; attempt++) {
      const motif = Array.from({ length: len }, () => pick([60, 62, 64, 65, 67, 69, 71]));
      const op = pick(ops);
      const transformed = applyOp(motif, op);
      const eq = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i]);
      const ambiguous = ops.some((other) => other !== op && eq(applyOp(motif, other), transformed)) || eq(motif, transformed);
      if (ambiguous) continue;
      const choices = ops.map((o) => ({ id: OP_LABEL[o], label: OP_LABEL[o] }));
      return {
        kind: 'mc',
        prompt: {
          text: `Motif: ${motif.map((m) => midiToDisplay(m, 'sharp')).join(' ')} → Transformed: ${transformed.map((m) => midiToDisplay(m, 'sharp')).join(' ')}`,
          melody: settings.presentation === 'staff' ? motif : undefined,
          melody2: settings.presentation === 'staff' ? transformed : undefined,
        },
        choices,
        answerIds: [OP_LABEL[op]],
        explanation: `The motif was transformed by ${OP_LABEL[op].toLowerCase()}.`,
        play: settings.play ? [...motif, ...transformed] : undefined,
        playMode: 'sequence',
      };
    }
    return null;
  },
};

// ---- ARR-14 Reharmonise an Approach Note (stacked, Tier 2) ----
const TECH_OPTIONS = REHARMONISATION_TECHNIQUES.map((t) => ({ value: t.id, label: t.label }));
const TECH_LABEL: Record<ReharmTechnique, string> = Object.fromEntries(
  REHARMONISATION_TECHNIQUES.map((t) => [t.id, t.label]),
) as Record<ReharmTechnique, string>;

export const ARR_14: ArrangingExercise = {
  id: 'arr-approach-reharm',
  title: 'Reharmonise an Approach Note',
  instruction:
    'You’re given a target note with its voicing already in place, an approach note, and a reharmonisation technique. Voice the approach note using that technique. More than one answer is correct — your voicing is checked against the requirements of the technique.',
  settingsSchema: [
    { kind: 'multi', key: 'techniques', label: 'Techniques', options: TECH_OPTIONS },
    { kind: 'multi', key: 'approachTypes', label: 'Approach note types', options: APPROACH_OPTIONS },
    { kind: 'toggle', key: 'playReveal', label: 'Play on reveal' },
  ],
  defaultSettings: { techniques: ['diminished', 'parallel'], approachTypes: ['chromatic', 'scale'], playReveal: true },
  generate(settings): ArrQuestion | null {
    const techniques = (settings.techniques as ReharmTechnique[]) ?? [];
    const approachTypes = (settings.approachTypes as ApproachNoteType[]) ?? [];
    if (!techniques.length || !approachTypes.length) return null;
    // Respect the compatibility matrix.
    const combos: { tech: ReharmTechnique; appr: ApproachNoteType }[] = [];
    for (const tech of techniques) for (const appr of approachTypes) if (isCompatible(appr, tech)) combos.push({ tech, appr });
    if (!combos.length) return null;
    const { tech, appr } = pick(combos);

    const root = pick(ROOTS);
    const targetChord = parseChord(`${root.name}${pick(['ma7', 'mi7', '7'])}`)!;
    const targetVoicing = buildVoicing({ chord: targetChord, leadMidi: pick([72, 74, 76]), type: 'close' }).pitches;
    const targetLead = targetVoicing[0]!;
    const delta = appr === 'scale' ? (Math.random() < 0.5 ? 2 : -2) : Math.random() < 0.5 ? 1 : -1;
    const approachLead = targetLead + delta;

    let reveal: number[];
    if (tech === 'diminished') {
      reveal = [approachLead, approachLead - 3, approachLead - 6, approachLead - 9];
    } else {
      // parallel / dominant / diatonic / free — planing the target voicing by delta.
      reveal = targetVoicing.map((m) => m + delta);
    }

    const grade = (user: number[]) => {
      if (user.some((m) => m == null)) return { correct: false, message: 'Fill in every voice.' };
      const violations: string[] = [];
      if (user[0] !== Math.max(...user)) violations.push('Keep the approach note (lead) on top.');
      const v: Voicing = { chord: targetChord, pitches: user, declaredType: null, instruments: null };
      if (checkFaults(v).some((f) => f.code === 'MINOR_NINTH')) violations.push('There’s a minor 9th inside the voicing.');
      if (tech === 'diminished') {
        const desc = [...user].sort((a, b) => b - a);
        const isDim = desc.every((m, i) => i === 0 || desc[i - 1]! - m === 3);
        if (!(desc[0] === approachLead && isDim && desc.length === 4)) violations.push('Build a diminished 7th downward from the melody note (stacked minor 3rds).');
      } else if (tech === 'parallel') {
        const d = user[0]! - targetLead;
        const parallel = user.every((m, i) => targetVoicing[i] != null && m - targetVoicing[i]! === d);
        if (!parallel) violations.push('Every voice must move by the same interval and direction as the lead.');
      }
      return { correct: violations.length === 0, message: violations.length === 0 ? `Valid ${TECH_LABEL[tech]} reharmonisation.` : violations.join(' ') };
    };

    return {
      kind: 'stacked',
      prompt: {
        text: `Target ${targetChord.canonical} voicing: ${formatVoicingList(targetVoicing, root.spelling)}. Reharmonise the approach note (${midiToDisplay(approachLead, root.spelling)}) using the ${TECH_LABEL[tech]} technique.`,
        chordSymbol: targetChord.canonical,
        spelling: root.spelling,
      },
      chordSymbol: targetChord.canonical,
      spelling: root.spelling,
      voiceCount: reveal.length,
      prefill: [approachLead, ...Array(reveal.length - 1).fill(null)],
      lockedRows: [0],
      grade,
      reveal,
      tier2: true,
    };
  },
};

export const MELODY_EXERCISES = [ARR_13, ARR_14, ARR_15, ARR_16];
