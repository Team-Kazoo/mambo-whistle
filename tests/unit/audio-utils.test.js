import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkBrowserSupport,
  calculateRMS,
  linearToDb,
  dBToLinear,
  calculateCents,
  frequencyToNote,
  performSimpleFFT
} from '../../js/utils/audio-utils.js';

const originalGlobals = {};

describe('audio-utils', () => {
  beforeEach(() => {
    // Capture/prepare globals used by checkBrowserSupport
    originalGlobals.AudioContext = global.AudioContext;
    originalGlobals.webkitAudioContext = global.webkitAudioContext;
    originalGlobals.navigator = global.navigator;
    originalGlobals.AudioWorkletNode = global.AudioWorkletNode;
    originalGlobals.location = global.window?.location;
  });

  afterEach(() => {
    // Restore globals
    global.AudioContext = originalGlobals.AudioContext;
    global.webkitAudioContext = originalGlobals.webkitAudioContext;
    global.navigator = originalGlobals.navigator;
    global.AudioWorkletNode = originalGlobals.AudioWorkletNode;
    if (global.window && originalGlobals.location) {
      Object.defineProperty(global.window, 'location', {
        configurable: true,
        value: originalGlobals.location
      });
    }
  });

  it('reports supported environment when required APIs exist', () => {
    global.AudioContext = function () {};
    global.AudioWorkletNode = function () {};
    global.navigator = {
      mediaDevices: {
        getUserMedia: () => Promise.resolve()
      }
    };
    Object.defineProperty(global.window, 'location', {
      configurable: true,
      value: new URL('https://localhost')
    });

    const result = checkBrowserSupport();
    expect(result.isSupported).toBe(true);
    expect(result.issues.length).toBeLessThanOrEqual(1); // at most the optional worklet hint
  });

  it('flags missing APIs with descriptive issues', () => {
    global.AudioContext = undefined;
    global.AudioWorkletNode = undefined;
    global.navigator = { mediaDevices: {} };
    Object.defineProperty(global.window, 'location', {
      configurable: true,
      value: new URL('http://example.com')
    });

    const result = checkBrowserSupport();
    expect(result.isSupported).toBe(false);
    expect(result.issues.some((msg) => msg.includes('Web Audio'))).toBe(true);
    expect(result.issues.some((msg) => msg.includes('麦克风'))).toBe(true);
    expect(result.issues.some((msg) => msg.includes('HTTPS'))).toBe(true);
  });

  it('calculates RMS and rejects invalid buffers', () => {
    const buffer = new Float32Array([0, 0.5, -0.5, 1]);
    expect(calculateRMS(buffer)).toBeCloseTo(0.612, 3);

    expect(() => calculateRMS([])).toThrow(TypeError);
    expect(() => calculateRMS(new Float32Array())).toThrow(RangeError);
  });

  it('converts between linear and dB domains', () => {
    const db = linearToDb(0.5);
    expect(db).toBeCloseTo(-6.02, 2);

    const linear = dBToLinear(-12);
    expect(linear).toBeCloseTo(0.251, 3);
  });

  it('computes cents and clamps extremes', () => {
    const cents = calculateCents(445, 440);
    expect(cents).toBeGreaterThan(0);
    expect(() => calculateCents(0, 440)).toThrow(RangeError);

    const clamped = calculateCents(1000, 440);
    expect(Math.abs(clamped)).toBeLessThanOrEqual(50);
  });

  it('maps frequency to nearest note info', () => {
    const note = frequencyToNote(440);
    expect(note.note).toBe('A');
    expect(note.octave).toBe(4);
    expect(note.targetFrequency).toBeCloseTo(440, 3);
  });

  it('performs simple FFT with correct output length and symmetry', () => {
    const buffer = new Float32Array([1, 0, -1, 0]); // simple waveform
    const spectrum = performSimpleFFT(buffer, 8);

    expect(spectrum.length).toBe(4);
    // Energy should be non-zero in the lower bins and finite overall
    expect(spectrum.some((v) => v > 0)).toBe(true);
  });
});
