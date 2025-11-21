/**
 * @fileoverview Central Type Definitions for Mambo Whistle
 * Serves as the "Contract" between Audio Core and UI.
 */

/**
 * @typedef {Object} PitchFrame
 * The fundamental unit of data flowing from Audio Analysis to Synthesis/UI.
 * 
 * @property {number} frequency - Smoothed frequency in Hz.
 * @property {number} rawFrequency - Raw detected frequency (unstable).
 * @property {string} note - Note name (e.g., "C", "F#").
 * @property {number} octave - Octave number (e.g., 4).
 * @property {number} cents - Deviation from the nearest semitone (-50 to +50).
 * @property {number} confidence - Reliability of the pitch detection (0.0 to 1.0).
 * @property {number} volumeLinear - RMS amplitude (0.0 to 1.0).
 * @property {number} volumeDb - Volume in Decibels.
 * @property {number} brightness - Spectral Centroid normalized (0.0 to 1.0).
 * @property {number} breathiness - Spectral Flatness / Noise ratio (0.0 to 1.0).
 * @property {string} articulation - State: 'silence' | 'attack' | 'sustain' | 'release'.
 * @property {number} captureTime - High-resolution timestamp of capture.
 */

/**
 * @typedef {Object} AudioDevice
 * @property {string} deviceId - Unique browser-generated ID.
 * @property {string} label - Human-readable name.
 * @property {'input'|'output'} kind - Device type.
 */

/**
 * @typedef {Object} AutoTuneConfig
 * @property {boolean} enabled - Is Auto-Tune active?
 * @property {string} key - Root key (e.g., "C", "G").
 * @property {'chromatic'|'major'|'minor'|'pentatonic_major'|'pentatonic_minor'|'blues'} scale - Scale type.
 * @property {number} strength - Correction amount (0.0 = Natural, 1.0 = Robotic).
 * @property {number} speed - Retune speed (0.0 = Instant, 1.0 = Slow).
 */

/**
 * @typedef {Object} AppState
 * The Single Source of Truth for the UI.
 * 
 * @property {Object} status
 * @property {'idle'|'starting'|'running'|'error'} status.engineState - Current engine lifecycle state.
 * @property {string|null} status.lastError - Last reported error message.
 * 
 * @property {Object} audio
 * @property {string} audio.inputDeviceId - Active Microphone ID.
 * @property {string} audio.outputDeviceId - Active Speaker ID.
 * @property {string} audio.lastKnownInputLabel - Last known label for input device.
 * @property {string} audio.lastKnownOutputLabel - Last known label for output device.
 * @property {Array<AudioDevice>} audio.availableInputDevices - List of available input devices.
 * @property {Array<AudioDevice>} audio.availableOutputDevices - List of available output devices.
 * @property {number} audio.latency - Last measured latency in ms.
 * @property {boolean} audio.isWorkletActive - Is AudioWorklet running?
 * 
 * @property {Object} synth
 * @property {string} synth.instrument - Current instrument ID (e.g., 'flute').
 * @property {boolean} synth.continuousMode - True = Portamento/Slide, False = Trigger.
 * @property {AutoTuneConfig} synth.autoTune - Auto-Tune settings.
 * @property {number} synth.reverbWet - Reverb amount (0-1).
 * @property {number} synth.delayWet - Delay amount (0-1).
 * 
 * @property {Object} ui
 * @property {boolean} ui.isSettingsOpen - Is the settings modal visible?
 * @property {boolean} ui.isHelpOpen - Is the help section visible?
 * @property {string} ui.activeView - 'main' | 'visualizer'.
 */

export {}; // Make this a module
