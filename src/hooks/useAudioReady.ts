import { useSyncExternalStore } from 'react';
import { audio, type AudioStatus } from '../lib/audio/engine';

// The one React coupling to the audio engine singleton (03-audio-engine.md §5).
export function useAudioReady(): AudioStatus {
  return useSyncExternalStore(audio.subscribe, () => audio.status);
}
