// ai-harmonizer.js - Fixed version with proper Magenta integration
const Tone = (typeof window !== 'undefined' && window.Tone) ? window.Tone : null;

/**
 * AI Harmonizer using Google Magenta (MusicRNN)
 *
 * FIXED (2025-11-23):
 * - Removed dynamic script loading (scripts are already in HTML)
 * - Fixed MusicRNN model initialization
 * - Fixed freqToMidi conversion (custom implementation)
 * - Improved error handling and logging
 */
export class AiHarmonizer {
    constructor() {
        this.enabled = false;
        this.status = 'idle'; // idle, loading, ready, processing, error
        this.model = null;
        this.backingSynth = null;

        // Configuration
        this.checkpointURL = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn';
        this.temperature = 1.1; // Creativity level (0.5-1.5)

        // Data Buffering
        this.noteBuffer = [];
        this.maxBufferLength = 32; // Number of quantized notes to keep
        this.lastProcessTime = 0;
        this.processInterval = 4000; // Generate every 4 seconds

        // State
        this.currentChord = null;
        this.isGenerating = false;

        // Event listeners
        this.onStatusChange = null; // Callback for UI updates

        // Validation
        if (!Tone) {
            console.warn('[AI Harmonizer] Tone.js not available');
        }

        // Check if Magenta is loaded
        if (typeof window === 'undefined' || !window.music_rnn) {
            console.warn('[AI Harmonizer] Magenta not loaded. Add Magenta scripts to HTML.');
        }
    }

    /**
     * Initialize and enable AI Harmonizer
     */
    async enable() {
        if (this.enabled) {
            console.log('[AI Harmonizer] Already enabled');
            return;
        }

        if (!Tone) {
            throw new Error('Tone.js not available – cannot enable AI Jam');
        }

        if (!window.music_rnn) {
            throw new Error('Magenta MusicRNN not loaded. Check HTML script tags.');
        }

        try {
            this._updateStatus('loading', 'Loading Neural Net...');

            // Ensure AudioContext is running (requires user gesture)
            if (Tone.context.state !== 'running') {
                await Tone.start();
                console.log('[AI Harmonizer] AudioContext resumed');
            }

            // Initialize MusicRNN Model
            if (!this.model) {
                console.log('[AI Harmonizer] Creating MusicRNN model from:', this.checkpointURL);
                this.model = new window.music_rnn.MusicRNN(this.checkpointURL);

                console.log('[AI Harmonizer] Initializing model (this may take 2-3 seconds)...');
                await this.model.initialize();

                console.log('[AI Harmonizer] ✓ Model initialized successfully');
            }

            // Initialize Backing Synth
            if (!this.backingSynth) {
                this.backingSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: {
                        type: "fatsawtooth",
                        count: 3,
                        spread: 30
                    },
                    envelope: {
                        attack: 0.2,
                        decay: 0.1,
                        sustain: 0.5,
                        release: 1
                    }
                }).toDestination();

                // Lower volume for backing track
                this.backingSynth.volume.value = -12;

                // Add reverb for spacious sound
                const reverb = new Tone.Reverb(3).toDestination();
                this.backingSynth.connect(reverb);

                console.log('[AI Harmonizer] ✓ Backing synth created');
            }

            this.enabled = true;
            this._updateStatus('ready', 'AI Listening...');
            console.log('🤖 [AI Harmonizer] Ready');

        } catch (error) {
            console.error('[AI Harmonizer] ❌ Failed to load:', error);
            this._updateStatus('error', error.message || 'Model Load Failed');
            this.enabled = false;
            throw error; // Re-throw so UI can handle it
        }
    }

    /**
     * Disable AI Harmonizer
     */
    disable() {
        this.enabled = false;
        this.isGenerating = false;

        // Release all synth voices
        if (this.backingSynth) {
            this.backingSynth.releaseAll();
        }

        // Clear buffer
        this.noteBuffer = [];

        this._updateStatus('idle', 'AI Off');
        console.log('[AI Harmonizer] Disabled');
    }

    /**
     * Process incoming pitch frame (called from main audio loop)
     * @param {Object} pitchFrame - { frequency, confidence, ... }
     */
    processFrame(pitchFrame = {}) {
        if (!this.enabled || !this.model || this.status !== 'ready') return;

        const now = Date.now();

        // Extract confidence and frequency (support multiple property names)
        const clarity = pitchFrame.confidence ?? pitchFrame.clarity ?? 0;
        const frequency = pitchFrame.frequency ?? pitchFrame.pitch ?? 0;

        // Only buffer high-confidence notes
        if (clarity > 0.9 && frequency > 0) {
            this._addToBuffer(frequency);
        }

        // Trigger generation periodically
        if (now - this.lastProcessTime > this.processInterval && !this.isGenerating) {
            this._generateBackingSequence();
            this.lastProcessTime = now;
        }
    }

    /**
     * Add pitch to buffer (convert to MIDI and deduplicate)
     */
    _addToBuffer(freq) {
        const midi = this._freqToMidi(freq);

        // Deduplication: don't add same note repeatedly
        const lastNote = this.noteBuffer[this.noteBuffer.length - 1];

        if (lastNote !== midi) {
            this.noteBuffer.push(midi);

            // Circular buffer: remove oldest if exceeds max length
            if (this.noteBuffer.length > this.maxBufferLength) {
                this.noteBuffer.shift();
            }

            // Debug log (optional, can comment out)
            // console.log('[AI Harmonizer] Buffered note:', midi, `(${this.noteBuffer.length}/${this.maxBufferLength})`);
        }
    }

    /**
     * Convert frequency to MIDI number
     * Formula: MIDI = 69 + 12 * log2(freq / 440)
     * @param {number} freq - Frequency in Hz
     * @returns {number} MIDI note number (rounded)
     */
    _freqToMidi(freq) {
        return Math.round(69 + 12 * Math.log2(freq / 440));
    }

    /**
     * Generate backing sequence using MusicRNN
     */
    async _generateBackingSequence() {
        // Need at least 5 notes for meaningful context
        if (this.noteBuffer.length < 5) {
            console.log('[AI Harmonizer] Not enough notes buffered (need 5, have', this.noteBuffer.length, ')');
            return;
        }

        this.isGenerating = true;
        this._updateStatus('processing', 'AI Thinking...');

        try {
            // Create unquantized NoteSequence from buffer
            const unquantizedSeq = {
                notes: this.noteBuffer.map((pitch, index) => ({
                    pitch: pitch,
                    startTime: index * 0.5,
                    endTime: (index + 1) * 0.5
                })),
                totalTime: this.noteBuffer.length * 0.5
            };

            console.log('[AI Harmonizer] Input sequence:', unquantizedSeq.notes.length, 'notes');

            // Quantize using Magenta's quantizer (CRITICAL!)
            const quantizedSeq = window.core.sequences.quantizeNoteSequence(unquantizedSeq, 4);

            // Generate continuation (16 steps ≈ 1 bar)
            const rnnSteps = 16;
            const result = await this.model.continueSequence(
                quantizedSeq,
                rnnSteps,
                this.temperature
            );

            console.log('[AI Harmonizer] ✓ Generated', result?.notes?.length || 0, 'notes');

            // Play the result
            if (result && result.notes && result.notes.length > 0) {
                this._playBacking(result.notes);
                this._updateStatus('ready', 'AI Jamming ♪');
            } else {
                console.warn('[AI Harmonizer] No notes generated');
                this._updateStatus('ready', 'AI Listening...');
            }

        } catch (error) {
            console.error('[AI Harmonizer] ❌ Generation error:', error);
            this._updateStatus('ready', 'AI Listening...');
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Play generated notes using backing synth
     */
    _playBacking(notes) {
        if (!Tone || !this.backingSynth) {
            console.warn('[AI Harmonizer] Cannot play: Tone.js or synth not available');
            return;
        }

        const now = Tone.now();

        console.log('[AI Harmonizer] 🎵 Playing', notes.length, 'notes');

        notes.forEach(note => {
            const duration = (note.endTime - note.startTime) || 0.25;
            const timeOffset = (note.startTime - notes[0].startTime) * 0.5; // Slow down tempo

            // Convert MIDI to frequency
            const freq = Tone.Frequency(note.pitch, "midi");

            // Trigger note
            this.backingSynth.triggerAttackRelease(
                freq,
                duration,
                now + timeOffset + 0.1 // Small delay to avoid click
            );
        });
    }

    /**
     * Update status and notify listeners
     */
    _updateStatus(status, message) {
        this.status = status;
        console.log(`[AI Harmonizer] Status: ${status} - ${message}`);

        if (this.onStatusChange) {
            this.onStatusChange({ status, message });
        }
    }
}
