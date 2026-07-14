import { useEffect, useRef } from 'react';
import { audio } from '../lib/audio/engine';
import { stopChannel, type PlaybackChannel } from '../lib/audio/playback';
import { useIsActiveTopic } from './useIsActiveTopic';

// On topic-switch deactivation, stop playback but never touch settings/scores
// (01-architecture.md §4 "deactivation contract").
export function useStopOnDeactivate(topicId: string, channel: PlaybackChannel): void {
  const isActive = useIsActiveTopic(topicId);
  const wasActive = useRef(isActive);

  useEffect(() => {
    if (wasActive.current && !isActive) {
      stopChannel(channel, audio.sampler);
    }
    wasActive.current = isActive;
  }, [isActive, channel]);
}
