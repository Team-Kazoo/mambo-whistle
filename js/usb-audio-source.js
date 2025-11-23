/**
 * USB Audio Source Node
 * 
 * 将 USB 串口接收的音频数据转换为 Web Audio API AudioBufferSourceNode
 * 提供与麦克风输入相同的接口，可以无缝集成到现有的音频处理链路中
 */

class UsbAudioSource {
    /**
     * USB 音频源
     * 
     * @param {AudioContext} audioContext - Web Audio API 上下文
     * @param {UsbAudioReceiver} receiver - USB 音频接收器实例
     * @param {Object} options - 配置选项
     * @param {number} options.sampleRate - 采样率 (Hz)
     * @param {number} options.bufferSize - 缓冲区大小（样本数）
     */
    constructor(audioContext, receiver, options = {}) {
        this.audioContext = audioContext;
        this.receiver = receiver;
        this.sampleRate = options.sampleRate || audioContext.sampleRate;
        
        // ScriptProcessorNode 要求缓冲区大小必须是 256-16384 之间的 2 的幂次方
        // 如果传入的值小于 256，使用 256；如果大于 16384，使用 16384
        let requestedSize = options.bufferSize || 256;
        if (requestedSize < 256) {
            requestedSize = 256;
        } else if (requestedSize > 16384) {
            requestedSize = 16384;
        }
        
        // 确保是 2 的幂次方（向上取整到最近的 2 的幂次方）
        this.bufferSize = Math.pow(2, Math.ceil(Math.log2(requestedSize)));

        // 音频缓冲区队列（环形缓冲区）
        this.bufferQueue = [];
        this.readIndex = 0;
        this.writeIndex = 0;
        this.queueMaxSize = 10; // 最大队列长度

        // ScriptProcessorNode（用于实时音频输出）
        this.scriptProcessor = null;
        this.outputGain = null;

        this.isRunning = false;

        // 统计信息
        this.stats = {
            framesReceived: 0,
            framesPlayed: 0,
            underruns: 0,
            overruns: 0
        };

        // 绑定接收器回调
        this.receiver.onFrame = this._onFrame.bind(this);
    }

    /**
     * 启动音频源
     */
    async start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.bufferQueue = [];
        this.readIndex = 0;
        this.writeIndex = 0;
        this.stats = {
            framesReceived: 0,
            framesPlayed: 0,
            underruns: 0,
            overruns: 0
        };

        console.log('[UsbAudioSource] 启动音频源');
        console.log(`  采样率: ${this.sampleRate} Hz`);
        console.log(`  缓冲区大小: ${this.bufferSize} 样本`);

        // 初始化 ScriptProcessorNode（如果尚未初始化）
        this._initializeScriptProcessor();
        

        // 启动接收器（如果尚未启动）
        if (!this.receiver.isRunning) {
            await this.receiver.start();
        }

        console.log('[UsbAudioSource] 音频源已启动');
    }

    /**
     * 停止音频源
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // 断开 ScriptProcessorNode
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor.onaudioprocess = null;
            this.scriptProcessor = null;
        }

        // 清空队列
        this.bufferQueue = [];
        this.readIndex = 0;
        this.writeIndex = 0;

        console.log('[UsbAudioSource] 音频源已停止');
    }

    /**
     * 初始化 ScriptProcessorNode（不启动接收器）
     * 用于在连接节点之前创建 ScriptProcessorNode
     */
    _initializeScriptProcessor() {
        if (this.scriptProcessor) {
            return; // 已经初始化
        }

        // 创建输出增益节点
        if (!this.outputGain) {
            this.outputGain = this.audioContext.createGain();
            this.outputGain.gain.value = 1.0;
        }

        // 创建 ScriptProcessorNode 用于实时音频输出
        this.scriptProcessor = this.audioContext.createScriptProcessor(
            this.bufferSize,
            0, // 无输入（我们手动填充数据）
            1  // 单声道输出
        );

        // 设置音频处理回调
        this.scriptProcessor.onaudioprocess = (event) => {
            const outputBuffer = event.outputBuffer;
            const outputData = outputBuffer.getChannelData(0);
            
            if (!this.isRunning) {
                // 如果未启动，输出静音
                for (let i = 0; i < outputData.length; i++) {
                    outputData[i] = 0;
                }
                return;
            }

            // 从队列中读取数据并填充输出缓冲区
            // 可能需要合并多个小帧来填满 ScriptProcessorNode 的缓冲区（256 样本）
            let outputIndex = 0;
            while (outputIndex < outputData.length && this.bufferQueue.length > 0) {
                const frame = this.bufferQueue[0];
                const remaining = outputData.length - outputIndex;
                const copyLength = Math.min(frame.length, remaining);
                
                // 复制数据到输出缓冲区
                for (let i = 0; i < copyLength; i++) {
                    outputData[outputIndex + i] = frame[i];
                }
                
                outputIndex += copyLength;
                
                // 如果当前帧已完全使用，移除它
                if (copyLength >= frame.length) {
                    this.bufferQueue.shift();
                } else {
                    // 如果只使用了部分数据，更新队列中的帧
                    this.bufferQueue[0] = frame.slice(copyLength);
                }
            }
            
            // 如果数据不足，用零填充
            for (let i = outputIndex; i < outputData.length; i++) {
                outputData[i] = 0;
            }

            if (outputIndex > 0) {
                this.stats.framesPlayed++;
            } else {
                // 队列为空，记录下溢
                this.stats.underruns++;
            }
            
            // 计算音量（RMS）
            let sumSquares = 0;
            for (let i = 0; i < outputData.length; i++) {
                sumSquares += outputData[i] * outputData[i];
            }
            const rms = Math.sqrt(sumSquares / outputData.length);
            const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
            
            // 音量统计（仅用于内部统计，不输出日志）
            this.stats.lastRMS = rms;
            this.stats.lastDB = db;
        };
    }

    /**
     * 获取输出节点（用于连接到其他音频节点）
     * @returns {ScriptProcessorNode} ScriptProcessorNode 本身（直接输出音频数据）
     */
    getOutputNode() {
        // 如果 ScriptProcessorNode 尚未创建，先初始化它
        if (!this.scriptProcessor) {
            this._initializeScriptProcessor();
        }
        return this.scriptProcessor;
    }
    
    /**
     * 获取增益节点（用于音量控制，可选）
     * @returns {GainNode} 增益节点
     */
    getGainNode() {
        if (!this.outputGain) {
            this.outputGain = this.audioContext.createGain();
            this.outputGain.gain.value = 1.0;
        }
        return this.outputGain;
    }

    /**
     * 获取统计信息
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            queueLength: this.bufferQueue.length
        };
    }

    /**
     * 处理接收到的音频帧
     * @private
     * @param {Int16Array} samples - 16 位 PCM 音频样本
     */
    _onFrame(samples) {
        if (!this.isRunning) {
            return;
        }

        // 将 Int16Array 转换为 Float32Array（Web Audio API 格式）
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            // 将 int16 (-32768 到 32767) 归一化到 float32 (-1.0 到 1.0)
            // 注意：使用 32768.0 而不是 32767.0 以确保范围正确
            floatSamples[i] = Math.max(-1.0, Math.min(1.0, samples[i] / 32768.0));
        }

        // 如果采样率不匹配，需要重采样
        let processedSamples = floatSamples;
        if (this.sampleRate !== this.audioContext.sampleRate) {
            processedSamples = this._resample(floatSamples, this.sampleRate, this.audioContext.sampleRate);
        }

        // 计算原始音频的音量（用于调试）
        let sumSquares = 0;
        for (let i = 0; i < processedSamples.length; i++) {
            sumSquares += processedSamples[i] * processedSamples[i];
        }
        const rms = Math.sqrt(sumSquares / processedSamples.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
        
        // 将样本直接加入队列（不按缓冲区大小分块）
        // 因为 USB 音频帧可能很小（如 60 样本），而 ScriptProcessorNode 缓冲区是 256
        // 我们需要累积多个小帧来填充 ScriptProcessorNode 的缓冲区
        if (processedSamples.length > 0) {
            // 检查队列是否已满
            if (this.bufferQueue.length >= this.queueMaxSize) {
                // 队列已满，丢弃最旧的数据
                this.bufferQueue.shift();
                this.stats.overruns++;
            }
            
            this.bufferQueue.push(processedSamples);
            this.stats.framesReceived++;
        }
        
        // 记录接收统计（不输出日志）
        this.stats.lastReceivedRMS = rms;
        this.stats.lastReceivedDB = db;
    }


    /**
     * 简单的线性重采样（用于采样率转换）
     * @private
     * @param {Float32Array} input - 输入音频数据
     * @param {number} inputSampleRate - 输入采样率
     * @param {number} outputSampleRate - 输出采样率
     * @returns {Float32Array} 重采样后的音频数据
     */
    _resample(input, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate) {
            return input;
        }

        const ratio = outputSampleRate / inputSampleRate;
        const outputLength = Math.round(input.length * ratio);
        const output = new Float32Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
            const srcIndex = i / ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
            const fraction = srcIndex - srcIndexFloor;

            // 线性插值
            output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
        }

        return output;
    }
}

// 导出到全局作用域（用于非模块环境）
if (typeof window !== 'undefined') {
    window.UsbAudioSource = UsbAudioSource;
}

// 导出类（用于模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UsbAudioSource };
}

