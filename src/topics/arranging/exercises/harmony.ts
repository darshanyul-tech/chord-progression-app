import {
  chordScaleForQuality,
  chordTones,
  midiToDisplay,
  parseChord,
  SLASH_CHORD_REASONS,
  UST_TABLE,
  ustRowsForSymbol,
  ustTriadSymbol,
} from '../../../lib/arranging';
import type { ArrangingExercise, ArrQuestion, ChoiceDef } from '../exerciseTypes';
import { QUALITIES, ROOTS } from '../arrCommon';
import { pick, sample, shuffle } from '../rand';

function mc(prompt: string, answer: string, distractors: string[], explanation: string, chordSymbol?: string): ArrQuestion {
  const wrong = sample(distractors.filter((d) => d !== answer), 3);
  const choices: ChoiceDef[] = shuffle([answer, ...wrong]).map((label) => ({ id: label, label }));
  return { kind: 'mc', prompt: { text: prompt, chordSymbol }, choices, answerIds: [answer], explanation };
}

// ---- ARR-09 Upper Structure Triads ----
export const ARR_09: ArrangingExercise = {
  id: 'arr-ust',
  title: 'Upper Structure Triads',
  instruction:
    'Upper structure triads express the extensions and alterations of a dominant chord as a plain triad sitting on top of it. The triad’s root, measured up from the dominant’s root, gives the upper structure number — a D triad over C7 is Upper Structure II. Answer the question about which triad produces which tensions.',
  settingsSchema: [
    { kind: 'multi', key: 'questionTypes', label: 'Question types', options: [
      { value: 'triad-tensions', label: 'Triad → tensions' },
      { value: 'tensions-triad', label: 'Tensions → triad' },
      { value: 'symbol-triad', label: 'Symbol → triad' },
    ] },
    { kind: 'toggle', key: 'includeMinor', label: 'Include minor upper structures' },
    { kind: 'toggle', key: 'showCheatSheet', label: 'Show the cheat sheet' },
  ],
  defaultSettings: { questionTypes: ['triad-tensions', 'tensions-triad'], includeMinor: true, showCheatSheet: false },
  generate(settings): ArrQuestion | null {
    const qts = (settings.questionTypes as string[]) ?? [];
    if (!qts.length) return null;
    const rows = UST_TABLE.filter((r) => (settings.includeMinor ? true : r.quality === 'major') && r.id !== 'bV');
    const root = pick(ROOTS);
    const row = pick(rows);
    const triad = ustTriadSymbol(row, root.pc, root.spelling);
    const domSymbol = `${root.name}7`;
    const qt = pick(qts);
    if (qt === 'triad-tensions') {
      return mc(`Over ${domSymbol}, a ${triad} triad implies which tensions?`, row.tensions, rows.map((r) => r.tensions), `${triad} over ${domSymbol} → ${row.tensions}.`, domSymbol);
    }
    if (qt === 'tensions-triad') {
      return mc(`Which upper triad over ${domSymbol} gives ${row.tensions}?`, triad, rows.map((r) => ustTriadSymbol(r, root.pc, root.spelling)), `${row.tensions} → ${triad}.`, domSymbol);
    }
    // symbol-triad
    const symbol = row.symbol.replace('C', root.name);
    const accepted = ustRowsForSymbol(row.symbol).map((r) => ustTriadSymbol(r, root.pc, root.spelling));
    const answer = accepted[0]!;
    return {
      kind: 'mc',
      prompt: { text: `Which upper structure triad produces ${symbol}?`, chordSymbol: symbol },
      choices: shuffle([answer, ...sample(rows.map((r) => ustTriadSymbol(r, root.pc, root.spelling)).filter((t) => !accepted.includes(t)), 3)]).map((l) => ({ id: l, label: l })),
      answerIds: accepted,
      explanation: `${symbol} comes from ${accepted.join(' or ')}.`,
    };
  },
};

// ---- ARR-10 Slash Chords & Polychords ----
export const ARR_10: ArrangingExercise = {
  id: 'arr-slash-poly',
  title: 'Slash Chords & Polychords',
  instruction:
    'A slash chord puts a bass note other than the root underneath a chord. If there’s no chord quality after the slash, it’s a chord over a bass note. If there is one, it’s a polychord — a chord over another chord. Identify which kind you’re looking at, or why you’d use one.',
  settingsSchema: [
    { kind: 'multi', key: 'questionTypes', label: 'Question types', options: [
      { value: 'which-kind', label: 'Which kind' },
      { value: 'why', label: 'Why use one' },
    ] },
    { kind: 'toggle', key: 'includePolychords', label: 'Include polychords' },
  ],
  defaultSettings: { questionTypes: ['which-kind', 'why'], includePolychords: true },
  generate(settings): ArrQuestion | null {
    const qts = (settings.questionTypes as string[]) ?? [];
    if (!qts.length) return null;
    const qt = pick(qts);
    if (qt === 'why') {
      const answer = pick(SLASH_CHORD_REASONS as unknown as string[]);
      return mc('Why would you use a slash chord here?', answer, SLASH_CHORD_REASONS as unknown as string[], 'Slash chords smooth the bass, notate an exact sound, or simplify a complex symbol.');
    }
    // which-kind
    const upper = pick(ROOTS).name + pick(['ma7', 'mi7', '7']);
    const bassRoot = pick(ROOTS).name;
    const isPoly = settings.includePolychords ? Math.random() < 0.5 : false;
    const symbol = isPoly ? `${upper}/${bassRoot}7` : `${pick(ROOTS).name}ma7/${bassRoot}`;
    const chord = parseChord(symbol)!;
    const answer = chord.isPolychord ? 'Polychord' : 'Chord over a bass note';
    return {
      kind: 'mc',
      prompt: { text: `Is ${symbol} a chord over a bass note, or a polychord?`, chordSymbol: symbol },
      choices: [{ id: 'Chord over a bass note', label: 'Chord over a bass note' }, { id: 'Polychord', label: 'Polychord' }],
      answerIds: [answer],
      explanation: chord.isPolychord ? 'A quality after the slash makes it a polychord.' : 'A plain note after the slash makes it a chord over a bass note.',
    };
  },
};

// ---- ARR-11 Chord Tones & Tensions ----
export const ARR_11: ArrangingExercise = {
  id: 'arr-chord-tones',
  title: 'Chord Tones & Tensions',
  instruction:
    'Questions on chord anatomy: which degree a note is, which tones define a chord’s quality, which are safe to leave out, and which tensions substitute for which chord tones.',
  settingsSchema: [
    { kind: 'multi', key: 'questionTypes', label: 'Question types', options: [
      { value: 'degree', label: 'Degree identification' },
      { value: 'expendable', label: 'Expendability' },
      { value: 'essential', label: 'Quality-defining tones' },
      { value: 'substitution', label: 'Substitution pairs' },
      { value: 'anatomy', label: 'X-Y-Z anatomy' },
    ] },
  ],
  defaultSettings: { questionTypes: ['degree', 'expendable', 'substitution'] },
  generate(settings): ArrQuestion | null {
    const qts = (settings.questionTypes as string[]) ?? [];
    if (!qts.length) return null;
    const qt = pick(qts);
    if (qt === 'expendable') return mc('Which are the most expendable notes in a four-note chord?', 'Root and 5th', ['Root and 5th', '3rd and 7th', '3rd and 5th', 'Root and 7th', '5th and 7th'], 'The bass supplies the root; the 5th is the weakest chord tone.');
    if (qt === 'essential') return mc('Which two chord tones define a chord’s quality and function?', '3rd and 7th', ['3rd and 7th', 'Root and 5th', 'Root and 3rd', '5th and 7th'], 'The 3rd and 7th define quality; the root and 5th are the most expendable.');
    if (qt === 'substitution') {
      const pairs = [{ q: 'the 9th', a: 'the root' }, { q: 'the 13th', a: 'the 5th' }, { q: 'the 6th', a: 'the 7th' }];
      const p = pick(pairs);
      return mc(`In the taught substitution pairs, ${p.q} substitutes for which chord tone?`, p.a, ['the root', 'the 3rd', 'the 5th', 'the 7th'], '9 for root, 13 for 5, 6 for 7.');
    }
    if (qt === 'anatomy') {
      const root = pick(ROOTS);
      const symbol = `${root.name}13(♯11)`;
      return mc(`In ${symbol}, which is the alteration (the Z in X-Y-Z)?`, '♯11', ['♯11', '13', root.name, '♭9'], 'X = triad, Y = seventh/extensions, Z = alterations.', symbol);
    }
    // degree
    const root = pick(ROOTS);
    const q = pick(QUALITIES.slice(0, 4));
    const chord = parseChord(`${root.name}${q.suffix}`)!;
    const tones = chordTones(chord);
    const degEntries = Object.entries(tones);
    const [deg, pc] = pick(degEntries);
    const noteName = midiToDisplay(60 + pc, root.spelling, false);
    return mc(`In ${chord.canonical}, what degree is ${noteName}?`, deg, ['1', '3', '5', '7', '9', '11', '13'], `${noteName} is the ${deg} of ${chord.canonical}.`, chord.canonical);
  },
};

// ---- ARR-12 Chord Scales ----
export const ARR_12: ArrangingExercise = {
  id: 'arr-chord-scales',
  title: 'Chord Scales',
  instruction:
    'A chord scale is a set of stepwise pitches consistent with the sound of a given chord. Name the chord scale for the chord shown.',
  settingsSchema: [
    { kind: 'multi', key: 'qualities', label: 'Chord qualities', options: QUALITIES.slice(0, 4).map((q) => ({ value: q.value, label: q.label })) },
  ],
  settingsNotice:
    'Chord-scale mappings here are PROVISIONAL — the full quality→scale set the unit expects is still to be confirmed (spec §5.5).',
  defaultSettings: { qualities: ['mi7', 'dom7', 'maj7', 'mi7b5'] },
  generate(settings): ArrQuestion | null {
    const qualities = (settings.qualities as string[]) ?? [];
    if (!qualities.length) return null;
    const root = pick(ROOTS);
    const chosen = pick(qualities);
    const q = QUALITIES.find((x) => x.value === chosen)!;
    const chord = parseChord(`${root.name}${q.suffix}`)!;
    const scale = chordScaleForQuality(chord.quality);
    const answer = `${root.name} ${scale.name}`;
    const scaleNames = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian', 'Lydian dominant', 'Altered'];
    return mc(`What chord scale fits ${chord.canonical}?`, answer, scaleNames.map((n) => `${root.name} ${n}`), `${chord.canonical} → ${answer} (provisional).`, chord.canonical);
  },
};

export const HARMONY_EXERCISES = [ARR_09, ARR_10, ARR_11, ARR_12];
