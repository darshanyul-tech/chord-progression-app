import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { audio } from '../../lib/audio/engine';
import { disconnectScheduled, scheduleMetroClick, type ScheduledNode } from '../../lib/audio/percussion';
import { generateMelody } from '../../lib/melody/generator';
import { firstDifferingMeasure, pitchedMeasuresEqual } from '../../lib/melody/grading';
import type { MelodicDictationSettings } from '../../lib/melody/settings';
import { spellMidi } from '../../lib/melody/spelling';
import { keyById, resolveRangeWindow, tiePreview, type Clef, type KeyDef, type NoteSpelling, type PitchedMeasure } from '../../lib/melody/theory';
import { defaultRestMeasure, fillGaps, type RestAdapter } from '../../lib/notation/gaps';
import { findPrecedingNote, resolvePlacementBeat } from '../../lib/notation/placement';
import { candidateBeats, DUR_LABELS, getActiveDurations } from '../../lib/rhythm/generator';
import { durationClose, durationFitsBar, gridStep, maxNotesOfDuration, metricPulseBeats, metricPulseCount, type TimeSigInfo } from '../../lib/rhythm/time';
import { midiToNoteName } from '../../lib/theory';
import { prefersReducedMotion, REDUCED_MOTION_INTERVAL_SEC } from '../../lib/motion';
import type { StatusKind } from '../../components/StatusLine';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'melodic-dictation';
const TRIAD_DUR_MS = 1200;

interface PlacementRecord {
  measureIndex: number;
  beat: number;
}

interface MelodyChannel {
  playbackGen: number;
  timers: number[];
  scheduledNodes: ScheduledNode[];
  rafId: number | null;
}

function newChannel(): MelodyChannel {
  return { playbackGen: 0, timers: [], scheduledNodes: [], rafId: null };
}

interface PlaybackModel {
  key: KeyDef;
  clef: Clef;
  timeSig: TimeSigInfo;
  numMeasures: number;
  measures: PitchedMeasure[];
}

/** Tonic (I/i) triad anchored to the clef's reference octave (§4 key orientation). */
function tonicTriadMidis(key: KeyDef, clef: Clef): number[] {
  const refLow = clef === 'treble' ? 60 : 48;
  const root = refLow + key.tonicPc;
  const third = key.mode === 'major' ? root + 4 : root + 3;
  return [root, third, root + 7];
}

// A bar should never have unaccounted-for space. Every mutation that can
// leave a hole — a fresh/cleared/undone measure, or a direct-hit replace
// whose new (possibly smaller) duration only partially covers whatever it
// cleared, e.g. an eighth note replacing one beat of a quarter rest and
// leaving the other half uncovered — runs its result through the shared
// lib/notation/gaps.ts fillGaps, which re-derives any missing span as
// default rests at the meter's pulse. This adapter is the only melodic-
// specific plug-in that framework needs (PitchedNote.rest+midi vs rhythm's
// RhythmNote.isRest — see rhythm-dictation/usePractice.ts's own).
const melodyRestAdapter: RestAdapter<PitchedMeasure[number]> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.rest,
  makeRest: (beat, duration) => ({ beat, duration, rest: true, midi: null }),
};

export function useMelodicPractice(settings: MelodicDictationSettings) {
  const audioStatus = useAudioReady();
  const isActive = useIsActiveTopic(TOPIC_ID);
  const channelRef = useRef<MelodyChannel>(newChannel());

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [key, setKey] = useState<KeyDef>(() => keyById(settings.key));
  const [clef, setClef] = useState<Clef>(settings.clef === 'random' ? 'treble' : settings.clef);
  const [timeSig, setTimeSig] = useState<TimeSigInfo>({ beatsPerBar: 4, beatValue: 4, measureBeats: 4 });
  const [numMeasures, setNumMeasures] = useState(settings.measures);
  const [correctMeasures, setCorrectMeasures] = useState<PitchedMeasure[]>([]);
  const [userMeasures, setUserMeasures] = useState<PitchedMeasure[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [cursorBeat, setCursorBeat] = useState<number | null>(null);
  const [cursorMidi, setCursorMidi] = useState<number | null>(null);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const [placementHistory, setPlacementHistory] = useState<PlacementRecord[]>([]);
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const [isDotActive, setIsDotActive] = useState(false);
  const [isTieActive, setIsTieActive] = useState(false);
  const [armedAccidental, setArmedAccidental] = useState<'' | '#' | 'b'>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [playbackFraction, setPlaybackFraction] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');

  const activeDurations = getActiveDurations(settings.durations, false, timeSig.measureBeats); // triplets off (§3.2)
  const gridStepVal = gridStep(activeDurations);

  function clearAllTimers() {
    const ch = channelRef.current;
    ch.timers.forEach((t) => clearTimeout(t));
    ch.timers = [];
  }

  function stopPlayback() {
    channelRef.current.playbackGen++;
    clearAllTimers();
    disconnectScheduled(channelRef.current.scheduledNodes);
    if (channelRef.current.rafId !== null) {
      cancelAnimationFrame(channelRef.current.rafId);
      channelRef.current.rafId = null;
    }
    try {
      audio.sampler?.releaseAll(0);
    } catch {
      /* noop */
    }
    setIsPlaying(false);
    setPlaybackFraction(null);
  }

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) stopPlayback();
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stopPlayback, []);

  function runPlayback(model: PlaybackModel) {
    if (audio.status !== 'ready' || !audio.sampler) return;
    stopPlayback();
    const channel = channelRef.current;
    const playGen = channel.playbackGen;
    const ctx = audio.rawContext();
    if (ctx.state === 'suspended' && 'resume' in ctx) (ctx as AudioContext).resume();
    setIsPlaying(true);
    setHasListened(true);

    const bpm = settings.tempo;
    const spb = 60 / bpm;
    const pulse = metricPulseBeats(model.timeSig.beatValue, model.timeSig.beatsPerBar);
    const countInPulses = metricPulseCount(model.timeSig.measureBeats, pulse);
    const countInDurMs = countInPulses * pulse * spb * 1000;

    const schedule = (delayMs: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (channel.playbackGen !== playGen) return;
        fn();
      }, Math.max(0, delayMs));
      channel.timers.push(id);
    };

    // Key orientation: tonic triad (§4), then a meter-aware one-bar count-in.
    schedule(50, () => {
      const triad = tonicTriadMidis(model.key, model.clef).map(midiToNoteName);
      audio.sampler!.triggerAttackRelease(triad, 1.2, audio.now(), 0.75);
    });
    for (let b = 0; b < countInPulses; b++) {
      schedule(50 + TRIAD_DUR_MS + b * pulse * spb * 1000, () => {
        scheduleMetroClick(ctx, ctx.currentTime, b === 0, 60, channel.scheduledNodes);
      });
    }

    const rhythmStartMs = 50 + TRIAD_DUR_MS + countInDurMs;
    let measureStartMs = rhythmStartMs;
    model.measures.forEach((bar) => {
      bar.forEach((n) => {
        if (!n.rest && n.midi !== null) {
          const noteName = midiToNoteName(n.midi);
          const whenMs = measureStartMs + n.beat * spb * 1000;
          const durSec = n.duration * spb * 0.9;
          schedule(whenMs, () => {
            audio.sampler!.triggerAttackRelease(noteName, durSec, audio.now(), 0.85);
          });
        }
      });
      measureStartMs += model.timeSig.measureBeats * spb * 1000;
    });

    const totalMs = rhythmStartMs + model.numMeasures * model.timeSig.measureBeats * spb * 1000;
    schedule(totalMs + 150, () => {
      setIsPlaying(false);
      setPlaybackFraction(null);
    });

    const perfStart = performance.now();
    let lastCursorUpdateMs = -Infinity;
    const tick = () => {
      if (channel.playbackGen !== playGen) return;
      const elapsed = performance.now() - perfStart;
      if (elapsed >= rhythmStartMs && elapsed <= totalMs) {
        if (!prefersReducedMotion() || elapsed - lastCursorUpdateMs >= REDUCED_MOTION_INTERVAL_SEC * 1000) {
          lastCursorUpdateMs = elapsed;
          setPlaybackFraction(Math.min(1, Math.max(0, (elapsed - rhythmStartMs) / (totalMs - rhythmStartMs))));
        }
      } else {
        setPlaybackFraction(null);
      }
      if (elapsed < totalMs) {
        channel.rafId = requestAnimationFrame(tick);
      } else {
        channel.rafId = null;
      }
    };
    channel.rafId = requestAnimationFrame(tick);
  }

  function startPlayback() {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (audioStatus !== 'ready') return;
    runPlayback({ key, clef, timeSig, numMeasures, measures: correctMeasures });
  }

  function replay() {
    stopPlayback();
    if (audioStatus !== 'ready') return;
    runPlayback({ key, clef, timeSig, numMeasures, measures: correctMeasures });
  }

  function generateQuestion(autoPlay = true) {
    stopPlayback();
    const generated = generateMelody(settings);
    const pulse = metricPulseBeats(generated.timeSig.beatValue, generated.timeSig.beatsPerBar);
    setKey(generated.key);
    setClef(generated.clef);
    setTimeSig(generated.timeSig);
    setNumMeasures(settings.measures);
    setCorrectMeasures(generated.measures);
    setUserMeasures(
      Array.from({ length: settings.measures }, () => defaultRestMeasure(generated.timeSig.measureBeats, pulse, melodyRestAdapter)),
    );
    setHasSubmitted(false);
    setIsCorrect(false);
    setActiveMeasureIndex(0);
    setPlacementHistory([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    setHasListened(false);
    if (autoPlay && audio.status === 'ready') {
      window.setTimeout(
        () =>
          runPlayback({
            key: generated.key,
            clef: generated.clef,
            timeSig: generated.timeSig,
            numMeasures: settings.measures,
            measures: generated.measures,
          }),
        450,
      );
    }
  }

  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    generateQuestion(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText('Audio ready. Press Play melody.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  function effectiveDuration(base: number): number {
    return isDotActive ? base * 1.5 : base;
  }

  function previewPitch(midi: number) {
    if (!settings.previewOnPlace || audio.status !== 'ready' || !audio.sampler) return;
    audio.sampler.triggerAttackRelease(midiToNoteName(midi), 0.35, audio.now());
  }

  function placeNoteAt(
    measureIndex: number,
    rawBeat: number,
    duration: number,
    isRest: boolean,
    midi: number | null,
    spellingOverride?: NoteSpelling,
  ) {
    if (hasSubmitted) return;
    const dur = effectiveDuration(duration);
    const measure = userMeasures[measureIndex];
    if (!measure) return;
    const cap = timeSig.measureBeats;
    const reject = () => {
      setFlashMeasure(measureIndex);
      window.setTimeout(() => setFlashMeasure(null), 280);
    };
    if (!durationFitsBar(dur, cap)) {
      reject();
      return;
    }
    // Resolve the click/cursor's raw beat estimate into either a direct hit
    // on an existing note (edit in place) or the nearest free slot the armed
    // duration actually fits in — a gap click never silently replaces a
    // neighbour to make room (docs/12-melodic-dictation-fixes.md MD-3 /
    // RC-3), since resolvePlacementBeat only ever returns free slots there.
    const resolved = resolvePlacementBeat(measure, rawBeat, dur, cap, gridStepVal);
    if (!resolved) {
      reject();
      return;
    }
    const { beat, isReplace } = resolved;
    const end = beat + dur;
    // A direct hit is a deliberate "put this note here instead" — unlike a
    // gap click, it's allowed to replace whatever the new (possibly larger)
    // duration now spans, not just the one note originally clicked. Only
    // reject if the new duration itself can't fit the bar from that beat.
    if (isReplace && end > cap + 0.001) {
      reject();
      return;
    }
    // A tied note sounds into the note in front of it — so if the note
    // immediately preceding this position is tied, the note being placed
    // here is that tie's other end and must sound the same pitch; inherit
    // it (and its spelling) regardless of which line was clicked. Shares
    // tiePreview with the hover ghost so preview and commit can't disagree.
    // (Arming Tie for *this* note is separate — it just tags the new note
    // itself as tied-forward; see the `tied` field on the note below.)
    let effectiveMidi = midi;
    let inheritedSpelling: NoteSpelling | undefined;
    let inheritedFromTie = false;
    if (!isRest && midi !== null) {
      const preview = tiePreview(userMeasures, measureIndex, beat, midi);
      if (preview.fromTiedPredecessor) {
        effectiveMidi = preview.midi;
        inheritedSpelling = preview.spelling;
        inheritedFromTie = true;
      }
    }
    // Clamp clicks far above/below the staff to the current range window
    // instead of placing an absurd pitch — flash to signal the clamp.
    let placedMidi = effectiveMidi;
    let placedSpelling = inheritedFromTie ? inheritedSpelling : spellingOverride;
    if (!isRest && effectiveMidi !== null) {
      const rangeWindow = resolveRangeWindow(key, clef, settings.range);
      const clamped = Math.max(rangeWindow.lowMidi, Math.min(rangeWindow.highMidi, effectiveMidi));
      if (clamped !== effectiveMidi) {
        placedMidi = clamped;
        // The override was pinned to a pitch that's no longer valid once
        // clamped — fall through to the pc-based fallback below instead.
        placedSpelling = undefined;
        setFlashMeasure(measureIndex);
        window.setTimeout(() => setFlashMeasure(null), 280);
      }
    }
    // Keyboard placement has no natural-letter cursor to pin a spelling
    // override to (moveCursorPitch walks raw semitones) — fall back to the
    // key/pc-based tie-break, still honoring the armed accidental where the
    // pitch class is genuinely ambiguous (spelling.ts's spellMidi).
    if (!isRest && placedMidi !== null && !placedSpelling && armedAccidental) {
      const spelled = spellMidi(placedMidi, key, armedAccidental);
      if (spelled.accidental) placedSpelling = { letter: spelled.letter, accidental: spelled.accidental, octave: spelled.octave };
    }
    // Gap-fill placements never overlap anything (resolvePlacementBeat only
    // returns beats that fit clean), so this filter is a no-op there; on a
    // direct hit it clears every note the new, possibly-larger span now covers.
    const overlaps = (n: { beat: number; duration: number }) => beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001;
    const removedBeats = measure.filter(overlaps).map((n) => n.beat);
    const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
    setUserMeasures((prev) =>
      prev.map((m, i) =>
        i === measureIndex
          ? fillGaps(
              [
                ...m.filter((n) => !overlaps(n)),
                {
                  beat,
                  duration: dur,
                  rest: isRest,
                  midi: isRest ? null : placedMidi,
                  spelling: isRest ? undefined : placedSpelling,
                  // Tie armed: this new note itself is the tied one — its
                  // curve leads forward to whatever gets placed next (a
                  // pending partial tie until then; lib/notation/ties.ts).
                  tied: !isRest && isTieActive ? true : undefined,
                },
              ],
              cap,
              pulse,
              melodyRestAdapter,
            )
          : m,
      ),
    );
    setPlacementHistory((prev) => [
      ...prev.filter(
        (p) => !(p.measureIndex === measureIndex && (durationClose(p.beat, beat) || removedBeats.some((b) => durationClose(b, p.beat)))),
      ),
      { measureIndex, beat },
    ]);
    setActiveMeasureIndex(measureIndex);
    if (!isRest && placedMidi !== null) previewPitch(placedMidi);
  }

  // Keyboard placement fallback (09-improvement-plan.md §14.1): mirrors
  // rhythm-dictation's insertion cursor, plus a pitch dimension (Up/Down
  // select a staff line before Enter commits, per the plan's melodic note).
  //
  // Steps through the union of (a) free beats the armed duration could fill
  // and (b) existing notes' own beats (so the cursor can still reach a note
  // to replace it), always moving to the single nearest steppable beat in
  // the travel direction — never "nearest overall, then +1" (that skipped
  // the very next beat whenever the cursor wasn't itself sitting on a
  // candidate, e.g. right after a placement; docs/12-melodic-dictation-
  // fixes.md MD-3 item 4, found via live verification of this fix).
  function moveCursorBeat(delta: number) {
    if (hasSubmitted) return;
    setCursorBeat((prev) => {
      const cur = prev ?? 0;
      const cap = timeSig.measureBeats;
      const measure = userMeasures[activeMeasureIndex] ?? [];
      const spans = measure.map((n) => ({ start: n.beat, end: n.beat + n.duration }));
      const dur = effectiveDuration(armedDuration);
      const freeCandidates = candidateBeats(dur, spans, cap, gridStepVal);
      const steppable = Array.from(new Set([...freeCandidates, ...measure.map((n) => n.beat)])).sort((a, b) => a - b);

      const next =
        delta > 0
          ? steppable.find((c) => c > cur + 0.001)
          : steppable
              .slice()
              .reverse()
              .find((c) => c < cur - 0.001);
      if (next !== undefined) return next;

      if (delta > 0) {
        const nextIndex = activeMeasureIndex + 1;
        if (nextIndex < numMeasures) {
          setActiveMeasureIndex(nextIndex);
          return 0;
        }
        return steppable.length ? steppable[steppable.length - 1]! : Math.max(0, cap - gridStepVal);
      }
      const prevIndex = activeMeasureIndex - 1;
      if (prevIndex >= 0) {
        setActiveMeasureIndex(prevIndex);
        return Math.max(0, cap - gridStepVal);
      }
      return steppable.length ? steppable[0]! : 0;
    });
  }

  function moveCursorPitch(delta: number) {
    if (hasSubmitted) return;
    setCursorMidi((prev) => {
      const rangeWindow = resolveRangeWindow(key, clef, settings.range);
      const cur = prev ?? rangeWindow.lowMidi;
      const next = Math.max(rangeWindow.lowMidi, Math.min(rangeWindow.highMidi, cur + delta));
      previewPitch(next);
      return next;
    });
  }

  function placeAtCursor() {
    if (cursorBeat === null) return;
    placeNoteAt(activeMeasureIndex, cursorBeat, armedDuration, armedIsRest, armedIsRest ? null : cursorMidi);
  }

  function focusCursor() {
    if (hasSubmitted) return;
    setCursorBeat(0);
    setCursorMidi((prev) => {
      if (prev !== null) return prev;
      return resolveRangeWindow(key, clef, settings.range).lowMidi;
    });
  }

  function blurCursor() {
    setCursorBeat(null);
  }

  function removeLastNote() {
    if (hasSubmitted) return;
    const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
    setPlacementHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1]!;
      setUserMeasures((prevMeasures) =>
        prevMeasures.map((m, i) => {
          if (i !== last.measureIndex) return m;
          const idx = m.findIndex((n) => durationClose(n.beat, last.beat));
          if (idx < 0) return m;
          // Refill the vacated span with default rests instead of leaving a
          // gap — a bar never has unaccounted-for space, undo included.
          return fillGaps(
            m.filter((_, i2) => i2 !== idx),
            timeSig.measureBeats,
            pulse,
            melodyRestAdapter,
          );
        }),
      );
      setActiveMeasureIndex(last.measureIndex);
      return prev.slice(0, -1);
    });
  }

  function clearActiveMeasure() {
    if (hasSubmitted) return;
    const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
    setUserMeasures((prev) =>
      prev.map((m, i) => (i === activeMeasureIndex ? defaultRestMeasure(timeSig.measureBeats, pulse, melodyRestAdapter) : m)),
    );
    setPlacementHistory((prev) => prev.filter((p) => p.measureIndex !== activeMeasureIndex));
  }

  function nudgeLastNote(delta: number) {
    if (hasSubmitted || !placementHistory.length) return;
    const last = placementHistory[placementHistory.length - 1]!;
    const note = userMeasures[last.measureIndex]?.find(
      (n) => durationClose(n.beat, last.beat) && !n.rest && n.midi !== null,
    );
    if (!note || note.midi === null) return;
    const newMidi = note.midi + delta;
    // A tie connects forward, so it's whatever *precedes* this note that may
    // carry the tied flag pointing at it — that tie no longer matches once
    // this note's pitch changes, so clear it too (alongside this note's own
    // tied flag, in case it itself ties forward to something further on).
    const preceding = findPrecedingNote(userMeasures, last.measureIndex, last.beat);
    setUserMeasures((prev) =>
      prev.map((m, i) => {
        let updated = m;
        if (i === last.measureIndex) {
          updated = updated.map((n) =>
            durationClose(n.beat, last.beat) && !n.rest && n.midi !== null
              ? { ...n, midi: newMidi, spelling: undefined, tied: undefined }
              : n,
          );
        }
        if (preceding?.note.tied && i === preceding.measureIndex) {
          updated = updated.map((n) => (n === preceding.note ? { ...n, tied: undefined } : n));
        }
        return updated;
      }),
    );
    previewPitch(newMidi);
  }

  function checkAnswer() {
    setHasSubmitted(true);
    const correct = pitchedMeasuresEqual(userMeasures, correctMeasures);
    setIsCorrect(correct);
    recordAttempt(TOPIC_ID, correct);
    if (correct) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      const diffIdx = firstDifferingMeasure(userMeasures, correctMeasures);
      setFeedbackKind('bad');
      setFeedbackMsg(
        diffIdx !== null ? `Incorrect — Measure ${diffIdx + 1} differs. See staff for corrections.` : 'Incorrect.',
      );
    }
  }

  function armDuration(dur: number) {
    setArmedDuration(dur);
  }
  function toggleRest() {
    setArmedIsRest((p) => !p);
  }
  function toggleDot() {
    setIsDotActive((p) => !p);
  }
  function toggleTie() {
    setIsTieActive((p) => !p);
  }
  function toggleSharp() {
    setArmedAccidental((p) => (p === '#' ? '' : '#'));
  }
  function toggleFlat() {
    setArmedAccidental((p) => (p === 'b' ? '' : 'b'));
  }

  async function init() {
    if (audio.status === 'ready' || audio.status === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
  }

  const totalBeatsPlaced = (m: PitchedMeasure) => m.reduce((s, n) => s + n.duration, 0);
  const allMeasuresFull = userMeasures.length > 0 && userMeasures.every((m) => Math.abs(totalBeatsPlaced(m) - timeSig.measureBeats) < 0.01);
  const submitEnabled = !hasSubmitted && allMeasuresFull && hasListened;

  const capacityHint = (() => {
    const sigLabel = `${timeSig.beatsPerBar}/${timeSig.beatValue}`;
    const parts: string[] = [];
    activeDurations.forEach((d) => {
      const n = maxNotesOfDuration(d, timeSig.measureBeats);
      if (n > 0) parts.push(`${n} ${DUR_LABELS[d] ?? d}${n === 1 ? '' : 's'}`);
    });
    return `${sigLabel} — ${parts.length ? `${parts.join(', ')} per bar.` : 'adjust settings to fit this metre.'}`;
  })();

  return {
    audioStatus,
    key,
    clef,
    timeSig,
    numMeasures,
    correctMeasures,
    userMeasures,
    hasSubmitted,
    isCorrect,
    activeMeasureIndex,
    setActiveMeasureIndex,
    cursorBeat,
    cursorMidi,
    moveCursorBeat,
    moveCursorPitch,
    placeAtCursor,
    focusCursor,
    blurCursor,
    flashMeasure,
    playbackFraction,
    isPlaying,
    armedDuration,
    armedIsRest,
    isDotActive,
    isTieActive,
    armedAccidental,
    activeDurations,
    gridStepVal,
    capacityHint,
    submitEnabled,
    statusText,
    statusKind,
    feedbackMsg,
    feedbackKind,
    score,
    effectiveDuration,
    generateQuestion: () => generateQuestion(true),
    startPlayback,
    stopPlayback,
    replay,
    placeNoteAt,
    removeLastNote,
    clearActiveMeasure,
    nudgeLastNote,
    checkAnswer,
    armDuration,
    toggleRest,
    toggleDot,
    toggleTie,
    toggleSharp,
    toggleFlat,
    init,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
