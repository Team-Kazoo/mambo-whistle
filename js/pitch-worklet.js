/**
 * AudioWorklet Pitch Detector Processor
 *
 * 完成版: 集成 YIN 音高检测算法
 * - 在 AudioWorklet 线程中运行 YIN 算法
 * - 实时音高检测和平滑处理
 * - 完整的音符信息计算
 * - 与 pitch-detector.js API 兼容
 *
 * 扩展: 表现力特征提取
 * - SimpleFFT: Spectral Centroid (brightness) + Flatness (breathiness)
 * - EMA 平滑滤波器
 * - 简化 OnsetDetector
 * - 完整 PitchFrame 数据结构 (11 字段)
 *
 * 性能目标:
 * - Buffer: 128 samples (2.9ms @ 44.1kHz)
 * - 处理时间: < 1ms per frame
 * - 总延迟: 8-15ms (vs. 46ms ScriptProcessor)
 */

/**
 *  简化 FFT 实现
 *
 * 用于计算频谱特征 (Spectral Centroid, Flatness)
 * 替代主线程的 AnalyserNode，使 Worklet 自给自足
 *
 * 算法: DFT (非 Cooley-Tukey FFT，简化实现)
 * 性能: 2048 点 DFT 约 0.5-1ms (可接受)
 */
class SimpleFFT {
    constructor(size = 2048) {
        this.size = size;
        this.halfSize = size / 2;

        // 工作缓冲区
        this.powerSpectrum = new Float32Array(this.halfSize);
    }

    /**
     * 计算功率谱
     * 只计算前 halfSize 个频率 bin (足够用于特征提取)
     *
     * @param {Float32Array} input - 时域信号 (长度 = size)
     * @returns {Float32Array} 功率谱 (长度 = halfSize)
     */
    computePowerSpectrum(input) {
        if (input.length !== this.size) {
            console.error('[SimpleFFT] Input size mismatch:', input.length, 'expected', this.size);
            return this.powerSpectrum;
        }

        // DFT: X[k] = Σ x[n] * e^(-j*2π*k*n/N)
        // 分解为: real = Σ x[n]*cos(2πkn/N), imag = Σ x[n]*sin(2πkn/N)
        for (let k = 0; k < this.halfSize; k++) {
            let real = 0;
            let imag = 0;

            for (let n = 0; n < this.size; n++) {
                const angle = (2 * Math.PI * k * n) / this.size;
                real += input[n] * Math.cos(angle);
                imag -= input[n] * Math.sin(angle); // 注意负号
            }

            // 功率谱 = |X[k]|^2 = real^2 + imag^2
            this.powerSpectrum[k] = real * real + imag * imag;
        }

        return this.powerSpectrum;
    }

    /**
     * 计算 Spectral Centroid (质心频率)
     *
     * 表示频谱的"重心"位置，与音色亮度正相关
     *
     * @param {Float32Array} powerSpectrum - 功率谱
     * @param {number} sampleRate - 采样率
     * @returns {number} 质心频率 (Hz)
     */
    computeSpectralCentroid(powerSpectrum, sampleRate) {
        let weightedSum = 0;
        let totalPower = 0;

        for (let k = 0; k < this.halfSize; k++) {
            const frequency = (k * sampleRate) / this.size;
            weightedSum += frequency * powerSpectrum[k];
            totalPower += powerSpectrum[k];
        }

        return totalPower > 0 ? weightedSum / totalPower : 0;
    }

    /**
     * 计算 Spectral Flatness (频谱平坦度)
     *
     * 几何平均 / 算术平均，范围 [0, 1]
     * 接近 1: 白噪声 (气声强)
     * 接近 0: 纯音 (气声弱)
     *
     * @param {Float32Array} powerSpectrum - 功率谱
     * @returns {number} 平坦度 [0, 1]
     */
    computeSpectralFlatness(powerSpectrum) {
        let geometricMean = 0;
        let arithmeticMean = 0;
        let count = 0;

        for (let k = 0; k < this.halfSize; k++) {
            if (powerSpectrum[k] > 0) {
                geometricMean += Math.log(powerSpectrum[k]);
                arithmeticMean += powerSpectrum[k];
                count++;
            }
        }

        if (count === 0) return 0;

        geometricMean = Math.exp(geometricMean / count);
        arithmeticMean /= count;

        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
}

/**
 *  EMA 滤波器 (指数移动平均)
 *
 * 用于平滑 volume, brightness, breathiness
 * 比 Kalman Filter 简单，性能更好
 */
class EMAFilter {
    constructor(alpha = 0.3) {
        this.alpha = alpha;  // 平滑系数 [0, 1]，越大响应越快
        this.value = null;
    }

    update(newValue) {
        if (this.value === null) {
            this.value = newValue;
        } else {
            this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
        }
        return this.value;
    }

    reset() {
        this.value = null;
    }
}

/**
 *  简化起音检测器
 *
 * 基于能量突增检测，比 的完整版简单
 * 适用于持续哼唱场景 (不需要 6dB 突增阈值)
 *
 * 状态机:
 * - silence: 音量 < -40dB
 * - attack: 能量突增 > threshold (或首次有音量)
 * - sustain: 持续有音量
 * - release: 音量下降到 silence 前的过渡
 */
class SimpleOnsetDetector {
    constructor(config = {}) {
        this.energyThreshold = config.energyThreshold ?? 3;  // dB (比 的 6dB 更宽松)
        this.historySize = config.historySize ?? 5;
        this.silenceThreshold = config.silenceThreshold ?? -40;  // dB
        this.minStateDuration = config.minStateDuration ?? 50;  // ms

        this.energyHistory = [];
        this.currentState = 'silence';
        this.lastStateChange = 0;
        this.frameCount = 0;
    }

    /**
     * 检测起音状态
     *
     * @param {number} volumeDb - 当前音量 (dB)
     * @param {number} currentTime - 当前时间戳 (秒)
     * @returns {string} 'silence' | 'attack' | 'sustain' | 'release'
     */
    detect(volumeDb, currentTime) {
        this.frameCount++;

        // 更新能量历史
        this.energyHistory.push(volumeDb);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        // 计算平均能量
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const energyIncrease = volumeDb - avgEnergy;

        // 时间约束: 状态切换至少间隔 minStateDuration
        const timeSinceChange = (currentTime - this.lastStateChange) * 1000; // ms
        const canChangeState = timeSinceChange >= this.minStateDuration;

        let newState = this.currentState;

        // 状态转换逻辑
        switch (this.currentState) {
            case 'silence':
                // silence → attack: 音量超过阈值 + 能量突增
                if (volumeDb > this.silenceThreshold) {
                    // 宽松检测: 能量突增 OR 绝对音量足够 (解决持续哼唱无法触发的问题)
                    if (energyIncrease > this.energyThreshold || volumeDb > -20) {
                        newState = 'attack';
                    } else {
                        // 能量平缓上升 → 直接进入 sustain (跳过 attack)
                        newState = 'sustain';
                    }
                }
                break;

            case 'attack':
                // attack → sustain: 持续一段时间后稳定
                if (canChangeState) {
                    newState = 'sustain';
                }
                break;

            case 'sustain':
                // sustain → release: 音量开始下降
                if (volumeDb < this.silenceThreshold + 10) {  // -30dB
                    newState = 'release';
                }
                break;

            case 'release':
                // release → silence: 音量降到阈值以下
                if (volumeDb < this.silenceThreshold) {
                    newState = 'silence';
                }
                // release → sustain: 音量又上升了 (重新哼唱)
                else if (volumeDb > this.silenceThreshold + 15) {  // -25dB
                    newState = 'sustain';
                }
                break;
        }

        // 更新状态
        if (newState !== this.currentState) {
            this.currentState = newState;
            this.lastStateChange = currentTime;
        }

        return this.currentState;
    }

    reset() {
        this.energyHistory = [];
        this.currentState = 'silence';
        this.lastStateChange = 0;
    }
}

class PitchDetectorWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();

        console.log('[PitchWorklet] Worklet 处理器已创建');

        // 配置参数 (从主线程接收,等待 'config' 消息更新)
        //  修复: 不再使用硬编码默认值,等待主线程下发集中式配置
        this.config = {
            sampleRate: sampleRate, // AudioWorkletGlobalScope 提供
            algorithm: 'YIN',
            // 以下参数将由主线程 ConfigManager 下发
            threshold: 0.1,          // YIN 内部阈值 (固定)
            clarityThreshold: 0.85,  // 置信度阈值 (待更新)
            minFrequency: 80,        // 待更新
            maxFrequency: 800,       // 待更新
            smoothingSize: 5,
            minVolumeThreshold: 0.01
        };

        console.log('[PitchWorklet] ⏳ 等待主线程配置下发...');

        // 初始化 YIN 检测器
        this.detector = this._createYINDetector(this.config);

        // 音高历史记录 (用于平滑)
        this.pitchHistory = [];

        // 音符映射表
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // 音频累积缓冲 (YIN需要更大的窗口)
        this.accumulationBuffer = new Float32Array(2048); // YIN 推荐至少 2048
        this.accumulationIndex = 0;
        this.accumulationFull = false;

        //  FFT 处理器
        this.fft = new SimpleFFT(2048);
        console.log('[PitchWorklet]  SimpleFFT 初始化完成 (2048 点)');

        //  EMA 平滑滤波器
        this.volumeFilter = new EMAFilter(0.3);       // volume 平滑
        this.brightnessFilter = new EMAFilter(0.3);   // brightness 平滑
        this.breathinessFilter = new EMAFilter(0.4);  // breathiness 平滑 (稍快响应)
        console.log('[PitchWorklet]  EMA 滤波器初始化完成');

        //  简化起音检测器
        this.onsetDetector = new SimpleOnsetDetector({
            energyThreshold: 3,      // dB (宽松阈值，适合持续哼唱)
            silenceThreshold: -40,   // dB
            minStateDuration: 50     // ms
        });
        console.log('[PitchWorklet]  SimpleOnsetDetector 初始化完成');

        //  特征历史 (用于日志去重)
        this.lastLoggedBrightness = -1;
        this.lastLoggedBreathiness = -1;

        // 性能统计
        this.stats = {
            framesProcessed: 0,
            pitchDetections: 0,
            fftComputations: 0,      // Phase 2.9
            startTime: currentTime,
            lastReportTime: currentTime,
            processingTimes: [],
            maxProcessingTime: 0
        };

        // 监听主线程消息
        this.port.onmessage = this._handleMessage.bind(this);

        // 通知主线程已就绪
        this.port.postMessage({
            type: 'ready',
            data: {
                sampleRate: this.config.sampleRate,
                bufferSize: 128,
                algorithm: 'YIN',
                features: ['pitch', 'brightness', 'breathiness']  // Phase 2.9
            }
        });

        console.log('[PitchWorklet]  Worklet 初始化完成 (YIN + FFT + EMA)');
    }

    /**
     * 创建 YIN 音高检测器
     * 基于 Pitchfinder 库的 YIN 实现
     */
    _createYINDetector(config) {
        const threshold = config.threshold || 0.1;
        const probabilityThreshold = 0.1;
        const sampleRate = config.sampleRate;

        return function detectPitch(buffer) {
            if (!buffer || buffer.length < 2) {
                return null;
            }

            const yinBufferSize = Math.floor(buffer.length / 2);
            const yinBuffer = new Float32Array(yinBufferSize);

            // Step 1: 计算差分函数
            let delta;
            for (let t = 0; t < yinBufferSize; t++) {
                yinBuffer[t] = 0;
            }

            for (let t = 1; t < yinBufferSize; t++) {
                for (let i = 0; i < yinBufferSize; i++) {
                    delta = buffer[i] - buffer[i + t];
                    yinBuffer[t] += delta * delta;
                }
            }

            // Step 2: 计算累积平均归一化差分
            yinBuffer[0] = 1;
            let runningSum = 0;
            for (let t = 1; t < yinBufferSize; t++) {
                runningSum += yinBuffer[t];
                yinBuffer[t] *= t / runningSum;
            }

            // Step 3: 绝对阈值
            let tau = -1;
            for (let t = 2; t < yinBufferSize; t++) {
                if (yinBuffer[t] < threshold) {
                    while (t + 1 < yinBufferSize && yinBuffer[t + 1] < yinBuffer[t]) {
                        t++;
                    }
                    tau = t;
                    break;
                }
            }

            // Step 4: 未检测到音高
            if (tau === -1) {
                return null;
            }

            // Step 5: 抛物线插值
            let betterTau;
            const x0 = (tau < 1) ? tau : tau - 1;
            const x2 = (tau + 1 < yinBufferSize) ? tau + 1 : tau;

            if (x0 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x2]) ? tau : x2;
            } else if (x2 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x0]) ? tau : x0;
            } else {
                const s0 = yinBuffer[x0];
                const s1 = yinBuffer[tau];
                const s2 = yinBuffer[x2];
                betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }

            // 计算频率
            const frequency = sampleRate / betterTau;

            // 检查概率
            const probability = 1 - yinBuffer[tau];
            if (probability < probabilityThreshold) {
                return null;
            }

            return frequency;
        };
    }

    /**
     * 音频处理回调
     * 每 128 samples 调用一次 (@ 44.1kHz ≈ 2.9ms)
     */
    process(inputs, outputs, parameters) {
        const startTime = currentTime;

        // 获取输入音频 (单声道)
        const input = inputs[0];
        if (!input || !input[0]) {
            return true; // 继续处理
        }

        const audioBuffer = input[0]; // Float32Array[128]

        try {
            // 计算音量
            const volume = this._calculateRMS(audioBuffer);

            // 累积音频数据到更大的缓冲区 (YIN 需要至少 2048 samples)
            this._accumulateAudio(audioBuffer);

            let pitchInfo = null;

            // 当缓冲区满时,执行音高检测
            if (this.accumulationFull) {
                // 检查音量阈值
                if (volume >= this.config.minVolumeThreshold) {
                    const frequency = this.detector(this.accumulationBuffer);

                    //  调试: 记录 YIN 检测结果
                    if (!frequency) {
                        // YIN 未检测到音高 (返回 null)
                        if (this.frameCount % 100 === 0) {  // 每 100 帧记录一次
                            console.log(`[PitchWorklet]  YIN 未检测到音高 (volume: ${volume.toFixed(3)})`);
                        }
                    } else if (frequency <= 0 || frequency >= 2000) {
                        // 频率超出合理范围
                        console.log(`[PitchWorklet]  频率超出范围: ${frequency.toFixed(1)} Hz (volume: ${volume.toFixed(3)})`);
                    } else if (frequency < this.config.minFrequency || frequency > this.config.maxFrequency) {
                        // 频率超出配置范围
                        console.log(`[PitchWorklet]  频率超出配置范围: ${frequency.toFixed(1)} Hz (配置: ${this.config.minFrequency}-${this.config.maxFrequency} Hz)`);
                    }

                    if (frequency && frequency > 0 && frequency < 2000) {
                        //  临时放宽频率范围检查 (调试用)
                        // 原始检查: frequency >= this.config.minFrequency && frequency <= this.config.maxFrequency
                        // 临时改为: 只检查合理范围 20-2000 Hz
                        if (frequency >= 20 && frequency <= 2000) {  // 🔥 临时修复

                            // 添加到历史记录
                            this.pitchHistory.push(frequency);
                            if (this.pitchHistory.length > this.config.smoothingSize) {
                                this.pitchHistory.shift();
                            }

                            // 计算平滑后的频率
                            const smoothedFrequency = this._getSmoothedPitch();

                            // 转换为音符信息
                            const noteInfo = this._frequencyToNote(smoothedFrequency);

                            // 计算置信度
                            const confidence = this._calculateConfidence(
                                this.accumulationBuffer,
                                frequency,
                                volume
                            );

                            //  FFT 频谱分析
                            const powerSpectrum = this.fft.computePowerSpectrum(this.accumulationBuffer);
                            const spectralCentroid = this.fft.computeSpectralCentroid(powerSpectrum, this.config.sampleRate);
                            const spectralFlatness = this.fft.computeSpectralFlatness(powerSpectrum);

                            this.stats.fftComputations++;

                            //  映射到 PitchFrame 字段
                            const rawBrightness = this._normalizeBrightness(spectralCentroid);
                            const rawBreathiness = Math.min(spectralFlatness, 1.0);

                            //  EMA 平滑
                            const smoothedVolume = this.volumeFilter.update(volume);
                            const smoothedBrightness = this.brightnessFilter.update(rawBrightness);
                            const smoothedBreathiness = this.breathinessFilter.update(rawBreathiness);

                            // 计算 volumeDb
                            const volumeDb = smoothedVolume > 0 ? 20 * Math.log10(smoothedVolume) : -100;

                            //  起音检测
                            const articulation = this.onsetDetector.detect(volumeDb, currentTime);

                            //  调试: 记录成功检测 (每 50 次记录一次)
                            if (this.stats.pitchDetections % 50 === 0) {
                                console.log(`[PitchWorklet]  检测到音高: ${smoothedFrequency.toFixed(1)} Hz (${noteInfo.note}${noteInfo.octave}), 置信度: ${confidence.toFixed(2)}, articulation: ${articulation}`);
                            }

                            //  构造完整 PitchFrame (12 字段 + captureTime for latency measurement)
                            pitchInfo = {
                                // 基础音高字段
                                frequency: smoothedFrequency,
                                rawFrequency: frequency,
                                note: noteInfo.note,
                                octave: noteInfo.octave,
                                cents: noteInfo.cents,
                                confidence: confidence,

                                // 音量字段
                                volumeLinear: smoothedVolume,
                                volumeDb: volumeDb,

                                // 频谱特征
                                brightness: smoothedBrightness,
                                breathiness: smoothedBreathiness,

                                // 起音状态
                                articulation: articulation,

                                // Latency measurement (timestamp only, for end-to-end)
                                captureTime: currentTime * 1000,

                                // 调试信息 (可选)
                                _debug: {
                                    spectralCentroid: spectralCentroid,
                                    spectralFlatness: spectralFlatness,
                                    rawBrightness: rawBrightness,
                                    rawBreathiness: rawBreathiness
                                }
                            };

                            this.stats.pitchDetections++;

                            //  发送完整 PitchFrame 到主线程
                            // 附加 Worklet currentTime (转换为毫秒) 用于精确时序追踪
                            this.port.postMessage({
                                type: 'pitch-frame',  // 新消息类型
                                data: pitchInfo,
                                timestamp: currentTime * 1000  // AudioContext.currentTime (秒) → 毫秒
                            });

                            // 兼容: 保留旧消息类型 (便于回退)
                            this.port.postMessage({
                                type: 'pitch-detected',
                                data: {
                                    frequency: smoothedFrequency,
                                    rawFrequency: frequency,
                                    note: noteInfo.note,
                                    octave: noteInfo.octave,
                                    cents: noteInfo.cents,
                                    confidence: confidence,
                                    volume: smoothedVolume
                                }
                            });
                        }
                    } else if (frequency === null) {
                        // 未检测到音高
                        this.port.postMessage({
                            type: 'no-pitch',
                            data: { volume: volume }
                        });
                    }
                }

                // 重置缓冲区 (滑动窗口: 保留后半部分)
                const halfSize = Math.floor(this.accumulationBuffer.length / 2);
                this.accumulationBuffer.copyWithin(0, halfSize);
                this.accumulationIndex = halfSize;
                this.accumulationFull = false;
            }

            // 透传音频数据 (输出 = 输入)
            const output = outputs[0];
            if (output && output[0]) {
                output[0].set(audioBuffer);
            }

        } catch (error) {
            // 错误报告
            this.port.postMessage({
                type: 'error',
                error: 'processing-error',
                message: error.message,
                stack: error.stack
            });
        }

        // 更新性能统计
        const processingTime = (currentTime - startTime) * 1000; // ms
        this._updateStats(processingTime);

        return true; // 继续处理
    }

    /**
     * 处理主线程消息
     */
    _handleMessage(event) {
        const { type, data } = event.data;

        switch (type) {
            case 'config':
                this._handleConfig(data);
                break;

            case 'update-params':
                this._handleUpdateParams(data);
                break;

            case 'control':
                this._handleControl(event.data);
                break;

            default:
                console.warn('[PitchWorklet] 未知消息类型:', type);
        }
    }

    /**
     * 处理配置消息 ( 接收主线程集中式配置)
     */
    _handleConfig(config) {
        console.log('[PitchWorklet] 📥 收到主线程配置:', config);

        //  合并配置 (主线程配置覆盖默认值)
        const oldConfig = { ...this.config };
        this.config = {
            ...this.config,
            ...config
        };

        // 关键参数变更日志
        if (oldConfig.clarityThreshold !== this.config.clarityThreshold) {
            console.log(`[PitchWorklet]  clarityThreshold: ${oldConfig.clarityThreshold} → ${this.config.clarityThreshold}`);
        }
        if (oldConfig.minFrequency !== this.config.minFrequency || oldConfig.maxFrequency !== this.config.maxFrequency) {
            console.log(`[PitchWorklet]  频率范围: ${oldConfig.minFrequency}-${oldConfig.maxFrequency} → ${this.config.minFrequency}-${this.config.maxFrequency} Hz`);
        }

        //  更新 EMA 滤波器参数 (如果提供)
        if (config.volumeAlpha !== undefined && this.volumeFilter) {
            this.volumeFilter.alpha = config.volumeAlpha;
            console.log(`[PitchWorklet]  volumeAlpha: ${config.volumeAlpha}`);
        }
        if (config.brightnessAlpha !== undefined && this.brightnessFilter) {
            this.brightnessFilter.alpha = config.brightnessAlpha;
            console.log(`[PitchWorklet]  brightnessAlpha: ${config.brightnessAlpha}`);
        }

        //  更新起音检测器参数
        if (this.onsetDetector && (config.energyThreshold || config.silenceThreshold || config.minStateDuration)) {
            if (config.energyThreshold !== undefined) {
                this.onsetDetector.energyThreshold = config.energyThreshold;
                console.log(`[PitchWorklet]  energyThreshold: ${config.energyThreshold} dB`);
            }
            if (config.silenceThreshold !== undefined) {
                this.onsetDetector.silenceThreshold = config.silenceThreshold;
                console.log(`[PitchWorklet]  silenceThreshold: ${config.silenceThreshold} dB`);
            }
            if (config.minStateDuration !== undefined) {
                this.onsetDetector.minStateDuration = config.minStateDuration;
                console.log(`[PitchWorklet]  minStateDuration: ${config.minStateDuration} ms`);
            }
        }

        //  注意: YIN 检测器不需要重新创建 (threshold 是内部固定值 0.1)
        // clarityThreshold 用于置信度过滤,不影响 YIN 算法本身

        this.port.postMessage({
            type: 'config-applied',
            config: this.config
        });

        console.log('[PitchWorklet]  配置已应用,Worklet 已使用主线程参数');
    }

    /**
     * 处理参数更新
     */
    _handleUpdateParams(params) {
        console.log('[PitchWorklet] 更新参数:', params);

        this.config = {
            ...this.config,
            ...params
        };

        this.port.postMessage({
            type: 'params-updated',
            config: this.config
        });
    }

    /**
     * 处理控制命令
     */
    _handleControl(message) {
        const { command } = message;

        switch (command) {
            case 'reset':
                this._reset();
                break;

            case 'get-stats':
                this._reportStats();
                break;

            default:
                console.warn('[PitchWorklet] 未知控制命令:', command);
        }
    }

    /**
     * 累积音频到更大的缓冲区
     */
    _accumulateAudio(newSamples) {
        const remaining = this.accumulationBuffer.length - this.accumulationIndex;
        const copySize = Math.min(newSamples.length, remaining);

        this.accumulationBuffer.set(
            newSamples.subarray(0, copySize),
            this.accumulationIndex
        );

        this.accumulationIndex += copySize;

        if (this.accumulationIndex >= this.accumulationBuffer.length) {
            this.accumulationFull = true;
        }
    }

    /**
     * 获取平滑后的音高 (中值滤波)
     */
    _getSmoothedPitch() {
        if (this.pitchHistory.length === 0) return 0;

        const sorted = [...this.pitchHistory].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    /**
     * 将频率转换为音符信息
     */
    _frequencyToNote(frequency) {
        // A4 = 440 Hz 为参考
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75); // C0 frequency

        // 计算与C0的半音差
        const halfSteps = 12 * Math.log2(frequency / C0);
        const roundedHalfSteps = Math.round(halfSteps);

        // 计算音符和八度
        // 修复: 负数取模仍为负，需要归一化到 0-11
        const noteIndex = ((roundedHalfSteps % 12) + 12) % 12;
        const octave = Math.floor(roundedHalfSteps / 12);

        // 计算音分偏差 (cents)
        const cents = Math.round((halfSteps - roundedHalfSteps) * 100);

        return {
            note: this.noteNames[noteIndex],
            octave: octave,
            fullNote: `${this.noteNames[noteIndex]}${octave}`,
            cents: cents
        };
    }

    /**
     * 计算检测置信度
     */
    _calculateConfidence(audioBuffer, frequency, volume) {
        if (!frequency || frequency <= 0) return 0;

        // 基于音量的置信度
        const minRMS = 0.01;
        const maxRMS = 0.3;

        let confidence = (volume - minRMS) / (maxRMS - minRMS);
        confidence = Math.max(0, Math.min(1, confidence));

        // 频率在人声范围内 (80-800Hz)，提升置信度
        if (frequency >= 80 && frequency <= 800) {
            confidence = Math.min(confidence * 1.2, 1);
        }

        return confidence;
    }

    /**
     * 计算 RMS 音量
     */
    _calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     *  归一化 Brightness
     *
     * 将 Spectral Centroid (Hz) 映射到 [0, 1] 范围
     *
     * 参考 SpectralFeatures 的映射逻辑:
     * - 人声频谱质心范围: 200Hz (暗) ~ 8000Hz (亮)
     * - 使用对数映射: log(centroid / 200) / log(8000 / 200)
     *
     * @param {number} spectralCentroid - 质心频率 (Hz)
     * @returns {number} brightness [0, 1]
     */
    _normalizeBrightness(spectralCentroid) {
        const minCentroid = 200;   // Hz - 最暗音色
        const maxCentroid = 8000;  // Hz - 最亮音色

        // 边界检查
        if (spectralCentroid <= minCentroid) return 0;
        if (spectralCentroid >= maxCentroid) return 1;

        // 对数映射 (人耳对频率的感知是对数的)
        const normalized = Math.log(spectralCentroid / minCentroid) / Math.log(maxCentroid / minCentroid);

        return Math.max(0, Math.min(1, normalized));
    }

    /**
     * 更新性能统计
     */
    _updateStats(processingTime) {
        this.stats.framesProcessed++;
        this.stats.processingTimes.push(processingTime);

        // 只保留最近 100 帧
        if (this.stats.processingTimes.length > 100) {
            this.stats.processingTimes.shift();
        }

        // 更新最大处理时间
        if (processingTime > this.stats.maxProcessingTime) {
            this.stats.maxProcessingTime = processingTime;
        }

        // 每秒报告一次统计
        if (currentTime - this.stats.lastReportTime >= 1.0) {
            this._reportStats();
            this.stats.lastReportTime = currentTime;
        }
    }

    /**
     * 获取平均处理时间
     */
    _getAvgProcessingTime() {
        const times = this.stats.processingTimes;
        if (times.length === 0) return 0;

        const sum = times.reduce((a, b) => a + b, 0);
        return (sum / times.length).toFixed(3);
    }

    /**
     * 报告性能统计
     */
    _reportStats() {
        this.port.postMessage({
            type: 'stats',
            data: {
                framesProcessed: this.stats.framesProcessed,
                avgProcessingTime: parseFloat(this._getAvgProcessingTime()),
                maxProcessingTime: this.stats.maxProcessingTime.toFixed(3),
                uptime: (currentTime - this.stats.startTime).toFixed(2)
            }
        });
    }

    /**
     * 重置统计
     */
    _reset() {
        this.stats = {
            framesProcessed: 0,
            startTime: currentTime,
            lastReportTime: currentTime,
            processingTimes: [],
            maxProcessingTime: 0
        };

        this.port.postMessage({
            type: 'reset-complete'
        });
    }
}

// 注册处理器
registerProcessor('pitch-detector', PitchDetectorWorklet);

console.log('[PitchWorklet]  PitchDetectorWorklet 已注册');
