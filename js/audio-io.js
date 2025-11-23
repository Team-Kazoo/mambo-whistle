/**
 * AudioIO 抽象层
 *
 * 统一的音频输入/输出接口，支持：
 * - AudioWorklet (现代, 低延迟)
 * - ScriptProcessor (回退, 兼容性)
 *
 *  低延迟音频基础
 * 为 AudioWorklet 迁移提供清晰的抽象
 *
 * @class AudioIO
 */

class AudioIO {
    constructor() {
        // 音频系统状态
        this.audioContext = null;
        this.stream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.isRunning = false;
        this.isInitialized = false;

        // 当前使用的模式
        this.mode = null; // 'worklet' | 'script-processor'

        // USB 音频输入相关
        this.usbReceiver = null;
        this.usbSource = null;
        this.inputSource = 'microphone'; // 'microphone' | 'usb'

        // 配置 (从 audio-config.js 或默认值)
        this.config = {
            sampleRate: 44100,
            bufferSize: 2048,        // ScriptProcessor 模式
            workletBufferSize: 128,  // AudioWorklet 模式
            useWorklet: true,        //  启用 AudioWorklet 低延迟模式
            workletFallback: true,   // 自动回退到 ScriptProcessor
            latencyHint: 'interactive',
            debug: false,            // 调试模式
            inputSource: 'microphone' // 输入源: 'microphone' | 'usb'
        };

        //  存储主线程的集中式配置 (用于序列化到 Worklet)
        this.appConfig = null;  // 来自 configManager.get()

        // 回调函数
        this.onFrameCallback = null;           // 原始音频帧回调 (所有模式)
        this.onPitchDetectedCallback = null;   // 音高检测回调 (仅 Worklet 模式)
        this.onWorkletPitchFrameCallback = null; //  Worklet PitchFrame 专用回调
        this.onErrorCallback = null;
        this.onStateChangeCallback = null;

        // 性能监控
        this.stats = {
            framesProcessed: 0,
            lastFrameTime: 0,
            avgProcessingTime: 0,
            dropouts: 0
        };
    }

    /**
     * 枚举可用的音频设备
     * @returns {Promise<{inputs: Array, outputs: Array}>}
     */
    async enumerateDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('[AudioIO] 浏览器不支持设备枚举');
            return { inputs: [], outputs: [] };
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(device => device.kind === 'audioinput');
            const outputs = devices.filter(device => device.kind === 'audiooutput');
            
            console.log(`[AudioIO] 已发现设备: ${inputs.length} 输入, ${outputs.length} 输出`);
            return { inputs, outputs };
        } catch (error) {
            console.error('[AudioIO] 设备枚举失败:', error);
            return { inputs: [], outputs: [] };
        }
    }

    /**
     * 设置音频输出设备 (Sink ID)
     * 注意: 仅 Chrome/Edge 支持 setSinkId
     * @param {string} deviceId 
     */
    async setAudioOutputDevice(deviceId) {
        if (!this.audioContext) return;
        
        // 尝试在 AudioContext 的 destination 上设置 sinkId (Web Audio API v2)
        // 或者在 HTMLAudioElement 上设置 (如果是流式播放)
        
        try {
            // 方法 1: AudioContext.setSinkId (实验性特性)
            if (typeof this.audioContext.setSinkId === 'function') {
                await this.audioContext.setSinkId(deviceId);
                console.log(`[AudioIO] AudioContext 输出已切换至: ${deviceId}`);
            } 
            // 方法 2: 检查 Tone.js 的处理 (因为应用使用 Tone.js 输出)
            // Tone.js 通常包装了 audioContext.destination，目前不直接支持 setSinkId 穿透
            // 但如果我们设置了 audioContext.setSinkId，Tone.js 应该会自动跟随
            else {
                console.warn('[AudioIO] 当前浏览器不支持 AudioContext.setSinkId，无法切换输出设备');
            }
        } catch (error) {
            console.error('[AudioIO] 设置输出设备失败:', error);
        }
    }

    /**
     * 配置音频系统
     * @param {Object} options - 配置选项
     * @param {number} options.sampleRate - 采样率
     * @param {number} options.bufferSize - 缓冲大小 (ScriptProcessor)
     * @param {number} options.workletBufferSize - 缓冲大小 (AudioWorklet)
     * @param {boolean} options.useWorklet - 是否使用 AudioWorklet
     * @param {string} options.latencyHint - 延迟提示
     * @param {string} options.inputDeviceId - 输入设备 ID
     * @param {string} options.outputDeviceId - 输出设备 ID
     * @param {string} options.inputSource - 输入源 ('microphone' | 'usb')
     * @param {Object} options.appConfig: 集中式配置对象 (来自 configManager)
     */
    configure(options = {}) {
        console.log('[AudioIO] 配置音频系统:', options);

        //  保存集中式配置
        if (options.appConfig) {
            this.appConfig = options.appConfig;
            console.log('[AudioIO]  已接收集中式配置');
        }

        // 更新输入源（需要在合并配置之前设置，以便后续判断）
        if (options.inputSource) {
            this.inputSource = options.inputSource;
            console.log(`[AudioIO] 输入源设置为: ${this.inputSource}`);
        }

        this.config = {
            ...this.config,
            ...options
        };

        // USB 音频设备固定使用 48000Hz 采样率（与 ESP32 设备匹配）
        if (this.inputSource === 'usb') {
            this.config.sampleRate = 48000;
            console.log('[AudioIO] USB 音频模式：强制使用 48000Hz 采样率（与设备匹配）');
        }

        // 验证配置
        this._validateConfig();

        return this;
    }

    /**
     * 启动音频系统
     * @returns {Promise<Object>} 启动结果 { mode, latency, sampleRate }
     */
    async start() {
        if (this.isRunning) {
            console.warn('[AudioIO] 音频系统已在运行');
            return;
        }

        const startTime = performance.now();

        try {
            console.group(' [AudioIO] 启动音频系统');

            // 1. 初始化 AudioContext
            await this._initializeAudioContext();

            // 1.5 如果配置了输出设备，尝试设置
            if (this.config.outputDeviceId && this.config.outputDeviceId !== 'default') {
                await this.setAudioOutputDevice(this.config.outputDeviceId);
            }

            // 2. 根据输入源类型初始化输入
            if (this.inputSource === 'usb') {
                await this._setupUsbAudio();
            } else {
                // 默认使用麦克风
                await this._requestMicrophone(this.config.inputDeviceId);
            }

            // 3. 决定使用哪种处理模式
            const useWorklet = this.config.useWorklet && this._supportsAudioWorklet();
            this.mode = useWorklet ? 'worklet' : 'script-processor';

            console.log('📌 选择模式:', this.mode);

            // 4. 创建音频处理链路
            if (this.mode === 'worklet') {
                await this._setupAudioWorklet();
            } else {
                await this._setupScriptProcessor();
            }

            // 4.5 如果使用 USB 音频，启动 USB 音频源
            // 注意：必须在连接节点之后启动，确保 ScriptProcessorNode 能触发回调
            if (this.inputSource === 'usb' && this.usbSource) {
                // USB 音频源应该在节点连接完成后启动
                // 但为了确保连接正确，我们在连接后再次检查
                console.log('[AudioIO] USB 音频源将在节点连接后启动');
            }

            this.isRunning = true;
            this.isInitialized = true;

            const initTime = performance.now() - startTime;
            const result = this.getLatencyInfo();

            console.log(' 启动成功:', {
                mode: this.mode,
                latency: result.totalLatency.toFixed(2) + 'ms',
                sampleRate: this.audioContext.sampleRate + 'Hz',
                initTime: initTime.toFixed(2) + 'ms'
            });
            console.groupEnd();

            // 触发状态变化回调
            this._notifyStateChange('started', result);

            return result;

        } catch (error) {
            console.error(' [AudioIO] 启动失败:', error);
            console.groupEnd();
            this._notifyError('start', error);
            throw error;
        }
    }

    /**
     * 停止音频系统
     */
    async stop() {
        if (!this.isRunning) {
            console.warn('[AudioIO] 音频系统未运行');
            return;
        }

        console.log('🛑 [AudioIO] 停止音频系统');

        try {
            // 停止 USB 音频源（如果使用）
            if (this.usbSource) {
                await this.usbSource.stop();
            }

            // 断开所有节点
            if (this.processorNode) {
                this.processorNode.disconnect();

                // 清理 ScriptProcessor 回调
                if (this.mode === 'script-processor') {
                    this.processorNode.onaudioprocess = null;
                }

                this.processorNode = null;
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            // 停止麦克风流
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            // 关闭 USB 接收器（如果使用）
            if (this.usbReceiver) {
                await this.usbReceiver.close();
            }

            this.isRunning = false;
            this._notifyStateChange('stopped', null);

            console.log(' [AudioIO] 已停止');

        } catch (error) {
            console.error(' [AudioIO] 停止时出错:', error);
            this._notifyError('stop', error);
        }
    }

    /**
     * 注册音频帧回调 (原始音频数据)
     * @param {Function} callback - (audioBuffer: Float32Array, timestamp: number) => void
     */
    onFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onFrame callback must be a function');
        }
        this.onFrameCallback = callback;
        console.log('[AudioIO] 已注册音频帧回调');
        return this;
    }

    /**
     * 注册音高检测回调 (仅 Worklet 模式)
     * @param {Function} callback - (pitchInfo: Object) => void
     */
    onPitchDetected(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onPitchDetected callback must be a function');
        }
        this.onPitchDetectedCallback = callback;
        console.log('[AudioIO] 已注册音高检测回调');
        return this;
    }

    /**
     *  注册 Worklet PitchFrame 专用回调
     * @param {Function} callback - (pitchFrame: PitchFrame, timestamp: number) => void
     */
    onWorkletPitchFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onWorkletPitchFrame callback must be a function');
        }
        this.onWorkletPitchFrameCallback = callback;
        console.log('[AudioIO]  已注册 Worklet PitchFrame 回调');
        return this;
    }

    /**
     * 注册错误回调
     * @param {Function} callback - (type: string, error: Error) => void
     */
    onError(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onError callback must be a function');
        }
        this.onErrorCallback = callback;
        return this;
    }

    /**
     * 注册状态变化回调
     * @param {Function} callback - (state: string, info: Object) => void
     */
    onStateChange(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onStateChange callback must be a function');
        }
        this.onStateChangeCallback = callback;
        return this;
    }

    /**
     * 获取延迟信息
     * @returns {Object} { bufferLatency, baseLatency, outputLatency, totalLatency }
     */
    getLatencyInfo() {
        if (!this.audioContext) {
            return {
                bufferLatency: 0,
                baseLatency: 0,
                outputLatency: 0,
                totalLatency: 0
            };
        }

        const bufferSize = this.mode === 'worklet'
            ? this.config.workletBufferSize
            : this.config.bufferSize;

        const bufferLatency = (bufferSize / this.audioContext.sampleRate) * 1000;
        const baseLatency = this.audioContext.baseLatency ?
            this.audioContext.baseLatency * 1000 : 0;
        const outputLatency = this.audioContext.outputLatency ?
            this.audioContext.outputLatency * 1000 : 0;

        return {
            mode: this.mode,
            bufferSize,
            sampleRate: this.audioContext.sampleRate,
            bufferLatency: parseFloat(bufferLatency.toFixed(2)),
            baseLatency: parseFloat(baseLatency.toFixed(2)),
            outputLatency: parseFloat(outputLatency.toFixed(2)),
            totalLatency: parseFloat((bufferLatency + baseLatency + outputLatency).toFixed(2))
        };
    }

    /**
     * 获取性能统计
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 销毁音频系统 (清理所有资源)
     */
    async destroy() {
        console.log('[AudioIO] 销毁音频系统');

        await this.stop();

        // 清理 USB 资源
        if (this.usbSource) {
            await this.usbSource.stop();
            this.usbSource = null;
        }

        if (this.usbReceiver) {
            await this.usbReceiver.close();
            this.usbReceiver = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
        console.log(' [AudioIO] 已销毁');
    }

    // ==================== 私有方法 ====================

    /**
     *  序列化配置并下发到 Worklet
     *
     *  关键修复: 将主线程集中式配置转换为 Worklet 可理解的参数
     * 避免 Worklet 使用硬编码值,确保配置一致性
     *
     * @private
     * @returns {Object} Worklet 配置对象
     */
    _serializeConfigForWorklet() {
        // 如果没有集中式配置,使用回退默认值
        if (!this.appConfig) {
            console.warn('[AudioIO]  未提供 appConfig,使用回退默认值');
            return {
                sampleRate: this.audioContext.sampleRate,
                algorithm: 'YIN',
                threshold: 0.1,  // YIN 算法内部阈值 (固定)
                clarityThreshold: 0.85,  // 音高置信度阈值
                minFrequency: 80,
                maxFrequency: 800,
                smoothingSize: 5,
                minVolumeThreshold: 0.01
            };
        }

        //  从集中式配置映射到 Worklet 参数
        const config = this.appConfig;
        const workletConfig = {
            // 基础参数
            sampleRate: this.audioContext.sampleRate,
            algorithm: 'YIN',

            // 音高检测参数 (从 config.pitchDetector 映射)
            threshold: 0.1,  // YIN 算法内部阈值 (固定,不暴露给用户)
            clarityThreshold: config.pitchDetector?.clarityThreshold ?? 0.85,
            minFrequency: config.pitchDetector?.minFrequency ?? 80,
            maxFrequency: config.pitchDetector?.maxFrequency ?? 800,

            // 平滑参数 (从 config.smoothing 映射)
            smoothingSize: 5,  // 中值滤波窗口 (固定)

            // 音量阈值 (从集中式配置读取)
            minVolumeThreshold: Number(config.pitchDetector?.minVolumeThreshold) || 0.0001,  // 🔥 强制转为数字并提供安全回退

            // 音高校正系数 (用于补偿采样率偏差或设备特性)
            frequencyCorrection: Number(config.pitchDetector?.frequencyCorrection) || 1.0,

            //  EMA 滤波器参数 (用于 Worklet 内部平滑)
            volumeAlpha: config.smoothing?.volume?.alpha ?? 0.3,
            brightnessAlpha: config.smoothing?.brightness?.alpha ?? 0.3,
            breathinessAlpha: 0.4,  // 固定值

            //  起音检测参数
            energyThreshold: config.onset?.energyThreshold ?? 3,
            silenceThreshold: config.onset?.silenceThreshold ?? -40,
            minStateDuration: config.onset?.attackDuration ?? 50,

            // Latency Profiler: 延迟分析标志 (Feature Flag)
            enableProfiling: window.__ENABLE_LATENCY_PROFILER__ || false
        };

        console.log('[AudioIO] 📋 配置映射完成:', {
            from: 'ConfigManager',
            to: 'Worklet',
            clarityThreshold: workletConfig.clarityThreshold,
            minFrequency: workletConfig.minFrequency,
            maxFrequency: workletConfig.maxFrequency,
            minVolumeThreshold: workletConfig.minVolumeThreshold,  //  调试日志
            energyThreshold: workletConfig.energyThreshold,
            silenceThreshold: workletConfig.silenceThreshold
        });

        return workletConfig;
    }

    /**
     * 初始化 AudioContext
     * @private
     */
    async _initializeAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('浏览器不支持 Web Audio API');
        }

        // 如果 AudioContext 已存在但采样率不匹配，需要重新创建
        if (this.audioContext && this.audioContext.sampleRate !== this.config.sampleRate) {
            console.warn(`[AudioIO] AudioContext 采样率不匹配 (${this.audioContext.sampleRate}Hz vs ${this.config.sampleRate}Hz)，将重新创建`);
            // 关闭旧的 AudioContext
            if (this.audioContext.state !== 'closed') {
                await this.audioContext.close();
            }
            this.audioContext = null;
        }

        // 如果 AudioContext 不存在，创建新的
        if (!this.audioContext) {
            this.audioContext = new AudioContextClass({
                latencyHint: this.config.latencyHint,
                sampleRate: this.config.sampleRate
            });

            // 确保 AudioContext 处于运行状态
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            console.log(' AudioContext 已创建:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state
            });
        } else {
            console.log(' AudioContext 已存在:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state
            });
        }
    }

    /**
     * 请求麦克风权限
     * @param {string|null} deviceId - 指定的输入设备 ID
     * @private
     * @throws {Error} 麦克风访问失败时抛出详细错误
     */
    async _requestMicrophone(deviceId = null) {
        // 检查浏览器支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                '浏览器不支持麦克风访问\n\n' +
                '请确认:\n' +
                '• 使用现代浏览器 (Chrome 66+, Firefox 76+, Safari 14.1+)\n' +
                '• 使用 HTTPS 连接或 localhost 环境'
            );
        }

        console.log(`🎤 请求麦克风权限... (Target DeviceID: ${deviceId || 'Default'})`);

        // 1. 准备音频约束 (理想配置: 低延迟, 无处理)
        const idealConstraints = {
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                latency: 0
            },
            video: false
        };

        // 2. 应用设备 ID
        if (deviceId && deviceId !== 'default') {
            idealConstraints.audio.deviceId = { exact: deviceId };
        }

        // 3. 尝试获取流 (带自动降级重试)
        try {
            console.log('[AudioIO] 尝试理想音频配置:', JSON.stringify(idealConstraints.audio));
            this.stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
        } catch (error) {
            console.warn('[AudioIO] 理想配置失败，尝试降级配置...', error.name);

            // 降级策略: 移除所有高级音频处理约束, 仅保留 deviceId (如果存在)
            const fallbackConstraints = {
                audio: true,
                video: false
            };

            if (deviceId && deviceId !== 'default') {
                fallbackConstraints.audio = { deviceId: { exact: deviceId } };
            }

            try {
                console.log('[AudioIO] 尝试安全(回退)配置:', JSON.stringify(fallbackConstraints.audio));
                this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                console.warn('[AudioIO]  已使用降级配置启动 (可能存在回声或延迟)');
            } catch (fallbackError) {
                // 错误处理 (保持原有逻辑)
                this._handleGetUserMediaError(fallbackError);
            }
        }

        // 检查是否成功获取流
        if (!this.stream || this.stream.getAudioTracks().length === 0) {
            throw new Error('获取麦克风流失败：未找到音频轨道');
        }

        // 创建音频源节点
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

        const track = this.stream.getAudioTracks()[0];
        const label = track.label || '默认设备';
        console.log(` 麦克风已连接: ${label} (State: ${track.readyState})`);
        
        // 双重检查: 轨道是否静音?
        if (track.muted) {
            console.warn('⚠️ 警告: 音频轨道处于 muted 状态 (可能是系统隐私设置拦截)');
        }
    }

    /**
     * 设置 USB 音频输入
     * @private
     */
    async _setupUsbAudio() {
        console.log('🔌 [AudioIO] 设置 USB 音频输入...');

        // 检查 Web Serial API 支持
        const UsbAudioReceiverClass = window.UsbAudioReceiver || (typeof UsbAudioReceiver !== 'undefined' ? UsbAudioReceiver : null);
        const UsbAudioSourceClass = window.UsbAudioSource || (typeof UsbAudioSource !== 'undefined' ? UsbAudioSource : null);

        if (!UsbAudioReceiverClass || !UsbAudioReceiverClass.isSupported()) {
            throw new Error(
                '浏览器不支持 Web Serial API\n\n' +
                '请使用支持 Web Serial API 的浏览器:\n' +
                '• Chrome 89+\n' +
                '• Edge 89+\n' +
                '• Opera 75+'
            );
        }

        if (!UsbAudioSourceClass) {
            throw new Error('UsbAudioSource 类未找到。请确保已加载 usb-audio-source.js');
        }

        // 创建 USB 音频接收器
        if (!this.usbReceiver) {
            this.usbReceiver = new UsbAudioReceiverClass({
                sampleRate: this.config.sampleRate || 48000,
                baudrate: 9216000,
                onFrame: (samples) => {
                    // USB 音频帧将通过 UsbAudioSource 转换为 Web Audio API 格式
                    // 这里不需要直接处理
                },
                onError: (error) => {
                    console.error('[AudioIO] USB 音频接收错误:', error);
                    this._notifyError('usb-receiver', error);
                },
                onStats: (stats) => {
                    if (this.config.debug) {
                        console.log('[AudioIO] USB 接收统计:', stats);
                    }
                }
            });
        }

        // 请求串口连接
        try {
            await this.usbReceiver.connect({
                baudRate: 9216000
            });
        } catch (error) {
            throw new Error(`USB 串口连接失败: ${error.message}`);
        }

        // 创建 USB 音频源
        // 注意：ScriptProcessorNode 需要至少 256 的缓冲区大小
        // 但为了与 WorkletNode 的 128 缓冲区匹配，我们使用 256（最接近的 2 的幂次方）
        // 这样可以减少缓冲区大小不匹配导致的问题
        // 实际上，ScriptProcessorNode 的最小值是 256，所以不能使用 128
        // 但 256 是 128 的 2 倍，Web Audio API 应该能自动处理
        const usbBufferSize = 256; // 固定使用 256（ScriptProcessorNode 的最小值）
        
        this.usbSource = new UsbAudioSourceClass(this.audioContext, this.usbReceiver, {
            sampleRate: this.config.sampleRate || 48000,
            bufferSize: usbBufferSize
        });

        // 使用 USB 音频源的输出节点作为 sourceNode
        this.sourceNode = this.usbSource.getOutputNode();

        console.log('✅ USB 音频输入已设置');
    }

    /**
     * 连接到指定的 USB 串口（如果已授权）
     * @param {SerialPort} port - 已授权的串口对象
     */
    async connectUsbPort(port) {
        const UsbAudioReceiverClass = window.UsbAudioReceiver || (typeof UsbAudioReceiver !== 'undefined' ? UsbAudioReceiver : null);
        const UsbAudioSourceClass = window.UsbAudioSource || (typeof UsbAudioSource !== 'undefined' ? UsbAudioSource : null);

        if (!UsbAudioReceiverClass) {
            const availableKeys = Object.keys(window).filter(k => k.toLowerCase().includes('usb')).join(', ');
            console.error('[AudioIO] 可用的全局对象:', availableKeys || '无');
            throw new Error('UsbAudioReceiver 类未找到。请确保已加载 usb-audio-receiver.js 脚本。');
        }

        if (!UsbAudioSourceClass) {
            const availableKeys = Object.keys(window).filter(k => k.toLowerCase().includes('usb')).join(', ');
            console.error('[AudioIO] 可用的全局对象:', availableKeys || '无');
            throw new Error('UsbAudioSource 类未找到。请确保已加载 usb-audio-source.js 脚本。');
        }

        if (!this.usbReceiver) {
            this.usbReceiver = new UsbAudioReceiverClass({
                sampleRate: this.config.sampleRate || 48000,
                baudrate: 9216000,
                onFrame: (samples) => {
                    // USB 音频帧将通过 UsbAudioSource 转换为 Web Audio API 格式
                },
                onError: (error) => {
                    console.error('[AudioIO] USB 音频接收错误:', error);
                    this._notifyError('usb-receiver', error);
                },
                onStats: (stats) => {
                    if (this.config.debug) {
                        console.log('[AudioIO] USB 接收统计:', stats);
                    }
                }
            });
        }

        await this.usbReceiver.connectToPort(port, {
            baudRate: 9216000
        });

        // 如果音频系统已运行，创建 USB 音频源
        if (this.audioContext && this.isRunning) {
            this.usbSource = new UsbAudioSourceClass(this.audioContext, this.usbReceiver, {
                sampleRate: this.config.sampleRate || 48000,
                bufferSize: this.config.workletBufferSize || 128
            });
            this.sourceNode = this.usbSource.getOutputNode();
            await this.usbSource.start();
        }
    }

    /**
     * 统一错误处理 helper
     */
    _handleGetUserMediaError(error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            throw new Error(
                '麦克风权限被拒绝\n\n' +
                '请允许浏览器访问麦克风:\n' +
                '• Chrome: 点击地址栏的 🔒 图标 → 网站设置 → 麦克风\n' +
                '• Firefox: 点击地址栏的 🔒 图标 → 权限 → 使用麦克风\n' +
                '• Safari: Safari 菜单 → 设置 → 网站 → 麦克风'
            );
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            throw new Error('未找到指定的麦克风设备。');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            throw new Error('无法读取麦克风数据 (设备可能被占用或硬件错误)。');
        } else if (error.name === 'OverconstrainedError') {
            throw new Error('麦克风不支持请求的配置 (采样率或设备ID无效)。');
        } else {
            throw new Error(`无法访问麦克风: ${error.message}`);
        }
    }

    /**
     * 设置 AudioWorklet 处理链路
     * @private
     */
    async _setupAudioWorklet() {
        console.log('⚙  设置 AudioWorklet 处理链路...');

        try {
            // 1. 加载 Worklet 模块
            const workletPath = 'js/pitch-worklet.js';
            console.log(' 加载 Worklet 模块:', workletPath);

            await this.audioContext.audioWorklet.addModule(workletPath);
            console.log(' Worklet 模块加载成功');

            // 2. 创建 AudioWorkletNode
            this.processorNode = new AudioWorkletNode(
                this.audioContext,
                'pitch-detector',
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [1]
                }
            );
            console.log(' AudioWorkletNode 已创建');

            // 3. 监听 Worklet 消息
            this.processorNode.port.onmessage = this._handleWorkletMessage.bind(this);

            // 4. 发送初始配置 ( 从 main.js 传入的集中式配置)
            //  关键修复: 将主线程配置序列化并下发到 Worklet
            const workletConfig = this._serializeConfigForWorklet();
            this.processorNode.port.postMessage({
                type: 'config',
                data: workletConfig
            });
            console.log('[AudioIO] 📤 配置已下发到 Worklet:', workletConfig);

            // 5. 连接节点链路
            //  仅用于音频分析，不连接到 destination (避免直接回放麦克风输入)
            // 合成器会单独连接到 destination 输出音色
            // 对于 USB 音频源，sourceNode 是 outputGain，需要连接到 processorNode
            if (this.inputSource === 'usb' && this.usbSource) {
                // USB 音频源：ScriptProcessorNode → processorNode → (静音 Gain) → destination
                // ScriptProcessorNode 必须连接到 destination 才能触发回调
                // 直接连接 ScriptProcessorNode 到 WorkletNode
                const usbOutputNode = this.usbSource.getOutputNode();
                usbOutputNode.connect(this.processorNode);
                
                // WorkletNode 也需要连接到 destination（通过静音 gain）才能工作
                const silentGain = this.audioContext.createGain();
                silentGain.gain.value = 0; // 静音
                this.processorNode.connect(silentGain);
                silentGain.connect(this.audioContext.destination);
                
                console.log('🔗 AudioWorklet 链路: USB ScriptProcessor → WorkletNode → SilentGain → Destination');
            } else {
                // 麦克风：sourceNode → processorNode
                this.sourceNode.connect(this.processorNode);
                console.log('🔗 AudioWorklet 链路: Mic → WorkletNode (分析用，不直接播放)');
            }

            console.log(' AudioWorklet 处理链路已建立');
            
            // 4.6 如果使用 USB 音频，现在启动 USB 音频源（在连接完成后）
            if (this.inputSource === 'usb' && this.usbSource && !this.usbSource.isRunning) {
                await this.usbSource.start();
                console.log('[AudioIO] ✅ USB 音频源已启动（在节点连接后）');
            }

        } catch (error) {
            console.error(' AudioWorklet 设置失败:', error);

            //  触发回退到 ScriptProcessor
            if (this.config.workletFallback !== false) {
                console.warn('  AudioWorklet 加载失败，自动回退到 ScriptProcessor 模式');
                console.warn('   原因:', error.message);
                console.warn('   影响: 延迟可能略高 (~46ms vs ~3ms)');
                this.mode = 'script-processor';
                await this._setupScriptProcessor();
            } else {
                throw error;
            }
        }
    }

    /**
     * 处理 Worklet 消息
     * @private
     */
    _handleWorkletMessage(event) {
        const { type, data, timestamp } = event.data;

        switch (type) {
            case 'ready':
                console.log('[AudioIO]  Worklet 已就绪, 采样率:', data.sampleRate);
                break;

            case 'pitch-detected':
                //  传递音高检测结果到专用回调
                if (this.onPitchDetectedCallback) {
                    this.onPitchDetectedCallback(data);
                }
                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;

            case 'pitch-frame':
                //  完整 PitchFrame 数据 (11 字段)
                // 使用 Worklet 提供的精确 timestamp (AudioContext.currentTime * 1000)
                const frameTimestamp = timestamp || performance.now();

                // Worklet 模式: 单一数据出口，避免重复处理
                if (this.onWorkletPitchFrameCallback) {
                    // 专用回调优先 (推荐)
                    this.onWorkletPitchFrameCallback(data, frameTimestamp);
                } else if (this.onFrameCallback) {
                    // Fallback: 如果未注册专用回调，使用通用 onFrame
                    console.warn('[AudioIO]  pitch-frame 未注册专用回调，使用 onFrame fallback');
                    this.onFrameCallback(data, frameTimestamp);
                }
                // 注意: 不再触发 onPitchDetectedCallback，避免双重处理

                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;

            case 'no-pitch':
                // 未检测到音高 (可选处理)
                if (this.config.debug && data) {
                    console.log('[AudioIO] 未检测到音高, 音量:', data.volume);
                }
                break;

            case 'test-ping':
                //  测试消息
                console.log('[AudioIO] Worklet Ping:', data);
                break;

            case 'stats':
                // 性能统计
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet Stats:', data);
                }
                this.stats = {
                    ...this.stats,
                    workletStats: data
                };
                break;

            case 'error':
                console.error('[AudioIO] Worklet 错误:', data);
                this._notifyError('worklet', new Error(data.message));
                break;

            case 'config-applied':
                console.log('[AudioIO] Worklet 配置已应用');
                break;

            case 'debug':
                // Worklet 调试信息
                console.log('[AudioIO] Worklet Debug:', data);
                break;

            default:
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet 消息:', type, data);
                }
        }
    }

    /**
     * 设置 ScriptProcessor 处理链路 (回退模式)
     * @private
     */
    async _setupScriptProcessor() {
        console.log('⚙  设置 ScriptProcessor 处理链路 (回退模式)...');

        this.processorNode = this.audioContext.createScriptProcessor(
            this.config.bufferSize,
            1, // 单声道输入
            1  // 单声道输出
        );

        // 设置音频处理回调
        this.processorNode.onaudioprocess = (event) => {
            if (!this.isRunning || !this.onFrameCallback) return;

            const startTime = performance.now();

            // 提取音频数据
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const audioBuffer = new Float32Array(inputBuffer);
            const timestamp = this.audioContext.currentTime;

            // 调用用户回调
            try {
                this.onFrameCallback(audioBuffer, timestamp);
            } catch (error) {
                console.error('[AudioIO] 音频帧处理错误:', error);
                this._notifyError('frame-processing', error);
            }

            // 性能统计
            const processingTime = performance.now() - startTime;
            this._updateStats(processingTime);
        };

        // 连接节点链路
        //  ScriptProcessor 需要连接到 destination 才能触发 onaudioprocess 回调
        // 使用静音的 GainNode 避免直接回放麦克风输入（防止回声）
        // 合成器会单独连接到 destination 输出音色
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;  // 静音（不播放输入）

        // 对于 USB 音频源，直接连接 ScriptProcessorNode 到 processorNode
        if (this.inputSource === 'usb' && this.usbSource) {
            // USB 音频源：ScriptProcessorNode → processorNode → silentGain → destination
            const usbOutputNode = this.usbSource.getOutputNode();
            usbOutputNode.connect(this.processorNode);
            console.log('🔗 ScriptProcessor 链路: USB ScriptProcessor → ProcessorNode → SilentGain → Destination');
        } else {
            // 麦克风：sourceNode → processorNode → silentGain → destination
            this.sourceNode.connect(this.processorNode);
            console.log('🔗 ScriptProcessor 链路: Mic → ProcessorNode → SilentGain → Destination');
        }
        
        this.processorNode.connect(silentGain);
        silentGain.connect(this.audioContext.destination);

        console.log(' ScriptProcessor 链路已建立 (静音连接，仅用于触发回调)');
    }

    /**
     * 检查浏览器是否支持 AudioWorklet
     * @private
     */
    _supportsAudioWorklet() {
        return typeof AudioWorkletNode !== 'undefined' &&
               'audioWorklet' in this.audioContext;
    }

    /**
     * 验证配置参数
     * @private
     */
    _validateConfig() {
        const { sampleRate, bufferSize, workletBufferSize } = this.config;

        if (sampleRate < 8000 || sampleRate > 96000) {
            console.warn('[AudioIO] 采样率超出推荐范围 (8000-96000Hz)');
        }

        if (![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) {
            console.warn('[AudioIO] ScriptProcessor buffer size 应为 2^n (256-16384)');
        }

        if (![128, 256, 512, 1024].includes(workletBufferSize)) {
            console.warn('[AudioIO] AudioWorklet buffer size 应为 128/256/512/1024');
        }
    }

    /**
     * 更新性能统计
     * @private
     */
    _updateStats(processingTime) {
        this.stats.framesProcessed++;
        this.stats.lastFrameTime = performance.now();

        // 计算移动平均处理时间
        const alpha = 0.1; // 平滑因子
        this.stats.avgProcessingTime =
            this.stats.avgProcessingTime * (1 - alpha) + processingTime * alpha;
    }

    /**
     * 通知状态变化
     * @private
     */
    _notifyStateChange(state, info) {
        if (this.onStateChangeCallback) {
            try {
                this.onStateChangeCallback(state, info);
            } catch (error) {
                console.error('[AudioIO] 状态变化回调错误:', error);
            }
        }
    }

    /**
     * 通知错误
     * @private
     */
    _notifyError(type, error) {
        if (this.onErrorCallback) {
            try {
                this.onErrorCallback(type, error);
            } catch (err) {
                console.error('[AudioIO] 错误回调本身出错:', err);
            }
        }
    }
}

// 注意: 不要在这里创建全局单例! 会导致双重实例化
// 每个使用者应该自己创建实例: new AudioIO()

// 兼容旧代码: 仅导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioIO };
}
