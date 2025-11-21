import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installToneMock } from '../helpers/mockTone.js';

const installMagentaMock = (continueImpl = async () => ({ notes: [] })) => {
  class FakeRNN {
    constructor(url) {
      this.url = url;
      this.initialized = false;
    }
    async initialize() {
      this.initialized = true;
    }
    async continueSequence(seq, steps, temperature) {
      return continueImpl(seq, steps, temperature);
    }
  }

  global.window.mm = {
    MusicRNN: FakeRNN,
    freqToMidi: (freq) => Math.round(freq)
  };

  return FakeRNN;
};

describe('AiHarmonizer', () => {
  beforeEach(() => {
    vi.resetModules();
    installToneMock();
    global.window.mm = undefined;
  });

  it('enables successfully with Magenta and Tone available', async () => {
    const { AiHarmonizer } = await import('../../js/features/ai-harmonizer.js');
    const harmonizer = new AiHarmonizer();

    const statusSpy = vi.fn();
    harmonizer.onStatusChange = statusSpy;

    vi.spyOn(harmonizer, '_loadScript').mockResolvedValue();
    const FakeRNN = installMagentaMock();

    await harmonizer.enable();

    expect(harmonizer.enabled).toBe(true);
    expect(harmonizer.model).toBeInstanceOf(FakeRNN);
    expect(statusSpy).toHaveBeenLastCalledWith({ status: 'ready', message: 'AI Listening...' });
    expect(harmonizer.backingSynth).toBeDefined();
  });

  it('buffers confident notes and triggers generation after interval', async () => {
    const continueSpy = vi.fn().mockResolvedValue({
      notes: [{ pitch: 64, startTime: 0, endTime: 0.25 }]
    });
    installMagentaMock(continueSpy);

    const { AiHarmonizer } = await import('../../js/features/ai-harmonizer.js');
    const harmonizer = new AiHarmonizer();

    vi.spyOn(harmonizer, '_loadScript').mockResolvedValue();
    await harmonizer.enable();

    // Seed buffer directly then ask generator to run
    harmonizer.noteBuffer = [60, 62, 64, 65, 67];
    harmonizer.lastProcessTime = 0;
    harmonizer.isGenerating = false;

    const playSpy = vi.spyOn(harmonizer, '_playBacking').mockImplementation(() => {});

    await harmonizer._generateBackingSequence();

    expect(harmonizer.noteBuffer.length).toBeGreaterThan(0);
    expect(continueSpy).toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
  });

  it('resets state on disable and releases synth voices', async () => {
    installMagentaMock();
    const { AiHarmonizer } = await import('../../js/features/ai-harmonizer.js');
    const harmonizer = new AiHarmonizer();

    vi.spyOn(harmonizer, '_loadScript').mockResolvedValue();
    await harmonizer.enable();

    harmonizer.disable();

    expect(harmonizer.enabled).toBe(false);
    expect(harmonizer.isGenerating).toBe(false);
    expect(harmonizer.backingSynth.released).toBe(true);
  });
});
