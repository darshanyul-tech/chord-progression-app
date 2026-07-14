import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, stopChannel } from '../../lib/audio/playback';
import { buildProgressionFromGuesses, makePlaceholderProgression, type GuessRowInput } from '../../lib/progression/custom';
import { generateProgression } from '../../lib/progression/generator';
import { degreeOptions, describeBarAnswer, extensionOptions, familyOptions, gradeBarMatch } from '../../lib/progression/grading';
import { schedulePlayback } from '../../lib/progression/playback';
import {
  HARMONY_REGEN_KEYS,
  resolvePracticeSettings,
  type ProgressionSettings,
  type ResolvedProgressionSettings,
} from '../../lib/progression/settings';
import { maxInversionFor, type ProgChord } from '../../lib/progression/theory';
import { useProgressionScoreStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'chord-progressions';

export interface GuessRowState {
  off: number;
  fam: string;
  ext: number;
  inv: number;
}

interface BarResult {
  text: string;
  ok: boolean;
}

function defaultGuessRow(resolved: ResolvedProgressionSettings): GuessRowState {
  const deg = degreeOptions(resolved)[0]!;
  const fam = familyOptions(resolved)[0]!;
  const ext = extensionOptions(resolved)[0]!;
  return { off: Number(deg.value), fam: String(fam.value), ext: Number(ext.value), inv: 0 };
}

function guessRowsToInputs(
  rows: GuessRowState[],
  resolved: ResolvedProgressionSettings,
): GuessRowInput[] {
  const degOpts = degreeOptions(resolved);
  return rows.map((r) => ({
    off: r.off,
    fam: r.fam,
    ext: r.ext,
    inv: resolved.inversions ? r.inv : null,
    romanLabel: degOpts.find((o) => o.value === r.off)?.label ?? '?',
  }));
}

// Ported state machine for legacy generateNew/play/reveal/gradeGuesses/
// custom-mode functions (docs/05-topics/06-chord-progressions.md).
export function useProgressionPractice(settings: ProgressionSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const stats = useProgressionScoreStore((s) => s.stats);
  const recordBar = useProgressionScoreStore((s) => s.recordBar);
  const resetStats = useProgressionScoreStore((s) => s.reset);

  const [progression, setProgression] = useState<ProgChord[]>([]);
  const [resolvedSettings, setResolvedSettings] = useState<ResolvedProgressionSettings>(() =>
    resolvePracticeSettings(settings),
  );
  const [guessRows, setGuessRows] = useState<GuessRowState[]>([]);
  const [results, setResults] = useState<(BarResult | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [activeBar, setActiveBar] = useState<number | 'ref' | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [scoreLine, setScoreLine] = useState(
    'Pick a roman numeral, quality and extension for each bar, then Check Answers.',
  );

  function generateNew(autoStatus: boolean) {
    const resolved = resolvePracticeSettings(settings);
    setResolvedSettings(resolved);
    setRevealed(false);

    if (settings.customMode) {
      const prog = makePlaceholderProgression(resolved);
      setProgression(prog);
      setGuessRows(prog.map(() => defaultGuessRow(resolved)));
      setResults(prog.map(() => null));
      let hint = 'Custom mode: choose roman numeral, quality, and extension per bar, then Play.';
      if (resolved.randomKey) hint += ' Random key: same progression, new key each Play.';
      setScoreLine(hint);
      if (autoStatus) {
        setStatusText(`Custom mode: set chords in Your Guess (${resolved.bars} bars), then Play.`);
        setStatusKind('');
      }
      return;
    }

    const prog = generateProgression(resolved);
    setProgression(prog);
    setGuessRows(prog.map(() => defaultGuessRow(resolved)));
    setResults(prog.map(() => null));
    setScoreLine('Pick a roman numeral, quality and extension for each bar, then Check Answers.');
    if (autoStatus) {
      setStatusText(`New progression generated (${resolved.bars} bars).`);
      setStatusKind('');
    }
  }

  const generateNewRef = useRef(generateNew);
  generateNewRef.current = generateNew;

  // Sync custom-mode guess-row count on bar-count change, preserving entries
  // already made (legacy syncCustomProgressionLength).
  function syncCustomLength() {
    const resolved = resolvePracticeSettings(settings);
    setResolvedSettings(resolved);
    setRevealed(false);
    const prog = makePlaceholderProgression(resolved);
    setProgression(prog);
    setGuessRows((prev) => prog.map((_, i) => prev[i] ?? defaultGuessRow(resolved)));
    setResults(prog.map(() => null));
  }
  const syncCustomLengthRef = useRef(syncCustomLength);
  syncCustomLengthRef.current = syncCustomLength;

  // Initial generate on mount (legacy calls generateNew(false) at boot).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    generateNewRef.current(false);
  }, []);

  // Harmony-affecting settings auto-regenerate (legacy onHarmonySettingChange),
  // even in custom mode (which wipes guess-row entries back to defaults).
  const harmonyRegenKey = HARMONY_REGEN_KEYS.map((k) => JSON.stringify(settings[k])).join('|');
  const skipHarmonyRegenRef = useRef(true);
  useEffect(() => {
    if (skipHarmonyRegenRef.current) {
      skipHarmonyRegenRef.current = false;
      return;
    }
    generateNewRef.current(true);
  }, [harmonyRegenKey]);

  // Bar-count changes: custom mode preserves entries, normal mode regenerates.
  const skipBarsRef = useRef(true);
  useEffect(() => {
    if (skipBarsRef.current) {
      skipBarsRef.current = false;
      return;
    }
    if (settings.customMode) syncCustomLengthRef.current();
    else generateNewRef.current(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.bars]);

  // Toggling custom mode itself regenerates (legacy setCustomMode).
  const skipCustomModeRef = useRef(true);
  useEffect(() => {
    if (skipCustomModeRef.current) {
      skipCustomModeRef.current = false;
      return;
    }
    generateNewRef.current(true);
  }, [settings.customMode]);

  useEffect(() => {
    if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  async function init() {
    const before = audio.status;
    if (before === 'ready' || before === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
    const after: typeof audio.status = audio.status;
    if (after === 'ready') {
      setStatusText('Audio ready. Generate, then Play.');
      setStatusKind('');
    }
  }

  function stop() {
    stopChannel(channelRef.current, audio.sampler);
    setActiveBar(null);
    setStatusText('Stopped.');
    setStatusKind('');
  }

  async function play() {
    if (audioStatus !== 'ready') {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }

    let s: ResolvedProgressionSettings;
    let prog: ProgChord[];

    if (settings.customMode) {
      const resolved = resolvePracticeSettings(settings);
      const built = buildProgressionFromGuesses(guessRowsToInputs(guessRows, resolved), resolved);
      if (!built.ok) {
        setStatusText(built.message!);
        setStatusKind('warn');
        return;
      }
      s = resolved;
      prog = built.prog!;
      setResolvedSettings(s);
      setProgression(prog);
    } else if (!progression.length) {
      s = resolvePracticeSettings(settings);
      prog = generateProgression(s);
      setResolvedSettings(s);
      setProgression(prog);
      setGuessRows(prog.map(() => defaultGuessRow(s)));
      setResults(prog.map(() => null));
      setScoreLine('Pick a roman numeral, quality and extension for each bar, then Check Answers.');
      setRevealed(false);
    } else {
      s = resolvedSettings;
      prog = progression;
    }

    stopChannel(channelRef.current, audio.sampler);
    setStatusText('Playing...');
    setStatusKind('');

    await schedulePlayback(audio.sampler, channelRef.current, audio.now(), s, prog, {
      onBarActive: (index) => setActiveBar(index),
    });

    let doneMsg = revealed ? 'Answer revealed in the bars above.' : 'Playback complete. Reveal when ready.';
    if (settings.customMode && s.randomKey) doneMsg = `Played in ${s.key}. ${doneMsg}`;
    setStatusText(doneMsg);
    setStatusKind('');
  }

  function reveal() {
    if (settings.customMode) {
      const resolved = resolvePracticeSettings(settings);
      const built = buildProgressionFromGuesses(guessRowsToInputs(guessRows, resolved), resolved);
      if (!built.ok) {
        setStatusText(built.message!);
        setStatusKind('warn');
        return;
      }
      setResolvedSettings(resolved);
      setProgression(built.prog!);
    } else if (!progression.length) {
      setStatusText('Generate a progression first.');
      setStatusKind('warn');
      return;
    }
    setRevealed(true);
    setStatusText(settings.customMode ? 'Custom progression revealed.' : 'Answer revealed.');
    setStatusKind('');
  }

  function check() {
    if (settings.customMode) {
      setStatusText(
        'In custom progression mode, Play uses your guess inputs. Turn off Custom to check against a generated progression.',
      );
      setStatusKind('warn');
      return;
    }
    if (!progression.length) {
      setStatusText('Generate a progression first.');
      setStatusKind('warn');
      return;
    }
    const s = resolvedSettings;
    let correct = 0;
    let fnCorrect = 0;
    let tonCorrect = 0;
    const newResults = progression.map((ch, i) => {
      const row = guessRows[i]!;
      const invVal = s.inversions ? row.inv : null;
      const match = gradeBarMatch(ch, row.off, row.fam, row.ext, invVal, s);
      const answer = describeBarAnswer(ch, s);
      if (match.degOk) fnCorrect++;
      if (match.famOk) tonCorrect++;
      if (match.allOk) correct++;
      recordBar({ overallOk: match.allOk, functionOk: match.degOk, tonalityOk: match.famOk });
      return { text: (match.allOk ? '✓ ' : '✗ was ') + answer, ok: match.allOk };
    });
    setResults(newResults);
    const total = progression.length;
    setScoreLine(
      `Last check: ${correct} / ${total} bars perfect${correct === total ? '  — nice!' : ''}  ·  Function ${fnCorrect}/${total}  ·  Tonality ${tonCorrect}/${total}`,
    );
    setRevealed(true);
    setStatusText('Checked your answers. Session totals updated below.');
    setStatusKind('');
  }

  async function playSelection() {
    if (audioStatus !== 'ready') {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    if (!progression.length) {
      setStatusText('Generate a progression first.');
      setStatusKind('warn');
      return;
    }
    const liveExt = settings.extensions;
    const extensions = liveExt.length ? liveExt : resolvedSettings.extensions.length ? resolvedSettings.extensions : [7];
    const s: ResolvedProgressionSettings = {
      ...resolvedSettings,
      tonicFirst: settings.tonicFirst,
      rootless: settings.rootless,
      bouncingBass: settings.bouncingBass,
      inversions: settings.inversions,
      bpm: settings.tempo,
      extensions,
    };
    const built = buildProgressionFromGuesses(guessRowsToInputs(guessRows, s), s);
    if (!built.ok) {
      setStatusText(built.message!);
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    setStatusText(`Playing your selection in ${s.key}...`);
    setStatusKind('');
    await schedulePlayback(audio.sampler, channelRef.current, audio.now(), s, built.prog!, {});
    setStatusText(`Finished playing your selection in ${s.key}.`);
    setStatusKind('');
  }

  function clearGuesses() {
    setGuessRows((prev) => prev.map(() => defaultGuessRow(resolvedSettings)));
    setResults((prev) => prev.map(() => null));
    setScoreLine('Pick a roman numeral, quality and extension for each bar, then Check Answers.');
  }

  function updateGuessRow(i: number, patch: Partial<GuessRowState>) {
    setGuessRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function next() {
    if (!settings.customMode) generateNew(false);
    await play();
  }

  function inversionOptionsFor(i: number): number[] {
    const ch = progression[i];
    const quality = ch ? ch.quality : 'maj7';
    return Array.from({ length: maxInversionFor(quality) + 1 }, (_, k) => k);
  }

  return {
    audioStatus,
    progression,
    resolvedSettings,
    guessRows,
    results,
    revealed,
    activeBar,
    statusText,
    statusKind,
    scoreLine,
    stats,
    init,
    generate: () => generateNew(true),
    play,
    stop,
    reveal,
    check,
    playSelection,
    clearGuesses,
    next,
    updateGuessRow,
    inversionOptionsFor,
    resetScore: resetStats,
  };
}
