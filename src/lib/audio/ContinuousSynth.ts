/**
 * ContinuousSynth - TypeScript Native Implementation
 *
 * Migrated from js/continuous-synth.js
 * Continuous frequency synthesizer - tracks voice pitch in real-time
 *
 * Architecture:
 * Old: PitchDetector → Note("C4") → triggerAttack("C4") → Fixed frequency
 * New: PitchDetector → Frequency(Hz) → Smooth → oscillator.frequency → Real-time tracking
 */

import * as Tone from 'tone'
import { DEFAULT_INSTRUMENT_PRESETS, type InstrumentPreset, type InstrumentName } from './instrument-presets'

export interface PitchInfo {
  frequency: number
  confidence?: number
  volume?: number
}

export class ContinuousSynth {
  private currentInstrument: InstrumentName = 'saxophone'
  private currentSynth: Tone.Synth | null = null
  private isPlaying: boolean = false
  private currentFrequency: number = 0

  // Frequency smoothing parameters
  private readonly frequencyUpdateThreshold: number = 0.005  // 0.5% difference triggers update
  private lastUpdateTime: number = 0
  private readonly minUpdateInterval: number = 10  // Minimum 10ms between updates

  // Confidence threshold
  private readonly minConfidence: number = 0.05

  // Silence detection (prevent sound from continuing after humming stops)
  private readonly silenceTimeout: number = 300  // 300ms without valid pitch = stop
  private lastValidPitchTime: number = 0
  private silenceCheckInterval: number | null = null

  // Articulation state tracking (for future use)
  // private lastArticulationState: 'silence' | 'playing' = 'silence'

  // Effects chain
  private vibrato: Tone.Vibrato
  private filter: Tone.Filter
  private reverb: Tone.Reverb

  // Noise layer (for breathiness feature)
  private noiseSource: Tone.Noise
  private noiseGain: Tone.Gain
  private noiseFilter: Tone.Filter

  // Instrument presets
  private presets: Record<string, InstrumentPreset>

  constructor(customPresets?: Record<string, InstrumentPreset>) {
    this.presets = customPresets || { ...DEFAULT_INSTRUMENT_PRESETS }

    // Effects chain
    this.vibrato = new Tone.Vibrato({
      frequency: 5,
      depth: 0.1
    })

    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2000,
      Q: 1
    })

    this.reverb = new Tone.Reverb({
      decay: 1.5,
      wet: 0.2
    })
    this.reverb.toDestination()

    // Noise layer
    this.noiseSource = new Tone.Noise('white')
    this.noiseGain = new Tone.Gain(0)  // Initially silent
    this.noiseFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 1000,
      Q: 2
    })

    // Connect effects chain
    this.vibrato.connect(this.filter)
    this.filter.connect(this.reverb)

    // Connect noise layer
    this.noiseSource.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.reverb)

    console.log('[ContinuousSynth] Initialized')
  }

  /**
   * Initialize synthesizer (must be called after user gesture)
   */
  async initialize(): Promise<void> {
    await Tone.start()

    // Start noise source
    if (this.noiseSource.state !== 'started') {
      this.noiseSource.start()
    }

    // Create initial synth with current instrument
    this.createSynth(this.currentInstrument)

    console.log('[ContinuousSynth] ✓ Ready')
  }

  /**
   * Create synthesizer for given instrument
   */
  private createSynth(instrumentName: InstrumentName): void {
    // Dispose old synth
    if (this.currentSynth) {
      this.currentSynth.triggerRelease()
      this.currentSynth.disconnect()
      this.currentSynth.dispose()
    }

    const preset = this.presets[instrumentName]
    if (!preset) {
      console.error(`[ContinuousSynth] Unknown instrument: ${instrumentName}`)
      return
    }

    // Create new synth with preset
    this.currentSynth = new Tone.Synth({
      oscillator: {
        type: preset.oscillator.type
      },
      envelope: {
        attack: preset.envelope.attack,
        decay: preset.envelope.decay,
        sustain: preset.envelope.sustain,
        release: preset.envelope.release
      },
      portamento: preset.portamento
    })

    // Connect to effects chain
    this.currentSynth.connect(this.vibrato)

    console.log(`[ContinuousSynth] Created synth: ${instrumentName}`)
  }

  /**
   * Change instrument (can be called while playing)
   */
  changeInstrument(instrumentName: InstrumentName): void {
    const wasPlaying = this.isPlaying
    const lastFrequency = this.currentFrequency

    // Stop current sound
    if (wasPlaying && this.currentSynth) {
      this.currentSynth.triggerRelease()
    }

    // Create new synth
    this.currentInstrument = instrumentName
    this.createSynth(instrumentName)

    // Resume playing if was playing
    if (wasPlaying && lastFrequency > 0) {
      this.currentSynth?.triggerAttack(lastFrequency)
      this.isPlaying = true
    }

    console.log(`[ContinuousSynth] Switched to: ${instrumentName}`)
  }

  /**
   * Update pitch (call this continuously with detected pitch)
   */
  updatePitch(pitchInfo: PitchInfo): void {
    if (!this.currentSynth) {
      console.warn('[ContinuousSynth] Synth not initialized')
      return
    }

    const { frequency, confidence = 1 } = pitchInfo

    // Validate frequency
    if (!frequency || frequency <= 0 || frequency > 2000) {
      this.handleSilence()
      return
    }

    // Check confidence threshold
    if (confidence < this.minConfidence) {
      this.handleSilence()
      return
    }

    // Update last valid pitch time
    this.lastValidPitchTime = Date.now()

    // Throttle frequency updates
    const now = Date.now()
    if (now - this.lastUpdateTime < this.minUpdateInterval) {
      return
    }

    // Check if frequency changed significantly
    const freqDiff = Math.abs(frequency - this.currentFrequency) / this.currentFrequency
    if (freqDiff < this.frequencyUpdateThreshold && this.isPlaying) {
      return  // No significant change, skip update
    }

    // Update frequency
    this.currentFrequency = frequency
    this.lastUpdateTime = now

    // Start or update synthesizer
    if (!this.isPlaying) {
      this.currentSynth.triggerAttack(frequency)
      this.isPlaying = true
      // this.lastArticulationState = 'playing'
      this.startSilenceCheck()
      console.log(`[ContinuousSynth] ▶️ Started at ${frequency.toFixed(1)}Hz`)
    } else {
      // Update frequency smoothly (Tone.js handles portamento)
      this.currentSynth.frequency.rampTo(frequency, 0.05)
    }
  }

  /**
   * Handle silence detection
   */
  private handleSilence(): void {
    if (!this.isPlaying) return

    const silenceDuration = Date.now() - this.lastValidPitchTime
    if (silenceDuration > this.silenceTimeout) {
      this.stop()
      console.log('[ContinuousSynth] ⏸ Stopped (silence detected)')
    }
  }

  /**
   * Start silence detection interval
   */
  private startSilenceCheck(): void {
    if (this.silenceCheckInterval) return

    this.silenceCheckInterval = window.setInterval(() => {
      this.handleSilence()
    }, 100)
  }

  /**
   * Stop silence detection interval
   */
  private stopSilenceCheck(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval)
      this.silenceCheckInterval = null
    }
  }

  /**
   * Manually stop synthesizer
   */
  stop(): void {
    if (!this.isPlaying) return

    this.currentSynth?.triggerRelease()
    this.isPlaying = false
    this.currentFrequency = 0
    // this.lastArticulationState = 'silence'
    this.stopSilenceCheck()

    console.log('[ContinuousSynth] ⏹ Stopped')
  }

  /**
   * Update volume (0-1)
   */
  setVolume(volume: number): void {
    if (!this.currentSynth) return

    const clampedVolume = Math.max(0, Math.min(1, volume))
    const dbVolume = Tone.gainToDb(clampedVolume)
    this.currentSynth.volume.value = dbVolume
  }

  /**
   * Update breathiness (0-1) - controls noise layer
   */
  setBreathiness(breathiness: number): void {
    const clampedBreathiness = Math.max(0, Math.min(1, breathiness))
    this.noiseGain.gain.rampTo(clampedBreathiness * 0.1, 0.1)
  }

  /**
   * Update vibrato depth (0-1)
   */
  setVibratoDepth(depth: number): void {
    const clampedDepth = Math.max(0, Math.min(1, depth))
    this.vibrato.depth.value = clampedDepth * 0.2
  }

  /**
   * Update filter frequency based on brightness
   */
  setBrightness(brightness: number): void {
    const clampedBrightness = Math.max(0, Math.min(1, brightness))
    const filterFreq = 500 + clampedBrightness * 3500  // 500Hz - 4000Hz
    this.filter.frequency.rampTo(filterFreq, 0.1)
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentInstrument: this.currentInstrument,
      currentFrequency: this.currentFrequency
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop()
    this.stopSilenceCheck()

    // Dispose audio nodes
    this.currentSynth?.dispose()
    this.vibrato.dispose()
    this.filter.dispose()
    this.reverb.dispose()
    this.noiseSource.stop()
    this.noiseSource.dispose()
    this.noiseGain.dispose()
    this.noiseFilter.dispose()

    console.log('[ContinuousSynth] Disposed')
  }
}
