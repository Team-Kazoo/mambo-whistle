import * as Tone from '../lib/tone.js';

/**
 * AI Harmonizer using Google Magenta (MusicRNN)
 * 
 * Architecture:
 * - Lazy loads the heavy ML model only when enabled.
 * - Runs as a "Sidechain" to the main audio loop.
 * - Buffers incoming pitch data, quantizes it, and periodically asks the AI for accompaniment.
 * - Manages its own simple PolySynth for backing chords/arpeggios.
 */
export class AiHarmonizer {
    constructor() {
        this.enabled = false;
        this.status = 'idle'; // idle, loading, ready, error
        this.model = null;
        this.backingSynth = null;
        
        // Configuration
        this.checkpointURL = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv';
        this.temperature = 1.1; // Higher = more random/creative
        
        // Data Buffering
        this.noteBuffer = [];
        this.maxBufferLength = 32; // Number of quantized steps to keep
        this.lastProcessTime = 0;
        this.processInterval = 4000; // Generate new backing every 4 seconds
        
        // State
        this.currentChord = null;
        this.isGenerating = false;

        // Event listeners
        this.onStatusChange = null; // Callback for UI updates
    }

    /**
     * Lazy load the Magenta library and model
     */
    async enable() {
        if (this.enabled) return;

        try {
            this._updateStatus('loading', 'Loading Neural Net...');

            // 1. Dynamic Import of Magenta (CDN) to avoid loading it on initial page load
            // We use the global script tag approach for Magenta as it's often more stable for the browser bundle
            if (!window.mm) {
                await this._loadScript('https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/dist/magentamusic.min.js');
            }

            // 2. Initialize Model
            if (!this.model) {
                this.model = new window.mm.MusicRNN(this.checkpointURL);
                await this.model.initialize();
            }

            // 3. Initialize Backing Synth (Simple Pad)
            if (!this.backingSynth) {
                this.backingSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
                    envelope: { attack: 0.2, decay: 0.1, sustain: 0.5, release: 1 }
                }).toDestination();
                
                // Lower volume for backing
                this.backingSynth.volume.value = -12;
                
                // Add some reverb to make it spacey
                const reverb = new Tone.Reverb(3).toDestination();
                this.backingSynth.connect(reverb);
            }

            this.enabled = true;
            this._updateStatus('ready', 'AI Listening...');
            console.log('🤖 AI Harmonizer Ready');

        } catch (error) {
            console.error('AI Harmonizer Failed to Load:', error);
            this._updateStatus('error', 'Model Load Failed');
            this.enabled = false;
        }
    }

    disable() {
        this.enabled = false;
        this.isGenerating = false;
        
        // Release synth voices
        if (this.backingSynth) {
            this.backingSynth.releaseAll();
        }
        
        // We DO NOT dispose the model here to avoid re-downloading/re-initializing cost
        // if the user toggles it back on. Memory vs. Speed trade-off.
        // If memory is critical, we could adding a explicit 'dispose' method.
        
        this._updateStatus('idle', 'AI Off');
    }

    /**
     * Main Process Loop (called by main.js)
     * @param {Object} pitchFrame - The detected pitch data
     */
    processFrame(pitchFrame) {
        if (!this.enabled || !this.model || this.status !== 'ready') return;

        const now = Date.now();

        // 1. Data Collection (Quantize & Buffer)
        // We only care about strong, clear notes for the AI
        if (pitchFrame.clarity > 0.9 && pitchFrame.pitch > 0) {
            this._addToBuffer(pitchFrame.pitch);
        }

        // 2. Trigger Generation Logic
        // If enough time has passed, ask the AI for a new layer
        if (now - this.lastProcessTime > this.processInterval && !this.isGenerating) {
            this._generateBackingSequence();
            this.lastProcessTime = now;
        }
    }

    /**
     * Add a pitch to the circular buffer (Quantized to MIDI)
     */
    _addToBuffer(freq) {
        if (!window.mm) return;

        const midi = window.mm.freqToMidi(freq);
        // Simple deduplication (don't fill buffer with same note 100 times)
        const lastNote = this.noteBuffer[this.noteBuffer.length - 1];
        
        if (lastNote !== midi) {
            this.noteBuffer.push(midi);
            if (this.noteBuffer.length > this.maxBufferLength) {
                this.noteBuffer.shift();
            }
        }
    }

    /**
     * Ask MusicRNN to hallucinate a backing track based on recent notes
     */
    async _generateBackingSequence() {
        if (this.noteBuffer.length < 5) return; // Not enough context
        
        this.isGenerating = true;
        this._updateStatus('processing', 'AI Thinking...');

        try {
            // Convert simple pitch buffer to NoteSequence format
            // This is a simplified representation
            const inputSequence = {
                notes: this.noteBuffer.map((pitch, index) => ({
                    pitch: pitch,
                    startTime: index * 0.25,
                    endTime: (index + 1) * 0.25
                })),
                totalTime: this.noteBuffer.length * 0.25,
                quantizationInfo: { stepsPerQuarter: 4 }
            };

            // The Magic: Continue the sequence
            // We ask for 16 steps (1 bar) of continuation
            const rnnSteps = 16;
            const result = await this.model.continueSequence(inputSequence, rnnSteps, this.temperature);

            // Play the result
            if (result && result.notes) {
                this._playBacking(result.notes);
            }

            this._updateStatus('ready', 'AI Jamming');

        } catch (e) {
            console.warn('AI Generation hiccup:', e);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Play the generated notes using the local backing synth
     */
    _playBacking(notes) {
        const now = Tone.now();
        
        // Play each note in the sequence
        notes.forEach(note => {
            const duration = note.endTime - note.startTime;
            // Scale time to match current approximate tempo (fixed for now)
            const timeOffset = (note.startTime - notes[0].startTime) * 0.5; 
            
            // Convert MIDI to Frequency
            const freq = Tone.Frequency(note.pitch, "midi");
            
            // Trigger
            this.backingSynth.triggerAttackRelease(freq, duration, now + timeOffset + 0.1);
        });
    }

    /**
     * Helper to load the script dynamically
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    _updateStatus(status, message) {
        this.status = status;
        if (this.onStatusChange) {
            this.onStatusChange({ status, message });
        }
    }
}
