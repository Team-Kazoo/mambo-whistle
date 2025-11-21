import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installToneMock } from '../helpers/mockTone.js';
import instrumentPresets from '../../js/config/instrument-presets.js';

const presets = instrumentPresets.presets;

describe('ContinuousSynthEngine', () => {
  beforeEach(() => {
    vi.resetModules();
    installToneMock();
  });

  it('initializes Tone context and creates default synth', async () => {
    const { ContinuousSynthEngine } = await import('../../js/continuous-synth.js');

    const engine = new ContinuousSynthEngine({
      appConfig: {
        pitchDetector: { minConfidence: 0.1 },
        synthesizer: { noiseGainMax: 0.25 }
      },
      instrumentPresets: presets
    });

    await engine.initialize();

    expect(Tone.start).toHaveBeenCalled();
    expect(Tone.context.lookAhead).toBe(0);
    expect(engine.currentSynth).toBeDefined();
    expect(engine.currentInstrument).toBe('flute');
    expect(engine.noiseSource.state).toBe('started');
  });

  it('routes expressive controls when a confident pitch frame arrives', async () => {
    const { ContinuousSynthEngine } = await import('../../js/continuous-synth.js');
    const engine = new ContinuousSynthEngine({
      appConfig: {
        pitchDetector: { minConfidence: 0.01 },
        synthesizer: { noiseGainMax: 0.3 }
      },
      instrumentPresets: presets
    });

    await engine.initialize();
    engine.isPlaying = true; // bypass start() audio gesture guard

    const articulationSpy = vi.spyOn(engine, 'handleArticulation');
    const freqSpy = vi.spyOn(engine, 'updateFrequencyWithCents');
    const brightSpy = vi.spyOn(engine, 'updateBrightness');
    const breathSpy = vi.spyOn(engine, 'updateBreathiness');
    const volumeSpy = vi.spyOn(engine, 'updateVolume');

    const frame = {
      frequency: 440,
      confidence: 0.9,
      cents: 4,
      brightness: 0.4,
      breathiness: 0.35,
      articulation: 'sustain',
      volumeLinear: 0.12
    };

    engine.processPitchFrame(frame);

    expect(articulationSpy).toHaveBeenCalledWith('sustain', 440, 0.12);
    expect(freqSpy).toHaveBeenCalledWith(440, 4, expect.any(Number));
    expect(brightSpy).toHaveBeenCalledWith(0.4);
    expect(breathSpy).toHaveBeenCalledWith(0.35, 440);
    expect(volumeSpy).toHaveBeenCalledWith(0.12);
  });

  it('maps brightness, breathiness, and volume into audio params', async () => {
    const { ContinuousSynthEngine } = await import('../../js/continuous-synth.js');
    const engine = new ContinuousSynthEngine({
      appConfig: {
        synthesizer: { noiseGainMax: 0.5 }
      },
      instrumentPresets: presets
    });
    await engine.initialize();

    engine.updateBrightness(0.25);
    const brightnessRamp = engine.filter.frequency.ramps.at(-1);
    expect(brightnessRamp.value).toBeGreaterThan(3500); // raised baseline

    engine.updateBreathiness(0.6, 220);
    const noiseRamp = engine.noiseGain.gain.ramps.at(-1);
    expect(noiseRamp.value).toBeCloseTo(0.3, 2); // capped by noiseGainMax
    const noiseFilterRamp = engine.noiseFilter.frequency.ramps.at(-1);
    expect(noiseFilterRamp.value).toBe(440);

    engine.currentInstrument = 'trumpet'; // FM preset with dynamicModulation
    engine.updateVolume(0.15);
    const volumeRamp = engine.currentSynth.volume.ramps.at(-1);
    expect(volumeRamp.value).toBeLessThanOrEqual(0);
    const modIndexRamp = engine.currentSynth.modulationIndex.ramps.at(-1);
    expect(modIndexRamp.value).toBeGreaterThan(presets.trumpet.modulationIndex);
  });

  it('changes instruments without throwing and updates state', async () => {
    const { ContinuousSynthEngine } = await import('../../js/continuous-synth.js');
    const engine = new ContinuousSynthEngine({
      appConfig: { pitchDetector: { minConfidence: 0.1 } },
      instrumentPresets: presets
    });
    await engine.initialize();

    engine.changeInstrument('violin');

    expect(engine.currentInstrument).toBe('violin');
    expect(engine.currentSynth).toBeDefined();
  });
});
