import { mod12, noteName, pick, random, shuffle } from '../theory';
import {
  FLOW,
  FUNCTIONS,
  applyExtensions,
  chooseInversion,
  chordId,
  degreePc,
  functionDegreePool,
  isMinorTonality,
  pickByVoiceLeading,
  pitchClassSteps,
  qualityParts,
  resolveDegreeQualityRoman,
  scaleOf,
  smoothVoiceLeading,
  chordSymbol,
  type ProgChord,
} from './theory';
import type { ResolvedProgressionSettings } from './settings';

// Ported verbatim from legacy generateProgression() and its helpers
// (docs/05-topics/06-chord-progressions.md).

export function pcToDegree(keyPc: number, pc: number, s: ResolvedProgressionSettings): number | null {
  for (let d = 1; d <= 7; d++) {
    if (degreePc(keyPc, d, s) === pc) return d;
  }
  return null;
}

export function degreeFunction(degree: number): string {
  if (FUNCTIONS.tonic!.indexOf(degree) !== -1) return 'tonic';
  if (FUNCTIONS.subdominant!.indexOf(degree) !== -1) return 'subdominant';
  return 'dominant';
}

export function makeDiatonicChord(degree: number, fnName: string, s: ResolvedProgressionSettings): ProgChord | null {
  const resolved = resolveDegreeQualityRoman(degree, s);
  if (!resolved) return null;
  const quality = applyExtensions(resolved.quality, s.extensions);
  const rootPc = degreePc(s.keyPc, degree, s);
  const rootName = noteName(rootPc);
  const parts = qualityParts(quality);
  return {
    degree,
    fn: fnName,
    rootPc,
    rootName,
    quality,
    rootDegree: degree,
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: resolved.roman,
    inversion: degree === 1 ? 0 : chooseInversion(quality, s),
    secondary: false,
  };
}

export function makeCadenceDominantChord(s: ResolvedProgressionSettings): ProgChord | null {
  if (isMinorTonality(s)) {
    if (s.minorV7) return makeDiatonicChord(5, 'dominant', s);
    if (s.minorVm7) return makeDiatonicChord(5, 'dominant', s);
    return makeDiatonicChord(7, 'dominant', s);
  }
  return makeDiatonicChord(5, 'dominant', s);
}

export function makeBorrowedIv(s: ResolvedProgressionSettings): ProgChord {
  const quality = applyExtensions('m7', s.extensions);
  const rootPc = degreePc(s.keyPc, 4, s);
  const rootName = noteName(rootPc);
  const parts = qualityParts(quality);
  return {
    degree: 4,
    fn: 'subdominant',
    rootPc,
    rootName,
    quality,
    rootDegree: 4,
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: 'iv',
    inversion: chooseInversion(quality, s),
    secondary: false,
  };
}

export function makeSecondaryDominant(targetDegree: number, s: ResolvedProgressionSettings): ProgChord {
  const targetPc = degreePc(s.keyPc, targetDegree, s);
  const domPc = mod12(targetPc + 7);
  const quality = applyExtensions('7', s.extensions);
  const rootName = noteName(domPc);
  const parts = qualityParts(quality);
  const target = scaleOf(s).roman[targetDegree] || String(targetDegree);
  return {
    degree: targetDegree,
    fn: 'dominant',
    rootPc: domPc,
    rootName,
    quality,
    rootDegree: pcToDegree(s.keyPc, domPc, s),
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: `V/${target}`,
    inversion: chooseInversion(quality, s),
    secondary: true,
  };
}

export function makeTritoneSub(targetDegree: number, s: ResolvedProgressionSettings): ProgChord {
  const targetPc = degreePc(s.keyPc, targetDegree, s);
  const subPc = mod12(targetPc + 1);
  const quality = applyExtensions('7', s.extensions);
  const rootName = noteName(subPc);
  const parts = qualityParts(quality);
  const target = scaleOf(s).roman[targetDegree] || String(targetDegree);
  return {
    degree: targetDegree,
    fn: 'dominant',
    rootPc: subPc,
    rootName,
    quality,
    rootDegree: pcToDegree(s.keyPc, subPc, s),
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: `subV/${target}`,
    inversion: chooseInversion(quality, s),
    secondary: true,
    chromatic: true,
  };
}

export function makeAppliedDominant(degree: number, s: ResolvedProgressionSettings): ProgChord {
  const quality = applyExtensions('7', s.extensions);
  const rootPc = degreePc(s.keyPc, degree, s);
  const rootName = noteName(rootPc);
  const parts = qualityParts(quality);
  const base = (scaleOf(s).roman[degree] || String(degree)).toUpperCase();
  return {
    degree,
    fn: 'dominant',
    rootPc,
    rootName,
    quality,
    rootDegree: degree,
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: `${base}7(dom)`,
    inversion: chooseInversion(quality, s),
    secondary: true,
  };
}

export function makeChromaticApproach(next: ProgChord, s: ResolvedProgressionSettings): ProgChord {
  const rootPc = mod12(next.rootPc + 1);
  const quality = applyExtensions('7', s.extensions);
  const rootName = noteName(rootPc);
  const parts = qualityParts(quality);
  const nextDeg = pcToDegree(s.keyPc, next.rootPc, s);
  const targetLabel = nextDeg ? scaleOf(s).roman[nextDeg] : next.rootName;
  return {
    degree: null,
    fn: 'dominant',
    rootPc,
    rootName,
    quality,
    rootDegree: pcToDegree(s.keyPc, rootPc, s),
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: `subV/${targetLabel}`,
    inversion: chooseInversion(quality, s),
    secondary: true,
    chromatic: true,
  };
}

function buildBarChord(
  i: number,
  s: ResolvedProgressionSettings,
  prevFn: string,
  prevChord: ProgChord | null,
): { chord: ProgChord; fn: string; forced: boolean } {
  const prevRootPc = prevChord ? prevChord.rootPc : null;
  const isLast = i === s.bars - 1;
  const isPenultimate = i === s.bars - 2;

  if (s.cadenceEnd && isLast) {
    return { chord: makeDiatonicChord(1, 'tonic', s)!, fn: 'tonic', forced: true };
  }
  if (s.cadenceEnd && isPenultimate) {
    return { chord: makeCadenceDominantChord(s)!, fn: 'dominant', forced: true };
  }
  if (i === 0) {
    return { chord: makeDiatonicChord(1, 'tonic', s)!, fn: 'tonic', forced: true };
  }

  let candidates = FLOW[prevFn] ? FLOW[prevFn]!.slice() : ['tonic'];
  if (!s.useSubdominant) candidates = candidates.filter((f) => f !== 'subdominant');
  if (!candidates.length) candidates = ['tonic', 'dominant'];
  let fnName = pick(candidates);

  let degreePool = functionDegreePool(fnName, s);
  if (fnName === 'subdominant' && !s.useSubdominant) {
    fnName = 'dominant';
    degreePool = functionDegreePool('dominant', s);
  }
  const degree = pickByVoiceLeading(degreePool, (d) => degreePc(s.keyPc, d, s), prevRootPc)!;

  if (!s.diatonicOnly && random() < 0.34) {
    const colours = ['secdom'];
    if (s.useSubdominant && degree !== 1) colours.push('applied');
    if (s.useSubdominant) colours.push('borrowediv');
    const choice = pick(colours);

    if (choice === 'secdom') {
      const targets = [1, 2, 3, 4, 5, 6, 7].filter(
        (t) => pcToDegree(s.keyPc, mod12(degreePc(s.keyPc, t, s) + 7), s) !== null,
      );
      const tgt = pickByVoiceLeading(
        targets.length ? targets : [5],
        (t) => mod12(degreePc(s.keyPc, t, s) + 7),
        prevRootPc,
      )!;
      return { chord: makeSecondaryDominant(tgt, s), fn: 'dominant', forced: false };
    }
    if (choice === 'applied') {
      return { chord: makeAppliedDominant(degree, s), fn: 'dominant', forced: false };
    }
    if (choice === 'borrowediv') {
      return { chord: makeBorrowedIv(s), fn: 'subdominant', forced: false };
    }
  }
  return { chord: makeDiatonicChord(degree, fnName, s)!, fn: fnName, forced: false };
}

export function dedupeAdjacent(prog: ProgChord[], s: ResolvedProgressionSettings): void {
  for (let i = 1; i < prog.length; i++) {
    if (chordId(prog[i]!) !== chordId(prog[i - 1]!)) continue;

    const free = (idx: number) => prog[idx] && !prog[idx]!._forced && !prog[idx]!.chromatic;
    const target = free(i) ? i : free(i - 1) ? i - 1 : i;
    const tPrevId = target > 0 ? chordId(prog[target - 1]!) : null;
    const tNextId = target + 1 < prog.length ? chordId(prog[target + 1]!) : null;

    let degrees = shuffle([1, 2, 3, 4, 5, 6, 7]);
    if (!s.useSubdominant) degrees = degrees.filter((d) => FUNCTIONS.subdominant!.indexOf(d) === -1);
    const prevRoot = target > 0 ? prog[target - 1]!.rootPc : null;
    if (prevRoot != null) {
      degrees.sort(
        (a, b) => pitchClassSteps(prevRoot, degreePc(s.keyPc, a, s)) - pitchClassSteps(prevRoot, degreePc(s.keyPc, b, s)),
      );
    }

    for (const d of degrees) {
      const cand = makeDiatonicChord(d, degreeFunction(d), s);
      if (!cand) continue;
      if (chordId(cand) !== tPrevId && chordId(cand) !== tNextId) {
        cand._forced = prog[target]!._forced;
        prog[target] = cand;
        break;
      }
    }
  }
}

export function insertChromaticChords(prog: ProgChord[], s: ResolvedProgressionSettings): void {
  const count = Math.max(0, Math.min(s.chromaticCount, prog.length));
  if (!count) return;
  const eligible: number[] = [];
  for (let i = 1; i < prog.length - 1; i++) eligible.push(i);
  const chosen = shuffle(eligible).slice(0, Math.min(count, eligible.length));
  chosen
    .sort((a, b) => b - a)
    .forEach((i) => {
      const repl = makeChromaticApproach(prog[i + 1]!, s);
      repl._forced = false;
      prog[i] = repl;
    });
}

export function generateProgression(s: ResolvedProgressionSettings): ProgChord[] {
  const prog: ProgChord[] = [];
  let prevFn = 'start';

  for (let i = 0; i < s.bars; i++) {
    const prevChord = prog.length ? prog[prog.length - 1]! : null;
    let built = buildBarChord(i, s, prevFn, prevChord);
    let attempts = 0;
    while (
      !built.forced &&
      prog.length &&
      chordId(built.chord) === chordId(prog[prog.length - 1]!) &&
      attempts < 24
    ) {
      built = buildBarChord(i, s, prevFn, prevChord);
      attempts++;
    }
    built.chord._forced = built.forced;
    prog.push(built.chord);
    prevFn = built.fn;
  }

  dedupeAdjacent(prog, s);
  if (s.chromaticism) insertChromaticChords(prog, s);
  dedupeAdjacent(prog, s);
  smoothVoiceLeading(prog, s);
  return prog;
}
