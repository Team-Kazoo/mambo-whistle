/**
 * Main Controller - Calibration-Free Version
 * Minimalist Design: Select Instrument -> Start Playing
 *
 * Integrates AudioIO low-latency audio abstraction layer
 * Integrates ExpressiveFeatures pipeline
 * Integrates centralized configuration management system
 * Step 2: Migrate global variables to AppContainer (Dependency Injection)
 */

import configManager from './config/app-config.js';
import { checkBrowserSupport, calculateRMS } from './utils/audio-utils.js';
import { AppContainer } from './core/app-container.js';
import { ExpressiveFeatures } from './expressive-features.js';
import instrumentPresetManager from './config/instrument-presets.js';
import { ContinuousSynthEngine } from './continuous-synth.js'; // Fixed: Import class
import { AiHarmonizer } from './features/ai-harmonizer.js';
import { VisualizerManager } from './managers/visualizer-manager.js'; // Import the new visualizer manager
import { SynthManager } from './managers/synth-manager.js'; // Import SynthManager
import { AudioLoopController } from './core/audio-loop-controller.js'; // Import AudioLoopController
import { TIMING_CONSTANTS } from './config/constants.js';
import { store } from './state/store.js'; // Import StateStore singleton
import { SafeUI } from './utils/safe-ui.js'; // Import SafeUI wrapper
import { MamboView } from './ui/mambo-view.js'; // Import View Layer

class MamboApp {
    /**
     * Step 2: Dependency Injection Constructor
     * @param {Object} services - Injected services object
     * @param {Object} services.config - App configuration
     * @param {Object} services.configManager - Config manager
     * @param {Object} services.pitchDetector - Pitch detector
     * @param {Object} services.performanceMonitor - Performance monitor
     * @param {Object} services.synthesizerEngine - Legacy synthesizer engine
     * @param {Object} services.continuousSynthEngine - Continuous synthesizer engine
     * @param {Object} services.aiHarmonizer - AI Harmonizer module
     * @param {Function} services.ExpressiveFeatures - Expressive features extraction class
     * @param {Object} services.visualizerManager - Visualizer manager module
     * @param {Object} services.synthManager - Synth manager (bridge to engines)
     * @param {Object} services.audioLoopController - Audio loop controller
     * @param {Object} services.store - State store (centralized state management)
     */
    constructor(services = {}) {
        this.isRunning = false;

        // Step 2: Injected services (prefer injected, fallback to global)
        this.config = services.config || null;
        this.configManager = services.configManager || null;
        this.pitchDetector = services.pitchDetector || null;
        this.performanceMonitor = services.performanceMonitor || null;
        this.synthesizerEngine = services.synthesizerEngine || null;
        this.continuousSynthEngine = services.continuousSynthEngine || null;
        this.aiHarmonizer = services.aiHarmonizer || null;
        this.ExpressiveFeatures = services.ExpressiveFeatures || null;
        this.visualizerManager = services.visualizerManager || null;
        this.synthManager = services.synthManager || null; // Injected SynthManager
        this.audioLoopController = services.audioLoopController || null; // Injected Controller
        this.store = services.store || null; // Injected State Store
        
        // View Layer
        this.view = new MamboView(document);

        // Audio System
        // AudioIO is the only supported audio system (AudioWorklet + ScriptProcessor fallback)
        // Legacy audioInputManager is deprecated, code kept for reference only
        this.audioIO = null;  // AudioIO instance (Only audio system)

        // Dual Engine Mode
        this.useContinuousMode = true;  // Default to Continuous Mode (Phase 2.7 Verified)
        this.currentEngine = null;      // Currently active engine

        // Expressive Feature Extraction
        this.expressiveFeatures = null;  // ExpressiveFeatures instance

        // UI Elements
        this.ui = {
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            helpBtn: document.getElementById('helpBtn'),
            helpToggle: document.getElementById('helpToggle'),
            helpContent: document.getElementById('helpContent'),
            helpSection: document.getElementById('tipsSection'),
            // warningBox, warningText now cached in MamboView

            // Mode Toggle
            modeToggle: document.getElementById('modeToggle'),
            modeText: document.getElementById('modeText'),
            navLinks: document.querySelectorAll('[data-scroll-target]'),
            
            // AI Jam Button
            aiJamBtn: document.getElementById('aiJamBtn'),
            aiProgressBar: document.getElementById('aiProgressBar'),
            aiIconIdle: document.getElementById('aiIconIdle'),
            aiIconLoading: document.getElementById('aiIconLoading'),
            aiIconActive: document.getElementById('aiIconActive'),
            aiJamTitle: document.getElementById('aiJamTitle'),
            aiJamStatus: document.getElementById('aiJamStatus'),

            // Status Badges
            instrumentStatus: document.getElementById('instrumentStatus'),
            recordingStatus: document.getElementById('recordingStatus'),
            // recordingHelper, systemStatus now cached in MamboView

            // Status and Visualization
            statusBar: document.getElementById('statusBar'),
            visualizer: document.getElementById('visualizer'),
            currentNote: document.getElementById('currentNote'),
            currentFreq: document.getElementById('currentFreq'),

            // Visualizer-specific metrics (inside canvas panel)
            visualizerLatency: document.getElementById('visualizerLatency'),
            visualizerConfidence: document.getElementById('visualizerConfidence'),
            
            // Export Button
            exportBtn: document.getElementById('exportBtn'),

            // Instrument Buttons
            instrumentBtns: document.querySelectorAll('.instrument-btn'),

            // Device Selection
            audioInputSelect: document.getElementById('audioInputSelect'),
            audioOutputSelect: document.getElementById('audioOutputSelect'),
            refreshDevicesBtn: document.getElementById('refreshDevicesBtn'),

            // Auto-Tune UI
            autoTuneToggle: document.getElementById('autoTuneToggle'),
            scaleKeySelect: document.getElementById('scaleKeySelect'),
            scaleTypeSelect: document.getElementById('scaleTypeSelect'),
            strengthSlider: document.getElementById('strengthSlider'),
            speedSlider: document.getElementById('speedSlider'),
            strengthValue: document.getElementById('strengthValue'),
            speedValue: document.getElementById('speedValue'),

            // Settings Modal
            // Settings Modal elements now cached in MamboView

            // Effects UI
            reverbSlider: document.getElementById('reverbSlider'),
            delaySlider: document.getElementById('delaySlider'),
            reverbValue: document.getElementById('reverbValue'),
            delayValue: document.getElementById('delayValue')
        };


        // 可视化设置

        // Device State
        this.selectedInputId = 'default';
        this.selectedOutputId = 'default';
        this.lastKnownInputLabel = 'System Default';
        this.lastKnownOutputLabel = 'System Default';
        this._loadDevicePreferences();
        this.selectedInstrument = 'flute'; // Track user selection before start
    }

    /**
     * Initialize Application
     * Step 2: Use injected configManager
     */
    async initialize() {
        console.log('Initializing Mambo Whistle (No-Calibration Version)...');

        // Step 2: Use injected configManager (fallback to global if not injected)
        const manager = this.configManager || configManager;

        // Load centralized configuration
        try {
            // If config was not injected in constructor, load it now
            if (!this.config) {
                this.config = manager.load();  // Load default config
            }
            console.log('[Config] Loaded default configuration:', {
                sampleRate: this.config.audio.sampleRate,
                bufferSize: this.config.audio.bufferSize,
                useWorklet: this.config.audio.useWorklet
            });
        } catch (error) {
            console.error('[Config] Failed to load configuration:', error);
            console.error('[Config] Using emergency fallback values');
            // Real fallback: Use hardcoded minimal viable config (must match app-config.js structure)
            this.config = {
                audio: { sampleRate: 44100, bufferSize: 2048, workletBufferSize: 128, useWorklet: true },
                pitchDetector: { clarityThreshold: 0.9, minFrequency: 80, maxFrequency: 800 },
                smoothing: {
                    kalman: { processNoise: 0.001, measurementNoise: 0.1, initialEstimate: 0, initialError: 1 },
                    volume: { alpha: 0.3 },
                    brightness: { alpha: 0.2 }
                },
                onset: { energyThreshold: 6, silenceThreshold: -40, attackDuration: 50, minSilenceDuration: 100, timeWindow: 3, debug: false },
                spectral: { fftSize: 2048, fftInterval: 2, minFrequency: 80, maxFrequency: 8000 },
                synthesizer: { pitchBendRange: 100, filterCutoffRange: { min: 200, max: 8000 }, noiseGainMax: 0.3 },
                performance: { enableStats: true, logLevel: 'info' }
            };
        }

        // Check compatibility
        this.checkCompatibility();

        // Initialize SafeUI wrapper for null-safe DOM manipulation
        this.safeUI = new SafeUI(this.ui);
        console.log('[Main] SafeUI wrapper initialized');

        // Bind events
        this.bindEvents();

        // Initialize visualization
        if (this.visualizerManager) {
            this.visualizerManager.init();
            console.log('[Main] VisualizerManager initialized.');
        }


        // Populate device list (initial attempt)
        // Note: Without permission, labels might be empty or list incomplete
        this._refreshDeviceList();

        if (navigator.mediaDevices?.addEventListener && !this._deviceChangeListener) {
            this._deviceChangeListener = () => {
                console.log('[Main] Media device change detected, refreshing list...');
                this._refreshDeviceList();
            };
            navigator.mediaDevices.addEventListener('devicechange', this._deviceChangeListener);
        }

        // Initialize Auto-Tune UI State
        if (this.ui.autoTuneToggle) {
            // Default off
            this.ui.autoTuneToggle.checked = false;
            this._updateAutoTuneState();
        }

        console.log('App initialized - Ready to play!');
    }

    /**
     * Check Browser Compatibility
     */
    checkCompatibility() {
        const support = checkBrowserSupport();

        if (!support.isSupported) {
            this.view.renderWarning(support.issues);
        }
    }

    /**
     * Bind UI Events
     */
    bindEvents() {
        // Setup Audio Loop UI Updates
        if (this.audioLoopController) {
            this.audioLoopController.onStatsUpdate = (stats) => {
                const { pitchFrame, latency } = stats;

                // Update Pitch Info (in visualizer)
                if (this.ui.currentNote) this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
                if (this.ui.currentFreq) this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;

                // Update Visualizer Metrics (inside canvas panel)
                if (this.ui.visualizerConfidence) this.ui.visualizerConfidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;
                if (this.ui.visualizerLatency) this.ui.visualizerLatency.textContent = `${latency}ms`;
            };
        }

        // Start/Stop - Note: UIManager also binds these, check for double triggers
        // Legacy Direct Binding Removed - Now handled by _setupTransportUI

        // Export Session
        if (this.ui.exportBtn) {
            this.ui.exportBtn.addEventListener('click', () => {
                if (this.visualizerManager) {
                    this.visualizerManager.exportSessionImage();
                }
            });
        }

        // UI Setup
        this._setupSettingsUI();
        this._setupDeviceUI();

        // Transport (Start/Stop/Mode) - State Driven
        this._setupTransportUI();

        // Auto-Tune & Effects
        this._setupAutoTuneUI();
        this._setupEffectsUI();

        // Instruments (State-Driven)
        this._setupInstrumentUI();

        // 帮助
        this._setupHelpUI();
        this._setupAiJamUI();
        this._setupKeyboardShortcuts();
    }

    /**
     * Setup Instrument UI interactions (State-Driven)
     * @private
     */
    _setupInstrumentUI() {
        this.view.bindInstrumentUI({
            onSelectInstrument: (instrumentId) => {
                // 1. Update internal tracking (legacy support)
                this.selectedInstrument = instrumentId;

                // 2. Update Manager (Audio Engine)
                if (this.synthManager) {
                    this.synthManager.setInstrument(instrumentId);
                } else if (this.currentEngine && this.currentEngine.changeInstrument) {
                     // Fallback if SynthManager not ready (unlikely)
                     this.currentEngine.changeInstrument(instrumentId);
                }
                
                // 3. Update Store (Source of Truth)
                // Note: SynthManager.setInstrument already updates store, 
                // but good practice to ensure store is updated if manager isn't used.
                if (this.store) {
                    this.store.setInstrument(instrumentId);
                }
            }
        });
    }

    /**
     * Setup AI Jam UI interactions (State-Driven)
     * @private
     */
    _setupAiJamUI() {
        // 1. Bind UI Events -> Controller Actions
        this.view.bindAiJamUI({
            onToggleAiJam: async () => {
                if (!this.aiHarmonizer) return;

                try {
                    // Ensure Audio Context is running
                    if (Tone.context.state !== 'running') {
                        await Tone.start();
                        console.log('[AI Jam] AudioContext resumed by user click');
                    }

                    // Toggle AI Harmonizer
                    if (this.aiHarmonizer.enabled) {
                        this.aiHarmonizer.disable();
                    } else {
                        await this.aiHarmonizer.enable();
                    }
                } catch (err) {
                    console.error('[AI Jam] Click handler error:', err);
                    alert("Please click 'Start Engine' first to enable audio features.");
                }
            }
        });

        // 2. Connect AI Harmonizer Status Changes to View Rendering
        if (this.aiHarmonizer) {
            this.aiHarmonizer.onStatusChange = ({ status, message }) => {
                console.log(`[AI Jam] Status: ${status} - ${message}`);

                // Render new state via View layer
                this.view.renderAiJam({ status, message });
            };
        }

        // 3. Initial Render
        this.view.renderAiJam({ status: 'idle' });
    }

    /**
     * Setup Auto-Tune UI interactions
     * @private
     */
    _setupAutoTuneUI() {
        const updateAutoTune = () => this._updateAutoTuneState();

        if (this.ui.autoTuneToggle) this.ui.autoTuneToggle.addEventListener('change', updateAutoTune);
        
        if (this.ui.scaleKeySelect) {
            this.ui.scaleKeySelect.addEventListener('change', (e) => {
                if (this.synthManager) {
                    this.synthManager.setAutoTuneConfig({ key: e.target.value });
                }
            });
        }

        if (this.ui.scaleTypeSelect) {
            this.ui.scaleTypeSelect.addEventListener('change', (e) => {
                if (this.synthManager) {
                    this.synthManager.setAutoTuneConfig({ scale: e.target.value });
                }
            });
        }

        // Helper for Segmented Controls (State-Driven)
        const setupSegmentedControl = (containerId, onSelect, defaultValue) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const buttons = container.querySelectorAll('button');

            const updateState = (selectedVal) => {
                // Delegate rendering to View layer
                this.view.renderSegmentedControl(container, selectedVal);
                onSelect(parseFloat(selectedVal));
            };

            // Bind clicks
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    updateState(btn.dataset.value);
                    // Also toggle Main Switch if user interacts with controls
                    if (this.ui.autoTuneToggle && !this.ui.autoTuneToggle.checked) {
                        this.ui.autoTuneToggle.checked = true;
                        this._updateAutoTuneState();
                    }
                });
            });

            // Initialize
            updateState(defaultValue);
        };

        // Init Segmented Controls
        setupSegmentedControl('strengthControl', (val) => {
            // console.log(`[UI] Strength selected: ${val}`);
            // Store for toggle logic
            this._lastStrengthVal = val; 
            if (this.synthManager) {
                this.synthManager.setAutoTuneConfig({ strength: val });
            }
        }, 1.0); // Default Hard (so toggle ON has immediate effect)

        setupSegmentedControl('speedControl', (val) => {
            // console.log(`[UI] Speed selected: ${val}`);
            if (this.synthManager) {
                this.synthManager.setAutoTuneConfig({ speed: val });
            }
        }, 0.0); // Default Robot (Fast)
    }

    /**
     * Setup Transport UI interactions (State-Driven)
     * @private
     */
    _setupTransportUI() {
        // 1. Bind UI Events -> Controller Actions
        this.view.bindTransportUI({
            onStart: () => this.start(),
            onStop: () => this.stop(),
            onModeChange: (isContinuous) => {
                if (this.isRunning) {
                    alert('Please stop playback before switching modes.');
                    // Revert toggle visually (store hasn't changed yet)
                    // Actually, simply calling renderTransport with CURRENT state will revert it
                    this.view.renderTransport(this.store.getState().status, this.store.getState().synth);
                    return;
                }
                this.switchMode(isContinuous);
            }
        });

        // Note: Subscription is handled centrally in _setupEffectsUI (or we can move it to a central `_setupSubscriptions` method later)
        // For now, we'll piggyback on the existing subscription or ensure it covers this.
    }

    /**
     * Setup Effects UI interactions (State-Driven)
     * @private
     */
    _setupEffectsUI() {
        // 1. Bind UI Events -> Controller Actions
        this.view.bindEffectsUI({
            onReverbChange: (percent) => {
                const wet = percent / 100;
                // Update Audio Engine
                if (this.synthManager) this.synthManager.setReverb(wet);
                // Update State (Source of Truth)
                if (this.store) this.store.setReverbWet(wet);
            },
            onDelayChange: (percent) => {
                const wet = percent / 100;
                if (this.synthManager) this.synthManager.setDelay(wet);
                if (this.store) this.store.setDelayWet(wet);
            }
        });

        // 2. Subscribe to State Changes -> UI Render
        if (this.store) {
            this.store.subscribe((newState) => {
                this.view.renderEffects(newState.synth);
                this.view.renderTransport(newState.status, newState.synth);
                this.view.renderInstrument(newState.synth);
            });
            
            // 3. Initial Render
            const state = this.store.getState();
            this.view.renderEffects(state.synth);
            this.view.renderTransport(state.status, state.synth);
            this.view.renderInstrument(state.synth);
        }
    }

    /**
     * Setup Settings Modal UI (State-Driven)
     * @private
     */
    _setupSettingsUI() {
        // Bind UI Events -> Controller Actions
        this.view.bindSettingsUI({
            onOpenSettings: () => {
                this.view.renderSettingsModal(true);
            },
            onCloseSettings: () => {
                this.view.renderSettingsModal(false);
            }
        });
    }

    /**
     * Setup Device Select UI (State-Driven)
     * @private
     */
    _setupDeviceUI() {
        // 1. Bind UI Events -> Controller Actions
        this.view.bindDeviceSelectUI({
            onInputDeviceChange: async (deviceId) => {
                const selectedLabel = this.view.getSelectedDeviceLabel('input');

                this.selectedInputId = deviceId;
                this.lastKnownInputLabel = selectedLabel;
                this._persistDevicePreference('input', deviceId, selectedLabel);
                this._updateDeviceHelperText();

                console.log(`[Main] Input device selected: ${deviceId}`);

                // If running, restart to apply new microphone
                if (this.isRunning && this.audioIO) {
                    console.log('[Main] Restarting audio to apply new input device...');
                    const originalText = this.view.systemStatus?.textContent || '';
                    this.view.renderStatusMessage('Switching Mic...');

                    try {
                        await this.audioIO.stop();
                        this.audioIO.configure({ inputDeviceId: deviceId });
                        await this.audioIO.start();
                        console.log('[Main] Audio restarted with new input.');
                        this.view.renderStatusMessage(originalText);
                    } catch (err) {
                        console.error('[Main] Failed to switch input:', err);
                        this._showError('Failed to switch microphone: ' + err.message);
                    }
                }
            },

            onOutputDeviceChange: async (deviceId) => {
                const selectedLabel = this.view.getSelectedDeviceLabel('output');

                this.selectedOutputId = deviceId;
                this.lastKnownOutputLabel = selectedLabel;
                this._persistDevicePreference('output', deviceId, selectedLabel);
                this._updateDeviceHelperText();

                console.log(`[Main] Output device selected: ${deviceId}`);

                // If running, update immediately
                if (this.audioIO) {
                    try {
                        await this.audioIO.setAudioOutputDevice(deviceId);
                    } catch (err) {
                        console.error('[Main] Failed to set output:', err);
                    }
                }
            },

            onRefreshDevices: () => {
                this._refreshDeviceList();
            }
        });
    }

    /**
     * Setup Help Section UI (State-Driven)
     * @private
     */
    _setupHelpUI() {
        this.view.bindHelpUI({
            onHelpBtnClick: () => {
                this.openHelpSection();
                this.scrollToSection('tipsSection');
            },
            onHelpToggle: () => {
                const isOpen = this.view.toggleHelp();
                if (isOpen) {
                    this.scrollToSection('tipsSection');
                }
            }
        });

        if (this.ui.navLinks) {
            this.ui.navLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const targetId = link.dataset.scrollTarget;
                    this.scrollToSection(targetId);
                });
            });
        }
    }

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 'T' for Auto-Tune Toggle
            if (e.key.toLowerCase() === 't') {
                const state = this.store.getState().synth;
                if (state.continuousMode && this.synthManager) {
                    const currentStrength = state.autoTune.strength || 0;
                    const newStrength = currentStrength > 0.5 ? 0.0 : 1.0; // Toggle 0 <-> 1
                    const isEnabled = newStrength > 0;
                    
                    this.synthManager.setAutoTuneConfig({ 
                        strength: newStrength,
                        enabled: isEnabled
                    });
                    
                    // Visual Feedback
                    const originalText = `Running (${state.continuousMode ? 'Continuous' : 'Legacy'})`;
                    console.log(`[Main] 🎹 Auto-Tune toggled ${isEnabled ? 'ON' : 'OFF'} (Strength: ${newStrength})`);

                    // Clear previous timeout if exists
                    if (this._statusTimeout) clearTimeout(this._statusTimeout);

                    // Show temporary status with auto-restore
                    this._statusTimeout = this.view.renderStatusMessage(
                        `Auto-Tune: ${isEnabled ? 'ON' : 'OFF'}`,
                        {
                            highlight: true,
                            timeout: 2000,
                            restoreText: this.isRunning ? originalText : ''
                        }
                    );
                } else {
                    console.log('[Main] ⚠️ Auto-Tune only available in Continuous Mode');
                }
            }
        });
    }


    /**
     * Refresh audio device list
     * Uses a temporary AudioIO instance to enumerate devices
     */
    async _refreshDeviceList() {
        console.log('[Main] Refreshing device list...');
        
        // Use temp AudioIO if main one doesn't exist
        const tempAudioIO = this.audioIO || new AudioIO();
        
        try {
            let { inputs, outputs } = await tempAudioIO.enumerateDevices();

            // Check if labels are missing
            const hasEmptyLabels = inputs.some(d => !d.label) || outputs.some(d => !d.label);
            
            if (hasEmptyLabels) {
                console.warn('[Main] Device labels missing.');
                
                if (this.isRunning && this.audioIO && this.audioIO.stream) {
                    // Case A: App is running, so we HAVE permission. 
                    // Chrome sometimes needs a moment after getUserMedia to populate labels.
                    console.log('[Main] App is running, retrying enumeration in 500ms...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const retry = await tempAudioIO.enumerateDevices();
                    inputs = retry.inputs;
                    outputs = retry.outputs;
                } else {
                    // Case B: App is stopped. We need to ask for permission.
                    console.log('[Main] App is stopped, requesting temporary permission...');
                    
                    // Visual feedback
                    const originalText = this.ui.refreshDevicesBtn ? this.ui.refreshDevicesBtn.innerText : '';
                    if (this.ui.refreshDevicesBtn) this.ui.refreshDevicesBtn.innerText = 'Requesting Permission...';
                    
                    try {
                        // Request explicit permission
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        // Stop immediately
                        stream.getTracks().forEach(t => t.stop());
                        
                        // Re-enumerate
                        const result = await tempAudioIO.enumerateDevices();
                        inputs = result.inputs;
                        outputs = result.outputs;
                        console.log('[Main] Permissions granted. Devices refreshed.');
                    } catch (err) {
                        console.error('[Main] Permission request failed:', err);
                        // Don't alert here to avoid spamming the user if they denied it
                    } finally {
                        if (this.ui.refreshDevicesBtn) this.ui.refreshDevicesBtn.innerText = originalText;
                    }
                }
            }
            
            // Render device selects via View layer
            const desiredInputVal = this.selectedInputId || this.ui.audioInputSelect?.value || 'default';
            const desiredOutputVal = this.selectedOutputId || this.ui.audioOutputSelect?.value || 'default';

            this.view.renderDeviceSelects({
                inputDevices: inputs,
                outputDevices: outputs,
                selectedInputId: desiredInputVal,
                selectedOutputId: desiredOutputVal,
                lastKnownInputLabel: this.lastKnownInputLabel,
                lastKnownOutputLabel: this.lastKnownOutputLabel
            });

            // Refresh button animation via View layer
            this.view.renderDeviceRefreshState(true);
            setTimeout(() => this.view.renderDeviceRefreshState(false), 500);
            this._updateDeviceHelperText();

        } catch (error) {
            console.error('[Main] Failed to refresh devices:', error);
        }
    }

    _captureActiveDeviceState() {
        const inputTrack = this.audioIO?.stream?.getAudioTracks?.()[0];
        if (inputTrack) {
            const settings = inputTrack.getSettings ? inputTrack.getSettings() : {};
            let appliedId = settings.deviceId;
            const label = inputTrack.label || this.lastKnownInputLabel;
            if (!appliedId && label) {
                appliedId = this._findDeviceIdByLabel(this.ui.audioInputSelect, label);
            }
            if (appliedId) {
                this.selectedInputId = appliedId;
                this._persistDevicePreference('input', appliedId, label);
                this._syncSelectValue(this.ui.audioInputSelect, appliedId, label);
            }
            if (label) {
                this.lastKnownInputLabel = label;
            }
        }

        if (this.ui.audioOutputSelect) {
            const label = this.view.getSelectedDeviceLabel('output');
            this.lastKnownOutputLabel = label;
            this._persistDevicePreference('output', this.selectedOutputId || 'default', label);
        }

        this._updateDeviceHelperText();
    }

    _loadDevicePreferences() {
        try {
            const savedInput = localStorage.getItem('mambo:lastInputDeviceId');
            const savedOutput = localStorage.getItem('mambo:lastOutputDeviceId');
            const savedInputLabel = localStorage.getItem('mambo:lastInputDeviceLabel');
            const savedOutputLabel = localStorage.getItem('mambo:lastOutputDeviceLabel');
            if (savedInput) this.selectedInputId = savedInput;
            if (savedOutput) this.selectedOutputId = savedOutput;
            if (savedInputLabel) this.lastKnownInputLabel = savedInputLabel;
            if (savedOutputLabel) this.lastKnownOutputLabel = savedOutputLabel;
        } catch (err) {
            console.warn('[Main] Unable to load saved device preferences:', err);
        }
    }

    _persistDevicePreference(type, deviceId, label) {
        try {
            const idKey = type === 'input' ? 'mambo:lastInputDeviceId' : 'mambo:lastOutputDeviceId';
            const labelKey = type === 'input' ? 'mambo:lastInputDeviceLabel' : 'mambo:lastOutputDeviceLabel';
            localStorage.setItem(idKey, deviceId || 'default');
            if (label) {
                localStorage.setItem(labelKey, label);
            }
        } catch (err) {
            console.warn('[Main] Unable to persist device preference:', err);
        }
    }

    _syncSelectValue(selectEl, deviceId, fallbackLabel) {
        this.view.syncSelectValue(selectEl, deviceId, fallbackLabel);
    }

    _findDeviceIdByLabel(selectEl, label) {
        return this.view.findDeviceIdByLabel(selectEl, label);
    }

    _updateDeviceHelperText() {
        this.view.renderDeviceHelper(
            this.lastKnownInputLabel || 'System Default',
            this.lastKnownOutputLabel || 'System Default'
        );
    }

    /**
     * Update Auto-Tune State based on UI controls
     */
    _updateAutoTuneState() {
        if (!this.continuousSynthEngine || !this.ui.autoTuneToggle) return;

        const isEnabled = this.ui.autoTuneToggle.checked;
        // Use stored value or default to 1.0 (Hard) if undefined
        const targetStrength = this._lastStrengthVal !== undefined ? this._lastStrengthVal : 1.0;
        
        // If enabled, use target value. If disabled, force 0.
        const finalStrength = isEnabled ? targetStrength : 0.0;

        this.continuousSynthEngine.setAutoTuneStrength(finalStrength);

        // Visual feedback for controls opacity
        this.view.renderAutoTuneControls(isEnabled);
    }

    /**
     * Switch Engine Mode (State-Driven)
     */
    switchMode(useContinuous) {
        this.useContinuousMode = useContinuous;

        // Update Store to trigger View re-render
        store.setState({
            synth: { ...store.getState().synth, continuousMode: useContinuous }
        });

        console.log(`[Mode Switch] ${useContinuous ? 'Continuous' : 'Legacy'} mode activated`);
    }

    /**
     * Start Playback
     * Uses AudioIO (or audioInputManager fallback - deprecated)
     */
    /**
     * Capture device selection from UI before starting
     * @private
     */
    _captureDeviceSelection() {
        if (this.ui.audioInputSelect?.value) {
            this.selectedInputId = this.ui.audioInputSelect.value;
        }
        if (this.ui.audioOutputSelect?.value) {
            this.selectedOutputId = this.ui.audioOutputSelect.value;
        }

        console.log('[Main] Starting with devices:', {
            input: this.selectedInputId,
            output: this.selectedOutputId
        });
    }

    /**
     * Initialize audio system and start processing
     * @returns {Promise<Object>} Audio system info
     * @private
     */
    async _initializeAudioSystem() {
        const audioStartInfo = await this._startWithAudioIO();
        this._captureActiveDeviceState();
        this.isRunning = true;

        if (this.audioLoopController) {
            this.audioLoopController.start();
        }

        return audioStartInfo;
    }

    /**
     * Update UI elements after successful start
     * @private
     */
    _updateUIForStarted() {
        // Toggle visibility using SafeUI
        this.safeUI.batchUpdate({
            // startBtn/stopBtn handled by State-Driven UI now
            statusBar: { show: true }
            // visualizer: { show: true } // Removed: Always visible
        });

        // Force visualizer resize to prevent blank canvas
        requestAnimationFrame(() => {
            if (this.visualizerManager) {
                this.visualizerManager.resize();
                console.log('[Main] ✓ Visualizer resized after showing');
            }
        });

        // Update status text
        this._updateStatusText();
    }

    /**
     * Update status text elements
     * @private
     */
    _updateStatusText() {
        const mode = this.useContinuousMode ? 'Continuous' : 'Legacy';

        // Update status and helper via View layer
        this.view.renderStatusMessage(`Running (${mode})`, { active: true });

        // Override device helper with playback message
        if (this.view.recordingHelper) {
            this.view.recordingHelper.textContent = 'Hum or sing to hear your voice transformed!';
        }

        // Update recording status via SafeUI (non-migrated yet)
        this.safeUI.batchUpdate({
            recordingStatus: {
                setText: 'Playing',
                addClass: 'status-ready'
            }
        });
    }

    /**
     * Handle startup errors and reset UI
     * @param {Error} error - The error that occurred
     * @private
     */
    _handleStartupError(error) {
        console.error('Failed to start:', error);
        
        // Update State: Error (This will reset buttons to Idle state usually, or Error state if implemented)
        if (this.store) this.store.setEngineStatus('error');

        // Show user-friendly error
        this._showError(error.message || 'Startup failed. Check microphone permissions and browser compatibility.');

        // Reset UI state using SafeUI
        this.safeUI.batchUpdate({
            recordingStatus: {
                setText: 'Error',
                removeClass: 'status-ready',
                addClass: 'status-error'
            }
        });
    }

    async start() {
        try {
            // Update State: Starting
            if (this.store) this.store.setEngineStatus('starting');

            console.log(`Starting Mambo Whistle in ${this.useContinuousMode ? 'Continuous' : 'Legacy'} mode...`);

            this._captureDeviceSelection();
            await this._initializeAudioSystem();
            
            // Update State: Running
            this.isRunning = true; // Keep internal flag for now
            if (this.store) this.store.setEngineStatus('running');

            this._updateUIForStarted(); // Keep specific UI updates (visualizer resize etc) for now, but remove btn toggles

            console.log('✓ Mambo Whistle is running!');

        } catch (error) {
            this._handleStartupError(error);
        }
    }

    /**
     * Start with AudioIO
     */
    async _startWithAudioIO() {
        console.log(' [Phase 1] Using AudioIO abstraction layer');

        // 1. Create AudioIO instance
        if (!this.audioIO) {
            this.audioIO = new AudioIO();

            // Use centralized config + pass to Worklet
            this.audioIO.configure({
                useWorklet: this.config.audio.useWorklet,
                workletBufferSize: this.config.audio.workletBufferSize || 128,  // From config
                bufferSize: this.config.audio.bufferSize,
                workletFallback: true,      // Auto fallback to ScriptProcessor
                sampleRate: this.config.audio.sampleRate,
                latencyHint: 'interactive',
                debug: this.config.performance.enableStats,
                // Device Selection
                inputDeviceId: this.selectedInputId,
                outputDeviceId: this.selectedOutputId,
                // P0 Fix: Pass complete config object for AudioIO to serialize for Worklet
                appConfig: this.config
            });

            // Register dedicated Worklet callback (avoids conflict with ScriptProcessor path)
            this.audioIO.onWorkletPitchFrame((pitchFrame, timestamp) => {
                // Use AudioContext.currentTime for latency measurement (same time source as Worklet)
                const receiveTime = this.audioIO.audioContext ? this.audioIO.audioContext.currentTime * 1000 : performance.now();
                if (this.audioLoopController) {
                    this.audioLoopController.handleWorkletPitchFrame(pitchFrame, timestamp, receiveTime);
                }
            });

            // ScriptProcessor mode callback (Fallback)
            this.audioIO.onFrame((data, timestamp) => {
                if (!this.audioLoopController) return;

                // Only handle Float32Array (ScriptProcessor mode)
                if (data instanceof Float32Array) {
                    this.audioLoopController.onAudioProcess(data);
                }
                // If PitchFrame object but Worklet callback not registered, warn here
                else if (data && typeof data === 'object' && 'frequency' in data) {
                    console.warn('[Main] Received PitchFrame but should use onWorkletPitchFrame callback');
                }
            });

            // Error handling
            this.audioIO.onError((type, error) => {
                console.error('[AudioIO Error]', type, error);
            });

            // Stage2: Register AudioIO instance to container for debugging
            window.container.register('audioIO', () => this.audioIO, { singleton: true });
            console.log('[Main] AudioIO instance registered to container');
        }

                    // 2. Start audio system (Start first to get actual mode and bufferSize)
                const result = await this.audioIO.start();
                console.log(' AudioIO started:', result);
        
                // 2.1 Refresh device list (now that we have permission, labels should be available)
                await this._refreshDeviceList();
        // 2.5 Initialize Latency Profiler (if enabled)
        if (window.__ENABLE_LATENCY_PROFILER__ && window.LatencyProfiler) {
            const profiler = new window.LatencyProfiler(this.audioIO.audioContext);
            window.latencyProfiler = profiler;  // Expose to global for monitor.html
            this.latencyProfiler = profiler;    // Keep ref

            // Initialize BroadcastChannel
            if ('BroadcastChannel' in window) {
                this.profilerBroadcast = new BroadcastChannel('latency-profiler');
                // Send report every second
                setInterval(() => {
                    const report = profiler.generateReport();
                    report.completedSessions = profiler.completedSessions.slice(-20);  // Only send last 20
                    this.profilerBroadcast.postMessage({
                        type: 'report',
                        report: report
                    });
                }, 1000);
                console.log('📡 BroadcastChannel started, sending data to monitor page');
            }

            console.log('⚡ Latency Profiler Enabled');
            console.log(' Open Monitor: http://localhost:3000/latency-profiler/pages/monitor.html');
            console.log(' Console: latencyProfiler.generateReport()');
        }

        // 3. Initialize engines (Use actual audioContext and bufferSize)
        const ctx = this.audioIO.audioContext;
        // Worklet uses workletBufferSize, ScriptProcessor uses bufferSize
        const bufferSize = result.mode === 'worklet'
            ? (this.config.audio.workletBufferSize || 128)  // From config, default 128
            : this.config.audio.bufferSize;
        await this._initializeEngines(ctx, bufferSize, result.mode);

        // 4. Update performance monitor (Step 2: Use injected service)
        if (!this.performanceMonitor.metrics.sampleRate) {
            await this.performanceMonitor.initialize(ctx, bufferSize, result.mode);
        }

        return result;
    }


    /**
     * Initialize Synthesizer Engine and Pitch Detector
     * Add ExpressiveFeatures initialization
     *
     * @param {AudioContext} audioContext - Web Audio API Context
     * @param {number} bufferSize - Actual buffer size used
     * @param {string} mode - Audio mode ('worklet' | 'script-processor')
     */
    async _initializeEngines(audioContext, bufferSize = 2048, mode = 'script-processor') {
        // Step 2: Use injected services (Container ensures injection, no fallback needed)

        // Initialize SynthManager if available (syncs with Store state)
        if (this.synthManager) {
            this.synthManager.init();
            console.log('[Main] SynthManager initialized and synced with Store');
        }

        // Select engine
        if (this.useContinuousMode) {
            this.currentEngine = this.continuousSynthEngine;
            console.log('Using Continuous Frequency Engine');
        } else {
            this.currentEngine = this.synthesizerEngine;
            console.log('Using Legacy Note-Based Engine');
        }

        // Initialize selected engine
        if (!this.currentEngine.currentSynth) {
            console.log('Initializing synthesizer engine...');
            await this.currentEngine.initialize();
            
            // 🔥 Apply pre-selected instrument (User might have clicked before Start)
            if (this.selectedInstrument) {
                console.log(`[Main] Applying pre-selected instrument: ${this.selectedInstrument}`);
                this.currentEngine.changeInstrument(this.selectedInstrument);
            }
        }

        // Initialize Pitch Detector (Needed for ScriptProcessor mode)
        if (mode !== 'worklet' && audioContext && !this.pitchDetector.detector) {
            console.log('Initializing pitch detector...');
            this.pitchDetector.initialize(audioContext.sampleRate);
        }

        // Initialize ExpressiveFeatures only in ScriptProcessor mode
        // In Worklet mode, all feature extraction is done in Worklet thread
        if (mode !== 'worklet' && !this.expressiveFeatures && audioContext && window.ExpressiveFeatures) {
            console.log('🎨 [Phase 2.10] Initializing ExpressiveFeatures (ScriptProcessor mode) with centralized config...');
            console.log(`  Mode: ${mode}, Buffer: ${bufferSize}, SampleRate: ${audioContext.sampleRate}`);

            // Use centralized config
            this.expressiveFeatures = new window.ExpressiveFeatures({
                audioContext: audioContext,
                sampleRate: audioContext.sampleRate,
                bufferSize: bufferSize,
                mode: mode,
                // Inject config parameters
                config: this.config
            });

            // Pass to AudioLoopController
            if (this.audioLoopController) {
                this.audioLoopController.expressiveFeatures = this.expressiveFeatures;
            }

            // Inject sourceNode to enable AnalyserNode FFT (ScriptProcessor mode only)
            if (this.audioIO && this.audioIO.sourceNode) {
                const success = this.expressiveFeatures.setSourceNode(this.audioIO.sourceNode);
                if (success) {
                    console.log(' [Phase 2.5] AnalyserNode FFT Enabled (Native Acceleration)');
                } else {
                    console.warn(' [Phase 2.5] AnalyserNode FFT Failed, using pure JS FFT');
                }
            }
        } else if (mode === 'worklet') {
            console.log(' [Phase 2.9] Worklet mode - Main thread skips ExpressiveFeatures (Features computed in Worklet)');
        } else if (!window.ExpressiveFeatures) {
            console.warn(' [Phase 2] ExpressiveFeatures module not loaded, skipping initialization');
        }
    }

    /**
     * Stop Playback
     */
    async stop() {
        console.log('Stopping Mambo Whistle...');
        this.isRunning = false;
        
        // Update State: Idle
        if (this.store) this.store.setEngineStatus('idle');

        if (this.audioLoopController) {
            this.audioLoopController.stop();
        }

        if (this.audioIO) {
            try {
                await this.audioIO.stop();
            } catch (e) {
                console.error('Error stopping audio:', e);
            }
        }

        // Reset UI using SafeUI (Clean up non-transport UI elements)
        this.safeUI.batchUpdate({
            // startBtn/stopBtn handled by State-Driven UI now
            statusBar: { hide: true },
            // visualizer: { hide: true }, // Removed: Always visible
            recordingStatus: {
                setText: 'Standby',
                removeClass: ['status-ready', 'status-error']
            }
        });

        // Reset status messages via View layer
        this.view.renderStatusMessage('Ready', { active: false });
        this.view.renderDeviceHelper(
            this.lastKnownInputLabel || 'System Default',
            this.lastKnownOutputLabel || 'System Default'
        );
        if (this.view.recordingHelper) {
            this.view.recordingHelper.textContent = 'Use headphones. Wired microphones recommended over Bluetooth for best latency.';
        }

        console.log('Mambo Whistle stopped');
    }



    /**
     * 音频处理 - ScriptProcessor 模式 (Fallback)
     * 数据流: ScriptProcessorNode → PitchDetector → ExpressiveFeatures → Synth
     *
     *  Worklet 模式下此方法不应被调用 (数据已在 Worklet 处理完毕)
     */






    openHelpSection() {
        this.view.renderHelp(true);
    }

    scrollToSection(targetId) {
        if (!targetId) {
            return;
        }

        const section = document.getElementById(targetId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Get latency statistics
     */
    getLatencyStats() {
        if (this.audioLoopController) {
            return this.audioLoopController.getLatencyStats();
        }
        return { min: 0, max: 0, avg: 0, count: 0 };
    }

    /**
     * 显示用户友好的错误提示
     * @param {string} message - 错误信息
     * @private
     */
    _showError(message) {
        // 使用 alert 显示错误（简单直接）
        alert(` ${message}`);

        // 如果有错误提示框，也在那里显示
        this.view.renderWarning(message);
    }
}

// =============================================================================
// Step 2: 依赖注入容器初始化
// =============================================================================

/**
 * 创建并配置依赖注入容器
 * 注册所有核心服务，实现控制反转 (IoC)
 */
const container = new AppContainer();
container.debug = false;  // 生产模式关闭调试日志

// 1. 配置管理器 (最底层，无依赖)
container.register('configManager', () => configManager, {
    singleton: true
});

// 2. 配置对象 (从 configManager 加载)
// 注意: 必须先调用 load() 再调用 get()
container.register('config', (c) => {
    const manager = c.get('configManager');
    return manager.load();  // load() 返回配置对象
}, {
    singleton: true
});

// 3. 乐器预设管理器 (Stage2: 直接使用 import)
container.register('instrumentPresetManager', () => instrumentPresetManager, {
    singleton: true
});

// 4. State Store (Centralized state management)
container.register('store', () => store, {
    singleton: true
});

// 5. 表现力特征提取模块 (Stage2: 直接使用 import)
container.register('ExpressiveFeatures', () => ExpressiveFeatures, {
    singleton: true
});

// 5. 音高检测器 (Step 2 Layer 2: 容器创建新实例)
container.register('pitchDetector', () => {
    console.log('[Container]  创建 PitchDetector 实例...');
    return new PitchDetector();
}, {
    singleton: true
});

// 6. 性能监控器 (Step 2 Layer 2: 容器创建新实例)
container.register('performanceMonitor', () => {
    console.log('[Container]  创建 PerformanceMonitor 实例...');
    return new PerformanceMonitor();
}, {
    singleton: true
});

// 7. 合成器引擎 - Legacy (Step 2 Layer 2: 容器创建新实例)
container.register('synthesizerEngine', () => {
    console.log('[Container]  创建 SynthesizerEngine (Legacy) 实例...');
    return new SynthesizerEngine();
}, {
    singleton: true
});

// 8. 合成器引擎 - Continuous (Step 2 Layer 2: 真正落实依赖注入)
// 注意：旧代码在模块顶层创建了无配置实例，导致双实例问题
// 现在模块文件已移除全局实例创建，容器成为唯一实例来源
container.register('continuousSynthEngine', (c) => {
    console.log('[Container]  创建 ContinuousSynthEngine (依赖注入)...');

    // Step 2 Layer 2: 容器统一创建实例 (注入配置和预设)
    const engine = new ContinuousSynthEngine({
        appConfig: c.get('config'),
        instrumentPresets: c.get('instrumentPresetManager').presets
    });

    console.log('[Container]  ContinuousSynthEngine 已创建 (双实例问题已解决)');
    return engine;
}, {
    singleton: true,
    dependencies: ['config', 'instrumentPresetManager']
});

// 8.5 AI 伴奏模块 (Step 2: 容器创建新实例)
container.register('aiHarmonizer', () => {
    console.log('[Container]  创建 AiHarmonizer 实例...');
    return new AiHarmonizer();
}, {
    singleton: true
});

// 8.6 Visualizer Manager
container.register('visualizerManager', (c) => {
    console.log('[Container]  创建 VisualizerManager 实例...');
    const config = c.get('config').visualizer || {}; // Get visualizer config from app config
    const pitchCanvas = document.getElementById('pitchCanvas'); // Get the canvas element directly
    if (!pitchCanvas) {
        console.warn('[Container] pitchCanvas element not found for VisualizerManager. Visualizer will not function.');
        // Return a no-op manager or throw error depending on desired behavior
        return { init: () => {}, update: () => {}, resize: () => {}, destroy: () => {} };
    }
    return new VisualizerManager(pitchCanvas, config);
}, {
    singleton: true,
    dependencies: ['config']
});

// 8.7 Synth Manager (Bridge between Store and Audio Engines)
container.register('synthManager', (c) => {
    console.log('[Container] Creating SynthManager instance...');
    return new SynthManager({
        continuous: c.get('continuousSynthEngine'),
        legacy: c.get('synthesizerEngine')
    });
}, {
    singleton: true,
    dependencies: ['continuousSynthEngine', 'synthesizerEngine']
});

// 8.8 Audio Loop Controller
container.register('audioLoopController', (c) => {
    console.log('[Container] Creating AudioLoopController instance...');
    return new AudioLoopController({
        synthManager: c.get('synthManager'),
        visualizerManager: c.get('visualizerManager'),
        performanceMonitor: c.get('performanceMonitor'),
        pitchDetector: c.get('pitchDetector'),
        aiHarmonizer: c.get('aiHarmonizer')
        // expressiveFeatures will be set by MamboApp after initialization
    });
}, {
    singleton: true,
    dependencies: ['synthManager', 'visualizerManager', 'performanceMonitor', 'pitchDetector', 'aiHarmonizer']
});

// 9. Main App Instance (Step 2: Pass services for Dependency Injection)
container.register('app', (c) => {
    console.log('[Container] Creating MamboApp instance (Dependency Injection)...');

            // Collect all dependent services
        const services = {
            config: c.get('config'),
            configManager: c.get('configManager'),
            pitchDetector: c.get('pitchDetector'),
            performanceMonitor: c.get('performanceMonitor'),
            synthesizerEngine: c.get('synthesizerEngine'),
            continuousSynthEngine: c.get('continuousSynthEngine'),
                    ExpressiveFeatures: c.get('ExpressiveFeatures'),
                    aiHarmonizer: c.get('aiHarmonizer'),
                    visualizerManager: c.get('visualizerManager'),
                    synthManager: c.get('synthManager'), // Inject SynthManager
                    audioLoopController: c.get('audioLoopController'), // Inject AudioLoopController
                    store: c.get('store') // Inject State Store
                };

                console.log('[Container]  服务已注入:', Object.keys(services));
                return new MamboApp(services);
            }, {
                singleton: true,
                dependencies: ['config', 'configManager', 'pitchDetector', 'performanceMonitor',
                               'synthesizerEngine', 'continuousSynthEngine', 'ExpressiveFeatures',
                               'aiHarmonizer', 'visualizerManager', 'synthManager', 'audioLoopController', 'store']
            });// =============================================================================
// Global Exposure (App Entry & Container Debug Interface Only)
// =============================================================================
// Stage 2 Cleanup Complete: Removed global exposure of intermediate services
// - All services are now accessed via window.container.get('serviceName')
// - Only window.app (App Entry) and window.container (Debug Interface) are retained
//
// Debug Examples:
//   window.container.get('configManager')
//   window.container.get('pitchDetector')
//   window.container.get('performanceMonitor')
//

// App instance created later (DOMContentLoaded)
let app = null;

// Expose container globally (The only service access point)
window.container = container;

console.log('[Main] Dependency Injection Container Initialized');
console.log('[Main] Registered Services:', container.getServiceNames());

// =============================================================================
// Application Startup
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Get app instance from container
    app = container.get('app');

    // Expose globally (Compatibility)
    window.app = app;

    // Initialize application
    app.initialize();
});
