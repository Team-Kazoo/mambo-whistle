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

        // Help Section Elements
        this.helpBtn = this.doc.getElementById('helpBtn');
        this.helpToggle = this.doc.getElementById('helpToggle');
        this.helpContent = this.doc.getElementById('helpContent');

        // Auto-Tune Control Elements
        this.strengthControl = this.doc.getElementById('strengthControl');
        this.speedControl = this.doc.getElementById('speedControl');
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
        const icon = document.getElementById('aiJamIcon');
        const text = document.getElementById('aiJamText');
        const notice = document.getElementById('aiJamNotice');

        switch (status) {
            case 'idle':
                // Off State
                if (text) text.textContent = 'AI Jam';
                if (icon) icon.classList.remove('animate-spin', 'animate-pulse');
                this.aiJamBtn.classList.remove('border-purple-400', 'bg-purple-600/30');
                this.aiJamBtn.classList.add('border-purple-500/30');
                this.aiJamBtn.disabled = false;
                break;

            case 'loading':
                // Loading Model
                if (text) text.textContent = 'Loading...';
                if (icon) {
                    icon.classList.remove('animate-pulse');
                    icon.classList.add('animate-spin');
                }
                this.aiJamBtn.classList.add('border-purple-400');
                this.aiJamBtn.disabled = true;
                // Show notice on first load
                if (notice && !sessionStorage.getItem('aiJamNoticeSeen')) {
                    notice.classList.remove('hidden');
                    sessionStorage.setItem('aiJamNoticeSeen', 'true');
                }
                break;

            case 'ready':
                // Active - Listening
                if (text) text.textContent = 'AI Listening';
                if (icon) {
                    icon.classList.remove('animate-spin');
                    icon.classList.add('animate-pulse');
                }
                this.aiJamBtn.classList.remove('border-purple-500/30');
                this.aiJamBtn.classList.add('border-purple-400', 'bg-purple-600/30');
                this.aiJamBtn.disabled = false;
                break;

            case 'processing':
                // Generating harmony
                if (text) text.textContent = 'AI Jamming';
                if (icon) icon.classList.add('animate-pulse');
                break;

            case 'error':
                // Error State
                if (text) text.textContent = 'AI Error';
                if (icon) icon.classList.remove('animate-spin', 'animate-pulse');
                this.aiJamBtn.classList.remove('border-purple-400', 'bg-purple-600/30');
                this.aiJamBtn.classList.add('border-red-500/50');
                this.aiJamBtn.disabled = false;
                break;

            default:
                // Fallback to idle
                if (text) text.textContent = 'AI Jam';
                if (icon) icon.classList.remove('animate-spin', 'animate-pulse');
                this.aiJamBtn.disabled = false;
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

    /**
     * Bind Help Section UI events
     * @param {object} handlers
     * @param {() => void} handlers.onHelpBtnClick
     * @param {() => void} handlers.onHelpToggle
     */
    bindHelpUI(handlers) {
        if (this.helpBtn && handlers.onHelpBtnClick) {
            this.helpBtn.addEventListener('click', handlers.onHelpBtnClick);
        }

        if (this.helpToggle && handlers.onHelpToggle) {
            this.helpToggle.addEventListener('click', handlers.onHelpToggle);
        }
    }

    /**
     * Render Help Section State
     * @param {boolean} isOpen - Whether help section is open
     */
    renderHelp(isOpen) {
        if (!this.helpContent) return;

        if (isOpen) {
            this.helpContent.classList.add('show');
        } else {
            this.helpContent.classList.remove('show');
        }

        if (this.helpToggle) {
            this.helpToggle.setAttribute('aria-expanded', isOpen);
        }
    }

    /**
     * Toggle Help Section and return new state
     * @returns {boolean} New open state
     */
    toggleHelp() {
        if (!this.helpContent) return false;

        const isOpen = this.helpContent.classList.toggle('show');
        if (this.helpToggle) {
            this.helpToggle.setAttribute('aria-expanded', isOpen);
        }
        return isOpen;
    }

    /**
     * Render Auto-Tune Controls State (Enable/Disable)
     * @param {boolean} enabled - Whether Auto-Tune is enabled
     */
    renderAutoTuneControls(enabled) {
        const opacity = enabled ? '1' : '0.5';
        const pointerEvents = enabled ? 'auto' : 'none';

        if (this.strengthControl) {
            this.strengthControl.style.opacity = opacity;
            this.strengthControl.style.pointerEvents = pointerEvents;
        }

        if (this.speedControl) {
            this.speedControl.style.opacity = opacity;
            this.speedControl.style.pointerEvents = pointerEvents;
        }
    }

    /**
     * Render Segmented Control State
     * @param {HTMLElement} container - Container element with buttons
     * @param {string|number} selectedValue - Value to mark as active
     */
    renderSegmentedControl(container, selectedValue) {
        if (!container) return;

        const buttons = container.querySelectorAll('button');
        const activeClass = ['bg-white', 'shadow-md', 'text-blue-600', 'font-bold', 'ring-1', 'ring-black/5'];
        const inactiveClass = ['text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-200/50'];

        buttons.forEach(btn => {
            if (btn.dataset.value === String(selectedValue)) {
                btn.classList.add(...activeClass);
                btn.classList.remove(...inactiveClass);
            } else {
                btn.classList.remove(...activeClass);
                btn.classList.add(...inactiveClass);
            }
        });
    }

    /**
     * Get selected device label from select element
     * @param {'input'|'output'} type - Device type
     * @returns {string} Selected device label or fallback
     */
    getSelectedDeviceLabel(type) {
        const selectEl = type === 'input' ? this.audioInputSelect : this.audioOutputSelect;
        const fallback = type === 'input' ? 'Custom Microphone' : 'Custom Output';

        if (!selectEl || !selectEl.selectedOptions[0]) {
            return fallback;
        }

        return selectEl.selectedOptions[0].textContent || fallback;
    }

    /**
     * Sync select element value, creating ghost option if needed
     * @param {HTMLSelectElement} selectEl - The select element
     * @param {string} deviceId - Device ID to set
     * @param {string} [fallbackLabel] - Label for ghost option
     */
    syncSelectValue(selectEl, deviceId, fallbackLabel) {
        if (!selectEl || !deviceId) return;

        const options = [...selectEl.options];
        if (!options.some(o => o.value === deviceId)) {
            const option = this.doc.createElement('option');
            option.value = deviceId;
            option.textContent = fallbackLabel || 'Active Device';
            selectEl.appendChild(option);
        }
        selectEl.value = deviceId;
    }

    /**
     * Find device ID by label text
     * @param {HTMLSelectElement} selectEl - The select element
     * @param {string} label - Label to search for
     * @returns {string|null} Device ID or null
     */
    findDeviceIdByLabel(selectEl, label) {
        if (!selectEl || !label) return null;

        const option = [...selectEl.options].find(o => o.textContent === label);
        return option ? option.value : null;
    }
}
