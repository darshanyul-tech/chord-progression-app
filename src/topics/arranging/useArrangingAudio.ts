import { useCallback } from 'react';
import * as Tone from 'tone';
import { audio } from '../../lib/audio/engine';
import { useAudioReady } from '../../hooks/useAudioReady';
import { midiToName } from '../../lib/arranging/pitch';

function toneName(midi: number): string {
  const { letter, accidental, octave } = midiToName(midi, 'sharp');
  return `${letter}${accidental ?? ''}${octave}`;
}

// Plays Arranging voicings/fragments through the shared sampler — never a second
// AudioContext (spec §7). Absolute pitches, never normalised to a register.
export function useArrangingAudio() {
  const status = useAudioReady();

  const play = useCallback((pitches: number[], mode: 'block' | 'sequence' = 'block') => {
    const sampler = audio.sampler;
    if (!sampler || !pitches.length) return;
    const now = Tone.now();
    if (mode === 'block') {
      sampler.triggerAttackRelease(pitches.map(toneName), '2n', now, 0.8);
    } else {
      pitches.forEach((m, i) => sampler.triggerAttackRelease(toneName(m), '4n', now + i * 0.42, 0.8));
    }
  }, []);

  // ARR-08 "play corrected version": faulty, gap, then corrected.
  const playComparison = useCallback((faulty: number[], corrected: number[]) => {
    const sampler = audio.sampler;
    if (!sampler) return;
    const now = Tone.now();
    sampler.triggerAttackRelease(faulty.map(toneName), '2n', now, 0.8);
    sampler.triggerAttackRelease(corrected.map(toneName), '2n', now + 1.4, 0.8);
  }, []);

  return { status, initAudio: audio.initAudio, play, playComparison };
}
