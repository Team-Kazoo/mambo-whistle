/**
 * 音色合成模块
 * 使用Tone.js实现多种乐器音色
 */

class SynthesizerEngine {
    constructor() {
        this.currentSynth = null;
        this.currentInstrument = 'saxophone';
        this.isPlaying = false;
        this.currentNote = null;
        this.currentFrequency = 0;

        // 效果器
        this.reverb = null;
        this.vibrato = null;
        this.filter = null;

        //  噪声层 (用于气声效果)
        this.noiseSource = null;
        this.noiseFilter = null;
        this.noiseGain = null;

        // 表现力参数
        this.expressiveness = {
            vibrato: 0,
            brightness: 0.5,
            volume: 0
        };

        //  起音状态追踪
        this.lastArticulationState = 'silence';  // 'silence' | 'attack' | 'sustain' | 'release'

        //  上一次的特征值 (用于减少日志刷屏)
        this.lastLoggedBrightness = -1;
        this.lastLoggedBreathiness = -1;

        // 音符触发阈值（降低到 0.01 以适应用户的麦克风）
        this.minConfidence = 0.01;
    }

    /**
     * 初始化Tone.js和合成器
     */
    async initialize() {
        try {
            // 重要: 检查AudioContext状态并在用户手势后恢复
            // Chrome的自动播放策略要求AudioContext必须在用户手势后启动
            if (Tone.context.state !== 'running') {
                await Tone.start();
                console.log('Tone.js AudioContext resumed after user gesture');
            }

            // 配置Tone.js为低延迟模式
            Tone.context.lookAhead = 0.01; // 10ms预见时间

            console.log('Tone.js initialized:', {
                context: Tone.context.state,
                lookAhead: Tone.context.lookAhead,
                latencyHint: Tone.context.latencyHint
            });

            // 创建效果器链
            this.createEffects();

            // 创建默认合成器
            this.createSynthesizer(this.currentInstrument);

            return true;
        } catch (error) {
            console.error('Failed to initialize synthesizer:', error);
            throw new Error('无法初始化合成器');
        }
    }

    /**
     * 创建效果器链
     */
    createEffects() {
        // 混响
        this.reverb = new Tone.Reverb({
            decay: 2,
            wet: 0.2
        }).toDestination();

        // 颤音
        this.vibrato = new Tone.Vibrato({
            frequency: 5,
            depth: 0.1
        });

        // 滤波器（控制音色亮度）
        this.filter = new Tone.Filter({
            frequency: 2000,
            type: 'lowpass',
            rolloff: -24
        });

        //  噪声层 (气声效果)
        //  延迟 start() 避免 AudioContext 警告
        this.noiseSource = new Tone.Noise('white');
        this.noiseGain = new Tone.Gain(0);  // 初始静音
        this.noiseFilter = new Tone.Filter({
            type: 'bandpass',
            frequency: 1000,
            Q: 2
        });

        // 噪声链路: noiseSource → noiseFilter → noiseGain → filter → reverb
        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.filter);

        //  启动噪声源 (在用户手势后)
        if (this.noiseSource.state !== 'started') {
            this.noiseSource.start();
        }

        console.log('[Synthesizer] Effects chain created ( with noise layer)');
    }

    /**
     * 创建指定乐器的合成器
     */
    createSynthesizer(instrument) {
        // 断开旧合成器
        if (this.currentSynth) {
            this.stopNote();
            this.currentSynth.disconnect();
            this.currentSynth.dispose();
        }

        // 创建新合成器
        switch (instrument) {
            case 'saxophone':
                this.currentSynth = new Tone.FMSynth({
                    harmonicity: 3,
                    modulationIndex: 12,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.01,
                        decay: 0.2,
                        sustain: 0.8,
                        release: 0.3
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.5,
                        decay: 0.2,
                        sustain: 1,
                        release: 0.5
                    }
                });
                break;

            case 'violin':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: {
                        attack: 0.1,
                        decay: 0.2,
                        sustain: 0.9,
                        release: 0.4
                    }
                });
                this.vibrato.frequency.value = 6;
                this.vibrato.depth.value = 0.3;
                break;

            case 'piano':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'triangle' },
                    envelope: {
                        attack: 0.005,
                        decay: 0.3,
                        sustain: 0.1,
                        release: 1
                    }
                });
                break;

            case 'flute':
                this.currentSynth = new Tone.AMSynth({
                    harmonicity: 2,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.02,
                        decay: 0.1,
                        sustain: 0.8,
                        release: 0.2
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.5,
                        decay: 0.2,
                        sustain: 1,
                        release: 0.5
                    }
                });
                break;

            case 'guitar':
                this.currentSynth = new Tone.PluckSynth({
                    attackNoise: 1,
                    dampening: 4000,
                    resonance: 0.9
                });
                break;

            case 'synth':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: {
                        attack: 0.005,
                        decay: 0.1,
                        sustain: 0.7,
                        release: 0.2
                    }
                });
                break;

            default:
                this.currentSynth = new Tone.Synth();
        }

        // 连接效果器链
        this.currentSynth.connect(this.vibrato);
        this.vibrato.connect(this.filter);
        this.filter.connect(this.reverb);

        this.currentInstrument = instrument;
        console.log(`Synthesizer created: ${instrument}`);
    }

    /**
     * 处理音高信息并触发音符 - 优化快速响应
     */
    /**
     *  处理完整的 PitchFrame (包含表现力特征)
     *
     * @param {PitchFrame} pitchFrame - 完整的音高和表现力数据
     */
    processPitchFrame(pitchFrame) {
        if (!pitchFrame || !this.currentSynth) return;

        const {
            frequency,
            note,
            octave,
            confidence,
            cents,           //  音分偏移
            brightness,      //  音色亮度
            breathiness,     //  气声度
            articulation,    //  起音状态
            volumeLinear,    //  线性音量
            volumeDb         //  dB 音量
        } = pitchFrame;

        // 临时调试日志 (首次调用时打印一次)
        if (!this._debugLogged) {
            console.log('[Synthesizer]  processPitchFrame() 首次调用:', {
                frequency: frequency?.toFixed(1),
                note: `${note}${octave}`,
                confidence: confidence?.toFixed(2),
                articulation,
                volumeLinear: volumeLinear?.toFixed(2),
                volumeDb: volumeDb?.toFixed(1)
            });
            this._debugLogged = true;
        }

        // 检查置信度阈值
        const isValidPitch = confidence >= this.minConfidence &&
                            frequency && frequency >= 20 && frequency <= 2000;

        if (!isValidPitch) {
            // 无效音高，触发 release
            this.handleArticulation('silence', null, 0);
            return;
        }

        const fullNote = `${note}${octave}`;

        //  智能起音处理
        this.handleArticulation(articulation, fullNote, volumeLinear);

        //  音分精细控制 (仅在播放时)
        if (this.isPlaying) {
            this.updateDetune(cents);
        }

        //  音色亮度控制
        this.updateBrightness(brightness);

        //  气声度控制
        this.updateBreathiness(breathiness, frequency);
    }

    processPitch(pitchInfo) {
        if (!pitchInfo || !this.currentSynth) return;

        const { frequency, note, octave, confidence, volume } = pitchInfo;

        // 检查置信度阈值
        if (confidence < this.minConfidence) {
            if (this.isPlaying) {
                this.stopNote();
            }
            return;
        }

        const fullNote = `${note}${octave}`;

        // 更新表现力参数
        this.updateExpressiveness(pitchInfo);

        // 快速音符切换 - 不等待 stopNote 完成
        if (fullNote !== this.currentNote) {
            // 立即停止旧音符并触发新音符
            if (this.isPlaying) {
                try {
                    this.currentSynth.triggerRelease(Tone.now());
                } catch (e) {}
            }
            this.playNote(fullNote, frequency, volume);
        } else {
            // 相同音符，保持播放
            this.updatePitch(frequency);
        }
    }

    /**
     * 播放音符 - 优化版本，减少延迟
     */
    playNote(note, frequency, volume = 0.5) {
        try {
            const now = Tone.now();
            const velocity = Math.min(Math.max(volume * 2, 0.1), 1);

            // 对于弹拨类乐器使用triggerAttackRelease
            if (this.currentInstrument === 'guitar' || this.currentInstrument === 'piano') {
                this.currentSynth.triggerAttackRelease(note, '0.5', now, velocity);
            } else {
                // 对于持续类乐器使用triggerAttack
                this.currentSynth.triggerAttack(note, now, velocity);
            }

            this.isPlaying = true;
            this.currentNote = note;
            this.currentFrequency = frequency;

        } catch (error) {
            console.error('[Synthesizer]  Error playing note:', error);
        }
    }

    /**
     * 停止当前音符
     */
    stopNote() {
        if (this.isPlaying && this.currentSynth) {
            try {
                this.currentSynth.triggerRelease(Tone.now());
                this.isPlaying = false;
                this.currentNote = null;
            } catch (error) {
                console.error('Error stopping note:', error);
            }
        }
    }

    /**
     * 更新音高（用于滑音效果）
     */
    updatePitch(frequency) {
        // Tone.js的音高弯曲需要更复杂的实现
        // 这里简化处理，仅在频率偏差较大时重新触发
        if (this.currentFrequency > 0) {
            const deviation = Math.abs(frequency - this.currentFrequency) / this.currentFrequency;
            if (deviation > 0.02) { // 2%偏差
                this.currentFrequency = frequency;
                // 可以在这里实现portamento效果
            }
        }
    }

    /**
     *  智能起音处理 (基于 articulation 状态)
     *
     * @param {string} articulation - 'silence' | 'attack' | 'sustain' | 'release'
     * @param {string} note - 音符名称 (如 'C4')
     * @param {number} volumeLinear - 线性音量 (0-1)
     */
    handleArticulation(articulation, note, volumeLinear) {
        const prevState = this.lastArticulationState;

        // 临时调试: 打印前5次状态变化
        if (!this._articulationCallCount) this._articulationCallCount = 0;
        if (this._articulationCallCount < 5) {
            console.log(`[Synthesizer]  handleArticulation #${this._articulationCallCount}: ${prevState} → ${articulation} (note: ${note}, vol: ${volumeLinear?.toFixed(2)})`);
            this._articulationCallCount++;
        }

        // 修复: 如果一直是 silence 但有足够音量，强制变为 sustain
        if (articulation === 'silence' && volumeLinear && volumeLinear > 0.1) {
            if (!this._silenceFrameCount) this._silenceFrameCount = 0;
            this._silenceFrameCount++;

            // 连续 3 帧都是 silence 且音量足够
            if (this._silenceFrameCount >= 3) {
                if (!this.isPlaying) {
                    // 未播放：触发 attack
                    console.log(`[Synthesizer]  强制触发 attack (OnsetDetector 未检测到，音量: ${volumeLinear.toFixed(2)})`);
                    articulation = 'attack';
                    this._silenceFrameCount = 0;
                } else {
                    // 已播放：保持 sustain
                    articulation = 'sustain';
                }
            }
        } else if (articulation === 'silence' && volumeLinear && volumeLinear <= 0.1) {
            // 音量很低，确实是 silence
            this._silenceFrameCount = 0;
        } else {
            this._silenceFrameCount = 0;
        }

        // 状态转换: silence/release → attack
        if (articulation === 'attack' && (prevState === 'silence' || prevState === 'release')) {
            const velocity = Math.min(Math.max(volumeLinear * 2, 0.1), 1);

            // 停止旧音符
            if (this.isPlaying) {
                try {
                    this.currentSynth.triggerRelease(Tone.now());
                } catch (e) {}
            }

            // 触发新音符
            this.playNote(note, null, velocity);
            console.log(`[Synthesizer] 🎺 Attack: ${note} (velocity: ${velocity.toFixed(2)})`);
        }
        // 状态转换: attack/sustain → release/silence
        else if ((articulation === 'release' || articulation === 'silence') &&
                 (prevState === 'attack' || prevState === 'sustain')) {
            this.stopNote();
            console.log(`[Synthesizer] 🔇 Release`);
        }
        // sustain 状态: 持续播放，可能切换音符
        else if (articulation === 'sustain' && this.isPlaying) {
            if (note && note !== this.currentNote) {
                // 连音切换音符
                const velocity = Math.min(Math.max(volumeLinear * 2, 0.1), 1);
                this.playNote(note, null, velocity);
                console.log(`[Synthesizer]  Note change (legato): ${note}`);
            }
        }

        this.lastArticulationState = articulation;
    }

    /**
     *  音分精细控制 (detune)
     *
     * @param {number} cents - 音分偏移 (-100 ~ +100)
     */
    updateDetune(cents) {
        if (cents === undefined || cents === null) return;
        if (!this.currentSynth || !this.currentSynth.detune) return;

        // Tone.js 的 detune 单位就是 cents
        this.currentSynth.detune.rampTo(cents, 0.02);

        // 仅在显著偏移时打印日志
        if (Math.abs(cents) > 15) {
            console.log(`[Synthesizer]  Detune: ${cents.toFixed(1)} cents`);
        }
    }

    /**
     *  音色亮度控制 (Filter Cutoff)
     *
     * @param {number} brightness - 亮度 (0-1)
     */
    updateBrightness(brightness) {
        if (brightness === undefined || brightness === null) return;

        // 非线性映射: brightness^1.5 * 7800 + 200
        const mappedBrightness = Math.pow(brightness, 1.5);
        const filterFreq = 200 + mappedBrightness * 7800;
        this.filter.frequency.rampTo(filterFreq, 0.02);

        // 仅在显著变化时打印日志 (变化 > 0.1 或极端值)
        const brightnessChanged = Math.abs(brightness - this.lastLoggedBrightness) > 0.1;
        const isExtreme = brightness < 0.2 || brightness > 0.8;

        if (brightnessChanged || (isExtreme && Math.abs(brightness - this.lastLoggedBrightness) > 0.02)) {
            console.log(`[Synthesizer] 🌟 Brightness: ${brightness.toFixed(2)} → Filter: ${filterFreq.toFixed(0)} Hz`);
            this.lastLoggedBrightness = brightness;
        }

        this.expressiveness.brightness = brightness;
    }

    /**
     *  气声度控制 (Noise Layer)
     *
     * @param {number} breathiness - 气声度 (0-1)
     * @param {number} frequency - 当前频率 (用于调整噪声滤波器)
     */
    updateBreathiness(breathiness, frequency) {
        if (breathiness === undefined || breathiness === null) return;
        if (!this.noiseGain) return;

        // 气声度映射: 0-1 → 0%-30% 噪声增益
        const noiseLevel = breathiness * 0.3;
        this.noiseGain.gain.rampTo(noiseLevel, 0.05);

        // 根据音高调整噪声滤波器中心频率
        if (frequency && this.noiseFilter) {
            const noiseFreq = frequency * 2;  // 倍频噪声
            this.noiseFilter.frequency.rampTo(noiseFreq, 0.05);
        }

        // 仅在显著变化时打印日志
        const breathinessChanged = Math.abs(breathiness - this.lastLoggedBreathiness) > 0.15;
        if (breathiness > 0.3 && breathinessChanged) {
            console.log(`[Synthesizer] 💨 Breathiness: ${breathiness.toFixed(2)} (noise: ${(noiseLevel * 100).toFixed(0)}%)`);
            this.lastLoggedBreathiness = breathiness;
        }
    }

    /**
     * 更新表现力参数 (兼容接口)
     */
    updateExpressiveness(pitchInfo) {
        const { cents, volume } = pitchInfo;

        // 从音分偏差计算颤音
        if (Math.abs(cents) > 10) {
            this.expressiveness.vibrato = Math.min(Math.abs(cents) / 50, 1);
            this.vibrato.depth.value = this.expressiveness.vibrato * 0.3;
        }

        // 从音量计算亮度
        this.expressiveness.brightness = Math.min(volume * 2, 1);
        const filterFreq = 500 + this.expressiveness.brightness * 3500;
        this.filter.frequency.rampTo(filterFreq, 0.05);

        this.expressiveness.volume = volume;
    }

    /**
     * 切换乐器
     */
    changeInstrument(instrument) {
        console.log(`Changing instrument to: ${instrument}`);
        this.createSynthesizer(instrument);
    }

    /**
     * 设置置信度阈值
     */
    setConfidenceThreshold(threshold) {
        this.minConfidence = threshold;
    }

    /**
     * 设置混响湿度
     */
    setReverbWet(wetness) {
        if (this.reverb) {
            this.reverb.wet.value = wetness;
        }
    }

    /**
     * 全局静音
     */
    mute() {
        this.stopNote();
        Tone.Destination.mute = true;
    }

    /**
     * 取消静音
     */
    unmute() {
        Tone.Destination.mute = false;
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            currentNote: this.currentNote,
            currentInstrument: this.currentInstrument,
            expressiveness: this.expressiveness
        };
    }

    /**
     * 清理资源
     */
    dispose() {
        this.stopNote();

        if (this.currentSynth) {
            this.currentSynth.dispose();
        }

        if (this.reverb) {
            this.reverb.dispose();
        }

        if (this.vibrato) {
            this.vibrato.dispose();
        }

        if (this.filter) {
            this.filter.dispose();
        }

        //  清理噪声层
        if (this.noiseSource) {
            this.noiseSource.dispose();
        }

        if (this.noiseGain) {
            this.noiseGain.dispose();
        }

        if (this.noiseFilter) {
            this.noiseFilter.dispose();
        }
    }
}

// Step 2 Layer 2: 移除全局实例创建
// 实例现在由 AppContainer 统一管理
// 旧代码: const synthesizerEngine = new SynthesizerEngine();
//
// 为向后兼容，在 main.js 中通过 window.synthesizerEngine 暴露容器实例
export { SynthesizerEngine };
