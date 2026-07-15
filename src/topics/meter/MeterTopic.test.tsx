import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as meterLib from '../../lib/recognition/meter';
import { useScoresStore } from '../../state/scores';
import { useMeterRecognitionSettings } from '../../state/settings/meter-recognition';
import { MeterTopic } from './MeterTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/meter-recognition']}>
      <MeterTopic />
    </MemoryRouter>,
  );
}

function fakeParam(value = 0) {
  return { value, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}
function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
}

vi.mock('../../lib/audio/engine', () => ({
  audio: {
    status: 'ready',
    sampler: { triggerAttackRelease: vi.fn(), releaseAll: vi.fn() },
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
    rawContext: () => ({
      currentTime: 0,
      state: 'running',
      sampleRate: 44100,
      createOscillator: () => ({ ...fakeNode(), frequency: fakeParam() }),
      createGain: () => ({ ...fakeNode(), gain: fakeParam() }),
      createBufferSource: () => ({ ...fakeNode(), buffer: null }),
      createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
      createBiquadFilter: () => ({ ...fakeNode(), frequency: fakeParam(), Q: fakeParam() }),
    }),
  },
}));

// docs/09-improvement-plan.md §12.2 — Replay must re-hear the same excerpt,
// not generate a fresh question (the only thing distinguishing "listen
// again" from "Next excerpt").
describe('MeterTopic — Replay re-hears the same excerpt', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useMeterRecognitionSettings.setState((s) => ({ ...s, enabledSignatures: ['2/4', '4/4'] }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call buildMeterQuestion again when Replay is pressed', () => {
    const buildSpy = vi.spyOn(meterLib, 'buildMeterQuestion');

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play excerpt' }));
    expect(buildSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(buildSpy).toHaveBeenCalledTimes(1);
  });
});
