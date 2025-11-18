/**
 * Continuous Frequency Synthesizer Engine
 *
 * 连续频率合成器引擎 - 实时跟踪人声音高变化
 *
 * 核心改进：
 * - 不再量化到离散音符，直接使用检测到的频率（Hz）
 * - 平滑的频率过渡（Portamento/滑音效果）
 * - 保留每个乐器的独特音色和包络特征
 * - 捕捉微妙的音乐表现力（颤音、滑音、音量变化）
 *
 * 架构对比：
 * 旧: PitchDetector → Note("C4") → triggerAttack("C4") → 固定频率
 * 新: PitchDetector → Frequency(Hz) → 平滑 → oscillator.frequency → 实时跟随
 *
 * P0 修复:
 * - 乐器预设从代码分离到 instrument-presets.js
 * - 支持运行时加载自定义音色
 * - 噪声层参数从集中式配置读取
 *
 * @class ContinuousSynthEngine
 * @author Kazoo Proto Team
 * @version 2.0.1-alpha
 */

class ContinuousSynthEngine {
    /**
     * @param {Object} options - 配置选项
     * @param {Object} options.appConfig: 集中式配置对象
     * @param {Object} options.instrumentPresets: 乐器预设对象 (可选)
     */
    constructor(options = {}) {
        //  存储集中式配置
        this.appConfig = options.appConfig || null;

        //  乐器预设配置 (从外部加载,向后兼容)
        this.instrumentPresets = options.instrumentPresets || {
            saxophone: {
                oscillator: { type: 'sawtooth' },
                envelope: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0.8,
                    release: 0.3
                },
                filterEnvelope: {
                    baseFrequency: 2000,
                    octaves: 2,
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.5,
                    release: 0.3
                },
                portamento: 0.03  // 30ms 滑音时间（中等表现力）
            },
            violin: {
                oscillator: { type: 'sawtooth' },
                envelope: {
                    attack: 0.1,
                    decay: 0.1,
                    sustain: 0.9,
                    release: 0.4
                },
                filterEnvelope: {
                    baseFrequency: 1500,
                    octaves: 3,
                    attack: 0.08,
                    decay: 0.2,
                    sustain: 0.7,
                    release: 0.4
                },
                portamento: 0.05  // 50ms 更明显的滑音（弦乐特征）
            },
            piano: {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.005,
                    decay: 0.3,
                    sustain: 0.1,
                    release: 1.0
                },
                filterEnvelope: {
                    baseFrequency: 3000,
                    octaves: 1,
                    attack: 0.005,
                    decay: 0.2,
                    sustain: 0.2,
                    release: 0.8
                },
                portamento: 0.01  // 10ms 快速（钢琴音色更清晰）
            },
            flute: {
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.8,
                    release: 0.2
                },
                filterEnvelope: {
                    baseFrequency: 2500,
                    octaves: 2.5,
                    attack: 0.03,
                    decay: 0.15,
                    sustain: 0.6,
                    release: 0.2
                },
                portamento: 0.025  // 25ms 轻快的滑音
            },
            guitar: {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.005,
                    decay: 0.4,
                    sustain: 0.1,
                    release: 0.6
                },
                filterEnvelope: {
                    baseFrequency: 2200,
                    octaves: 1.5,
                    attack: 0.005,
                    decay: 0.3,
                    sustain: 0.2,
                    release: 0.5
                },
                portamento: 0.015  // 15ms 适度滑音
            },
            synth: {
                oscillator: { type: 'square' },
                envelope: {
                    attack: 0.005,
                    decay: 0.1,
                    sustain: 0.7,
                    release: 0.2
                },
                filterEnvelope: {
                    baseFrequency: 3500,
                    octaves: 2,
                    attack: 0.01,
                    decay: 0.05,
                    sustain: 0.8,
                    release: 0.15
                },
                portamento: 0.02  // 20ms 电子感觉
            }
        };

        // 当前状态
        this.currentInstrument = 'saxophone';
        this.currentSynth = null;
        this.isPlaying = false;
        this.currentFrequency = 0;

        // 频率平滑参数
        this.frequencyUpdateThreshold = 0.005;  // 0.5% 差异才更新（避免抖动）
        this.lastUpdateTime = 0;
        this.minUpdateInterval = 10;  // 最小更新间隔 10ms（避免过度触发）

        // 置信度阈值 (从集中式配置读取)
        this.minConfidence = options.appConfig?.pitchDetector?.minConfidence ?? 0.05;  // 🔥 修复: 从配置读取

        // 无声检测机制（防止停止哼唱后声音不停）
        this.silenceTimeout = 300;  // 300ms无有效音高则停止
        this.lastValidPitchTime = 0;
        this.silenceCheckInterval = null;

        //  Articulation 状态追踪
        this.lastArticulationState = 'silence';

        // 效果器链
        this.vibrato = new Tone.Vibrato({
            frequency: 5,
            depth: 0.1
        });

        this.filter = new Tone.Filter({
            type: 'lowpass',
            frequency: 2000,
            Q: 1
        });

        this.reverb = new Tone.Reverb({
            decay: 1.5,
            wet: 0.2
        }).toDestination();

        //  噪声层 (用于 breathiness 特征)
        //  延迟 start() 到 initialize()，避免 AudioContext 警告
        this.noiseSource = new Tone.Noise('white');
        this.noiseGain = new Tone.Gain(0); // 初始静音
        this.noiseFilter = new Tone.Filter({
            type: 'bandpass',
            frequency: 1000,
            Q: 2
        });

        // 连接效果器链
        this.vibrato.connect(this.filter);
        this.filter.connect(this.reverb);

        // 连接噪声层到主效果链
        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.filter);

        // 性能监控
        this.performanceMetrics = {
            frequencyUpdates: 0,
            lastFrequency: 0,
            updateLatency: []
        };

        console.log('[ContinuousSynth] ✓ Initialized with continuous frequency tracking');
        console.log('[ContinuousSynth] ✓ Expressive Features: cents, brightness, breathiness, articulation');
    }

    /**
     * 初始化合成器
     */
    async initialize() {
        //  确保在用户手势后启动 AudioContext
        await Tone.start();

        // 🔥 [CRITICAL FIX] 移除 Tone.js 的调度延迟
        // 默认 lookAhead 是 0.1 (100ms)，这对于实时乐器是致命的
        // 参考: https://tonejs.github.io/docs/14.7.77/Context#lookAhead
        Tone.context.lookAhead = 0;
        console.log('[ContinuousSynth] ⚡ Tone.js lookAhead set to 0ms (real-time mode)');

        // 注意: latencyHint 是只读属性，在 AudioContext 创建时由 AudioIO 设置为 'interactive'
        // 不需要在这里重复设置
        console.log('[ContinuousSynth] ℹ️ latencyHint is read-only (already set by AudioIO)');

        //  启动噪声源 (之前在构造函数中启动会触发警告)
        if (this.noiseSource && this.noiseSource.state !== 'started') {
            this.noiseSource.start();
        }

        this.createSynthesizer(this.currentInstrument);
        console.log('[ContinuousSynth] ✓ Ready');
    }

    /**
     * 创建特定乐器的合成器
     */
    createSynthesizer(instrument) {
        // 停止旧合成器
        if (this.currentSynth) {
            this.stop();
            this.currentSynth.dispose();
        }

        const preset = this.instrumentPresets[instrument] || this.instrumentPresets.saxophone;

        // 使用 MonoSynth 支持连续频率控制
        this.currentSynth = new Tone.MonoSynth({
            oscillator: preset.oscillator,
            envelope: preset.envelope,
            filterEnvelope: preset.filterEnvelope,
            portamento: preset.portamento  // 关键：内置滑音
        });

        // 连接到效果器链
        this.currentSynth.connect(this.vibrato);

        this.currentInstrument = instrument;
        console.log(`[ContinuousSynth] Created: ${instrument} (portamento: ${preset.portamento}s)`);
    }

    /**
     * 处理音高信息 - 核心方法（替代旧的processPitch）
     * @param {Object} pitchInfo - { frequency, note, octave, confidence, volume }
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
            confidence,
            cents,           //  音分偏移
            brightness,      //  音色亮度
            breathiness,     //  气声度
            articulation,    //  起音状态
            volumeLinear     //  音量
        } = pitchFrame;

        const now = Date.now();

        // 置信度和频率有效性检查
        const isValidPitch = confidence >= this.minConfidence &&
                            frequency && frequency >= 20 && frequency <= 2000;

        if (isValidPitch) {
            // 记录有效音高时间
            this.lastValidPitchTime = now;

            // Task 4: Articulation → ADSR Trigger
            // 检测状态转换，触发 attack/release
            this.handleArticulation(articulation, frequency, volumeLinear);

            // 如果正在播放，更新表现力参数
            if (this.isPlaying) {
                // Task 1: Cents → Pitch Bend
                this.updateFrequencyWithCents(frequency, cents, now);

                // Task 2: Brightness → Filter Cutoff
                this.updateBrightness(brightness);

                // Task 3: Breathiness → Noise Layer
                this.updateBreathiness(breathiness, frequency);
            }
        } else {
            // 无效音高：不立即停止，等待silenceDetection超时
        }
    }

    processPitch(pitchInfo) {
        if (!pitchInfo || !this.currentSynth) return;

        const { frequency, confidence, volume } = pitchInfo;
        const now = Date.now();

        // 置信度和频率有效性检查
        const isValidPitch = confidence >= this.minConfidence &&
                            frequency && frequency >= 20 && frequency <= 2000;

        if (isValidPitch) {
            // 记录有效音高时间
            this.lastValidPitchTime = now;

            // 如果未播放，启动合成器
            if (!this.isPlaying) {
                this.start(frequency, volume);
                this.startSilenceDetection();
                return;
            }

            // 频率平滑更新逻辑
            this.updateFrequency(frequency, now);

            // 更新表现力参数
            this.updateExpressiveness(pitchInfo);
        } else {
            // 无效音高：不立即停止，等待silenceDetection超时
            // 这样可以容忍短暂的检测失败
        }
    }

    /**
     * 启动合成器（开始发声）
     */
    start(initialFrequency, volume = 0.5) {
        try {
            const now = Tone.now();
            const velocity = Math.min(Math.max(volume * 2, 0.1), 1);

            // 触发包络启动（但不指定音符名称）
            // 使用频率直接设置
            this.currentSynth.triggerAttack(initialFrequency, now, velocity);

            this.isPlaying = true;
            this.currentFrequency = initialFrequency;
            this.lastUpdateTime = Date.now();

            console.log(`[ContinuousSynth] ▶ Started at ${initialFrequency.toFixed(1)} Hz (velocity: ${velocity.toFixed(2)})`);
        } catch (error) {
            console.error('[ContinuousSynth]  Start error:', error);
        }
    }

    /**
     * Task 1: 使用 cents 进行精细 pitch bend
     *
     * @param {number} frequency - 基础频率 (Hz)
     * @param {number} cents - 音分偏移 (-50 ~ +50)
     * @param {number} timestamp - 时间戳
     */
    updateFrequencyWithCents(frequency, cents, timestamp) {
        // 避免过度频繁更新
        if (timestamp - this.lastUpdateTime < this.minUpdateInterval) {
            return;
        }

        // 使用 cents 进行微调
        // cents 为 0 时，pitchBendRatio = 1 (无偏移)
        // cents 为 100 时，pitchBendRatio = 2^(100/1200) ≈ 1.0595 (升高半音)
        const pitchBendRatio = Math.pow(2, cents / 1200);
        const adjustedFrequency = frequency * pitchBendRatio;

        // 计算频率偏差
        const deviation = Math.abs(adjustedFrequency - this.currentFrequency) / this.currentFrequency;

        // 只有明显变化才更新（避免抖动）
        if (deviation > this.frequencyUpdateThreshold) {
            const startTime = performance.now();

            // 🔥 [LATENCY FIX] 使用极短的 rampTo 代替直接赋值
            // 0.01s (10ms) 的平滑既能避免爆音，又能保持低延迟
            // 之前的直接赋值 (frequency.value =) 可能导致点击声
            this.currentSynth.frequency.rampTo(adjustedFrequency, 0.01);

            // 性能监控
            const latency = performance.now() - startTime;
            this.performanceMetrics.frequencyUpdates++;
            this.performanceMetrics.updateLatency.push(latency);
            if (this.performanceMetrics.updateLatency.length > 100) {
                this.performanceMetrics.updateLatency.shift();
            }

            this.currentFrequency = adjustedFrequency;
            this.lastUpdateTime = timestamp;

            // Debug 日志（仅在 cents 明显时）
            if (Math.abs(cents) > 15) {
                console.log(`[ContinuousSynth]  Pitch bend: ${cents.toFixed(1)} cents → ${adjustedFrequency.toFixed(1)} Hz`);
            }
        }
    }

    /**
     * 更新频率（实时跟踪）- 保留向后兼容
     */
    updateFrequency(newFrequency, timestamp) {
        // 回退到不带 cents 的版本
        this.updateFrequencyWithCents(newFrequency, 0, timestamp);
    }

    /**
     * Task 2: 使用 brightness 控制 filter cutoff
     *
     * 🔥 紧急修复 (2025-01-01): 重新设计映射算法
     *
     * 问题: 原算法导致低 brightness (0.07-0.3) → 低 filter cutoff (356-1467 Hz)
     * 后果: 滤掉所有高频泛音 (2000-8000 Hz),导致声音完全被闷掉
     *
     * 行业最佳实践:
     * - 人声泛音主要在 2000-4000 Hz
     * - 歌手共振峰 (singer formant) 在 2800-3200 Hz
     * - Filter cutoff < 2000 Hz 会让声音完全失去清晰度
     *
     * 新算法:
     * - 基线提升: 2000 Hz (确保基本清晰度)
     * - 动态范围: 2000-8000 Hz (6000 Hz 范围)
     * - 指数映射: brightness^0.7 (让中低亮度区间变化更明显)
     *
     * @param {number} brightness - 音色亮度 (0-1, 来自频谱质心)
     */
    updateBrightness(brightness) {
        if (brightness === undefined || brightness === null) return;

        // 🔥 紧急修复 2: 进一步提高基线到 3500 Hz
        // 原因: iPhone 麦克风 brightness 经常为 0,导致 2000 Hz 仍然太闷
        //
        // brightness = 0.0 → 3500 Hz (确保清晰度)
        // brightness = 0.5 → 5793 Hz (明亮)
        // brightness = 1.0 → 8000 Hz (非常亮)
        const mappedBrightness = Math.pow(brightness, 0.5);  // 指数 0.5 (平方根) 让响应更快
        const filterFreq = 3500 + mappedBrightness * 4500;

        // 🔥 [LATENCY FIX] 缩短平滑时间 (20ms → 10ms)
        this.filter.frequency.rampTo(filterFreq, 0.01);

        // Debug 日志（仅在亮度明显变化时）
        if (brightness < 0.3 || brightness > 0.7) {
            console.log(`[ContinuousSynth] 🌟 Brightness: ${brightness.toFixed(2)} → Filter: ${filterFreq.toFixed(0)} Hz`);
        }
    }

    /**
     * Task 3: 使用 breathiness 控制噪声层强度
     *
     * P0 修复: noiseGainMax 从集中式配置读取
     *
     * @param {number} breathiness - 气声度 (0-1, 来自频谱平坦度)
     * @param {number} frequency - 当前频率 (用于调整噪声滤波器中心频率)
     */
    updateBreathiness(breathiness, frequency) {
        if (breathiness === undefined || breathiness === null) return;

        //  从集中式配置读取最大噪声增益
        const noiseGainMax = this.appConfig?.synthesizer?.noiseGainMax ?? 0.3;

        // 限制噪声最大强度 (避免过度嘈杂)
        const noiseAmount = Math.min(breathiness * noiseGainMax, noiseGainMax);

        // 🔥 [LATENCY FIX] 缩短平滑时间 (50ms → 20ms)
        // 噪声变化不需要太长的过渡时间
        this.noiseGain.gain.rampTo(noiseAmount, 0.02);

        // 让噪声滤波器跟随音高 (让气声更自然)
        if (frequency && frequency > 0) {
            const noiseFilterFreq = frequency * 2; // 噪声中心频率为音高的 2 倍
            this.noiseFilter.frequency.rampTo(noiseFilterFreq, 0.02);
        }

        // Debug 日志（仅在气声明显时）
        if (breathiness > 0.4) {
            console.log(`[ContinuousSynth] 💨 Breathiness: ${breathiness.toFixed(2)} → Noise: ${(noiseAmount * 100).toFixed(0)}%`);
        }
    }

    /**
     * Task 4: 处理 articulation 状态转换，触发 ADSR
     *
     * @param {string} articulation - 当前起音状态 ('attack'|'sustain'|'release'|'silence')
     * @param {number} frequency - 当前频率
     * @param {number} volume - 当前音量 (0-1)
     */
    handleArticulation(articulation, frequency, volume) {
        const previousState = this.lastArticulationState;

        // 状态转换 1: silence/release → attack/sustain (新音符开始)
        const shouldStart =
            articulation === 'attack' ||
            (articulation === 'sustain' && (previousState === 'silence' || previousState === 'release'));

        if (shouldStart) {
            const startLabel = articulation === 'attack'
                ? 'Attack detected - triggering new note'
                : 'Sustain bootstrap - starting note';
            console.log(`[ContinuousSynth]  ${startLabel}`);

            if (!this.isPlaying) {
                // 启动合成器
                this.start(frequency, volume || 0.5);
                this.startSilenceDetection();
            } else {
                // 重新触发 attack (retriggering)
                this.currentSynth.triggerAttack(frequency, Tone.now(), volume || 0.5);
            }
        }

        // 状态转换 2: sustain → release (音符释放)
        if (articulation === 'release' && previousState === 'sustain') {
            console.log('[ContinuousSynth] 🔇 Release detected');
            // 注意: 不立即停止，只是标记状态，让包络自然衰减
        }

        // 状态转换 3: release → silence (完全静音)
        if (articulation === 'silence' && previousState === 'release') {
            console.log('[ContinuousSynth] 🔇 Silence detected - triggering release');
            if (this.isPlaying) {
                this.currentSynth.triggerRelease(Tone.now());
            }
        }

        this.lastArticulationState = articulation;
    }

    /**
     * 更新表现力参数（音量、颤音、亮度）- 保留向后兼容
     */
    updateExpressiveness(pitchInfo) {
        const { cents, volume, brightness, breathiness } = pitchInfo;

        // 从音分偏差计算颤音深度
        if (cents && Math.abs(cents) > 10) {
            const vibratoDepth = Math.min(Math.abs(cents) / 50, 1) * 0.3;
            // 🔥 [LATENCY FIX] 缩短平滑时间 (50ms → 10ms)
            this.vibrato.depth.rampTo(vibratoDepth, 0.01);
        }

        //  使用新的 brightness 控制（如果可用）
        if (brightness !== undefined) {
            this.updateBrightness(brightness);
        } else if (volume) {
            // 回退: 从音量计算滤波器亮度
            const estimatedBrightness = Math.min(volume * 2, 1);
            const filterFreq = 500 + estimatedBrightness * 3500;
            // 🔥 [LATENCY FIX] 缩短平滑时间 (50ms → 10ms)
            this.filter.frequency.rampTo(filterFreq, 0.01);
        }

        //  使用新的 breathiness 控制（如果可用）
        if (breathiness !== undefined) {
            this.updateBreathiness(breathiness, pitchInfo.frequency);
        }
    }

    /**
     * 启动无声检测（防止停止哼唱后声音不停）
     */
    startSilenceDetection() {
        // 清除旧的定时器
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
        }

        // 每50ms检查一次是否超时
        this.silenceCheckInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastPitch = now - this.lastValidPitchTime;

            if (timeSinceLastPitch > this.silenceTimeout && this.isPlaying) {
                console.log(`[ContinuousSynth] 🔇 Silence detected (${timeSinceLastPitch}ms), stopping...`);
                this.stop();
            }
        }, 50);
    }

    /**
     * 停止合成器
     */
    stop() {
        if (this.isPlaying && this.currentSynth) {
            try {
                this.currentSynth.triggerRelease(Tone.now());
                this.isPlaying = false;
                this.currentFrequency = 0;

                // 🔥 重置状态机 - 修复停止后无法重启的问题
                this.lastArticulationState = 'silence';

                // 清除无声检测定时器
                if (this.silenceCheckInterval) {
                    clearInterval(this.silenceCheckInterval);
                    this.silenceCheckInterval = null;
                }

                console.log('[ContinuousSynth] ■ Stopped');
            } catch (error) {
                console.error('[ContinuousSynth]  Stop error:', error);
            }
        }
    }

    /**
     * 切换乐器
     */
    changeInstrument(instrument) {
        console.log(`[ContinuousSynth] Changing to: ${instrument}`);
        this.createSynthesizer(instrument);
    }

    /**
     * 获取性能指标
     */
    getPerformanceMetrics() {
        const avgLatency = this.performanceMetrics.updateLatency.length > 0
            ? this.performanceMetrics.updateLatency.reduce((a, b) => a + b, 0) / this.performanceMetrics.updateLatency.length
            : 0;

        return {
            totalUpdates: this.performanceMetrics.frequencyUpdates,
            averageUpdateLatency: avgLatency.toFixed(3),
            currentFrequency: this.currentFrequency.toFixed(2),
            isPlaying: this.isPlaying,
            instrument: this.currentInstrument
        };
    }

    /**
     * 设置置信度阈值
     */
    setConfidenceThreshold(threshold) {
        this.minConfidence = threshold;
    }

    /**
     * 设置频率更新阈值（调整响应性）
     */
    setFrequencyUpdateThreshold(threshold) {
        this.frequencyUpdateThreshold = threshold;
        console.log(`[ContinuousSynth] Frequency threshold: ${threshold * 100}%`);
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
     * 清理资源
     */
    dispose() {
        this.stop();

        // 清除定时器
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }

        // 清理音频资源
        if (this.currentSynth) this.currentSynth.dispose();
        this.vibrato.dispose();
        this.filter.dispose();
        this.reverb.dispose();

        //  清理噪声层
        if (this.noiseSource) this.noiseSource.dispose();
        if (this.noiseGain) this.noiseGain.dispose();
        if (this.noiseFilter) this.noiseFilter.dispose();

        console.log('[ContinuousSynth] Disposed');
    }
}

// Step 2 Layer 2: 移除全局实例创建，解决双实例问题
// 实例现在由 AppContainer 统一管理（注入配置和预设）
// 旧代码: const continuousSynthEngine = new ContinuousSynthEngine();
//
// 这是导致双实例问题的根源：
// - 模块顶层创建了一个无配置的实例
// - 容器又创建了另一个带依赖注入的实例
// - 业务代码使用的是旧的模块级实例，容器实例无人使用
//
// 为向后兼容，在 main.js 中通过 window.continuousSynthEngine 暴露容器实例
