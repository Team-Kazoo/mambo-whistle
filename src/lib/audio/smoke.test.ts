/**
 * Smoke Tests - Basic functionality verification
 */

import { describe, it, expect } from 'vitest'
import { PitchDetector } from './PitchDetector'
import { InstrumentPresetManager, DEFAULT_INSTRUMENT_PRESETS } from './instrument-presets'

describe('Audio System - Smoke Tests', () => {
  describe('PitchDetector', () => {
    it('should create an instance', () => {
      const detector = new PitchDetector()
      expect(detector).toBeInstanceOf(PitchDetector)
    })

    it('should convert frequency to note', () => {
      const detector = new PitchDetector()
      const noteInfo = detector.frequencyToNote(440)
      expect(noteInfo.note).toBe('A4')
    })

    it('should convert note to frequency', () => {
      const detector = new PitchDetector()
      const freq = detector.noteToFrequency('A4')
      expect(freq).toBeCloseTo(440, 1)
    })
  })

  describe('InstrumentPresets', () => {
    it('should have all default instruments', () => {
      const instruments = Object.keys(DEFAULT_INSTRUMENT_PRESETS)
      expect(instruments).toContain('saxophone')
      expect(instruments).toContain('violin')
      expect(instruments).toContain('piano')
      expect(instruments).toContain('flute')
      expect(instruments).toContain('guitar')
      expect(instruments).toContain('synth')
    })

    it('should load instrument presets', () => {
      const manager = new InstrumentPresetManager()
      const sax = manager.getPreset('saxophone')
      expect(sax).not.toBeNull()
      expect(sax?.oscillator.type).toBe('sawtooth')
    })
  })
})
