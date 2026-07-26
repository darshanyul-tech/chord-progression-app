import {
  buildVoicing,
  checkLIL,
  classifyRange,
  concertToWritten,
  getInstrument,
  INSTRUMENTS,
  midiToDisplay,
  parseChord,
  sortByScoreOrder,
  writtenToConcert,
  type Instrument,
  type Voicing,
} from '../../../lib/arranging';
import type { ArrangingExercise, ArrQuestion, ChoiceDef } from '../exerciseTypes';
import { formatVoicingList, ROOTS } from '../arrCommon';
import { pick, sample, shuffle } from '../rand';

const DEFAULT_INSTRUMENTS = ['trumpet', 'alto-sax', 'tenor-sax', 'bari-sax', 'trombone'];
const INSTRUMENT_OPTIONS = INSTRUMENTS.filter((i) => i.id !== 'drums').map((i) => ({ value: i.id, label: i.displayName }));

const TRANSPOSITION_LABELS: Record<string, string> = {
  M2: 'A major 2nd higher',
  M6: 'A major 6th higher',
  M9: 'A major 9th higher (octave + M2)',
  M13: 'A major 13th higher (octave + M6)',
  P8: 'Sounds an octave lower than written',
  none: 'Non-transposing',
};

function mc(prompt: string, answer: string, distractors: string[], explanation: string): ArrQuestion {
  const wrong = sample(distractors.filter((d) => d !== answer), 3);
  const choices: ChoiceDef[] = shuffle([answer, ...wrong]).map((label) => ({ id: label, label }));
  return { kind: 'mc', prompt: { text: prompt }, choices, answerIds: [answer], explanation };
}

// ---- ARR-05 Transposition ----
export const ARR_05: ArrangingExercise = {
  id: 'arr-transposition',
  title: 'Transposition',
  instruction:
    'Convert between concert pitch and written pitch for the instrument shown, or answer the question about how that instrument transposes. Remember that key signatures transpose too, and that some instruments use a different clef on a concert score than on the player’s part.',
  settingsSchema: [
    { kind: 'multi', key: 'instruments', label: 'Instruments', options: INSTRUMENT_OPTIONS },
    { kind: 'multi', key: 'questionTypes', label: 'Question types', options: [
      { value: 'pitch', label: 'Pitch conversion' },
      { value: 'interval', label: 'Transposition interval' },
      { value: 'clef', label: 'Clef' },
      { value: 'open-strings', label: 'Open strings' },
    ] },
  ],
  defaultSettings: { instruments: DEFAULT_INSTRUMENTS, questionTypes: ['pitch', 'interval'] },
  generate(settings): ArrQuestion | null {
    const ids = (settings.instruments as string[]) ?? [];
    const qts = (settings.questionTypes as string[]) ?? [];
    if (!ids.length || !qts.length) return null;
    const qt = pick(qts);
    if (qt === 'open-strings') {
      const stringy = ids.map(getInstrument).filter((i): i is Instrument => !!i?.openStrings);
      const inst = stringy.length ? pick(stringy) : getInstrument('bass')!;
      const answer = inst.openStrings!.map((m) => midiToDisplay(m, 'sharp', false)).join('–');
      const wrongs = [inst.openStrings!.slice().reverse().map((m) => midiToDisplay(m, 'sharp', false)).join('–'), 'E–A–D–G–B–E', 'C–G–D–A'];
      return mc(`What are the open strings of the ${inst.displayName}, low to high?`, answer, wrongs, `${inst.displayName}: ${answer}.`);
    }
    const inst = getInstrument(pick(ids))!;
    if (qt === 'interval') {
      const answer = TRANSPOSITION_LABELS[inst.transposition.interval]!;
      return mc(`What is the transposition of the ${inst.displayName}?`, answer, Object.values(TRANSPOSITION_LABELS), `${inst.displayName}: ${answer}.`);
    }
    if (qt === 'clef') {
      const onScore = Math.random() < 0.5;
      const answer = onScore ? inst.clefOnConcertScore : inst.clef;
      const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
      return mc(`Which clef does the ${inst.displayName} use ${onScore ? 'on a concert score' : 'on the transposed part'}?`, cap(answer), ['Treble', 'Bass', 'Alto', 'Tenor'], `${inst.displayName} ${onScore ? '(concert score)' : '(part)'}: ${cap(answer)} clef.`);
    }
    // pitch conversion
    const concert = pick([60, 62, 64, 65, 67, 69, 55, 57, 59]);
    const toWritten = Math.random() < 0.5;
    if (toWritten) {
      const written = concertToWritten(inst, concert);
      const answer = midiToDisplay(written, 'sharp');
      return mc(`Concert ${midiToDisplay(concert, 'sharp')} is written as what for ${inst.displayName}?`, answer, [midiToDisplay(concert, 'sharp'), midiToDisplay(concert + 2, 'sharp'), midiToDisplay(written + 1, 'sharp'), midiToDisplay(written - 2, 'sharp')], `Concert ${midiToDisplay(concert, 'sharp')} → written ${answer}.`);
    }
    const written = concert;
    const sounding = writtenToConcert(inst, written);
    const answer = midiToDisplay(sounding, 'sharp');
    return mc(`Written ${midiToDisplay(written, 'sharp')} for ${inst.displayName} sounds as what concert pitch?`, answer, [midiToDisplay(written, 'sharp'), midiToDisplay(sounding + 2, 'sharp'), midiToDisplay(sounding - 1, 'sharp'), midiToDisplay(written + 2, 'sharp')], `Written ${midiToDisplay(written, 'sharp')} → concert ${answer}.`);
  },
};

// ---- ARR-06 Instrument Ranges (blocked on user data — placeholder ranges) ----
export const ARR_06: ArrangingExercise = {
  id: 'arr-ranges',
  title: 'Instrument Ranges',
  instruction:
    'Decide whether the note shown falls inside the given instrument’s range — and if so, whether it’s in the best range or up in the altissimo.',
  settingsSchema: [
    { kind: 'multi', key: 'instruments', label: 'Instruments', options: INSTRUMENT_OPTIONS },
    { kind: 'toggle', key: 'includeAltissimo', label: 'Include altissimo as a category' },
  ],
  settingsNotice:
    'Range figures here are PLACEHOLDERS — the assessed professional and best-range charts are still to be supplied (spec §5.2). Not yet assessment-accurate.',
  defaultSettings: { instruments: ['alto-sax', 'tenor-sax', 'bari-sax', 'trumpet', 'trombone'], includeAltissimo: true },
  generate(settings): ArrQuestion | null {
    const ids = (settings.instruments as string[]) ?? [];
    if (!ids.length) return null;
    const inst = getInstrument(pick(ids))!;
    const note = pick([inst.range.low - 3, inst.range.low + 2, Math.round((inst.bestRange.low + inst.bestRange.high) / 2), inst.range.high + 3, inst.altissimo?.low ?? inst.range.high]);
    const cls = classifyRange(inst, note);
    const labelMap: Record<string, string> = { best: 'In the best range', 'in-range': 'In range (not best)', altissimo: 'In the altissimo', 'out-of-range': 'Out of range' };
    const answer = labelMap[cls]!;
    const options = Object.values(labelMap);
    return mc(`Is concert ${midiToDisplay(note, 'sharp')} in range for the ${inst.displayName}?`, answer, options, `${midiToDisplay(note, 'sharp')} is ${answer.toLowerCase()} (placeholder data).`);
  },
};

// ---- ARR-07 Lower Interval Limits ----
export const ARR_07: ArrangingExercise = {
  id: 'arr-lil',
  title: 'Lower Interval Limits',
  instruction:
    'Check the voicing for lower interval limit violations. When intervals sit below certain limits they sound muddy and indistinct. Where the bottom note isn’t the root, assume a root underneath and check the voicing against that.',
  settingsSchema: [
    { kind: 'select', key: 'presentation', label: 'Presentation', options: [{ value: 'staff', label: 'Staff' }, { value: 'list', label: 'Text list' }] },
    { kind: 'toggle', key: 'play', label: 'Play voicing' },
  ],
  settingsNotice: 'Implements the three general LIL principles; the full interval-by-interval chart is still to be supplied (spec §5.3).',
  defaultSettings: { presentation: 'staff', play: true },
  generate(settings): ArrQuestion | null {
    const root = pick(ROOTS);
    const chord = parseChord(`${root.name}${pick(['ma7', 'mi7', '7'])}`)!;
    // Half the time, push the voicing low enough to risk a violation.
    const lead = Math.random() < 0.5 ? pick([60, 62, 64]) : pick([70, 72, 74]);
    const pitches = buildVoicing({ chord, leadMidi: lead, type: pick(['close', 'drop-2', 'drop-3']) }).pitches;
    const voicing: Voicing = { chord, pitches, declaredType: null, instruments: null };
    const hasViolation = checkLIL(voicing).length > 0;
    const answer = hasViolation ? 'Yes — a limit is broken' : 'No — it’s within the limits';
    return {
      kind: 'mc',
      prompt: {
        text: `Top to bottom: ${formatVoicingList(pitches, root.spelling)}`,
        chordSymbol: chord.canonical,
        staffPitches: settings.presentation === 'staff' ? pitches : undefined,
        spelling: root.spelling,
      },
      choices: [{ id: 'Yes — a limit is broken', label: 'Yes — a limit is broken' }, { id: 'No — it’s within the limits', label: 'No — it’s within the limits' }],
      answerIds: [answer],
      explanation: hasViolation ? checkLIL(voicing)[0]!.detail + ' (A limit, not an absolute — with intent it can work.)' : 'No lower interval limit is broken here.',
      play: settings.play ? pitches : undefined,
    };
  },
};

// ---- ARR-17 Score Order (drag-to-order, Tier 1) ----
export const ARR_17: ArrangingExercise = {
  id: 'arr-score-order',
  title: 'Score Order',
  instruction: 'Put these instruments into correct score order, top to bottom.',
  settingsSchema: [
    { kind: 'stepper', key: 'poolSize', label: 'Instrument pool size', min: 4, max: 10 },
    { kind: 'toggle', key: 'includeRhythm', label: 'Include rhythm section' },
  ],
  defaultSettings: { poolSize: 7, includeRhythm: true },
  generate(settings): ArrQuestion | null {
    const pool = INSTRUMENTS.filter((i) => (settings.includeRhythm ? true : i.family !== 'rhythm'));
    const n = Math.min(Number(settings.poolSize) || 7, pool.length);
    const chosen = sample(pool, n);
    const correctOrder = sortByScoreOrder(chosen.map((i) => i.id));
    const items = shuffle(chosen).map((i) => ({ id: i.id, label: i.displayName }));
    return {
      kind: 'order',
      prompt: { text: 'Drag into score order, top to bottom.' },
      items,
      correctOrder,
      explanation: `Correct order: ${correctOrder.map((id) => getInstrument(id)!.displayName).join(' → ')}.`,
    };
  },
};

export const ORCHESTRATION_EXERCISES = [ARR_05, ARR_06, ARR_07, ARR_17];
