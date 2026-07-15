import { useSyncExternalStore } from 'react';
import { mic, type MicStatus } from '../lib/audio/mic';

// The one React coupling to the mic singleton, mirroring useAudioReady.ts's
// pattern for lib/audio/engine.ts.
export function useMicReady(): MicStatus {
  return useSyncExternalStore(mic.subscribe, () => mic.status);
}
