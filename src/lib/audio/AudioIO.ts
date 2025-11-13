/**
 * AudioIO - TypeScript Native Implementation
 *
 * Migrated from js/audio-io.js
 * Unified audio input/output interface supporting:
 * - AudioWorklet (modern, low latency)
 * - ScriptProcessorNode (fallback, compatibility)
 */

export interface PitchFrame {
  frequency: number
  rawFrequency: number
  note: string
  octave: number
  cents: number
  confidence: number
  volume: number
  brightness?: number
  breathiness?: number
  articulation?: string
  captureTime?: number
}

export interface AudioFrameData {
  audioData: Float32Array
  sampleRate: number
  timestamp: number
  pitchFrame?: PitchFrame  // Complete PitchFrame from worklet
}

export interface LatencyInfo {
  mode: 'worklet' | 'script-processor'
  bufferLatency: number
  hardwareLatency: number
  totalLatency: number
  sampleRate: number
}

export type AudioStateChangeCallback = (state: string, info?: any) => void
export type AudioFrameCallback = (data: AudioFrameData) => void
export type ErrorCallback = (context: string, error: Error) => void

export class AudioIO {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: AudioWorkletNode | ScriptProcessorNode | null = null
  private isRunning: boolean = false
  private isInitialized: boolean = false
  private mode: 'worklet' | 'script-processor' | null = null

  // Configuration
  private readonly config = {
    sampleRate: 44100,
    bufferSize: 2048,         // ScriptProcessor mode
    workletBufferSize: 128,   // AudioWorklet mode
    useWorklet: true,         // Enable AudioWorklet low-latency mode
    latencyHint: 'interactive' as AudioContextLatencyCategory
  }

  // Callbacks
  private onFrameCallback: AudioFrameCallback | null = null
  private onErrorCallback: ErrorCallback | null = null
  private onStateChangeCallback: AudioStateChangeCallback | null = null

  /**
   * Configure audio system
   */
  configure(options: Partial<typeof AudioIO.prototype.config>): this {
    Object.assign(this.config, options)
    console.log('[AudioIO] Configured:', this.config)
    return this
  }

  /**
   * Set frame callback
   */
  setOnFrame(callback: AudioFrameCallback): void {
    this.onFrameCallback = callback
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: AudioStateChangeCallback): void {
    this.onStateChangeCallback = callback
  }

  /**
   * Set error callback
   */
  setOnError(callback: ErrorCallback): void {
    this.onErrorCallback = callback
  }

  /**
   * Start audio system
   */
  async start(): Promise<LatencyInfo> {
    if (this.isRunning) {
      console.warn('[AudioIO] Already running')
      return this.getLatencyInfo()
    }

    try {
      console.log('[AudioIO] Starting audio system...')

      // 1. Initialize AudioContext
      await this.initializeAudioContext()

      // 2. Request microphone permission
      await this.requestMicrophone()

      // 3. Determine processing mode
      const useWorklet = this.config.useWorklet && this.supportsAudioWorklet()
      this.mode = useWorklet ? 'worklet' : 'script-processor'

      console.log(`[AudioIO] Mode: ${this.mode}`)

      // 4. Create audio processing chain
      if (this.mode === 'worklet') {
        await this.setupAudioWorklet()
      } else {
        await this.setupScriptProcessor()
      }

      this.isRunning = true
      this.isInitialized = true

      const result = this.getLatencyInfo()
      this.notifyStateChange('started', result)

      console.log(`[AudioIO] ✓ Started (${result.totalLatency.toFixed(1)}ms latency)`)
      return result

    } catch (error) {
      console.error('[AudioIO] Start failed:', error)
      this.notifyError('start', error as Error)
      throw error
    }
  }

  /**
   * Stop audio system
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('[AudioIO] Stopping...')

    // Disconnect nodes
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    // Stop microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    this.isRunning = false
    this.notifyStateChange('stopped')

    console.log('[AudioIO] ✓ Stopped')
  }

  /**
   * Get latency information
   */
  getLatencyInfo(): LatencyInfo {
    if (!this.audioContext || !this.mode) {
      return {
        mode: 'script-processor',
        bufferLatency: 0,
        hardwareLatency: 0,
        totalLatency: 0,
        sampleRate: 44100
      }
    }

    const sampleRate = this.audioContext.sampleRate
    const bufferSize = this.mode === 'worklet'
      ? this.config.workletBufferSize
      : this.config.bufferSize

    const bufferLatency = (bufferSize / sampleRate) * 1000  // ms
    const hardwareLatency = (this.audioContext.baseLatency || 0) * 1000  // ms
    const totalLatency = bufferLatency + hardwareLatency

    return {
      mode: this.mode,
      bufferLatency: parseFloat(bufferLatency.toFixed(2)),
      hardwareLatency: parseFloat(hardwareLatency.toFixed(2)),
      totalLatency: parseFloat(totalLatency.toFixed(2)),
      sampleRate
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      mode: this.mode,
      sampleRate: this.audioContext?.sampleRate || 0
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop()

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('[AudioIO] Disposed')
  }

  // ========== Private Methods ==========

  private async initializeAudioContext(): Promise<void> {
    if (this.audioContext) {
      return
    }

    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: this.config.latencyHint
    })

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    console.log('[AudioIO] AudioContext created:', {
      sampleRate: this.audioContext.sampleRate,
      state: this.audioContext.state
    })
  }

  private async requestMicrophone(): Promise<void> {
    console.log('[AudioIO] Requesting microphone...')

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: this.config.sampleRate
        }
      })

      console.log('[AudioIO] ✓ Microphone granted')
    } catch (error) {
      throw new Error(`Microphone access denied: ${error}`)
    }
  }

  private supportsAudioWorklet(): boolean {
    return typeof AudioWorkletNode !== 'undefined' && this.audioContext !== null
  }

  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext || !this.stream) {
      throw new Error('AudioContext or stream not initialized')
    }

    // Load worklet module (Vite serves public/ files at root)
    await this.audioContext.audioWorklet.addModule('/pitch-worklet.js')

    // Create source node
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)

    // Create worklet node (must match registerProcessor name in pitch-worklet.js)
    this.processorNode = new AudioWorkletNode(this.audioContext, 'pitch-detector')

    // Handle messages from worklet
    this.processorNode.port.onmessage = (event) => {
      const { type, data, timestamp } = event.data

      // Handle pitch-frame messages (complete PitchFrame object from worklet)
      if (type === 'pitch-frame' && data && this.onFrameCallback) {
        this.onFrameCallback({
          audioData: new Float32Array([]), // Worklet already processed, no raw audio needed
          sampleRate: this.audioContext?.sampleRate || 44100,
          timestamp,
          pitchFrame: data // Pass complete PitchFrame object
        })
      }

      // Handle error messages
      if (type === 'error' && this.onErrorCallback) {
        this.onErrorCallback('worklet', new Error(data.message || 'Worklet error'))
      }
    }

    // Connect nodes
    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)

    console.log('[AudioIO] ✓ AudioWorklet setup complete')
  }

  private async setupScriptProcessor(): Promise<void> {
    if (!this.audioContext || !this.stream) {
      throw new Error('AudioContext or stream not initialized')
    }

    // Create source node
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)

    // Create script processor node
    const bufferSize = this.config.bufferSize
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

    // Handle audio processing
    this.processorNode.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer
      const audioData = inputBuffer.getChannelData(0)

      if (this.onFrameCallback) {
        this.onFrameCallback({
          audioData: new Float32Array(audioData),
          sampleRate: this.audioContext!.sampleRate,
          timestamp: performance.now()
        })
      }
    }

    // Connect nodes
    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)

    console.log('[AudioIO] ✓ ScriptProcessor setup complete')
  }

  private notifyStateChange(state: string, info?: any): void {
    this.onStateChangeCallback?.(state, info)
  }

  private notifyError(context: string, error: Error): void {
    this.onErrorCallback?.(context, error)
  }
}
