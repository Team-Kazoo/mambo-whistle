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

  // Mock the Magenta API structure (updated to match ai-harmonizer.js usage)
  global.window.music_rnn = {
    MusicRNN: FakeRNN
  };

  global.window.core = {
    sequences: {
      quantizeNoteSequence: (seq, stepsPerQuarter) => {
        // Simple mock: just add quantizationInfo
        return {
          ...seq,
          quantizationInfo: { stepsPerQuarter }
        };
      }
    }
  };

  return FakeRNN;
};

describe('AiHarmonizer', () => {
  beforeEach(() => {
    vi.resetModules();
    installToneMock();
    // Clean up Magenta mocks
    global.window.music_rnn = undefined;
    global.window.core = undefined;
  });

  it('enables successfully with Magenta and Tone available', async () => {
    const { AiHarmonizer } = await import('../../js/features/ai-harmonizer.js');
    const harmonizer = new AiHarmonizer();

    const statusSpy = vi.fn();
    harmonizer.onStatusChange = statusSpy;

    // Note: _loadScript() was removed in the AI Harmonizer refactor (scripts now preloaded in HTML)
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

    // Note: _loadScript() was removed in the AI Harmonizer refactor (scripts now preloaded in HTML)
    await harmonizer.enable();

    // Seed buffer directly then ask generator to run
    harmonizer.noteBuffer = [60, 62, 64, 65, 67];
    harmonizer.lastProcessTime = 0;
    harmonizer.isGenerating = false;

    const playSpy = vi.spyOn(harmonizer, '_playBacking').mockImplementation(() => {});

    // _generateBackingSequence now uses requestIdleCallback/setTimeout for scheduling
    // We need to wait for the scheduled callback to complete
    await harmonizer._generateBackingSequence();

    // Wait for the scheduled callback to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(harmonizer.noteBuffer.length).toBeGreaterThan(0);
    expect(continueSpy).toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
  });

  it('resets state on disable and releases synth voices', async () => {
    installMagentaMock();
    const { AiHarmonizer } = await import('../../js/features/ai-harmonizer.js');
    const harmonizer = new AiHarmonizer();

    // Note: _loadScript() was removed in the AI Harmonizer refactor (scripts now preloaded in HTML)
    await harmonizer.enable();

    harmonizer.disable();

    expect(harmonizer.enabled).toBe(false);
    expect(harmonizer.isGenerating).toBe(false);
    expect(harmonizer.backingSynth.released).toBe(true);
  });
});
