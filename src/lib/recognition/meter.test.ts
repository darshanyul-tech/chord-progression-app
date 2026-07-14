import { describe, expect, it } from 'vitest';
import {
  METER_SIGNATURES,
  buildMeterChoiceDefs,
  buildMeterQuestion,
  defaultMeterRecognitionSettings,
  hasOnsetOnEveryPulse,
} from './meter';
import { getActiveDurations } from '../rhythm/generator';
import { gridStep, metricPulseBeats, parseTimeSig } from '../rhythm/time';

describe('defaultMeterRecognitionSettings', () => {
  it('enables the documented default signature contrast set', () => {
    expect(defaultMeterRecognitionSettings().enabledSignatures.sort()).toEqual(
      ['2/4', '3/4', '4/4', '6/8'].sort(),
    );
  });
});

describe('buildMeterQuestion', () => {
  it('returns null when fewer than 2 signatures are enabled (§4 guard)', () => {
    expect(buildMeterQuestion({ ...defaultMeterRecognitionSettings(), enabledSignatures: [] })).toBeNull();
    expect(buildMeterQuestion({ ...defaultMeterRecognitionSettings(), enabledSignatures: ['4/4'] })).toBeNull();
  });

  it("answerId always equals the signature bar 1's metric pulses are checked against", () => {
    const settings = defaultMeterRecognitionSettings();
    for (let i = 0; i < 30; i++) {
      const q = buildMeterQuestion(settings);
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(settings.enabledSignatures).toContain(q.answerId);
      const timeSig = parseTimeSig(q.answerId);
      expect(q.timeSig).toEqual(timeSig);
    }
  });

  it('bar 1 always has an onset on every metric pulse, for every signature (100 samples each)', () => {
    for (const sig of METER_SIGNATURES) {
      // Duplicate entry keeps the >=2-enabled guard satisfied while forcing
      // every draw to resolve to this exact signature.
      const settings = { ...defaultMeterRecognitionSettings(), enabledSignatures: [sig, sig] };
      const timeSig = parseTimeSig(sig);
      const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
      for (let i = 0; i < 100; i++) {
        const q = buildMeterQuestion(settings)!;
        expect(q.answerId).toBe(sig);
        expect(hasOnsetOnEveryPulse(q.pattern[0]!, timeSig.measureBeats, pulse)).toBe(true);
      }
    }
  });

  it('never includes rests or non-fixed durations (§3.2 fixed internal difficulty)', () => {
    const settings = defaultMeterRecognitionSettings();
    const allowed = [1, 0.5, 1.5, 2];
    for (let i = 0; i < 20; i++) {
      const q = buildMeterQuestion(settings)!;
      q.pattern.forEach((bar) => {
        bar.forEach((note) => {
          expect(note.isRest).toBe(false);
          expect(allowed.some((d) => Math.abs(d - note.duration) < 0.01)).toBe(true);
        });
      });
    }
  });
});

describe('buildMeterChoiceDefs', () => {
  it('orders choices in the fixed canonical signature order, filtered to enabled ones', () => {
    const defs = buildMeterChoiceDefs(['6/8', '2/4', '9/8']);
    expect(defs.map((d) => d.id)).toEqual(['2/4', '6/8', '9/8']);
  });
});

describe('generator sanity (reused rhythm engine, not re-tested here)', () => {
  it('getActiveDurations/gridStep still resolve for every meter signature', () => {
    METER_SIGNATURES.forEach((sig) => {
      const timeSig = parseTimeSig(sig);
      const durs = getActiveDurations([1, 0.5, 1.5, 2], false, timeSig.measureBeats);
      expect(durs.length).toBeGreaterThan(0);
      expect(gridStep(durs)).toBeGreaterThan(0);
    });
  });
});
