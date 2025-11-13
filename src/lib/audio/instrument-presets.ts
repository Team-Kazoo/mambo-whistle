/**
 * Instrument Presets - TypeScript Configuration
 *
 * Migrated from js/config/instrument-presets.js
 * Provides instrument sound configurations for the synthesizer
 */

export interface OscillatorConfig {
  type: 'sawtooth' | 'sine' | 'square' | 'triangle'
}

export interface EnvelopeConfig {
  attack: number    // seconds
  decay: number     // seconds
  sustain: number   // 0-1
  release: number   // seconds
}

export interface FilterEnvelopeConfig {
  baseFrequency: number  // Hz
  octaves: number        // octaves
  attack: number         // seconds
  decay: number          // seconds
  sustain: number        // 0-1
  release: number        // seconds
}

export interface InstrumentPreset {
  oscillator: OscillatorConfig
  envelope: EnvelopeConfig
  filterEnvelope: FilterEnvelopeConfig
  portamento: number  // seconds - affects expressiveness
}

export type InstrumentName = 'saxophone' | 'violin' | 'piano' | 'flute' | 'guitar' | 'synth'

/**
 * Default instrument preset library
 */
export const DEFAULT_INSTRUMENT_PRESETS: Record<InstrumentName, InstrumentPreset> = {
  saxophone: {
    oscillator: { type: 'sawtooth' },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.3
    },
    filterEnvelope: {
      baseFrequency: 2000,
      octaves: 2,
      attack: 0.02,
      decay: 0.1,
      sustain: 0.5,
      release: 0.3
    },
    portamento: 0.03  // 30ms - medium expressiveness
  },

  violin: {
    oscillator: { type: 'sawtooth' },
    envelope: {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.9,
      release: 0.4
    },
    filterEnvelope: {
      baseFrequency: 1500,
      octaves: 3,
      attack: 0.08,
      decay: 0.2,
      sustain: 0.7,
      release: 0.4
    },
    portamento: 0.05  // 50ms - more pronounced glide (string characteristic)
  },

  piano: {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.005,
      decay: 0.3,
      sustain: 0.1,
      release: 1.0
    },
    filterEnvelope: {
      baseFrequency: 3000,
      octaves: 1,
      attack: 0.005,
      decay: 0.2,
      sustain: 0.2,
      release: 0.8
    },
    portamento: 0.01  // 10ms - fast (piano tone more articulate)
  },

  flute: {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.02,
      decay: 0.1,
      sustain: 0.8,
      release: 0.2
    },
    filterEnvelope: {
      baseFrequency: 2500,
      octaves: 2.5,
      attack: 0.03,
      decay: 0.15,
      sustain: 0.6,
      release: 0.2
    },
    portamento: 0.025  // 25ms - light glide
  },

  guitar: {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.005,
      decay: 0.4,
      sustain: 0.1,
      release: 0.6
    },
    filterEnvelope: {
      baseFrequency: 2200,
      octaves: 1.5,
      attack: 0.005,
      decay: 0.3,
      sustain: 0.2,
      release: 0.5
    },
    portamento: 0.015  // 15ms - moderate glide
  },

  synth: {
    oscillator: { type: 'square' },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2
    },
    filterEnvelope: {
      baseFrequency: 3500,
      octaves: 2,
      attack: 0.01,
      decay: 0.05,
      sustain: 0.8,
      release: 0.15
    },
    portamento: 0.02  // 20ms - electronic feel
  }
}

/**
 * Instrument Preset Manager
 */
export class InstrumentPresetManager {
  private presets: Record<string, InstrumentPreset>

  constructor(customPresets?: Record<string, InstrumentPreset>) {
    this.presets = customPresets || { ...DEFAULT_INSTRUMENT_PRESETS }
  }

  getPreset(name: InstrumentName): InstrumentPreset | null {
    return this.presets[name] || null
  }

  getAllPresetNames(): string[] {
    return Object.keys(this.presets)
  }

  setPreset(name: string, preset: InstrumentPreset): void {
    this.presets[name] = preset
  }

  hasPreset(name: string): boolean {
    return name in this.presets
  }
}
