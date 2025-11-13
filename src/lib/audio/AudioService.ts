/**
 * AudioService - Complete TypeScript Native Implementation
 *
 * Replaces the bridge pattern with a fully native TS audio system
 * No longer loads legacy JS files - uses PitchDetector, AudioIO, and ContinuousSynth
 */

import type { AudioState, InstrumentType, AudioMode } from '@/lib/types/audio'
import { AudioIO, type AudioFrameData, type PitchFrame } from './AudioIO'
import { PitchDetector, type PitchResult } from './PitchDetector'
import { ContinuousSynth } from './ContinuousSynth'
import type { InstrumentName } from './instrument-presets'

export type AudioStateChangeListener = (state: AudioState) => void

export class AudioService {
  private state: AudioState
  private listeners: Set<AudioStateChangeListener> = new Set()

  // Audio components
  private audioIO: AudioIO
  private pitchDetector: PitchDetector
  private synth: ContinuousSynth

  // Pitch data (for future use)
  // private lastPitchResult: PitchResult | null = null

  constructor() {
    this.state = {
      isReady: false,
      isPlaying: false,
      currentInstrument: 'saxophone',
      currentMode: 'continuous',
      pitchData: null,
      latency: 0,
      status: 'initializing'
    }

    // Initialize audio components
    this.audioIO = new AudioIO()
    this.pitchDetector = new PitchDetector()
    this.synth = new ContinuousSynth()

    // Setup audio processing pipeline
    this.setupAudioPipeline()
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): Readonly<AudioState> {
    return { ...this.state }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: AudioStateChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Update state and notify listeners
   */
  private setState(partial: Partial<AudioState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach(listener => listener(this.state))
  }

  /**
   * Initialize audio system (idempotent - safe to call multiple times)
   */
  async initialize(): Promise<void> {
    // Prevent double initialization (React StrictMode mounts twice)
    if (this.state.isReady) {
      console.log('[AudioService] Already initialized, skipping')
      return
    }

    try {
      this.setState({ status: 'Loading Tone.js...' })

      // Wait for Tone.js to load (loaded via CDN in index.html or dynamically)
      await this.waitForTone()

      this.setState({ status: 'Loading Pitchfinder...' })

      // Wait for Pitchfinder to load
      await this.waitForPitchfinder()

      this.setState({ status: 'Initializing audio system...' })

      // Initialize components
      await this.synth.initialize()
      this.pitchDetector.initialize(44100)

      // Configure AudioIO
      this.audioIO.configure({
        sampleRate: 44100,
        useWorklet: true,
        latencyHint: 'interactive'
      })

      this.setState({
        isReady: true,
        status: 'Ready - Click Start to begin'
      })

      console.log('[AudioService] ✓ Initialization complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({
        isReady: false,
        status: `Error: ${message}`
      })
      throw error
    }
  }

  /**
   * Start audio capture and playback
   */
  async start(): Promise<void> {
    if (!this.state.isReady) {
      throw new Error('Audio system not initialized. Call initialize() first.')
    }

    if (this.state.isPlaying) {
      console.warn('[AudioService] Already playing')
      return
    }

    try {
      this.setState({ status: 'Starting audio...' })

      // Resume Tone.js AudioContext (required after user gesture)
      await this.synth.resume()

      // Start AudioIO
      const latencyInfo = await this.audioIO.start()

      this.setState({
        isPlaying: true,
        status: `Playing (${this.state.currentInstrument})`,
        latency: latencyInfo.totalLatency
      })

      console.log('[AudioService] ✓ Started')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({ status: `Start failed: ${message}` })
      throw error
    }
  }

  /**
   * Stop audio capture and playback
   */
  stop(): void {
    if (!this.state.isPlaying) {
      return
    }

    try {
      // Stop audio IO
      this.audioIO.stop()

      // Stop synthesizer
      this.synth.stop()

      this.setState({
        isPlaying: false,
        pitchData: null,
        status: 'Ready'
      })

      console.log('[AudioService] ✓ Stopped')
    } catch (error) {
      console.error('[AudioService] Stop error:', error)
    }
  }

  /**
   * Change active instrument
   */
  changeInstrument(instrument: InstrumentType): void {
    this.synth.changeInstrument(instrument as InstrumentName)

    this.setState({
      currentInstrument: instrument,
      status: this.state.isPlaying
        ? `Playing (${instrument})`
        : 'Ready'
    })

    console.log('[AudioService] Instrument changed:', instrument)
  }

  /**
   * Change playback mode
   */
  changeMode(mode: AudioMode): void {
    this.setState({ currentMode: mode })
    console.log('[AudioService] Mode changed:', mode)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop()
    this.audioIO.dispose()
    this.synth.dispose()
    this.listeners.clear()
    console.log('[AudioService] Destroyed')
  }

  // ========== Private Methods ==========

  /**
   * Setup audio processing pipeline
   */
  private setupAudioPipeline(): void {
    this.audioIO.setOnFrame((frameData: AudioFrameData) => {
      this.processAudioFrame(frameData)
    })

    this.audioIO.setOnStateChange((state, info) => {
      if (state === 'started' && info) {
        this.setState({ latency: info.totalLatency })
      }
    })

    this.audioIO.setOnError((context, error) => {
      console.error(`[AudioService] AudioIO error (${context}):`, error)
      this.setState({ status: `Error: ${error.message}` })
    })
  }

  /**
   * Process audio frame
   */
  private processAudioFrame(frameData: AudioFrameData): void {
    // In Worklet mode, use pre-computed PitchFrame from worklet
    if (frameData.pitchFrame) {
      this.processPitchFrame(frameData.pitchFrame)
      return
    }

    // Fallback: ScriptProcessor mode - compute pitch in main thread
    const audioData = frameData.audioData
    const rms = Math.sqrt(
      audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length
    )

    // Detect pitch
    const pitchResult = this.pitchDetector.detect(audioData, rms)

    if (pitchResult) {
      this.processPitchFrame(pitchResult)

      // Update pitch data in state
      this.setState({
        pitchData: {
          note: pitchResult.note,
          frequency: pitchResult.frequency,
          confidence: pitchResult.confidence
        }
      })

    }
  }

  /**
   * Process pitch frame (from worklet or pitch detector)
   */
  private processPitchFrame(pitchFrame: PitchFrame | PitchResult): void {
    // Update state
    this.setState({
      pitchData: {
        note: pitchFrame.note || '',
        frequency: pitchFrame.frequency || 0,
        confidence: pitchFrame.confidence || 0
      }
    })

    // Forward to synthesizer
    if (this.state.currentMode === 'continuous') {
      this.synth.updatePitch({
        frequency: pitchFrame.frequency,
        confidence: pitchFrame.confidence,
        volume: pitchFrame.volume || pitchFrame.volumeLinear || 0
      })
    }
  }

  /**
   * Wait for Tone.js to load
   */
  private async waitForTone(): Promise<void> {
    if ((window as any).Tone) {
      return Promise.resolve()
    }

    // Load Tone.js dynamically if not already loaded
    await this.loadScript('https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.js')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tone.js load timeout')), 5000)
      const check = () => {
        if ((window as any).Tone) {
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }

  /**
   * Wait for Pitchfinder to load
   */
  private async waitForPitchfinder(): Promise<void> {
    if ((window as any).Pitchfinder || (window as any).pitchfinder) {
      return Promise.resolve()
    }

    // Use local pitchfinder-browser.js (same as legacy system)
    const localSrc = '/js/lib/pitchfinder-browser.js'

    try {
      await this.loadScript(localSrc)

      // Wait for library to be available
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Pitchfinder load timeout')), 3000)
        const check = () => {
          if ((window as any).Pitchfinder || (window as any).pitchfinder) {
            clearTimeout(timeout)
            resolve()
          } else {
            setTimeout(check, 100)
          }
        }
        check()
      })

      return // Success
    } catch (error) {
      console.error(`Failed to load Pitchfinder from ${localSrc}`, error)
      throw new Error('Failed to load Pitchfinder library')
    }
  }

  /**
   * Load external script
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load: ${src}`))
      document.head.appendChild(script)
    })
  }
}

// Singleton instance
let instance: AudioService | null = null

export function getAudioService(): AudioService {
  if (!instance) {
    instance = new AudioService()
  }
  return instance
}
