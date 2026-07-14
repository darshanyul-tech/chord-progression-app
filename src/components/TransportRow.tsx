import type { AudioStatus } from '../lib/audio/engine';

interface TransportRowProps {
  audioStatus: AudioStatus;
  loadBadgeText: string;
  onInit(): void;
  onPlay(): void;
  playLabel: string;
  replayVisible: boolean;
  onReplay(): void;
  onStop(): void;
  nextVisible: boolean;
  nextLabel: string;
  onNext(): void;
}

// Canonical transport button order for every recognition topic (02-ui-shell §7):
// Initialize -> Play -> Replay -> Stop -> Next.
export function TransportRow({
  audioStatus,
  loadBadgeText,
  onInit,
  onPlay,
  playLabel,
  replayVisible,
  onReplay,
  onStop,
  nextVisible,
  nextLabel,
  onNext,
}: TransportRowProps) {
  const ready = audioStatus === 'ready';
  return (
    <div className="buttons">
      {!ready && (
        <button type="button" onClick={onInit} disabled={audioStatus === 'loading'}>
          Initialize Audio<span className="loadbadge">{loadBadgeText}</span>
        </button>
      )}
      {ready && (
        <button type="button" onClick={onPlay}>
          {playLabel}
        </button>
      )}
      {replayVisible && (
        <button type="button" className="secondary" onClick={onReplay}>
          Replay
        </button>
      )}
      <button type="button" className="ghost" onClick={onStop}>
        Stop
      </button>
      {nextVisible && (
        <button type="button" className="secondary" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}
