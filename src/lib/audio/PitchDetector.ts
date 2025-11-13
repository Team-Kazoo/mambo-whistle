/**
 * PitchDetector - TypeScript Native Implementation
 *
 * Migrated from js/pitch-detector.js
 * Uses YIN algorithm via Pitchfinder library
 */

export interface PitchResult {
  frequency: number
  rawFrequency: number
  note: string
  octave: number
  cents: number
  confidence: number
  volume: number | null
}

export interface NoteInfo {
  note: string
  octave: number
  cents: number
  frequency: number
}

export class PitchDetector {
  private detector: ((buffer: Float32Array) => number | null) | null = null
  private sampleRate: number = 44100
  private threshold: number = 0.1

  private pitchHistory: number[] = []
  private historySize: number = 5

  private readonly noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  private minVolumeThreshold: number = 0.01

  /**
   * Initialize YIN detector
   */
  initialize(sampleRate: number): void {
    this.sampleRate = sampleRate

    // Check if Pitchfinder library is loaded
    const PitchfinderLib = (window as any).Pitchfinder || (window as any).pitchfinder

    if (!PitchfinderLib) {
      throw new Error('Pitchfinder library not loaded')
    }

    try {
      this.detector = PitchfinderLib.YIN({
        sampleRate: this.sampleRate,
        threshold: this.threshold
      })
      console.log('[PitchDetector] Initialized:', { sampleRate, threshold: this.threshold })
    } catch (error) {
      throw new Error(`Failed to create YIN detector: ${error}`)
    }
  }

  /**
   * Detect pitch from audio buffer
   */
  detect(audioBuffer: Float32Array, volume: number | null = null): PitchResult | null {
    if (!this.detector) {
      console.warn('[PitchDetector] Not initialized')
      return null
    }

    // Check volume threshold
    if (volume !== null && volume < this.minVolumeThreshold) {
      return null
    }

    // Use YIN algorithm to detect pitch
    const frequency = this.detector(audioBuffer)

    if (frequency && frequency > 0 && frequency < 2000) {
      // Add to history
      this.pitchHistory.push(frequency)
      if (this.pitchHistory.length > this.historySize) {
        this.pitchHistory.shift()
      }

      // Calculate smoothed frequency
      const smoothedFrequency = this.getSmoothedPitch()

      // Convert to note info
      const noteInfo = this.frequencyToNote(smoothedFrequency)

      return {
        frequency: smoothedFrequency,
        rawFrequency: frequency,
        note: noteInfo.note,
        octave: noteInfo.octave,
        cents: noteInfo.cents,
        confidence: this.calculateConfidence(audioBuffer, frequency),
        volume
      }
    }

    return null
  }

  /**
   * Get smoothed pitch using median filter
   */
  getSmoothedPitch(): number {
    if (this.pitchHistory.length === 0) return 0
    if (this.pitchHistory.length === 1) return this.pitchHistory[0]

    const sorted = [...this.pitchHistory].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
  }

  /**
   * Calculate confidence based on signal strength
   */
  calculateConfidence(audioBuffer: Float32Array, frequency: number): number {
    if (!frequency || frequency <= 0) return 0
    if (audioBuffer.length === 0) return 0

    // Calculate RMS
    const rms = Math.sqrt(
      audioBuffer.reduce((sum, val) => sum + val * val, 0) / audioBuffer.length
    )

    // Base confidence on RMS
    let confidence = Math.min(rms * 10, 1.0)

    // Boost confidence for human voice range (80-800Hz)
    if (frequency >= 80 && frequency <= 800) {
      confidence = Math.min(confidence * 1.2, 1.0)
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Convert frequency to note name
   */
  frequencyToNote(frequency: number): NoteInfo {
    const A4 = 440
    const C0 = A4 * Math.pow(2, -4.75) // ~16.35 Hz

    const halfSteps = 12 * Math.log2(frequency / C0)
    const octave = Math.floor(halfSteps / 12)
    const noteIndex = Math.round(halfSteps) % 12
    const note = this.noteNames[noteIndex]

    // Calculate cents deviation
    const exactNoteFreq = C0 * Math.pow(2, (octave * 12 + noteIndex) / 12)
    const cents = Math.round(1200 * Math.log2(frequency / exactNoteFreq))

    return {
      note: `${note}${octave}`,
      octave,
      cents,
      frequency
    }
  }

  /**
   * Convert note name to frequency
   */
  noteToFrequency(note: string): number {
    const match = note.match(/^([A-G]#?)(\d+)$/)
    if (!match) return 0

    const [, noteName, octaveStr] = match
    const octave = parseInt(octaveStr)
    const noteIndex = this.noteNames.indexOf(noteName)

    if (noteIndex === -1) return 0

    const A4 = 440
    const C0 = A4 * Math.pow(2, -4.75)
    return C0 * Math.pow(2, (octave * 12 + noteIndex) / 12)
  }

  /**
   * Quantize frequency to nearest note
   */
  quantizePitch(frequency: number): number {
    const noteInfo = this.frequencyToNote(frequency)
    return this.noteToFrequency(noteInfo.note)
  }

  /**
   * Reset pitch history
   */
  reset(): void {
    this.pitchHistory = []
  }

  /**
   * Set volume threshold
   */
  setVolumeThreshold(threshold: number): void {
    this.minVolumeThreshold = Math.max(0, threshold)
  }

  /**
   * Set smoothing window size
   */
  setSmoothingSize(size: number): void {
    this.historySize = Math.max(1, Math.min(20, size))
  }

  /**
   * Get note range in frequency range
   */
  getNoteRange(minFreq: number, maxFreq: number): string[] {
    if (minFreq >= maxFreq) return []

    const notes: string[] = []
    for (let freq = minFreq; freq <= maxFreq; freq *= Math.pow(2, 1 / 12)) {
      const noteInfo = this.frequencyToNote(freq)
      if (!notes.includes(noteInfo.note)) {
        notes.push(noteInfo.note)
      }
    }
    return notes
  }
}
