import { getNearestScaleNote } from './core/music-scales.js';
import { KarplusStrong } from './core/karplus-strong.js';
import instrumentPresetManager from './config/instrument-presets.js';

/**
 * Continuous Frequency Synthesizer Engine
 *
 * Real-time voice pitch tracking synthesizer engine
 *
 * Key improvements:
 * - Direct frequency (Hz) usage instead of discrete note quantization
 * - Smooth frequency transitions (Portamento/glide effect)
 * - Preserves unique timbre and envelope characteristics per instrument
 * - Captures subtle musical expressions (vibrato, glide, volume changes)
 *
 * Architecture comparison:
 * Old: PitchDetector → Note("C4") → triggerAttack("C4") → Fixed frequency
 * New: PitchDetector → Frequency(Hz) → Smoothing → oscillator.frequency → Real-time tracking
 *
 * Recent fixes:
 * - Instrument presets extracted to instrument-presets.js
 * - Runtime custom timbre loading support
 * - Noise layer parameters read from centralized config
 *
 * @class ContinuousSynthEngine
 * @author Mambo Whistle Team
 * @version 2.0.1-alpha
 */

export class ContinuousSynthEngine {
    /**
     * @param {Object} options - Configuration options
     * @param {Object} options.appConfig - Centralized configuration object
     * @param {Object} options.instrumentPresets - Instrument presets object (optional)
     */
    constructor(options = {}) {
        // Store centralized configuration
        this.appConfig = options.appConfig || null;

        // Instrument presets configuration (loaded from external source, backward compatible)
        this.instrumentPresets = options.instrumentPresets || instrumentPresetManager.presets;

        // Current state
        this.currentInstrument = 'flute';
        this.currentSynth = null;
        this.isPlaying = false;
        this.currentFrequency = 0;

        // Frequency smoothing parameters
        this.frequencyUpdateThreshold = 0.005;  // 0.5% difference threshold to update (avoid jitter)
        this.lastUpdateTime = 0;
        this.minUpdateInterval = 10;  // Minimum update interval 10ms (avoid excessive triggering)

        // Confidence threshold (read from centralized config)
        this.minConfidence = options.appConfig?.pitchDetector?.minConfidence ?? 0.05;  // Fixed: Read from config

        // Silence detection mechanism (prevent sound from continuing after humming stops)
        this.silenceTimeout = 300;  // Stop after 300ms without valid pitch
        this.lastValidPitchTime = 0;
        this.silenceCheckInterval = null;

        // Articulation state tracking
        this.lastArticulationState = 'silence';

        // Effect Chain
        this.vibrato = new Tone.Vibrato({
            frequency: 5,
            depth: 0.1
        });

        this.filter = new Tone.Filter({
            type: 'lowpass',
            frequency: 2000,
            Q: 1
        });

        // Delay (Echo)
        this.delay = new Tone.FeedbackDelay({
            delayTime: 0.25,
            feedback: 0.4,
            wet: 0
        });

        this.reverb = new Tone.Reverb({
            decay: 1.5,
            wet: 0.2
        }).toDestination();

        // Noise Layer (for breathiness feature)
        // Delay start() until initialize() to avoid AudioContext warnings
        this.noiseSource = new Tone.Noise('white');
        this.noiseGain = new Tone.Gain(0); // Start muted
        this.noiseFilter = new Tone.Filter({
            type: 'bandpass',
            frequency: 1000,
            Q: 2
        });

        // Connect Effect Chain
        this.vibrato.connect(this.filter);
        this.filter.connect(this.delay);
        this.delay.connect(this.reverb);

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

        // Auto-Tune 参数
        this.autoTuneStrength = 0.0; // 0.0 (Natural) -> 1.0 (Hard Tune)
        this.retuneSpeed = 0.0;      // 0.0 (Fast/Robotic) -> 1.0 (Slow/Natural)
        this.scaleKey = 'C';
        this.scaleType = 'chromatic';

        console.log('[ContinuousSynth] ✓ Initialized with continuous frequency tracking');
        console.log('[ContinuousSynth] ✓ Expressive Features: cents, brightness, breathiness, articulation');
    }

    /**
     * 设置自动调音强度
     * @param {number} strength - 0.0 (无) ~ 1.0 (完全量化)
     */
    setAutoTuneStrength(strength) {
        this.autoTuneStrength = Math.max(0, Math.min(1, strength));
        console.log(`[ContinuousSynth] 🔧 Auto-Tune Strength: ${(this.autoTuneStrength * 100).toFixed(0)}%`);
    }

    /**
     * 设置调音速度 (Humanize)
     * @param {number} speed - 0.0 (Robotic) ~ 1.0 (Natural)
     */
    setRetuneSpeed(speed) {
        this.retuneSpeed = Math.max(0, Math.min(1, speed));
        console.log(`[ContinuousSynth] 🔧 Retune Speed: ${(this.retuneSpeed * 100).toFixed(0)}%`);
    }

    /**
     * 设置调式
     * @param {string} key - 根音 (e.g., 'C', 'F#')
     * @param {string} type - 调式类型 (e.g., 'major', 'minor')
     */
    setScale(key, type) {
        this.scaleKey = key;
        this.scaleType = type;
        console.log(`[ContinuousSynth] 🎼 Scale Set: ${key} ${type}`);
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

        const preset = this.instrumentPresets[instrument] || this.instrumentPresets.flute;
        const type = preset.type || 'MonoSynth';

        try {
            switch (type) {
                case 'KarplusStrong':
                    this.currentSynth = new KarplusStrong({
                        damping: preset.damping,
                        resonance: preset.resonance
                    });
                    break;

                case 'FMSynth':
                    this.currentSynth = new Tone.FMSynth({
                        harmonicity: preset.harmonicity || 3,
                        modulationIndex: preset.modulationIndex || 10,
                        oscillator: preset.oscillator,
                        modulation: preset.modulation,
                        envelope: preset.envelope,
                        modulationEnvelope: preset.filterEnvelope, // Map filterEnvelope to modulationEnvelope for FM
                        portamento: preset.portamento
                    });
                    break;

                case 'AMSynth':
                    this.currentSynth = new Tone.AMSynth({
                        harmonicity: preset.harmonicity || 3,
                        oscillator: preset.oscillator,
                        modulation: preset.modulation,
                        envelope: preset.envelope,
                        modulationEnvelope: preset.filterEnvelope, // Map filterEnvelope to modulationEnvelope
                        portamento: preset.portamento
                    });
                    break;

                case 'MonoSynth':
                default:
                    if (type !== 'MonoSynth') {
                        console.warn(`[ContinuousSynth] Unknown type '${type}', falling back to MonoSynth`);
                    }
                    this.currentSynth = new Tone.MonoSynth({
                        oscillator: preset.oscillator,
                        envelope: preset.envelope,
                        filterEnvelope: preset.filterEnvelope,
                        portamento: preset.portamento
                    });
                    break;
            }

            // 初始音量设为静音，防止 start() 时的瞬时爆音
            // 注意：KarplusStrong 使用 .output.gain 或 .volume
            if (this.currentSynth.volume) {
                this.currentSynth.volume.value = -60;
            }

            // 连接到效果器链
            // 注意：KarplusStrong 也是 Tone.js 兼容节点，拥有 connect 方法
            this.currentSynth.connect(this.vibrato);

            this.currentInstrument = instrument;
            console.log(`[ContinuousSynth] Created: ${instrument} (${type}, portamento: ${preset.portamento || 0}s)`);

        } catch (error) {
            console.error(`[ContinuousSynth] Failed to create synthesizer for ${instrument}:`, error);
            // Fallback to MonoSynth if anything fails
            if (type !== 'MonoSynth') {
                console.warn('[ContinuousSynth] Falling back to MonoSynth');
                this.currentSynth = new Tone.MonoSynth();
                this.currentSynth.connect(this.vibrato);
            }
        }
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

                // Task 5: Volume → Continuous Gain Control (New!)
                this.updateVolume(volumeLinear);
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
            
            // 🔥 [CONTINUOUS CONTROL FIX]
            // 使用固定 Velocity 1.0，将动态完全交给 Volume 控制
            const velocity = 1.0;

            // 立即更新目标音量 (从 -60dB 平滑上升)
            this.updateVolume(volume);

            // 触发包络启动
            if (this.currentSynth instanceof KarplusStrong) {
                this.currentSynth.triggerAttack(initialFrequency, now, velocity);
            } else {
                // Standard Tone.js Synth
                this.currentSynth.triggerAttack(initialFrequency, now, velocity);
            }

            this.isPlaying = true;
            this.currentFrequency = initialFrequency;
            this.lastUpdateTime = Date.now();

            console.log(`[ContinuousSynth] ▶ Started at ${initialFrequency.toFixed(1)} Hz (velocity: ${velocity.toFixed(2)})`);
        } catch (error) {
            console.error('[ContinuousSynth]  Start error:', error);
        }
    }

    /**
     * Task 1: 频率更新 (Auto-Tune & Smoothing)
     *
     * @param {number} frequency - 基础频率 (Hz, Raw Input from Mic)
     * @param {number} cents - 音分偏移 (未使用，由 getNearestScaleNote 重新计算)
     * @param {number} timestamp - 时间戳
     */
    updateFrequencyWithCents(frequency, cents, timestamp) {
        // 避免过度频繁更新
        if (timestamp - this.lastUpdateTime < this.minUpdateInterval) {
            return;
        }

        // 1. 计算目标音高 (Scale Quantization)
        // 根据当前调式找到最近的合法音符
        const { frequency: scaleFreq } = getNearestScaleNote(frequency, this.scaleKey, this.scaleType);

        // 2. 混合原始音高与目标音高 (Correction Strength)
        // autoTuneStrength: 0.0 (完全原始) -> 1.0 (完全修正)
        // 使用线性插值 (Lerp)
        const targetFrequency = frequency + (scaleFreq - frequency) * this.autoTuneStrength;

        // 3. 计算平滑时间 (Retune Speed / Humanize)
        // retuneSpeed: 0.0 (Robotic/Fast, 5ms) -> 1.0 (Natural/Slow, 100ms)
        // 较慢的速度可以保留更多的滑音和颤音细节
        const rampTime = 0.005 + (this.retuneSpeed * 0.1);

        // 计算相对于当前振荡器频率的变化 (防抖)
        const currentOscFreq = (this.currentSynth instanceof KarplusStrong) 
            ? this.currentSynth.currentFrequency 
            : (this.currentSynth.frequency ? this.currentSynth.frequency.value : targetFrequency);
            
        const deviation = Math.abs(targetFrequency - currentOscFreq) / (currentOscFreq || 1);

        // 只有明显变化才更新（避免微小抖动）
        if (deviation > this.frequencyUpdateThreshold) {
            const startTime = performance.now();
            
            // Unified Continuous Slide Logic
            // Since we removed discrete instruments (Piano/Guitar), all instruments 
            // now benefit from smooth continuous frequency updates (Portamento).
            if (this.currentSynth instanceof KarplusStrong) {
                this.currentSynth.setFrequency(targetFrequency, rampTime);
            } else if (this.currentSynth.frequency) {
                this.currentSynth.frequency.rampTo(targetFrequency, rampTime);
            }

            // 性能监控
            const latency = performance.now() - startTime;
            this.performanceMetrics.frequencyUpdates++;
            this.performanceMetrics.updateLatency.push(latency);
            if (this.performanceMetrics.updateLatency.length > 100) {
                this.performanceMetrics.updateLatency.shift();
            }

            this.currentFrequency = targetFrequency;
            this.lastUpdateTime = timestamp;

            // Debug (Log occasional large corrections)
            if (this.autoTuneStrength > 0.5 && Math.abs(scaleFreq - frequency) > 5) {
                // console.log(`[AutoTune] Raw: ${frequency.toFixed(1)} -> Scale: ${scaleFreq.toFixed(1)} (Strength: ${(this.autoTuneStrength*100).toFixed(0)}%)`);
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
     * Task 5: 连续音量控制 (Continuous Volume Control)
     * 
     * 将输入的 RMS 音量映射到合成器的输出增益 (dB)
     * 解决 "响度不变" 和 "突变" 的问题
     * 
     * @param {number} inputVolume - 输入线性音量 (RMS, 0.0 - 1.0)
     */
    updateVolume(inputVolume) {
        if (inputVolume === undefined || inputVolume === null) return;

        // 1. 定义动态范围 (Dynamic Range)
        // 麦克风输入的有效范围通常很小，需要扩展
        const minInput = 0.01;  // 底噪/静音阈值
        const maxInput = 0.20;  // 最大歌唱音量 (根据经验值，可后续改为自动校准)
        
        const minOutputDb = -30; // 最低有效音量 (不建议太低，否则听不清)
        const maxOutputDb = 0;   // 最大音量 (0dB)

        // 2. 归一化与钳位 (Normalize & Clamp)
        let normalized = (inputVolume - minInput) / (maxInput - minInput);
        normalized = Math.max(0, Math.min(1, normalized));

        // 3. 映射曲线 (Transfer Function)
        // 使用指数曲线 (Power Law) 增加动态感
        // curve = 1.0: 线性映射
        // curve > 1.0: 扩展 (低音更低，高音更高，增加对比度)
        // curve < 1.0: 压缩 (提升细节)
        const curve = 1.5; 
        const mappedLinear = Math.pow(normalized, curve);

        // 4. 转换为 dB
        let targetDb = minOutputDb + mappedLinear * (maxOutputDb - minOutputDb);

        // 特殊处理：如果输入极小，快速衰减到静音，防止背景噪音
        if (inputVolume < minInput) {
             targetDb = -60;
        }

        // 5. 平滑更新 (Smoothing)
        // 使用 rampTo 防止爆音 (Zipper Noise)
        // 0.05s (50ms) 提供了灵敏的响应，同时足够平滑
        if (this.currentSynth && this.currentSynth.volume) {
            this.currentSynth.volume.rampTo(targetDb, 0.05);
        }

        // 🔥 Dynamic FM: Map Volume to Brightness (Modulation Index)
        // Essential for Brass/Winds (Louder = Brighter)
        const preset = this.instrumentPresets[this.currentInstrument];
        if (this.currentSynth instanceof Tone.FMSynth && preset?.dynamicModulation) {
            // Base index from preset, add up to 10 based on volume
            const baseIndex = preset.modulationIndex || 0;
            const dynamicRange = 10; 
            const targetIndex = baseIndex + (normalized * dynamicRange);
            
            this.currentSynth.modulationIndex.rampTo(targetIndex, 0.05);
        }
        
        // Debug 日志 (仅在音量大幅变化时)
        // if (Math.random() < 0.01) console.log(`Vol: ${inputVolume.toFixed(3)} -> ${targetDb.toFixed(1)} dB`);
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
                // 同样使用 velocity 1.0
                this.updateVolume(volume || 0.5);
                
                if (this.currentSynth instanceof KarplusStrong) {
                    this.currentSynth.triggerAttack(frequency, Tone.now(), 1.0);
                } else {
                    this.currentSynth.triggerAttack(frequency, Tone.now(), 1.0);
                }
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
                const now = Tone.now();
                
                if (this.currentSynth instanceof KarplusStrong) {
                    this.currentSynth.triggerRelease(now);
                } else {
                    this.currentSynth.triggerRelease(now);
                }
                
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
     * 设置延迟湿度
     */
    setDelayWet(wetness) {
        if (this.delay) {
            this.delay.wet.value = wetness;
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
        this.delay.dispose();
        this.reverb.dispose();

        //  清理噪声层
        if (this.noiseSource) this.noiseSource.dispose();
        if (this.noiseGain) this.noiseGain.dispose();
        if (this.noiseFilter) this.noiseFilter.dispose();

        console.log('[ContinuousSynth] Disposed');
    }
}

// Instance managed by AppContainer with proper dependency injection
//
// 为向后兼容，在 main.js 中通过 window.continuousSynthEngine 暴露容器实例
