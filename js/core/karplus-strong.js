/**
 * Karplus-Strong String Synthesis Model
 * 
 * Implements a physical model of a plucked string using a delay line feedback loop.
 * Algorithm: Burst of Noise -> Delay Line -> Lowpass Filter -> Output
 *                               ^----------------------------|
 * 
 * Features:
 * - Continous Pitch: Modulates delay time to change frequency.
 * - Natural Decay: The feedback loop creates a natural exponential decay.
 * - Real-time Damping: Controls the brightness of the string.
 */

export class KarplusStrong {
    constructor(options = {}) {
        this.options = {
            damping: 0.4,      // Lowpass filter value (0-1 or Hz)
            resonance: 0.96,   // Feedback amount (0-1)
            ...options
        };

        // 1. Excitation Source (The "Pluck")
        this.noise = new Tone.Noise("white");
        this.noiseBurst = new Tone.Envelope({
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.001
        });
        
        this.noiseGain = new Tone.Gain(0);
        
        // 1.5 Excitation Filter (Tone Shaping for the Pluck)
        // Real picks don't produce full-spectrum white noise. They are duller.
        this.excitationFilter = new Tone.Filter({
            type: "lowpass",
            frequency: this.options.pluckDamping || 2000,
            Q: 0.5
        });

        // 2. The String Loop (Delay + Filter + Feedback)
        // We use Tone.LowpassCombFilter as it effectively implements the Karplus-Strong loop
        // It has: delayTime (pitch), resonance (feedback), dampening (filtering)
        this.stringLoop = new Tone.LowpassCombFilter({
            dampening: this.options.damping * 3000, // Map 0-1 to Hz roughly
            resonance: this.options.resonance,
            delayTime: 0.01 // Initial arbitrary value
        });

        // 2.5 Body Resonance (Simulation of the Guitar Body)
        // A fixed filter to smooth out the raw string sound
        this.bodyFilter = new Tone.Filter({
            type: "lowpass",
            frequency: 3000,
            Q: 0.7
        });

        // 3. Output Gain (Volume control)
        this.output = new Tone.Gain(1);
        this.volume = this.output.volume; // Expose volume property for Tone.js compatibility

        // Connections: Noise -> ExcitationFilter -> Gain -> StringLoop -> BodyFilter -> Output
        this.noise.connect(this.excitationFilter);
        this.excitationFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.stringLoop);
        this.stringLoop.connect(this.bodyFilter);
        this.bodyFilter.connect(this.output);
        
        // Initial State
        this.noise.start(); // Noise source always runs, we gate it with noiseGain
        this.currentFrequency = 440;
    }

    /**
     * Trigger the pluck attack
     * @param {number} frequency - Pitch in Hz
     * @param {number} time - AudioContext time
     * @param {number} velocity - Velocity (0-1)
     */
    triggerAttack(frequency, time, velocity = 1) {
        this.currentFrequency = frequency;
        
        // RESET STATE: Ensure string is resonant and output is open
        // This fixes the "one note only" bug where release killed the resonance permanently
        this.stringLoop.resonance.cancelScheduledValues(time);
        this.stringLoop.resonance.setValueAtTime(this.options.resonance, time);
        
        this.output.gain.cancelScheduledValues(time);
        this.output.gain.setValueAtTime(1, time);
        
        // Set Pitch (Delay Time = 1 / Freq)
        const delayTime = 1 / frequency;
        this.stringLoop.delayTime.setValueAtTime(delayTime, time);

        // Trigger Noise Burst (Excitation)
        // We use the Gain node directly controlled by an envelope curve
        this.noiseGain.gain.cancelScheduledValues(time);
        this.noiseGain.gain.setValueAtTime(0, time);
        this.noiseGain.gain.linearRampToValueAtTime(velocity, time + 0.005);
        this.noiseGain.gain.exponentialRampToValueAtTime(0, time + 0.05); // Short burst
    }

    /**
     * Release the note (Dampen the string)
     * @param {number} time 
     */
    triggerRelease(time) {
        // In physical modeling, release is just muting the resonance or output
        this.stringLoop.resonance.rampTo(0, 0.1, time);
        this.output.gain.rampTo(0, 0.2, time);
    }

    /**
     * Continuous frequency update (for slides/vibrato)
     * @param {number} frequency 
     * @param {number} rampTime 
     */
    setFrequency(frequency, rampTime = 0.01) {
        if (!frequency || frequency <= 0) return;
        this.currentFrequency = frequency;
        const delayTime = 1 / frequency;
        this.stringLoop.delayTime.rampTo(delayTime, rampTime);
    }

    /**
     * Connect to destination or other nodes
     */
    connect(destination) {
        this.output.connect(destination);
        return this;
    }

    /**
     * Cleanup
     */
    dispose() {
        this.noise.dispose();
        this.excitationFilter.dispose();
        this.noiseGain.dispose();
        this.stringLoop.dispose();
        this.bodyFilter.dispose();
        this.output.dispose();
        this.noiseBurst.dispose();
    }
    
    // Property proxies for compatibility
    get frequency() {
        // Return a proxy object that has a rampTo method
        return {
            value: this.currentFrequency,
            rampTo: (val, time) => this.setFrequency(val, time),
            setValueAtTime: (val, time) => this.setFrequency(val, 0) // Immediate
        };
    }
}