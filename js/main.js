/**
 * 主控制器 - 无校准版本
 * 极简设计：选择乐器 → 开始播放
 *
 *  集成 AudioIO 低延迟音频抽象层
 *  集成 ExpressiveFeatures 表现力特征提取管线
 *  集成集中式配置管理系统
 * Step 2: 迁移全局变量到 AppContainer (依赖注入)
 */

import configManager from './config/app-config.js';
import { checkBrowserSupport, calculateRMS } from './utils/audio-utils.js';
import { AppContainer } from './core/app-container.js';
import { ExpressiveFeatures } from './expressive-features.js';
import instrumentPresetManager from './config/instrument-presets.js';
import { ContinuousSynthEngine } from './continuous-synth.js'; // Fixed: Import class
import { AiHarmonizer } from './features/ai-harmonizer.js';

class KazooApp {
    /**
     * Step 2: 依赖注入构造函数
     * @param {Object} services - 注入的服务对象
     * @param {Object} services.config - 应用配置
     * @param {Object} services.configManager - 配置管理器
     * @param {Object} services.pitchDetector - 音高检测器
     * @param {Object} services.performanceMonitor - 性能监控器
     * @param {Object} services.synthesizerEngine - Legacy 合成器引擎
     * @param {Object} services.continuousSynthEngine - Continuous 合成器引擎
     * @param {Object} services.aiHarmonizer - AI 伴奏模块
     * @param {Function} services.ExpressiveFeatures - 表现力特征提取类
     */
    constructor(services = {}) {
        this.isRunning = false;

        // Step 2: 注入的服务 (优先使用注入，回退到全局)
        this.config = services.config || null;
        this.configManager = services.configManager || null;
        this.pitchDetector = services.pitchDetector || null;
        this.performanceMonitor = services.performanceMonitor || null;
        this.synthesizerEngine = services.synthesizerEngine || null;
        this.continuousSynthEngine = services.continuousSynthEngine || null;
        this.aiHarmonizer = services.aiHarmonizer || null;
        this.ExpressiveFeatures = services.ExpressiveFeatures || null;

        //  音频系统
        // AudioIO 是唯一支持的音频系统（AudioWorklet + ScriptProcessor fallback）
        // Legacy audioInputManager 已弃用，代码保留仅供参考
        this.audioIO = null;  // AudioIO 实例（唯一音频系统）

        //  双引擎模式
        this.useContinuousMode = true;  //  默认使用 Continuous 模式 (Phase 2.7 已验证)
        this.currentEngine = null;      // 当前激活的引擎

        //  表现力特征提取
        this.expressiveFeatures = null;  // ExpressiveFeatures 实例

        // UI元素
        this.ui = {
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            helpBtn: document.getElementById('helpBtn'),
            helpToggle: document.getElementById('helpToggle'),
            helpContent: document.getElementById('helpContent'),
            helpSection: document.getElementById('tipsSection'),
            warningBox: document.getElementById('warningBox'),
            warningText: document.getElementById('warningText'),

            //  模式切换
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

            // 状态徽章
            instrumentStatus: document.getElementById('instrumentStatus'),
            recordingStatus: document.getElementById('recordingStatus'),
            recordingHelper: document.getElementById('recordingHelper'),

            // 状态和可视化
            statusBar: document.getElementById('statusBar'),
            visualizer: document.getElementById('visualizer'),
            systemStatus: document.getElementById('systemStatus'),
            latency: document.getElementById('latency'),
            confidence: document.getElementById('confidence'),
            currentNote: document.getElementById('currentNote'),
            currentFreq: document.getElementById('currentFreq'),
            pitchCanvas: document.getElementById('pitchCanvas'),

            // 乐器按钮
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
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            settingsBackdrop: document.getElementById('settingsBackdrop'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),

            // Effects UI
            reverbSlider: document.getElementById('reverbSlider'),
            delaySlider: document.getElementById('delaySlider'),
            reverbValue: document.getElementById('reverbValue'),
            delayValue: document.getElementById('delayValue')
        };


        // 可视化设置
        this.visualizer = null;

        // Device State
        this.selectedInputId = 'default';
        this.selectedOutputId = 'default';
        this.lastKnownInputLabel = 'System Default';
        this.lastKnownOutputLabel = 'System Default';
        this._loadDevicePreferences();
        this.selectedInstrument = 'flute'; // Track user selection before start
    }

    /**
     * 初始化应用
     * Step 2: 使用注入的 configManager
     */
    async initialize() {
        console.log('Initializing Kazoo App (No-Calibration Version)...');

        // Step 2: 使用注入的 configManager (如未注入则回退到全局)
        const manager = this.configManager || configManager;

        //  加载集中式配置
        try {
            // 如果 config 未在构造函数注入，则现在加载
            if (!this.config) {
                this.config = manager.load();  // 默认配置
            }
            console.log('[Config] Loaded default configuration:', {
                sampleRate: this.config.audio.sampleRate,
                bufferSize: this.config.audio.bufferSize,
                useWorklet: this.config.audio.useWorklet
            });
        } catch (error) {
            console.error('[Config] Failed to load configuration:', error);
            console.error('[Config] Using emergency fallback values');
            // 真正的回退: 使用硬编码的最小可用配置 (必须与 app-config.js 结构一致)
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

        // 检查兼容性
        this.checkCompatibility();

        // 绑定事件
        this.bindEvents();

        // 初始化可视化
        this.initVisualizer();

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
     * 检查浏览器兼容性
     */
    checkCompatibility() {
        const support = checkBrowserSupport();

        if (!support.isSupported) {
            this.ui.warningBox.classList.remove('hidden');
            this.ui.warningText.innerHTML = support.issues.map(i => `<li>${i}</li>`).join('');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 开始/停止 - 注意：UIManager 也在绑定这些按钮，检查是否会双重触发
        this.ui.startBtn.addEventListener('click', () => this.start());
        this.ui.stopBtn.addEventListener('click', () => this.stop());

        // Settings Modal Logic
        const openSettings = () => {
            if (this.ui.settingsModal) {
                this.ui.settingsModal.classList.remove('hidden');
                // Trigger reflow
                void this.ui.settingsModal.offsetWidth;
                // Animate in
                if (this.ui.settingsBackdrop) this.ui.settingsBackdrop.classList.remove('opacity-0');
                if (this.ui.settingsPanel) this.ui.settingsPanel.classList.remove('translate-x-full');
            }
        };

        const closeSettings = () => {
            if (this.ui.settingsModal) {
                // Animate out
                if (this.ui.settingsBackdrop) this.ui.settingsBackdrop.classList.add('opacity-0');
                if (this.ui.settingsPanel) this.ui.settingsPanel.classList.add('translate-x-full');
                
                // Wait for transition
                setTimeout(() => {
                    this.ui.settingsModal.classList.add('hidden');
                }, 300);
            }
        };

        if (this.ui.settingsBtn) this.ui.settingsBtn.addEventListener('click', openSettings);
        if (this.ui.closeSettingsBtn) this.ui.closeSettingsBtn.addEventListener('click', closeSettings);
        if (this.ui.settingsBackdrop) this.ui.settingsBackdrop.addEventListener('click', closeSettings);

        // Device Selection
        if (this.ui.audioInputSelect) {
            this.ui.audioInputSelect.addEventListener('change', async (e) => {
                this.selectedInputId = e.target.value;
                const selectedLabel = e.target.selectedOptions[0]?.textContent || 'Custom Microphone';
                console.log(`[Main] Input device selected: ${this.selectedInputId}`);
                this.lastKnownInputLabel = selectedLabel;
                this._persistDevicePreference('input', this.selectedInputId, selectedLabel);
                this._updateDeviceHelperText();
                
                // If running, restart to apply new microphone
                if (this.isRunning && this.audioIO) {
                    console.log('[Main] Restarting audio to apply new input device...');
                    // Visual feedback
                    const originalText = this.ui.systemStatus.textContent;
                    this.ui.systemStatus.textContent = 'Switching Mic...';
                    
                    try {
                        await this.audioIO.stop();
                        // Update config with new device ID
                        this.audioIO.configure({ inputDeviceId: this.selectedInputId });
                        await this.audioIO.start();
                        console.log('[Main] Audio restarted with new input.');
                        this.ui.systemStatus.textContent = originalText;
                    } catch (err) {
                        console.error('[Main] Failed to switch input:', err);
                        this._showError('Failed to switch microphone: ' + err.message);
                    }
                }
            });
        }

        if (this.ui.audioOutputSelect) {
            this.ui.audioOutputSelect.addEventListener('change', async (e) => {
                this.selectedOutputId = e.target.value;
                const selectedLabel = e.target.selectedOptions[0]?.textContent || 'Custom Output';
                console.log(`[Main] Output device selected: ${this.selectedOutputId}`);
                this.lastKnownOutputLabel = selectedLabel;
                this._persistDevicePreference('output', this.selectedOutputId, selectedLabel);
                this._updateDeviceHelperText();
                
                // If running, update immediately
                if (this.audioIO) {
                    try {
                        await this.audioIO.setAudioOutputDevice(this.selectedOutputId);
                    } catch (err) {
                        console.error('[Main] Failed to set output:', err);
                    }
                }
            });
        }

        if (this.ui.refreshDevicesBtn) {
            this.ui.refreshDevicesBtn.addEventListener('click', () => {
                this._refreshDeviceList();
            });
        }

        // Auto-Tune Controls
        const updateAutoTune = () => this._updateAutoTuneState();

        if (this.ui.autoTuneToggle) this.ui.autoTuneToggle.addEventListener('change', updateAutoTune);
        
        if (this.ui.scaleKeySelect) {
            this.ui.scaleKeySelect.addEventListener('change', (e) => {
                if (this.continuousSynthEngine) {
                    this.continuousSynthEngine.setScale(e.target.value, this.ui.scaleTypeSelect.value);
                }
            });
        }

        if (this.ui.scaleTypeSelect) {
            this.ui.scaleTypeSelect.addEventListener('change', (e) => {
                if (this.continuousSynthEngine) {
                    this.continuousSynthEngine.setScale(this.ui.scaleKeySelect.value, e.target.value);
                }
            });
        }

        // Helper for Segmented Controls
        const setupSegmentedControl = (containerId, onSelect, defaultValue) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const buttons = container.querySelectorAll('button');
            // Enhanced Active State: White bg, Blue text, Bold, Shadow, Ring border
            const activeClass = ['bg-white', 'shadow-md', 'text-blue-600', 'font-bold', 'ring-1', 'ring-black/5'];
            // Enhanced Inactive State: Gray text, subtle hover
            const inactiveClass = ['text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-200/50'];

            const updateState = (selectedVal) => {
                buttons.forEach(btn => {
                    if (btn.dataset.value === String(selectedVal)) {
                        btn.classList.add(...activeClass);
                        btn.classList.remove(...inactiveClass);
                    } else {
                        btn.classList.remove(...activeClass);
                        btn.classList.add(...inactiveClass);
                    }
                });
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
            console.log(`[UI] Strength selected: ${val}`);
            // Store for toggle logic
            this._lastStrengthVal = val; 
            if (this.continuousSynthEngine) {
                this.continuousSynthEngine.setAutoTuneStrength(val);
            }
        }, 1.0); // Default Hard (so toggle ON has immediate effect)

        setupSegmentedControl('speedControl', (val) => {
            console.log(`[UI] Speed selected: ${val}`);
            if (this.continuousSynthEngine) {
                this.continuousSynthEngine.setRetuneSpeed(val);
            }
        }, 0.0); // Default Robot (Fast)

        // Effects Controls (Placeholders)
        if (this.ui.reverbSlider) {
            this.ui.reverbSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                this.ui.reverbValue.textContent = `${val}%`;
                if (this.continuousSynthEngine) {
                    this.continuousSynthEngine.setReverbWet(val / 100);
                }
            });
        }

        if (this.ui.delaySlider) {
            this.ui.delaySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                this.ui.delayValue.textContent = `${val}%`;
                if (this.continuousSynthEngine) {
                    this.continuousSynthEngine.setDelayWet(val / 100);
                }
            });
        }

        //  模式切换
        this.ui.modeToggle.addEventListener('change', (e) => {
            if (this.isRunning) {
                alert('Please stop playback before switching modes.');
                e.target.checked = this.useContinuousMode;
                return;
            }
            this.switchMode(e.target.checked);
        });

        // 乐器选择
        this.ui.instrumentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instrument = e.currentTarget.dataset.instrument;
                
                // Update internal state (for when engine starts later)
                this.selectedInstrument = instrument;

                // 🔥 [ARCHITECTURE FIX] 视觉切换逻辑统一到 main.js，移除 HTML 内联重复代码
                // 移除其他按钮的 active 类
                this.ui.instrumentBtns.forEach(b => b.classList.remove('active'));
                // 激活当前按钮（Google 彩色边框）
                e.currentTarget.classList.add('active');

                // 更新状态徽章 - 从 button 中提取乐器名称
                const instrumentNameEl = e.currentTarget.querySelector('.font-semibold');
                if (instrumentNameEl && this.ui.instrumentStatus) {
                    this.ui.instrumentStatus.textContent = instrumentNameEl.textContent;
                }

                // 如果合成器已初始化，切换乐器（使用当前引擎）
                if (this.currentEngine && this.currentEngine.currentSynth) {
                    this.currentEngine.changeInstrument(instrument);
                }
            });
        });

        // 帮助
        if (this.ui.helpBtn) {
            this.ui.helpBtn.addEventListener('click', () => {
                this.openHelpSection();
                this.scrollToSection('tipsSection');
            });
        }

        if (this.ui.helpToggle) {
            this.ui.helpToggle.addEventListener('click', () => {
                const isOpen = this.ui.helpContent.classList.toggle('show');
                this.ui.helpToggle.setAttribute('aria-expanded', isOpen);
                if (isOpen) {
                    this.scrollToSection('tipsSection');
                }
            });
        }

        if (this.ui.navLinks) {
            this.ui.navLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const targetId = link.dataset.scrollTarget;
                    this.scrollToSection(targetId);
                });
            });
        }

        // AI Jam Toggle
        if (this.ui.aiJamBtn) {
            // Helper to reset classes
            const resetBtnClasses = () => {
                this.ui.aiJamBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'text-white');
                this.ui.aiJamBtn.classList.add('bg-white/80', 'hover:bg-white', 'text-gray-900');
                
                this.ui.aiJamTitle.classList.remove('text-white');
                this.ui.aiJamTitle.classList.add('text-gray-900');
                
                this.ui.aiJamStatus.classList.remove('text-blue-100');
                this.ui.aiJamStatus.classList.add('text-gray-500');
            };

            const setActiveClasses = () => {
                this.ui.aiJamBtn.classList.remove('bg-white/80', 'hover:bg-white', 'text-gray-900');
                this.ui.aiJamBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white');

                this.ui.aiJamTitle.classList.remove('text-gray-900');
                this.ui.aiJamTitle.classList.add('text-white');
                
                this.ui.aiJamStatus.classList.remove('text-gray-500');
                this.ui.aiJamStatus.classList.add('text-blue-100');
            };

            // Status Update Callback
            if (this.aiHarmonizer) {
                this.aiHarmonizer.onStatusChange = ({ status, message }) => {
                    console.log(`[AI Jam] Status: ${status} - ${message}`);
                    
                    // Hide all icons first
                    this.ui.aiIconIdle.classList.add('hidden');
                    this.ui.aiIconLoading.classList.add('hidden');
                    this.ui.aiIconActive.classList.add('hidden');
                    this.ui.aiProgressBar.style.width = '0%'; // Reset progress by default

                    if (status === 'loading') {
                        // Loading State
                        this.ui.aiIconLoading.classList.remove('hidden');
                        this.ui.aiJamTitle.textContent = 'Downloading...';
                        this.ui.aiJamStatus.textContent = ' ~5MB Model';
                        this.ui.aiJamBtn.disabled = true;
                        
                        // Simulate Progress
                        setTimeout(() => { this.ui.aiProgressBar.style.width = '40%'; }, 100);
                        setTimeout(() => { this.ui.aiProgressBar.style.width = '80%'; }, 2000);
                        
                    } else if (status === 'ready') {
                        // Active State
                        setActiveClasses();
                        this.ui.aiIconActive.classList.remove('hidden');
                        this.ui.aiJamTitle.textContent = 'Smart Jam';
                        this.ui.aiJamStatus.textContent = 'Listening...';
                        this.ui.aiJamBtn.disabled = false;

                    } else if (status === 'processing') {
                        // Thinking State (Keep Active Look)
                        setActiveClasses();
                        this.ui.aiIconActive.classList.remove('hidden');
                        this.ui.aiJamStatus.textContent = 'Generating...';
                        
                    } else if (status === 'idle') {
                        // Idle State
                        resetBtnClasses();
                        this.ui.aiIconIdle.classList.remove('hidden');
                        this.ui.aiJamTitle.textContent = 'Smart Jam';
                        this.ui.aiJamStatus.textContent = 'Off';
                        this.ui.aiJamBtn.disabled = false;

                    } else if (status === 'error') {
                        // Error State
                        resetBtnClasses();
                        this.ui.aiIconIdle.classList.remove('hidden');
                        this.ui.aiJamTitle.textContent = 'Error';
                        this.ui.aiJamStatus.textContent = 'Try Again';
                        this.ui.aiJamBtn.disabled = false;
                    }
                };
            }

            this.ui.aiJamBtn.addEventListener('click', async () => {
                if (!this.aiHarmonizer) return;

                try {
                    // 1. Ensure Audio Context is running
                    if (Tone.context.state !== 'running') {
                        await Tone.start();
                        console.log('[AI Jam] AudioContext resumed by user click');
                    }

                    // 2. Toggle AI
                    if (this.aiHarmonizer.enabled) {
                        this.aiHarmonizer.disable();
                    } else {
                        await this.aiHarmonizer.enable();
                    }
                } catch (err) {
                    console.error('[AI Jam] Click handler error:', err);
                    alert("Please click 'Start Engine' first to enable audio features.");
                }
            });
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // 'T' for Auto-Tune Toggle
            if (e.key.toLowerCase() === 't') {
                if (this.currentEngine === this.continuousSynthEngine) {
                    const currentStrength = this.continuousSynthEngine.autoTuneStrength || 0;
                    const newStrength = currentStrength > 0.5 ? 0.0 : 1.0; // Toggle 0 <-> 1
                    
                    this.continuousSynthEngine.setAutoTuneStrength(newStrength);
                    
                    // Visual Feedback
                    const originalText = `Running (${this.useContinuousMode ? 'Continuous' : 'Legacy'})`;
                    this.ui.systemStatus.textContent = `Auto-Tune: ${newStrength > 0 ? 'ON' : 'OFF'}`;
                    this.ui.systemStatus.classList.add('highlight'); // Optional: add css class if exists, or just rely on text
                    
                    console.log(`[Main] 🎹 Auto-Tune toggled ${newStrength > 0 ? 'ON' : 'OFF'} (Strength: ${newStrength})`);

                    // Revert text after 2s
                    if (this._statusTimeout) clearTimeout(this._statusTimeout);
                    this._statusTimeout = setTimeout(() => {
                        if (this.isRunning) {
                             this.ui.systemStatus.textContent = originalText;
                        }
                        this.ui.systemStatus.classList.remove('highlight');
                    }, 2000);
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
            
            // Populate Inputs
            if (this.ui.audioInputSelect) {
                const desiredVal = this.selectedInputId || this.ui.audioInputSelect.value || 'default';
                this.ui.audioInputSelect.innerHTML = '';
                
                // Add Default
                const defaultOpt = document.createElement('option');
                defaultOpt.value = 'default';
                defaultOpt.textContent = 'Default Microphone';
                this.ui.audioInputSelect.appendChild(defaultOpt);
                
                inputs.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${index + 1}`;
                    this.ui.audioInputSelect.appendChild(option);
                });

                // Restore selection if possible
                if (desiredVal && [...this.ui.audioInputSelect.options].some(o => o.value === desiredVal)) {
                    this.ui.audioInputSelect.value = desiredVal;
                } else if (desiredVal && desiredVal !== 'default') {
                    const ghostOption = document.createElement('option');
                    ghostOption.value = desiredVal;
                    ghostOption.textContent = `${this.lastKnownInputLabel || 'Previous Mic'} (disconnected)`;
                    ghostOption.disabled = true;
                    this.ui.audioInputSelect.appendChild(ghostOption);
                    this.ui.audioInputSelect.value = desiredVal;
                }
            }

            // Populate Outputs
            if (this.ui.audioOutputSelect) {
                const desiredVal = this.selectedOutputId || this.ui.audioOutputSelect.value || 'default';
                this.ui.audioOutputSelect.innerHTML = '';
                
                const defaultOpt = document.createElement('option');
                defaultOpt.value = 'default';
                defaultOpt.textContent = 'Default Output';
                this.ui.audioOutputSelect.appendChild(defaultOpt);
                
                outputs.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Speaker ${index + 1}`;
                    this.ui.audioOutputSelect.appendChild(option);
                });

                // Restore selection if possible
                if (desiredVal && [...this.ui.audioOutputSelect.options].some(o => o.value === desiredVal)) {
                    this.ui.audioOutputSelect.value = desiredVal;
                } else if (desiredVal && desiredVal !== 'default') {
                    const ghostOption = document.createElement('option');
                    ghostOption.value = desiredVal;
                    ghostOption.textContent = `${this.lastKnownOutputLabel || 'Previous Output'} (disconnected)`;
                    ghostOption.disabled = true;
                    this.ui.audioOutputSelect.appendChild(ghostOption);
                    this.ui.audioOutputSelect.value = desiredVal;
                }
            }

            // Update button animation
            if (this.ui.refreshDevicesBtn) {
                const icon = this.ui.refreshDevicesBtn.querySelector('svg');
                if (icon) {
                    icon.classList.add('animate-spin');
                    setTimeout(() => icon.classList.remove('animate-spin'), 500);
                }
            }
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
            const selectedOption = this.ui.audioOutputSelect.selectedOptions[0];
            if (selectedOption) {
                this.lastKnownOutputLabel = selectedOption.textContent;
                this._persistDevicePreference('output', this.selectedOutputId || 'default', selectedOption.textContent);
            }
        }

        this._updateDeviceHelperText();
    }

    _loadDevicePreferences() {
        try {
            const savedInput = localStorage.getItem('kazoo:lastInputDeviceId');
            const savedOutput = localStorage.getItem('kazoo:lastOutputDeviceId');
            const savedInputLabel = localStorage.getItem('kazoo:lastInputDeviceLabel');
            const savedOutputLabel = localStorage.getItem('kazoo:lastOutputDeviceLabel');
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
            const idKey = type === 'input' ? 'kazoo:lastInputDeviceId' : 'kazoo:lastOutputDeviceId';
            const labelKey = type === 'input' ? 'kazoo:lastInputDeviceLabel' : 'kazoo:lastOutputDeviceLabel';
            localStorage.setItem(idKey, deviceId || 'default');
            if (label) {
                localStorage.setItem(labelKey, label);
            }
        } catch (err) {
            console.warn('[Main] Unable to persist device preference:', err);
        }
    }

    _syncSelectValue(selectEl, deviceId, fallbackLabel) {
        if (!selectEl || !deviceId) return;
        const options = [...selectEl.options];
        if (!options.some(o => o.value === deviceId)) {
            const option = document.createElement('option');
            option.value = deviceId;
            option.textContent = fallbackLabel || 'Active Device';
            selectEl.appendChild(option);
        }
        selectEl.value = deviceId;
    }

    _findDeviceIdByLabel(selectEl, label) {
        if (!selectEl || !label) return null;
        const option = [...selectEl.options].find(o => o.textContent === label);
        return option ? option.value : null;
    }

    _updateDeviceHelperText() {
        if (!this.ui.recordingHelper) return;
        const mic = this.lastKnownInputLabel || 'System Default';
        const out = this.lastKnownOutputLabel || 'System Default';
        this.ui.recordingHelper.textContent = `Mic · ${mic}  |  Output · ${out}`;
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
        const strengthCtrl = document.getElementById('strengthControl');
        const speedCtrl = document.getElementById('speedControl');
        const opacity = isEnabled ? '1' : '0.5';
        const pointerEvents = isEnabled ? 'auto' : 'none';
        
        if (strengthCtrl) {
            strengthCtrl.style.opacity = opacity;
            strengthCtrl.style.pointerEvents = pointerEvents;
        }
        if (speedCtrl) {
            speedCtrl.style.opacity = opacity;
            speedCtrl.style.pointerEvents = pointerEvents;
        }
    }

    /**
     *  切换引擎模式
     */
    switchMode(useContinuous) {
        this.useContinuousMode = useContinuous;
        this.ui.modeText.textContent = useContinuous ? 'Continuous' : 'Legacy';

        console.log(`[Mode Switch] ${useContinuous ? 'Continuous' : 'Legacy'} mode activated`);
    }

    /**
     * 开始播放
     *  使用 AudioIO 或 audioInputManager
     */
    async start() {
        try {
            console.log(`Starting Kazoo Proto in ${this.useContinuousMode ? 'Continuous' : 'Legacy'} mode...`);

            // 🔥 [CRITICAL FIX] Force sync device selection from UI before starting
            // This handles cases where the user changed selection *before* clicking Start
            if (this.ui.audioInputSelect && this.ui.audioInputSelect.value) {
                this.selectedInputId = this.ui.audioInputSelect.value;
            }
            if (this.ui.audioOutputSelect && this.ui.audioOutputSelect.value) {
                this.selectedOutputId = this.ui.audioOutputSelect.value;
            }
            
            console.log('[Main] Starting with devices:', {
                input: this.selectedInputId,
                output: this.selectedOutputId
            });

            //  启动音频系统（仅 AudioIO）
            const audioStartInfo = await this._startWithAudioIO();
            this._captureActiveDeviceState();

            // 更新UI
            this.isRunning = true;
            this.ui.startBtn.classList.add('hidden');
            this.ui.stopBtn.classList.remove('hidden');
            this.ui.statusBar.classList.remove('hidden');
            this.ui.visualizer.classList.remove('hidden');

            // 🔥 [UX FIX] 强制刷新 Canvas 尺寸，解决 hidden 导致的黑屏问题
            // Canvas 在 display:none 状态下初始化时尺寸为 0，显示后需要重新计算
            requestAnimationFrame(() => {
                if (this.resizeVisualizer) {
                    this.resizeVisualizer();
                    console.log('[Main] ✓ Visualizer resized after showing');
                }
            });

            this.ui.systemStatus.textContent = `Running (${this.useContinuousMode ? 'Continuous' : 'Legacy'})`;
            this.ui.systemStatus.classList.add('active');
            this.ui.recordingStatus.textContent = 'Playing';
            this.ui.recordingStatus.classList.add('status-ready');
            this.ui.recordingHelper.textContent = 'Hum or sing to hear your voice transformed!';

            console.log('✓ Kazoo Proto is running!');

        } catch (error) {
            console.error('Failed to start:', error);

            // 显示用户友好的错误提示
            this._showError(error.message || '启动失败，请检查麦克风权限和浏览器兼容性');

            // 重置 UI 状态
            this.ui.startBtn.classList.remove('hidden');
            this.ui.stopBtn.classList.add('hidden');
            this.ui.recordingStatus.textContent = 'Error';
            this.ui.recordingStatus.classList.remove('status-ready');
            this.ui.recordingStatus.classList.add('status-error');
        }
    }

    /**
     *  使用 AudioIO 启动
     */
    async _startWithAudioIO() {
        console.log(' [Phase 1] 使用 AudioIO 抽象层');

        // 1. 创建 AudioIO 实例
        if (!this.audioIO) {
            this.audioIO = new AudioIO();

            //  使用集中式配置 + 下发到 Worklet
            this.audioIO.configure({
                useWorklet: this.config.audio.useWorklet,
                workletBufferSize: this.config.audio.workletBufferSize || 128,  // 从配置读取
                bufferSize: this.config.audio.bufferSize,
                workletFallback: true,      // 自动回退到 ScriptProcessor
                sampleRate: this.config.audio.sampleRate,
                latencyHint: 'interactive',
                debug: this.config.performance.enableStats,
                // Device Selection
                inputDeviceId: this.selectedInputId,
                outputDeviceId: this.selectedOutputId,
                //  P0 修复: 传递完整配置对象,供 AudioIO 序列化并下发到 Worklet
                appConfig: this.config
            });

            // Latency measurement
            this.latencyMeasurements = [];

            //  注册专用 Worklet 回调 (避免与 ScriptProcessor 路径冲突)
            this.audioIO.onWorkletPitchFrame((pitchFrame, timestamp) => {
                // Use AudioContext.currentTime for latency measurement (same time source as Worklet)
                const receiveTime = this.audioIO.audioContext ? this.audioIO.audioContext.currentTime * 1000 : performance.now();
                this.handleWorkletPitchFrame(pitchFrame, timestamp, receiveTime);
            });

            // ScriptProcessor 模式回调 (Fallback)
            this.audioIO.onFrame((data, timestamp) => {
                // 只处理 Float32Array (ScriptProcessor 模式)
                if (data instanceof Float32Array) {
                    this.onAudioProcess(data);
                }
                // 如果是 PitchFrame 对象但未注册 Worklet 回调，也可在此处理
                else if (data && typeof data === 'object' && 'frequency' in data) {
                    console.warn('[Main]  收到 PitchFrame 但应使用 onWorkletPitchFrame 回调');
                }
            });

            // 错误处理
            this.audioIO.onError((type, error) => {
                console.error('[AudioIO Error]', type, error);
            });

            // Stage2: 将 AudioIO 实例注册到容器供调试访问
            window.container.register('audioIO', () => this.audioIO, { singleton: true });
            console.log('[Main]  AudioIO 实例已注册到容器');
        }

                    // 2. 启动音频系统 (先启动，获取实际 mode 和 bufferSize)
                const result = await this.audioIO.start();
                console.log(' AudioIO 已启动:', result);
        
                // 2.1 Refresh device list (now that we have permission, labels should be available)
                await this._refreshDeviceList();
        // 2.5 初始化延迟分析器 (如果启用)
        if (window.__ENABLE_LATENCY_PROFILER__ && window.LatencyProfiler) {
            const profiler = new window.LatencyProfiler(this.audioIO.audioContext);
            window.latencyProfiler = profiler;  // 暴露到全局供 monitor.html 访问
            this.latencyProfiler = profiler;    // 保存实例引用

            // 初始化 BroadcastChannel 向监控页面发送数据
            if ('BroadcastChannel' in window) {
                this.profilerBroadcast = new BroadcastChannel('latency-profiler');
                // 每秒发送一次报告
                setInterval(() => {
                    const report = profiler.generateReport();
                    report.completedSessions = profiler.completedSessions.slice(-20);  // 只发送最近20条
                    this.profilerBroadcast.postMessage({
                        type: 'report',
                        report: report
                    });
                }, 1000);
                console.log('📡 BroadcastChannel 已启动，正在向监控页面发送数据');
            }

            console.log('⚡ Latency Profiler 已启用');
            console.log(' 打开实时监控: http://localhost:3000/latency-profiler/pages/monitor.html');
            console.log(' 控制台输入 latencyProfiler.generateReport() 查看统计数据');
        }

        // 3. 初始化引擎 (使用实际的 audioContext 和 bufferSize)
        const ctx = this.audioIO.audioContext;
        //  Worklet 使用 workletBufferSize，ScriptProcessor 使用 bufferSize
        const bufferSize = result.mode === 'worklet'
            ? (this.config.audio.workletBufferSize || 128)  // 从配置读取，默认 128
            : this.config.audio.bufferSize;
        await this._initializeEngines(ctx, bufferSize, result.mode);

        // 4. 更新性能监控 (Step 2: 使用注入的服务)
        if (!this.performanceMonitor.metrics.sampleRate) {
            await this.performanceMonitor.initialize(ctx, bufferSize, result.mode);

        return result;
        }
    }

    /**
     * @deprecated Legacy audioInputManager 已弃用
     * 保留此代码仅供参考，不再使用
     * AudioIO 已提供完整的 AudioWorklet + ScriptProcessor fallback 支持
     */
    /*
    async _startWithLegacyAudio() {
        console.log('🔄 [Legacy] 使用 audioInputManager');

        // 初始化音频系统
        if (!audioInputManager.audioContext) {
            await audioInputManager.initialize();
        }

        // 启动麦克风
        await audioInputManager.startMicrophone();

        // 初始化引擎 (使用 Legacy 的 bufferSize)
        await this._initializeEngines(
            audioInputManager.audioContext,
            audioInputManager.config.bufferSize,
            'script-processor'
        );

        // 设置音频处理回调
        audioInputManager.onAudioProcess = this.onAudioProcess.bind(this);

        // 初始化性能监控
        if (!performanceMonitor.metrics.sampleRate) {
            await performanceMonitor.initialize(
                audioInputManager.audioContext,
                audioInputManager.config.bufferSize,
                'script-processor'
            );
        }
    }
    */

    /**
     * 初始化合成器引擎和音高检测器
     *  添加 ExpressiveFeatures 初始化
     *
     * @param {AudioContext} audioContext - Web Audio API 上下文
     * @param {number} bufferSize - 实际使用的缓冲区大小
     * @param {string} mode - 音频模式 ('worklet' | 'script-processor')
     */
    async _initializeEngines(audioContext, bufferSize = 2048, mode = 'script-processor') {
        // Step 2: 使用注入的服务（容器保证注入，无需回退）
        // 选择引擎
        if (this.useContinuousMode) {
            this.currentEngine = this.continuousSynthEngine;
            console.log('Using Continuous Frequency Engine');
        } else {
            this.currentEngine = this.synthesizerEngine;
            console.log('Using Legacy Note-Based Engine');
        }

        // 初始化选中的引擎
        if (!this.currentEngine.currentSynth) {
            console.log('Initializing synthesizer engine...');
            await this.currentEngine.initialize();
            
            // 🔥 Apply pre-selected instrument (User might have clicked before Start)
            if (this.selectedInstrument) {
                console.log(`[Main] Applying pre-selected instrument: ${this.selectedInstrument}`);
                this.currentEngine.changeInstrument(this.selectedInstrument);
            }
        }

        // 初始化音高检测 (ScriptProcessor 模式需要)
        if (mode !== 'worklet' && audioContext && !this.pitchDetector.detector) {
            console.log('Initializing pitch detector...');
            this.pitchDetector.initialize(audioContext.sampleRate);
        }

        //  ExpressiveFeatures 仅在 ScriptProcessor 模式下初始化
        // Worklet 模式下所有特征提取已在 Worklet 线程完成
        if (mode !== 'worklet' && !this.expressiveFeatures && audioContext && window.ExpressiveFeatures) {
            console.log('🎨 [Phase 2.10] Initializing ExpressiveFeatures (ScriptProcessor 模式) with centralized config...');
            console.log(`  Mode: ${mode}, Buffer: ${bufferSize}, SampleRate: ${audioContext.sampleRate}`);

            //  使用集中式配置
            this.expressiveFeatures = new window.ExpressiveFeatures({
                audioContext: audioContext,
                sampleRate: audioContext.sampleRate,
                bufferSize: bufferSize,
                mode: mode,
                // 注入配置参数
                config: this.config
            });

            //  注入 sourceNode 启用 AnalyserNode FFT (仅 ScriptProcessor 模式)
            if (this.audioIO && this.audioIO.sourceNode) {
                const success = this.expressiveFeatures.setSourceNode(this.audioIO.sourceNode);
                if (success) {
                    console.log(' [Phase 2.5] AnalyserNode FFT 已启用 (原生加速)');
                } else {
                    console.warn(' [Phase 2.5] AnalyserNode FFT 启用失败，继续使用纯 JS FFT');
                }
            }
        } else if (mode === 'worklet') {
            console.log(' [Phase 2.9] Worklet 模式 - 主线程跳过 ExpressiveFeatures (特征已在 Worklet 计算)');
        } else if (!window.ExpressiveFeatures) {
            console.warn(' [Phase 2] ExpressiveFeatures 模块未加载，跳过初始化');
        }
    }

    /**
     * 停止播放
     */
    stop() {
        this.isRunning = false;

        // 停止音频系统
        if (this.audioIO) {
            this.audioIO.stop();
        }

        //  停止当前引擎
        if (this.currentEngine) {
            if (this.useContinuousMode) {
                this.currentEngine.stop();
            } else {
                this.currentEngine.stopNote();
            }
        }

        // 更新UI
        this.ui.startBtn.classList.remove('hidden');
        this.ui.stopBtn.classList.add('hidden');
        this.ui.systemStatus.textContent = 'Stopped';
        this.ui.systemStatus.classList.remove('active');
        this.ui.recordingStatus.textContent = 'Ready';
        this.ui.recordingHelper.textContent = 'No setup required • Works in your browser';

        console.log('Kazoo Proto stopped');
    }

    /**
     *  处理来自 AudioWorklet 的音高检测结果
     *  集成 ExpressiveFeatures，生成完整 PitchFrame
     *
     * 注意: AudioWorklet 模式下，目前 pitchInfo 来自 Worklet，
     *       但 audioBuffer 不可用。需要在 Worklet 中传递 buffer。
     */
    onPitchDetected(pitchInfo) {
        if (!this.isRunning || !this.currentEngine) return;

        // 性能监控开始
        this.performanceMonitor.startProcessing();

        //  生成 PitchFrame
        //  警告: AudioWorklet 模式下没有 audioBuffer，表现力特征不完整
        let pitchFrame = pitchInfo;  // 默认使用原始 pitchInfo
        if (this.expressiveFeatures) {
            try {
                // TODO  在 Worklet 中传递 audioBuffer 或直接计算特征
                const dummyBuffer = new Float32Array(128);  // 占位 (volumeDb 会是 -60)
                console.warn('[Phase 2] AudioWorklet 模式下表现力特征不完整，请使用 ScriptProcessor');

                pitchFrame = this.expressiveFeatures.process({
                    pitchInfo,
                    audioBuffer: dummyBuffer,
                    timestamp: performance.now()
                });
            } catch (error) {
                console.error('[ExpressiveFeatures Error]', error);
                pitchFrame = pitchInfo;  // 回退到基础 pitchInfo
            }
        }

        // AI Processing Hook
        if (this.aiHarmonizer && this.aiHarmonizer.enabled) {
            this.aiHarmonizer.processFrame(pitchFrame);
        }

        // 更新显示
        this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
        this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
        this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

        //  驱动当前引擎 (优先使用 processPitchFrame，回退到 processPitch)
        if (this.currentEngine.processPitchFrame) {
            this.currentEngine.processPitchFrame(pitchFrame);
        } else {
            this.currentEngine.processPitch(pitchInfo);
        }

        // 可视化
        this.updateVisualizer(pitchFrame);

        // 性能监控结束
        this.performanceMonitor.endProcessing();

        // 更新性能指标
        this.performanceMonitor.updateFPS();
        const metrics = this.performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * 音频处理 - ScriptProcessor 模式 (Fallback)
     * 数据流: ScriptProcessorNode → PitchDetector → ExpressiveFeatures → Synth
     *
     *  Worklet 模式下此方法不应被调用 (数据已在 Worklet 处理完毕)
     */
    onAudioProcess(audioBuffer) {
        if (!this.isRunning || !this.currentEngine) return;

        //  Worklet 模式下跳过此流程
        if (this.audioIO && this.audioIO.mode === 'worklet') {
            console.warn('[Main]  Worklet 模式下不应调用 onAudioProcess - 数据应通过 handleWorkletPitchFrame');
            return;
        }

        // 性能监控开始
        this.performanceMonitor.startProcessing();

        const volume = calculateRMS(audioBuffer);
        const pitchInfo = this.pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            //  生成完整 PitchFrame (包含表现力特征)
            let pitchFrame = pitchInfo;  // 默认使用基础 pitchInfo
            if (this.expressiveFeatures) {
                try {
                    pitchFrame = this.expressiveFeatures.process({
                        pitchInfo,
                        audioBuffer,  // ScriptProcessor 模式有完整 buffer
                        timestamp: performance.now()
                    });
                } catch (error) {
                    console.error('[ExpressiveFeatures Error]', error);
                    pitchFrame = pitchInfo;  // 回退到基础 pitchInfo
                }
            }

            // AI Processing Hook
        if (this.aiHarmonizer && this.aiHarmonizer.enabled) {
            this.aiHarmonizer.processFrame(pitchFrame);
        }

        // 更新显示
            this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
            this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
            this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

            //  驱动当前引擎 (优先使用 processPitchFrame，回退到 processPitch)
            if (this.currentEngine.processPitchFrame) {
                this.currentEngine.processPitchFrame(pitchFrame);
            } else {
                this.currentEngine.processPitch(pitchInfo);
            }

            // 可视化
            this.updateVisualizer(pitchFrame);
        }

        // 性能监控结束
        this.performanceMonitor.endProcessing();

        // 更新性能指标
        this.performanceMonitor.updateFPS();
        const metrics = this.performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     *  处理 Worklet 模式的完整 PitchFrame
     *
     * 数据流: AudioWorkletNode.process() → YIN + FFT + EMA + OnsetDetector →
     *         pitch-frame message → onWorkletPitchFrame 回调 → 此方法
     *
     * @param {PitchFrame} pitchFrame - 包含 11 个字段的完整音高帧
     * @param {number} timestamp - 时间戳 (ms)
     */
    handleWorkletPitchFrame(pitchFrame, timestamp, receiveTime) {
        if (!this.isRunning || !this.currentEngine) return;

        // Measure end-to-end latency
        if (receiveTime && pitchFrame.captureTime) {
            const latency = receiveTime - pitchFrame.captureTime;
            this.latencyMeasurements.push(latency);
            if (this.latencyMeasurements.length > 100) {
                this.latencyMeasurements.shift();
            }
        }

        // 调试: 首次调用时打印完整 PitchFrame
        if (!this._workletPitchFrameLogged) {
            console.log('[Main] handleWorkletPitchFrame 首次调用:', {
                pitchFrame,
                timestamp,
                fields: Object.keys(pitchFrame)
            });
            console.log('[Main] Worklet 数据流已建立 - 跳过主线程 ExpressiveFeatures');
            this._workletPitchFrameLogged = true;
        }

        // 性能监控开始
        this.performanceMonitor.startProcessing();

        // 更新 UI 显示
        this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
        this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
        this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

        // 直接传递给合成器 (PitchFrame 已包含所有表现力特征)
        if (this.currentEngine.processPitchFrame) {
            this.currentEngine.processPitchFrame(pitchFrame);
        } else if (this.currentEngine.processPitch) {
            // Fallback: 合成器不支持完整 PitchFrame API
            this.currentEngine.processPitch(pitchFrame);
        }

        // 更新可视化
        this.updateVisualizer(pitchFrame);

        // 性能监控结束
        this.performanceMonitor.endProcessing();
        this.performanceMonitor.updateFPS();

        // 更新延迟显示
        const metrics = this.performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * 初始化可视化 - Modern Piano Roll Style
     */
    initVisualizer() {
        const canvas = this.ui.pitchCanvas;
        if (!canvas) return;

        this.visualizer = {
            ctx: canvas.getContext('2d'),
            history: [],
            maxHistory: 300, // Keep ~5-6 seconds of history at 60fps
            
            // Vocal Range: E2 (82Hz) to C6 (1047Hz)
            // Using MIDI note numbers for logarithmic scaling
            minMidi: 40,  // E2
            maxMidi: 84,  // C6
            
            gridColor: 'rgba(255, 255, 255, 0.05)',
            cNoteColor: 'rgba(255, 255, 255, 0.15)',
            activeNoteColor: 'rgba(255, 255, 255, 0.1)',
            
            lastFrame: null
        };

        this.resizeVisualizer();
        window.addEventListener('resize', () => this.resizeVisualizer());
    }

    /**
     * 辅助：频率转 MIDI 音符编号 (Float)
     */
    _freqToMidi(freq) {
        if (!freq || freq <= 0) return 0;
        return 69 + 12 * Math.log2(freq / 440);
    }

    /**
     * 辅助：MIDI 音符编号转 Y 坐标
     */
    _midiToY(midi, canvasHeight) {
        const { minMidi, maxMidi } = this.visualizer;
        // Map MIDI range to 0-1 (inverted because Canvas Y=0 is top)
        const normalized = 1 - (midi - minMidi) / (maxMidi - minMidi);
        return normalized * canvasHeight;
    }

    /**
     * 更新可视化
     */
    updateVisualizer(pitchInfo) {
        if (!this.visualizer || !this.ui.pitchCanvas) return;

        // 仅在有置信度时记录，或者记录 null 表示中断
        // 为了线条连续性，我们记录所有帧，但在绘制时处理中断
        this.visualizer.history.push({
            frequency: pitchInfo.frequency,
            confidence: pitchInfo.confidence || 0,
            midi: this._freqToMidi(pitchInfo.frequency),
            timestamp: Date.now()
        });

        if (this.visualizer.history.length > this.visualizer.maxHistory) {
            this.visualizer.history.shift();
        }

        this.visualizer.lastFrame = pitchInfo;
        this.drawVisualizer();
    }

    drawVisualizer() {
        const { ctx, history, minMidi, maxMidi } = this.visualizer;
        const canvas = this.ui.pitchCanvas;
        if (!ctx || !canvas) return;

        const width = canvas.width;
        const height = canvas.height;

        // 1. Clear & Background
        ctx.clearRect(0, 0, width, height);
        
        // 2. Draw Piano Roll Grid (Semitones)
        // Loop through all MIDI notes in range
        const startNote = Math.ceil(minMidi);
        const endNote = Math.floor(maxMidi);
        
        // Calculate current note row to highlight
        const currentFreq = this.visualizer.lastFrame?.frequency;
        const currentMidi = this._freqToMidi(currentFreq);
        const currentNoteRounded = Math.round(currentMidi);

        ctx.lineWidth = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '10px Inter, sans-serif';

        for (let i = startNote; i <= endNote; i++) {
            const y = this._midiToY(i, height);
            const isC = i % 12 === 0; // C notes (0=C-1, 12=C0, 24=C1, 36=C2, 48=C3...)
            
            // Highlight current detected note row
            const isCurrentRow = (i === currentNoteRounded) && (this.visualizer.lastFrame?.confidence > 0.1);

            ctx.beginPath();
            
            if (isCurrentRow) {
                ctx.fillStyle = 'rgba(66, 133, 244, 0.15)'; // Active note row highlight
                const rowHeight = height / (maxMidi - minMidi);
                ctx.fillRect(0, y - rowHeight/2, width, rowHeight);
            }

            // Grid Line
            if (isC) {
                ctx.strokeStyle = this.visualizer.cNoteColor;
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = this.visualizer.gridColor;
                ctx.lineWidth = 0.5;
            }
            
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();

            // Labels for C notes
            if (isC) {
                const octave = (i / 12) - 1;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillText(`C${octave}`, 5, y - 2);
            }
        }

        // 3. Draw Pitch Curve (保留音高展示，优化 GPU 开销)
        if (history.length < 2) return;

        ctx.beginPath();
        
        // 简化：使用纯色代替渐变以降低 GPU 开销
        ctx.strokeStyle = 'rgba(66, 133, 244, 0.8)';
        ctx.lineWidth = 2; // 稍微减小线宽
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 绘制音高曲线
        let started = false;
        const xStep = width / (this.visualizer.maxHistory - 1);

        for (let i = 0; i < history.length; i++) {
            const point = history[i];
            const x = i * xStep;
            
            // Skip if silence or low confidence
            if (point.confidence < 0.1 || point.frequency < 50) {
                started = false;
                continue;
            }

            const y = this._midiToY(point.midi, height);

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y); 
            }
        }
        
        // 移除阴影效果以降低 GPU 开销
        ctx.stroke();

        // 4. Current Pitch Indicator (Right Side) - 保留但简化
        const last = history[history.length - 1];
        if (last && last.confidence > 0.1 && last.frequency > 50) {
            const y = this._midiToY(last.midi, height);
            const x = width - 5;

            // 简化：移除阴影的圆点
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // Current Note Label Bubble - 保留音符显示
            const noteName = this.ui.currentNote.textContent;
            ctx.fillStyle = 'rgba(66, 133, 244, 0.9)';
            ctx.beginPath();
            ctx.roundRect(width - 40, y - 10, 35, 20, 4);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(noteName, width - 22, y);
        }
    }

    resizeVisualizer() {
        if (!this.visualizer || !this.ui.pitchCanvas) {
            return;
        }

        const canvas = this.ui.pitchCanvas;
        // Use parent container dimensions
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
        
        // Redraw immediately
        this.drawVisualizer();
    }

    openHelpSection() {
        if (!this.ui.helpContent) {
            return;
        }

        if (!this.ui.helpContent.classList.contains('show')) {
            this.ui.helpContent.classList.add('show');
        }

        if (this.ui.helpToggle) {
            this.ui.helpToggle.setAttribute('aria-expanded', true);
        }
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
        if (this.latencyMeasurements.length === 0) {
            return { min: 0, max: 0, avg: 0, count: 0 };
        }
        const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
        return {
            min: sorted[0].toFixed(1),
            max: sorted[sorted.length - 1].toFixed(1),
            avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1),
            p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(1),
            p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
            count: sorted.length
        };
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
        if (this.ui.warningBox && this.ui.warningText) {
            this.ui.warningBox.classList.remove('hidden');
            this.ui.warningText.innerHTML = `<li>${message.replace(/\n/g, '</li><li>')}</li>`;
        }
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

// 4. 表现力特征提取模块 (Stage2: 直接使用 import)
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

// 9. 主应用实例 (Step 2: 传入服务对象，实现依赖注入)
container.register('app', (c) => {
    console.log('[Container]  创建 KazooApp 实例 (依赖注入)...');

    // 收集所有依赖服务
    const services = {
        config: c.get('config'),
        configManager: c.get('configManager'),
        pitchDetector: c.get('pitchDetector'),
        performanceMonitor: c.get('performanceMonitor'),
        synthesizerEngine: c.get('synthesizerEngine'),
        continuousSynthEngine: c.get('continuousSynthEngine'),
        ExpressiveFeatures: c.get('ExpressiveFeatures'),
        aiHarmonizer: c.get('aiHarmonizer')
    };

    console.log('[Container]  服务已注入:', Object.keys(services));
    return new KazooApp(services);
}, {
    singleton: true,
    dependencies: ['config', 'configManager', 'pitchDetector', 'performanceMonitor',
                   'synthesizerEngine', 'continuousSynthEngine', 'ExpressiveFeatures',
                   'aiHarmonizer']
});

// =============================================================================
// 全局暴露 (仅保留应用入口和容器调试接口)
// =============================================================================
// Stage2 清理完成：移除所有中间服务的全局暴露
// - 所有服务现在通过 window.container.get('serviceName') 访问
// - 仅保留 window.app (应用入口) 和 window.container (调试接口)
//
// 调试示例:
//   window.container.get('configManager')
//   window.container.get('pitchDetector')
//   window.container.get('performanceMonitor')
//

// 应用实例稍后创建 (DOMContentLoaded)
let app = null;

// 暴露容器到全局 (唯一的服务访问入口)
window.container = container;

console.log('[Main]  依赖注入容器初始化完成');
console.log('[Main]  已注册服务:', container.getServiceNames());

// =============================================================================
// 应用启动
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 从容器获取应用实例
    app = container.get('app');

    // 暴露到全局 (兼容性)
    window.app = app;

    // 初始化应用
    app.initialize();
});
