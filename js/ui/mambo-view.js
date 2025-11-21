export class MamboView {
    /**
     * @param {Document} rootDocument
     */
    constructor(rootDocument = document) {
        this.doc = rootDocument;

        // Cache Elements
        this.reverbSlider = this.doc.getElementById('reverbSlider');
        this.reverbValue = this.doc.getElementById('reverbValue');
        this.delaySlider = this.doc.getElementById('delaySlider');
        this.delayValue = this.doc.getElementById('delayValue');

        // Transport Elements
        this.startBtn = this.doc.getElementById('startBtn');
        this.stopBtn = this.doc.getElementById('stopBtn');
        this.modeToggle = this.doc.getElementById('modeToggle');
        this.modeText = this.doc.getElementById('modeText');

        // Instrument Elements
        this.instrumentBtns = this.doc.querySelectorAll('.instrument-btn');
        this.instrumentStatus = this.doc.getElementById('instrumentStatus');

        // AI Jam Elements
        this.aiJamBtn = this.doc.getElementById('aiJamBtn');
        this.aiJamTitle = this.doc.getElementById('aiJamTitle');
        this.aiJamStatus = this.doc.getElementById('aiJamStatus');
        this.aiIconIdle = this.doc.getElementById('aiIconIdle');
        this.aiIconLoading = this.doc.getElementById('aiIconLoading');
        this.aiIconActive = this.doc.getElementById('aiIconActive');
        this.aiProgressBar = this.doc.getElementById('aiProgressBar');

        // Device Select Elements
        this.audioInputSelect = this.doc.getElementById('audioInputSelect');
        this.audioOutputSelect = this.doc.getElementById('audioOutputSelect');
        this.refreshDevicesBtn = this.doc.getElementById('refreshDevicesBtn');

        // Settings Modal Elements
        this.settingsBtn = this.doc.getElementById('settingsBtn');
        this.settingsModal = this.doc.getElementById('settingsModal');
        this.settingsBackdrop = this.doc.getElementById('settingsBackdrop');
        this.settingsPanel = this.doc.getElementById('settingsPanel');
        this.closeSettingsBtn = this.doc.getElementById('closeSettingsBtn');

        // Status Message Elements
        this.systemStatus = this.doc.getElementById('systemStatus');
        this.warningBox = this.doc.getElementById('warningBox');
        this.warningText = this.doc.getElementById('warningText');
        this.recordingHelper = this.doc.getElementById('recordingHelper');
    }

    /**
     * Bind UI events (Delegate logic to handlers)
     * @param {object} handlers
     * @param {(percent: number) => void} handlers.onReverbChange
     * @param {(percent: number) => void} handlers.onDelayChange
     */
    bindEffectsUI(handlers) {
        if (this.reverbSlider && handlers.onReverbChange) {
            this.reverbSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handlers.onReverbChange(val);
            });
        }
        
        if (this.delaySlider && handlers.onDelayChange) {
            this.delaySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handlers.onDelayChange(val);
            });
        }
    }

    /**
     * Bind Instrument Selection events
     * @param {object} handlers
     * @param {(instrumentId: string) => void} handlers.onSelectInstrument
     */
    bindInstrumentUI(handlers) {
        if (this.instrumentBtns && handlers.onSelectInstrument) {
            this.instrumentBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const instrumentId = e.currentTarget.dataset.instrument;
                    if (instrumentId) {
                        handlers.onSelectInstrument(instrumentId);
                    }
                });
            });
        }
    }

    /**
     * Bind Transport events
     * @param {object} handlers
     * @param {() => void} handlers.onStart
     * @param {() => void} handlers.onStop
     * @param {(isContinuous: boolean) => void} handlers.onModeChange
     */
    bindTransportUI(handlers) {
        if (this.startBtn && handlers.onStart) {
            this.startBtn.addEventListener('click', handlers.onStart);
        }
        if (this.stopBtn && handlers.onStop) {
            this.stopBtn.addEventListener('click', handlers.onStop);
        }
        if (this.modeToggle && handlers.onModeChange) {
            this.modeToggle.addEventListener('change', (e) => {
                handlers.onModeChange(e.target.checked);
            });
        }
    }

    /**
     * Render state to UI
     * @param {object} synthState - The 'synth' slice of the app state
     */
    renderEffects(synthState) {
        if (!synthState) return;

        const reverbPercent = Math.round((synthState.reverbWet ?? 0) * 100);
        const delayPercent = Math.round((synthState.delayWet ?? 0) * 100);

        // Reverb
        if (this.reverbSlider && this.reverbSlider.value !== String(reverbPercent)) {
            this.reverbSlider.value = reverbPercent;
        }
        if (this.reverbValue && this.reverbValue.textContent !== `${reverbPercent}%`) {
            this.reverbValue.textContent = `${reverbPercent}%`;
        }

        // Delay
        if (this.delaySlider && this.delaySlider.value !== String(delayPercent)) {
            this.delaySlider.value = delayPercent;
        }
        if (this.delayValue && this.delayValue.textContent !== `${delayPercent}%`) {
            this.delayValue.textContent = `${delayPercent}%`;
        }
    }

    /**
     * Render Transport State
     * @param {object} statusState - The 'status' slice
     * @param {object} synthState - The 'synth' slice
     */
    renderTransport(statusState, synthState) {
        // 1. Engine State (Start/Stop buttons)
        if (statusState && statusState.engineState) {
            const isRunning = statusState.engineState === 'running';
            const isStarting = statusState.engineState === 'starting';
            
            // Simple visibility toggle
            if (this.startBtn) {
                const shouldHide = isRunning || isStarting;
                this.startBtn.classList.toggle('hidden', shouldHide);
                
                // Disable during starting, but DO NOT overwrite innerHTML with textContent
                this.startBtn.disabled = isStarting;
                this.startBtn.classList.toggle('opacity-50', isStarting);
                this.startBtn.classList.toggle('cursor-not-allowed', isStarting);
                
                // Optional: If you really want to change text, find the span inside
                const textSpan = this.startBtn.querySelector('span');
                if (textSpan) {
                    textSpan.textContent = isStarting ? 'Starting...' : 'Start Engine';
                }
            }

            if (this.stopBtn) {
                // Show stop button only if running
                const shouldShow = isRunning;
                this.stopBtn.classList.toggle('hidden', !shouldShow);
            }
        }

        // 2. Mode Toggle
        if (synthState && this.modeToggle) {
            const isContinuous = synthState.continuousMode;
            if (this.modeToggle.checked !== isContinuous) {
                this.modeToggle.checked = isContinuous;
            }
            if (this.modeText) {
                this.modeText.textContent = isContinuous ? 'Continuous' : 'Legacy';
            }
        }
    }

    /**
     * Render Instrument State
     * @param {object} synthState - The 'synth' slice
     */
    renderInstrument(synthState) {
        if (!synthState || !synthState.instrument) return;

        const activeId = synthState.instrument;

        // 1. Update active class on buttons
        if (this.instrumentBtns) {
            this.instrumentBtns.forEach(btn => {
                if (btn.dataset.instrument === activeId) {
                    btn.classList.add('active');
                    // Update Status Badge if this is the active button
                    if (this.instrumentStatus) {
                         const nameEl = btn.querySelector('.font-semibold');
                         if (nameEl) this.instrumentStatus.textContent = nameEl.textContent;
                    }
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    /**
     * Bind AI Jam UI events
     * @param {object} handlers
     * @param {() => void} handlers.onToggleAiJam
     */
    bindAiJamUI(handlers) {
        if (this.aiJamBtn && handlers.onToggleAiJam) {
            this.aiJamBtn.addEventListener('click', handlers.onToggleAiJam);
        }
    }

    /**
     * Render AI Jam State
     * @param {object} aiState - AI Jam state object
     * @param {string} aiState.status - 'idle' | 'loading' | 'ready' | 'processing' | 'error'
     * @param {string} [aiState.message] - Optional status message
     */
    renderAiJam(aiState) {
        if (!aiState || !this.aiJamBtn) return;

        const { status } = aiState;

        // Hide all icons first
        if (this.aiIconIdle) this.aiIconIdle.classList.add('hidden');
        if (this.aiIconLoading) this.aiIconLoading.classList.add('hidden');
        if (this.aiIconActive) this.aiIconActive.classList.add('hidden');
        if (this.aiProgressBar) this.aiProgressBar.style.width = '0%';

        // Define style presets
        const idleClasses = {
            add: ['bg-white/80', 'hover:bg-white', 'text-gray-900'],
            remove: ['bg-blue-600', 'hover:bg-blue-700', 'text-white']
        };
        const activeClasses = {
            add: ['bg-blue-600', 'hover:bg-blue-700', 'text-white'],
            remove: ['bg-white/80', 'hover:bg-white', 'text-gray-900']
        };

        const applyClasses = (element, preset) => {
            if (!element) return;
            element.classList.remove(...preset.remove);
            element.classList.add(...preset.add);
        };

        switch (status) {
            case 'loading':
                // Loading State
                if (this.aiIconLoading) this.aiIconLoading.classList.remove('hidden');
                if (this.aiJamTitle) this.aiJamTitle.textContent = 'Downloading...';
                if (this.aiJamStatus) this.aiJamStatus.textContent = '~5MB Model';
                if (this.aiJamBtn) this.aiJamBtn.disabled = true;

                // Simulate progress animation
                if (this.aiProgressBar) {
                    setTimeout(() => { this.aiProgressBar.style.width = '40%'; }, 100);
                    setTimeout(() => { this.aiProgressBar.style.width = '80%'; }, 2000);
                }
                break;

            case 'ready':
                // Active State
                applyClasses(this.aiJamBtn, activeClasses);
                if (this.aiJamTitle) {
                    this.aiJamTitle.classList.remove('text-gray-900');
                    this.aiJamTitle.classList.add('text-white');
                }
                if (this.aiJamStatus) {
                    this.aiJamStatus.classList.remove('text-gray-500');
                    this.aiJamStatus.classList.add('text-blue-100');
                }
                if (this.aiIconActive) this.aiIconActive.classList.remove('hidden');
                if (this.aiJamTitle) this.aiJamTitle.textContent = 'Smart Jam';
                if (this.aiJamStatus) this.aiJamStatus.textContent = 'Listening...';
                if (this.aiJamBtn) this.aiJamBtn.disabled = false;
                break;

            case 'processing':
                // Thinking State
                applyClasses(this.aiJamBtn, activeClasses);
                if (this.aiJamTitle) {
                    this.aiJamTitle.classList.remove('text-gray-900');
                    this.aiJamTitle.classList.add('text-white');
                }
                if (this.aiJamStatus) {
                    this.aiJamStatus.classList.remove('text-gray-500');
                    this.aiJamStatus.classList.add('text-blue-100');
                }
                if (this.aiIconActive) this.aiIconActive.classList.remove('hidden');
                if (this.aiJamStatus) this.aiJamStatus.textContent = 'Generating...';
                break;

            case 'error':
                // Error State
                applyClasses(this.aiJamBtn, idleClasses);
                if (this.aiJamTitle) {
                    this.aiJamTitle.classList.remove('text-white');
                    this.aiJamTitle.classList.add('text-gray-900');
                }
                if (this.aiJamStatus) {
                    this.aiJamStatus.classList.remove('text-blue-100');
                    this.aiJamStatus.classList.add('text-gray-500');
                }
                if (this.aiIconIdle) this.aiIconIdle.classList.remove('hidden');
                if (this.aiJamTitle) this.aiJamTitle.textContent = 'Error';
                if (this.aiJamStatus) this.aiJamStatus.textContent = 'Try Again';
                if (this.aiJamBtn) this.aiJamBtn.disabled = false;
                break;

            case 'idle':
            default:
                // Idle State
                applyClasses(this.aiJamBtn, idleClasses);
                if (this.aiJamTitle) {
                    this.aiJamTitle.classList.remove('text-white');
                    this.aiJamTitle.classList.add('text-gray-900');
                }
                if (this.aiJamStatus) {
                    this.aiJamStatus.classList.remove('text-blue-100');
                    this.aiJamStatus.classList.add('text-gray-500');
                }
                if (this.aiIconIdle) this.aiIconIdle.classList.remove('hidden');
                if (this.aiJamTitle) this.aiJamTitle.textContent = 'Smart Jam';
                if (this.aiJamStatus) this.aiJamStatus.textContent = 'Off';
                if (this.aiJamBtn) this.aiJamBtn.disabled = false;
                break;
        }
    }

    /**
     * Bind Device Select UI events
     * @param {object} handlers
     * @param {(deviceId: string) => void} handlers.onInputDeviceChange
     * @param {(deviceId: string) => void} handlers.onOutputDeviceChange
     * @param {() => void} handlers.onRefreshDevices
     */
    bindDeviceSelectUI(handlers) {
        if (this.audioInputSelect && handlers.onInputDeviceChange) {
            this.audioInputSelect.addEventListener('change', (e) => {
                handlers.onInputDeviceChange(e.target.value);
            });
        }

        if (this.audioOutputSelect && handlers.onOutputDeviceChange) {
            this.audioOutputSelect.addEventListener('change', (e) => {
                handlers.onOutputDeviceChange(e.target.value);
            });
        }

        if (this.refreshDevicesBtn && handlers.onRefreshDevices) {
            this.refreshDevicesBtn.addEventListener('click', handlers.onRefreshDevices);
        }
    }

    /**
     * Render Device Select dropdowns
     * @param {object} deviceState
     * @param {Array} deviceState.inputDevices - Array of input device objects
     * @param {Array} deviceState.outputDevices - Array of output device objects
     * @param {string} deviceState.selectedInputId - Currently selected input device ID
     * @param {string} deviceState.selectedOutputId - Currently selected output device ID
     * @param {string} [deviceState.lastKnownInputLabel] - Label for disconnected input device
     * @param {string} [deviceState.lastKnownOutputLabel] - Label for disconnected output device
     */
    renderDeviceSelects(deviceState) {
        if (!deviceState) return;

        const {
            inputDevices = [],
            outputDevices = [],
            selectedInputId = 'default',
            selectedOutputId = 'default',
            lastKnownInputLabel = '',
            lastKnownOutputLabel = ''
        } = deviceState;

        // Render input devices
        if (this.audioInputSelect) {
            this._populateSelectElement(
                this.audioInputSelect,
                inputDevices,
                selectedInputId,
                'Microphone',
                'Default Microphone',
                lastKnownInputLabel
            );
        }

        // Render output devices
        if (this.audioOutputSelect) {
            this._populateSelectElement(
                this.audioOutputSelect,
                outputDevices,
                selectedOutputId,
                'Speaker',
                'Default Output',
                lastKnownOutputLabel
            );
        }
    }

    /**
     * Render refresh button animation
     * @param {boolean} isRefreshing - Whether refresh is in progress
     */
    renderDeviceRefreshState(isRefreshing) {
        if (!this.refreshDevicesBtn) return;

        const icon = this.refreshDevicesBtn.querySelector('svg');
        if (!icon) return;

        if (isRefreshing) {
            icon.classList.add('animate-spin');
        } else {
            icon.classList.remove('animate-spin');
        }
    }

    /**
     * Populate a select element with device options
     * @private
     * @param {HTMLSelectElement} selectElement
     * @param {Array} devices - Array of {deviceId, label} objects
     * @param {string} selectedValue - Value to select
     * @param {string} deviceTypeName - 'Microphone' or 'Speaker'
     * @param {string} defaultLabel - Label for default option
     * @param {string} lastKnownLabel - Label for disconnected device
     */
    _populateSelectElement(selectElement, devices, selectedValue, deviceTypeName, defaultLabel, lastKnownLabel) {
        if (!selectElement) return;

        // Clear existing options
        selectElement.innerHTML = '';

        // Add default option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = 'default';
        defaultOpt.textContent = defaultLabel;
        selectElement.appendChild(defaultOpt);

        // Add device options
        devices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${deviceTypeName} ${index + 1}`;
            selectElement.appendChild(option);
        });

        // Restore previous selection if possible
        const hasMatchingOption = [...selectElement.options].some(opt => opt.value === selectedValue);

        if (selectedValue && hasMatchingOption) {
            selectElement.value = selectedValue;
        } else if (selectedValue && selectedValue !== 'default') {
            // Device disconnected - add ghost option
            const ghostOption = document.createElement('option');
            ghostOption.value = selectedValue;
            ghostOption.textContent = `${lastKnownLabel || `Previous ${deviceTypeName}`} (disconnected)`;
            ghostOption.disabled = true;
            selectElement.appendChild(ghostOption);
            selectElement.value = selectedValue;
        }
    }

    /**
     * Bind Settings Modal UI events
     * @param {object} handlers
     * @param {() => void} handlers.onOpenSettings
     * @param {() => void} handlers.onCloseSettings
     */
    bindSettingsUI(handlers) {
        if (this.settingsBtn && handlers.onOpenSettings) {
            this.settingsBtn.addEventListener('click', handlers.onOpenSettings);
        }

        if (this.closeSettingsBtn && handlers.onCloseSettings) {
            this.closeSettingsBtn.addEventListener('click', handlers.onCloseSettings);
        }

        if (this.settingsBackdrop && handlers.onCloseSettings) {
            this.settingsBackdrop.addEventListener('click', handlers.onCloseSettings);
        }
    }

    /**
     * Render Settings Modal State
     * @param {boolean} isOpen - Whether the modal should be open
     */
    renderSettingsModal(isOpen) {
        if (!this.settingsModal) return;

        if (isOpen) {
            // Open Animation
            this.settingsModal.classList.remove('hidden');

            // Prevent background scrolling
            document.body.classList.add('overflow-hidden');

            // Trigger reflow for animation
            void this.settingsModal.offsetWidth;

            // Animate in
            if (this.settingsBackdrop) {
                this.settingsBackdrop.classList.remove('opacity-0');
            }
            if (this.settingsPanel) {
                this.settingsPanel.classList.remove('translate-x-full');
            }
        } else {
            // Close Animation
            if (this.settingsBackdrop) {
                this.settingsBackdrop.classList.add('opacity-0');
            }
            if (this.settingsPanel) {
                this.settingsPanel.classList.add('translate-x-full');
            }

            // Remove scroll lock
            document.body.classList.remove('overflow-hidden');

            // Wait for transition, then hide
            setTimeout(() => {
                this.settingsModal.classList.add('hidden');
            }, 300);
        }
    }

    /**
     * Render System Status Message
     * @param {string} text - Status text to display
     * @param {object} [options] - Rendering options
     * @param {boolean} [options.highlight] - Add highlight class
     * @param {boolean} [options.active] - Add active class
     * @param {number} [options.timeout] - Auto-clear after milliseconds
     * @returns {Function|null} Cleanup function to cancel timeout, or null
     */
    renderStatusMessage(text, options = {}) {
        if (!this.systemStatus) return null;

        this.systemStatus.textContent = text;

        // Apply classes
        if (options.highlight) {
            this.systemStatus.classList.add('highlight');
        } else {
            this.systemStatus.classList.remove('highlight');
        }

        if (options.active !== undefined) {
            if (options.active) {
                this.systemStatus.classList.add('active');
            } else {
                this.systemStatus.classList.remove('active');
            }
        }

        // Handle timeout
        if (options.timeout) {
            const timeoutId = setTimeout(() => {
                if (options.restoreText) {
                    this.systemStatus.textContent = options.restoreText;
                }
                this.systemStatus.classList.remove('highlight');
            }, options.timeout);

            // Return cleanup function
            return () => clearTimeout(timeoutId);
        }

        return null;
    }

    /**
     * Render Warning Message
     * @param {string[]|string} messages - Warning messages (array or newline-separated string)
     * @param {boolean} show - Whether to show or hide warning box
     */
    renderWarning(messages, show = true) {
        if (!this.warningBox || !this.warningText) return;

        if (!show) {
            this.warningBox.classList.add('hidden');
            return;
        }

        // Convert to array if string
        const messageArray = Array.isArray(messages)
            ? messages
            : messages.split('\n').filter(m => m.trim());

        // Render as list
        this.warningText.innerHTML = messageArray.map(m => `<li>${m}</li>`).join('');
        this.warningBox.classList.remove('hidden');
    }

    /**
     * Render Device Helper Text
     * @param {string} inputLabel - Input device label
     * @param {string} outputLabel - Output device label
     */
    renderDeviceHelper(inputLabel, outputLabel) {
        if (!this.recordingHelper) return;

        const mic = inputLabel || 'System Default';
        const out = outputLabel || 'System Default';
        this.recordingHelper.textContent = `Mic · ${mic}  |  Output · ${out}`;
    }
}
