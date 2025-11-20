/**
 * Instrument Presets Configuration
 * 
 * Focused on Continuous Instruments (Monophonic) that map naturally to human voice.
 * Excludes discrete instruments like Piano/Guitar to avoid "Uncanny Valley".
 * 
 * Categories:
 * I. Woodwinds (Flute, Clarinet, Dizi)
 * II. Saxophones (Soprano, Alto)
 * III. Brass (Trumpet, Trombone, Suona)
 * IV. Strings (Violin, Cello, Erhu)
 * V. Reeds (Harmonica)
 */

const instrumentPresets = {
    // --- Woodwinds ---
    flute: {
        type: 'FMSynth',
        name: 'Flute',
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.5 },
        modulation: { type: 'sine' },
        modulationIndex: 2,
        harmonicity: 1,
        portamento: 0.05,
        dynamicModulation: true // Louder = slightly brighter
    },
    clarinet: {
        type: 'FMSynth',
        name: 'Clarinet',
        oscillator: { type: 'square' }, // Odd harmonics (hollow sound)
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.9, release: 0.3 },
        modulation: { type: 'sine' },
        modulationIndex: 3,
        harmonicity: 1.5, // Ratio 2:3 characteristic of clarinet
        portamento: 0.05
    },
    dizi: {
        type: 'FMSynth',
        name: 'Bamboo Flute',
        oscillator: { type: 'sine' },
        envelope: { attack: 0.04, decay: 0.2, sustain: 0.8, release: 0.4 },
        modulation: { type: 'square' }, // Membrane buzz simulation
        modulationIndex: 5, 
        harmonicity: 2, // Higher harmonic buzz
        portamento: 0.04,
        dynamicModulation: true
    },

    // --- Saxophones ---
    soprano_sax: {
        type: 'FMSynth',
        name: 'Soprano Sax',
        oscillator: { type: 'sawtooth' }, // Brighter than Alto
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.4 },
        modulation: { type: 'sine' },
        modulationIndex: 8,
        harmonicity: 1,
        portamento: 0.06,
        dynamicModulation: true
    },
    alto_sax: {
        type: 'FMSynth',
        name: 'Alto Sax',
        oscillator: { type: 'square' }, // Warmer, hollower
        envelope: { attack: 0.08, decay: 0.2, sustain: 0.8, release: 0.4 },
        modulation: { type: 'sine' },
        modulationIndex: 10,
        harmonicity: 3, // Classic FM Sax ratio
        portamento: 0.06,
        dynamicModulation: true
    },

    // --- Brass ---
    trumpet: {
        type: 'FMSynth',
        name: 'Trumpet',
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.2 },
        modulation: { type: 'sine' },
        modulationIndex: 5, // Increases heavily with volume
        harmonicity: 1,
        portamento: 0.02,
        dynamicModulation: true
    },
    trombone: {
        type: 'FMSynth',
        name: 'Trombone',
        oscillator: { type: 'sawtooth' }, // Brass buzz
        envelope: { attack: 0.1, decay: 0.2, sustain: 1, release: 0.5 },
        modulation: { type: 'sine' },
        modulationIndex: 6,
        harmonicity: 1,
        portamento: 0.15, // KEY: Long slides
        dynamicModulation: true
    },
    suona: {
        type: 'FMSynth',
        name: 'Suona',
        oscillator: { type: 'square' }, // Piercing sound
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 },
        modulation: { type: 'sawtooth' }, // Aggressive modulation
        modulationIndex: 15,
        harmonicity: 4, // High frequency harmonics
        portamento: 0.03,
        dynamicModulation: true
    },

    // --- Strings ---
    violin: {
        type: 'MonoSynth',
        name: 'Violin',
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.8 },
        filterEnvelope: { baseFrequency: 600, octaves: 3, attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.8, Q: 2 },
        portamento: 0.08
    },
    cello: {
        type: 'MonoSynth',
        name: 'Cello',
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.15, decay: 0.2, sustain: 0.9, release: 1.5 },
        filterEnvelope: { baseFrequency: 250, octaves: 2.5, attack: 0.2, decay: 0.3, sustain: 0.8, release: 1.0, Q: 1.5 },
        portamento: 0.12
    },
    erhu: {
        type: 'FMSynth', // FM better for that "nasal" vocal quality
        name: 'Erhu',
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.5 },
        modulation: { type: 'sine' },
        modulationIndex: 6,
        harmonicity: 1, // Fundamental resonance
        portamento: 0.1, // Glissando is essential
        dynamicModulation: true
    },

    // --- Reeds ---
    harmonica: {
        type: 'AMSynth', // AM creates the "beating" reed sound
        name: 'Harmonica',
        oscillator: { type: 'square' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.2 },
        modulation: { type: 'square' },
        harmonicity: 1.01, // Detuned slightly for beating effect
        portamento: 0.05
    }
};

export default {
    presets: instrumentPresets
};