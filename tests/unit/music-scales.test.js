import { describe, it, expect } from 'vitest';
import { freqToMidi, midiToFreq, getNearestScaleNote, SCALES, KEYS } from '../../js/core/music-scales.js';

describe('MusicScales utilities', () => {
  it('converts frequency to MIDI and back with minimal error', () => {
    const midi = freqToMidi(440);
    expect(midi).toBeCloseTo(69, 5);

    const freq = midiToFreq(69);
    expect(freq).toBeCloseTo(440, 5);
  });

  it('returns nearest in-scale note when already in scale', () => {
    const result = getNearestScaleNote(440, 'C', 'major');

    expect(result.noteName).toBe('A'); // A is diatonic in C major
    expect(result.frequency).toBeCloseTo(440, 2);
    expect(result.centsDeviation).toBeCloseTo(0, 1);
  });

  it('quantizes to nearest diatonic note when out of scale', () => {
    // ~F#4 should snap to closest diatonic pitch in C major (F or G)
    const result = getNearestScaleNote(370, 'C', 'major');

    expect(['F', 'G']).toContain(result.noteName);
    // Should land on a diatonic target frequency
    expect(result.frequency).toBeGreaterThan(340);
    expect(result.frequency).toBeLessThan(400);
  });

  it('respects different roots and scales', () => {
    // F# is diatonic in G major, so it should pass through unchanged
    const result = getNearestScaleNote(370, 'G', 'major');

    expect(result.noteName).toBe('F#');
    expect(KEYS.includes(result.noteName)).toBe(true);
    expect(SCALES.major.intervals).toContain(11); // F# interval in G major
  });
});
