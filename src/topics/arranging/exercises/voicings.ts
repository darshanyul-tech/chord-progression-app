import {
  analyse,
  basicVoicingTones,
  buildThreeNote,
  buildVoicing,
  chordTones,
  checkFaults,
  FAMILY_LABELS,
  FAULT_LABELS,
  MECHANICAL_TYPE_LABELS,
  parseChord,
  pitchClass,
  type FaultCode,
  type MechanicalVoicingType,
  type ParsedChord,
  type Voicing,
  type VoicingFamily,
} from '../../../lib/arranging';
import type { ArrangingExercise, ArrQuestion } from '../exerciseTypes';
import { chordSymbol, formatVoicingList, midisMultisetEqual, QUALITIES, ROOTS, rootByPc } from '../arrCommon';
import { pick } from '../rand';

const MECH_TYPES: MechanicalVoicingType[] = ['close', 'close-doubled', 'drop-2', 'drop-3', 'drop-2+4'];
const MECH_OPTIONS = MECH_TYPES.map((t) => ({ value: t, label: MECHANICAL_TYPE_LABELS[t] }));
const QUALITY_OPTIONS = QUALITIES.map((q) => ({ value: q.value, label: q.label }));
const FAMILY_LIST: VoicingFamily[] = ['triad', 'shell', 'quartal', 'quartal-dominant', 'cluster', 'upper-structure-triad'];
const FAMILY_OPTIONS = FAMILY_LIST.map((f) => ({ value: f, label: FAMILY_LABELS[f] }));

function pickChord(qualityValues: string[]): { chord: ParsedChord; symbol: string; spelling: 'sharp' | 'flat' } {
  const root = pick(ROOTS);
  const q = QUALITIES.find((x) => x.value === pick(qualityValues)) ?? QUALITIES[0]!;
  const symbol = chordSymbol(root, q.suffix);
  return { chord: parseChord(symbol)!, symbol, spelling: root.spelling };
}

function pickChordToneLead(chord: ParsedChord, low: number, high: number): number {
  const pcs = basicVoicingTones(chord);
  const candidates: number[] = [];
  for (let m = low; m <= high; m++) if (pcs.includes(pitchClass(m))) candidates.push(m);
  return candidates.length ? pick(candidates) : Math.round((low + high) / 2);
}

// ---- ARR-01 Build a Mechanical Voicing (stacked, Tier 1 / 2) ----
export const ARR_01: ArrangingExercise = {
  id: 'arr-voicing-build',
  title: 'Build a Mechanical Voicing',
  instruction:
    'You’re given a chord symbol, a lead note, and a voicing type. Build the voicing by filling in the remaining voices, top to bottom. Voice 1 is the lead and is already filled in. Hang the chord tones down from the lead note as close as possible within an octave, then apply the drop if the question asks for one.',
  settingsSchema: [
    { kind: 'multi', key: 'types', label: 'Voicing types', options: MECH_OPTIONS },
    { kind: 'multi', key: 'qualities', label: 'Chord qualities', options: QUALITY_OPTIONS },
    {
      kind: 'select',
      key: 'leadMode',
      label: 'Lead note',
      options: [
        { value: 'chord', label: 'Chord tones only' },
        { value: 'diatonic', label: 'Any diatonic note' },
        { value: 'chromatic', label: 'Any chromatic note' },
      ],
    },
    { kind: 'toggle', key: 'tensionSub', label: 'Tension substitution', note: 'With substitution on, more than one answer is correct; answers are checked against the voicing rules instead.' },
    { kind: 'toggle', key: 'playReveal', label: 'Play voicing on reveal' },
  ],
  defaultSettings: {
    types: ['close', 'drop-2', 'drop-3', 'drop-2+4'],
    qualities: ['maj7', 'mi7', 'dom7'],
    leadMode: 'chord',
    tensionSub: false,
    playReveal: true,
  },
  generate(settings): ArrQuestion | null {
    const types = (settings.types as string[]) ?? [];
    const qualities = (settings.qualities as string[]) ?? [];
    if (!types.length || !qualities.length) return null;
    const { chord, spelling } = pickChord(qualities);
    const type = pick(types) as MechanicalVoicingType;
    const leadMode = settings.leadMode as string;
    const tensionSub = Boolean(settings.tensionSub);
    let lead: number;
    if (leadMode === 'chord') lead = pickChordToneLead(chord, 67, 84);
    else if (leadMode === 'diatonic') lead = pick([67, 69, 71, 72, 74, 76, 77, 79]);
    else lead = 67 + Math.floor(Math.random() * 13);

    const built = buildVoicing({ chord, leadMidi: lead, type, options: { allowTensionSubstitution: false } });
    const reveal = built.pitches;
    const voiceCount = reveal.length;

    const grade = (user: number[]) => {
      if (user.some((m) => m == null)) return { correct: false, message: 'Fill in every voice first.' };
      if (!tensionSub) {
        const ok = midisMultisetEqual(user, reveal);
        return {
          correct: ok,
          message: ok ? 'Correct — that matches the mechanical voicing.' : `Not quite. The voicing is ${formatVoicingList(reveal, spelling)}.`,
        };
      }
      // Tier 2 — validate against the rules rather than a single key.
      const v: Voicing = { chord, pitches: user, declaredType: type, instruments: null };
      const violations: string[] = [];
      if (user[0] !== Math.max(...user)) violations.push('The lead must stay on top.');
      if (user.length !== voiceCount) violations.push(`This ${MECHANICAL_TYPE_LABELS[type]} needs ${voiceCount} voices.`);
      const tones = chordTones(chord);
      const available = new Set(Object.values(tones));
      if (!user.every((m) => available.has(pitchClass(m)))) violations.push('Every pitch must be a chord tone or an allowed tension.');
      if (checkFaults(v).some((f) => f.code === 'MINOR_NINTH')) violations.push('Avoid the minor 9th inside the voicing.');
      return {
        correct: violations.length === 0,
        message: violations.length === 0 ? 'Valid — every rule satisfied.' : violations.join(' '),
      };
    };

    return {
      kind: 'stacked',
      prompt: { text: `${MECHANICAL_TYPE_LABELS[type]} on ${chord.canonical}`, chordSymbol: chord.canonical, spelling },
      chordSymbol: chord.canonical,
      spelling,
      voiceCount,
      prefill: [lead, ...Array(voiceCount - 1).fill(null)],
      lockedRows: [0],
      grade,
      reveal,
      tier2: tensionSub,
    };
  },
};

// ---- ARR-02 Identify a Mechanical Voicing (MC, Tier 1) ----
export const ARR_02: ArrangingExercise = {
  id: 'arr-voicing-identify',
  title: 'Identify a Mechanical Voicing',
  instruction:
    'You’ll see the notes of a voicing from top to bottom. Identify which voicing type it is. Close voicings sit within one octave. Open voicings span more than an octave — which voice was dropped tells you which type.',
  settingsSchema: [
    { kind: 'multi', key: 'types', label: 'Voicing types included', options: MECH_OPTIONS },
    { kind: 'multi', key: 'qualities', label: 'Chord qualities', options: QUALITY_OPTIONS },
    { kind: 'toggle', key: 'showChordSymbol', label: 'Show chord symbol' },
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play voicing on question' },
  ],
  defaultSettings: {
    types: ['close', 'drop-2', 'drop-3', 'drop-2+4'],
    qualities: ['maj7', 'mi7', 'dom7'],
    showChordSymbol: true,
    presentation: 'staff',
    play: true,
  },
  generate(settings): ArrQuestion | null {
    const types = (settings.types as string[]) ?? [];
    const qualities = (settings.qualities as string[]) ?? [];
    if (!types.length || !qualities.length) return null;
    const { chord, spelling } = pickChord(qualities);
    const type = pick(types) as MechanicalVoicingType;
    const lead = pickChordToneLead(chord, 70, 79);
    const voicing = buildVoicing({ chord, leadMidi: lead, type });
    const detected = analyse(voicing).detectedTypes.filter((t) => types.includes(t));
    const answerIds = (detected.length ? detected : [type]).map((t) => MECHANICAL_TYPE_LABELS[t]);
    const choices = types.map((t) => ({ id: MECHANICAL_TYPE_LABELS[t as MechanicalVoicingType], label: MECHANICAL_TYPE_LABELS[t as MechanicalVoicingType] }));
    return {
      kind: 'mc',
      prompt: {
        text: `Top to bottom: ${formatVoicingList(voicing.pitches, spelling)}`,
        chordSymbol: settings.showChordSymbol ? chord.canonical : undefined,
        staffPitches: settings.presentation === 'staff' ? voicing.pitches : undefined,
        spelling,
      },
      choices,
      answerIds,
      explanation: `This is a ${answerIds.join(' / ')} voicing (span ${analyse(voicing).span} semitones).`,
      play: settings.play ? voicing.pitches : undefined,
    };
  },
};

// ---- ARR-03 Identify a Three-Note Voicing Type (MC, Tier 1) ----
export const ARR_03: ArrangingExercise = {
  id: 'arr-three-note-identify',
  title: 'Identify a Three-Note Voicing Type',
  instruction:
    'You’ll see a three-note voicing and its chord symbol. Identify which voicing family it belongs to. Triad — 1, 3, 5 only, nothing closer than a minor 3rd. Shell — 3rd and 7th plus one colour tone. Quartal — stacked 4ths. Quartal dominant — a 4th over a tritone. Cluster — a 2nd between two adjacent voices. Upper structure triad — a triad from the upper structure of an extended dominant.',
  settingsSchema: [
    { kind: 'multi', key: 'families', label: 'Families included', options: FAMILY_OPTIONS },
    { kind: 'toggle', key: 'showChordSymbol', label: 'Show chord symbol' },
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play voicing on question' },
  ],
  defaultSettings: { families: ['triad', 'shell', 'quartal', 'cluster'], showChordSymbol: true, presentation: 'staff', play: true },
  generate(settings): ArrQuestion | null {
    const families = (settings.families as VoicingFamily[]) ?? [];
    if (!families.length) return null;
    const family = pick(families);
    // Quartal-dominant & UST require dominant chords; others use a small pool.
    const needsDominant = family === 'quartal-dominant' || family === 'upper-structure-triad';
    const symbol = needsDominant ? `${pick(ROOTS).name}13` : `${pick(ROOTS).name}${pick(['ma7', 'mi7', '7'])}`;
    const chord = parseChord(symbol)!;
    const spelling = rootByPc(chord.root).spelling;
    const top = pickChordToneLead(chord, 72, 79);
    const pitches = buildThreeNote(chord, family, top);
    const voicing: Voicing = { chord, pitches, declaredType: null, instruments: null };
    // Accept any detected family that's actually offered as a choice; a voicing
    // can legitimately read as several families (documented overlaps, §2.4).
    const accepted = analyse(voicing).acceptableFamilies.filter((f) => families.includes(f));
    const answerIds = (accepted.length ? accepted : [family]).map((f) => FAMILY_LABELS[f]);
    const choices = families.map((f) => ({ id: FAMILY_LABELS[f], label: FAMILY_LABELS[f] }));
    return {
      kind: 'mc',
      prompt: {
        text: `Top to bottom: ${formatVoicingList(pitches, spelling)}`,
        chordSymbol: settings.showChordSymbol ? chord.canonical : undefined,
        staffPitches: settings.presentation === 'staff' ? pitches : undefined,
        spelling,
      },
      choices,
      answerIds,
      explanation: `This voicing reads as ${answerIds.join(' / ')}.`,
      play: settings.play ? pitches : undefined,
    };
  },
};

// ---- ARR-04 Build a Three-Note Voicing (stacked, Tier 2) ----
export const ARR_04: ArrangingExercise = {
  id: 'arr-three-note-build',
  title: 'Build a Three-Note Voicing',
  instruction:
    'You’re given a chord symbol, a lead note, and a voicing family. Build a three-note voicing of that family. There’s more than one correct answer here — your voicing is checked against the rules for that family rather than against a single solution.',
  settingsSchema: [
    { kind: 'multi', key: 'families', label: 'Families', options: FAMILY_OPTIONS },
    { kind: 'toggle', key: 'playReveal', label: 'Play on reveal' },
  ],
  defaultSettings: { families: ['shell', 'quartal', 'cluster'], playReveal: true },
  generate(settings): ArrQuestion | null {
    const families = (settings.families as VoicingFamily[]) ?? [];
    if (!families.length) return null;
    const family = pick(families);
    const needsDominant = family === 'quartal-dominant' || family === 'upper-structure-triad';
    const symbol = needsDominant ? `${pick(ROOTS).name}13` : `${pick(ROOTS).name}${pick(['ma7', 'mi7', '7'])}`;
    const chord = parseChord(symbol)!;
    const spelling = rootByPc(chord.root).spelling;
    // Retry the lead until the example voicing is itself clean (no m9 / LIL),
    // so the reveal always passes the same grader the user's answer faces.
    let lead = pickChordToneLead(chord, 72, 79);
    let reveal = buildThreeNote(chord, family, lead);
    for (let attempt = 0; attempt < 12; attempt++) {
      const faults = checkFaults({ chord, pitches: reveal, declaredType: null, instruments: null });
      if (!faults.some((f) => f.code === 'MINOR_NINTH' || f.code === 'LIL_VIOLATION')) break;
      lead = pickChordToneLead(chord, 72, 79);
      reveal = buildThreeNote(chord, family, lead);
    }
    const grade = (user: number[]) => {
      if (user.some((m) => m == null)) return { correct: false, message: 'Fill in all three voices first.' };
      const v: Voicing = { chord, pitches: user, declaredType: null, instruments: null };
      const fams = analyse(v).acceptableFamilies;
      const faults = checkFaults(v);
      const violations: string[] = [];
      if (!fams.includes(family)) violations.push(`This isn’t a valid ${FAMILY_LABELS[family]} voicing.`);
      if (user[0] !== Math.max(...user)) violations.push('Keep the lead on top.');
      if (faults.some((f) => f.code === 'MINOR_NINTH')) violations.push('There’s a minor 9th inside the voicing.');
      if (faults.some((f) => f.code === 'LIL_VIOLATION')) violations.push('A lower interval limit is broken.');
      return {
        correct: violations.length === 0,
        message: violations.length === 0 ? `Valid ${FAMILY_LABELS[family]} voicing.` : violations.join(' '),
        violations: violations.length ? violations : undefined,
      };
    };
    return {
      kind: 'stacked',
      prompt: { text: `Build a ${FAMILY_LABELS[family]} voicing on ${chord.canonical}`, chordSymbol: chord.canonical, spelling },
      chordSymbol: chord.canonical,
      spelling,
      voiceCount: 3,
      prefill: [lead, null, null],
      lockedRows: [0],
      grade,
      reveal,
      tier2: true,
    };
  },
};

// ---- ARR-08 Spot the Error (multi-select, Tier 1) ----
const FAULT_CODES: FaultCode[] = ['MINOR_NINTH', 'LIL_VIOLATION', 'SECOND_ON_TOP', 'EXCESSIVE_GAP', 'VOICE_CROSSING', 'OUT_OF_RANGE', 'DOUBLED_THIRD'];
const FAULT_OPTIONS = FAULT_CODES.map((c) => ({ value: c, label: FAULT_LABELS[c] }));

function injectFault(chord: ParsedChord, base: number[], code: FaultCode): number[] {
  const p = [...base];
  switch (code) {
    case 'MINOR_NINTH':
      p[1] = p[0]! - 13; // second voice a m9 below the lead
      break;
    case 'EXCESSIVE_GAP':
      p[1] = p[0]! - 11; // >M6 between top two
      break;
    case 'SECOND_ON_TOP':
      p[1] = p[0]! - 2;
      break;
    case 'DOUBLED_THIRD': {
      const third = chordTones(chord)['3'];
      if (third != null) p[p.length - 1] = p[0]! - 12; // rough — handled by generator retry
      break;
    }
    case 'LIL_VIOLATION':
      return p.map((m) => m - 24); // push the whole voicing very low
    default:
      break;
  }
  return p.sort((a, b) => b - a);
}

export const ARR_08: ArrangingExercise = {
  id: 'arr-spot-error',
  title: 'Spot the Error',
  instruction:
    'Look over the voicing and select every problem you can find. Some voicings have nothing wrong with them. Check for: minor 9th intervals inside the voicing, lower interval limit violations, a 2nd between the top two voices, a gap wider than a major 6th between adjacent voices, crossed voices, and doubled thirds.',
  settingsSchema: [
    { kind: 'multi', key: 'faults', label: 'Faults that can appear', options: FAULT_OPTIONS },
    { kind: 'toggle', key: 'includeClean', label: 'Include clean voicings' },
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play voicing' },
  ],
  defaultSettings: { faults: ['MINOR_NINTH', 'LIL_VIOLATION', 'EXCESSIVE_GAP', 'SECOND_ON_TOP'], includeClean: true, presentation: 'staff', play: true },
  generate(settings): ArrQuestion | null {
    const enabled = (settings.faults as FaultCode[]) ?? [];
    if (!enabled.length) return null;
    const { chord, spelling } = pickChord(['maj7', 'mi7', 'dom7']);
    const base = buildVoicing({ chord, leadMidi: pickChordToneLead(chord, 67, 76), type: pick(['close', 'drop-2']) }).pitches;
    const clean = settings.includeClean && Math.random() < 0.25;
    let pitches = base;
    if (!clean) {
      const code = pick(enabled);
      pitches = injectFault(chord, base, code);
    }
    const voicing: Voicing = { chord, pitches, declaredType: null, instruments: null };
    const correctIds = checkFaults(voicing)
      .filter((f) => f.severity === 'violation' && enabled.includes(f.code))
      .map((f) => f.code as string);
    const uniqueCorrect = [...new Set(correctIds)];
    const choices = [...enabled.map((c) => ({ id: c, label: FAULT_LABELS[c] })), { id: 'NONE', label: 'Nothing wrong' }];
    return {
      kind: 'multi',
      prompt: {
        text: `Top to bottom: ${formatVoicingList(pitches, spelling)}`,
        chordSymbol: chord.canonical,
        staffPitches: settings.presentation === 'staff' ? pitches : undefined,
        spelling,
      },
      choices,
      correctIds: uniqueCorrect.length ? uniqueCorrect : ['NONE'],
      explanation: uniqueCorrect.length ? `Faults: ${uniqueCorrect.map((c) => FAULT_LABELS[c as FaultCode]).join(', ')}.` : 'This voicing is clean.',
      play: settings.play ? pitches : undefined,
      playCorrected: uniqueCorrect.length ? base : undefined,
    };
  },
};

// ---- ARR-18 Identify a Voicing by Ear (MC, Tier 1) ----
export const ARR_18: ArrangingExercise = {
  id: 'arr-voicing-by-ear',
  title: 'Identify a Voicing by Ear',
  instruction:
    'Listen to the voicing and answer the question. You can replay it as often as you like — only your first answer is scored.',
  settingsSchema: [
    { kind: 'select', key: 'questionType', label: 'Question type', options: [{ value: 'open-close', label: 'Open or close' }, { value: 'type', label: 'Voicing type' }, { value: 'count', label: 'How many distinct pitches' }] },
    { kind: 'multi', key: 'types', label: 'Voicing types included', options: MECH_OPTIONS },
    { kind: 'toggle', key: 'showChordSymbol', label: 'Show chord symbol' },
  ],
  defaultSettings: { questionType: 'open-close', types: ['close', 'drop-2', 'drop-2+4'], showChordSymbol: true },
  generate(settings): ArrQuestion | null {
    const types = (settings.types as string[]) ?? [];
    if (!types.length) return null;
    const { chord } = pickChord(['maj7', 'mi7', 'dom7']);
    const type = pick(types) as MechanicalVoicingType;
    const voicing = buildVoicing({ chord, leadMidi: pickChordToneLead(chord, 72, 79), type });
    const qt = settings.questionType as string;
    let choices: { id: string; label: string }[];
    let answerIds: string[];
    let promptText: string;
    if (qt === 'open-close') {
      const isOpen = analyse(voicing).span > 12;
      choices = [{ id: 'Close', label: 'Close' }, { id: 'Open', label: 'Open' }];
      answerIds = [isOpen ? 'Open' : 'Close'];
      promptText = 'Is this an open or a close voicing?';
    } else if (qt === 'count') {
      const distinct = new Set(voicing.pitches.map(pitchClass)).size;
      choices = [3, 4, 5].map((n) => ({ id: String(n), label: `${n} pitches` }));
      answerIds = [String(distinct)];
      promptText = 'How many distinct pitches do you hear?';
    } else {
      choices = types.map((t) => ({ id: MECHANICAL_TYPE_LABELS[t as MechanicalVoicingType], label: MECHANICAL_TYPE_LABELS[t as MechanicalVoicingType] }));
      answerIds = analyse(voicing).detectedTypes.filter((t) => types.includes(t)).map((t) => MECHANICAL_TYPE_LABELS[t]);
      promptText = 'Which voicing type is this?';
    }
    return {
      kind: 'mc',
      prompt: { text: promptText, chordSymbol: settings.showChordSymbol ? chord.canonical : undefined },
      choices,
      answerIds: answerIds.length ? answerIds : [choices[0]!.id],
      explanation: `It was a ${MECHANICAL_TYPE_LABELS[voicing.declaredType ?? type]}.`,
      play: voicing.pitches,
    };
  },
};

// ---- ARR-19 Omit & Skip Techniques (stacked, Tier 1 skip / Tier 2 omit) ----
export const ARR_19: ArrangingExercise = {
  id: 'arr-omit-skip',
  title: 'Omit & Skip Techniques',
  instruction:
    'Two techniques for handling awkward cases. The skip rule — when the lead note isn’t a chord tone, skip the chord tone immediately beneath it and assign the next two chord tones to the remaining voices. The omit technique — to reduce a four-note close voicing to three voices, drop one of the lower voices. "Omit 2" removes the second note down from the top. Which one you omit depends on context, so more than one answer can be right.',
  settingsSchema: [
    { kind: 'select', key: 'technique', label: 'Technique', options: [{ value: 'skip', label: 'Skip rule' }, { value: 'omit', label: 'Omit technique' }] },
    { kind: 'multi', key: 'qualities', label: 'Chord qualities', options: QUALITY_OPTIONS.slice(0, 3) },
    { kind: 'toggle', key: 'playReveal', label: 'Play on reveal' },
  ],
  defaultSettings: { technique: 'skip', qualities: ['maj7', 'mi7', 'dom7'], playReveal: true },
  generate(settings): ArrQuestion | null {
    const qualities = (settings.qualities as string[]) ?? [];
    if (!qualities.length) return null;
    const { chord, spelling } = pickChord(qualities);
    const technique = settings.technique as string;
    if (technique === 'skip') {
      // Non-chord-tone lead → deterministic 4-voice skip result.
      const lead = pick([69, 71, 74, 76]); // likely tensions/diatonic notes
      const isChordTone = basicVoicingTones(chord).includes(pitchClass(lead));
      const leadMidi = isChordTone ? lead + 1 : lead;
      const reveal = buildVoicing({ chord, leadMidi, type: 'close' }).pitches;
      const grade = (user: number[]) => {
        if (user.some((m) => m == null)) return { correct: false, message: 'Fill in every voice.' };
        const ok = midisMultisetEqual(user, reveal);
        return { correct: ok, message: ok ? 'Correct — skip rule applied correctly.' : `The skip result is ${formatVoicingList(reveal, spelling)}.` };
      };
      return {
        kind: 'stacked',
        prompt: { text: `Apply the skip rule on ${chord.canonical}`, chordSymbol: chord.canonical, spelling },
        chordSymbol: chord.canonical,
        spelling,
        voiceCount: reveal.length,
        prefill: [leadMidi, ...Array(reveal.length - 1).fill(null)],
        lockedRows: [0],
        grade,
        reveal,
        tier2: false,
      };
    }
    // Omit technique — Tier 2: reduce a 4-note close voicing to 3.
    const lead = pickChordToneLead(chord, 72, 79);
    const close = buildVoicing({ chord, leadMidi: lead, type: 'close' }).pitches;
    const reveal = buildVoicing({ chord, leadMidi: lead, type: 'close', options: { omit: 3 } }).pitches;
    const grade = (user: number[]) => {
      if (user.some((m) => m == null)) return { correct: false, message: 'Fill in all three voices.' };
      const sortedUser = [...user].sort((a, b) => b - a);
      const violations: string[] = [];
      if (user[0] !== Math.max(...user)) violations.push('Keep the lead on top.');
      for (let i = 0; i < sortedUser.length - 1; i++) if (sortedUser[i]! - sortedUser[i + 1]! < 3) violations.push('Avoid intervals smaller than a 3rd between adjacent voices.');
      const tones = chordTones(chord);
      const pcs = new Set(user.map(pitchClass));
      if (tones['3'] != null && !pcs.has(tones['3'])) violations.push('Keep the 3rd.');
      if (tones['7'] != null && !pcs.has(tones['7'])) violations.push('Keep the 7th.');
      const drawnFromClose = user.every((m) => close.includes(m));
      if (!drawnFromClose) violations.push('Use three notes from the close voicing.');
      return { correct: violations.length === 0, message: violations.length === 0 ? 'Valid omission.' : [...new Set(violations)].join(' ') };
    };
    return {
      kind: 'stacked',
      prompt: { text: `Omit one lower voice from the close voicing on ${chord.canonical}. Close voicing: ${formatVoicingList(close, spelling)}`, chordSymbol: chord.canonical, spelling },
      chordSymbol: chord.canonical,
      spelling,
      voiceCount: 3,
      prefill: [lead, null, null],
      lockedRows: [0],
      grade,
      reveal,
      tier2: true,
    };
  },
};

export const VOICING_EXERCISES = [ARR_01, ARR_02, ARR_03, ARR_04, ARR_08, ARR_18, ARR_19];
