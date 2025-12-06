/**
 * 延迟测试器
 * 
 * 通过互相关分析比较 USB 音频设备和普通麦克风的端到端延迟差异
 * 
 * 工作原理：
 * 1. 同时采集两路音频输入（USB 设备 + 普通麦克风）
 * 2. 检测到明显峰值（如敲击声）时，截取分析窗口
 * 3. 使用互相关算法找到两路信号的最佳对齐点
 * 4. 计算延迟差异并统计
 */

class LatencyTester {
    constructor() {
        // 音频上下文
        this.audioContext = null;
        
        // USB 音频输入
        this.usbReceiver = null;
        this.usbConnected = false;
        
        // 麦克风输入
        this.micStream = null;
        this.micConnected = false;
        this.micProcessor = null;
        
        // 采样率
        this.usbSampleRate = 48000;
        this.micSampleRate = 44100; // 实际可能由设备决定
        this.targetSampleRate = 48000; // 统一目标采样率
        
        // 音频缓冲区（环形缓冲区）
        this.bufferDuration = 2000; // 2秒缓冲
        this.usbBuffer = null;
        this.micBuffer = null;
        this.usbWriteIndex = 0;
        this.micWriteIndex = 0;
        
        // 时间戳缓冲（与音频缓冲对应）
        this.usbTimestamps = null;
        this.micTimestamps = null;
        
        // 测试状态
        this.isRunning = false;
        this.lastPeakTime = 0;
        this.peakCooldown = 300; // 峰值检测冷却时间(ms) - 降低以提高灵敏度
        
        // 峰值检测状态（双通道独立检测）
        this.usbPeakDetected = false;
        this.micPeakDetected = false;
        this.usbPeakTime = 0;
        this.micPeakTime = 0;
        this.peakWindow = 100; // 两个通道峰值需要在此时间窗口内
        
        // 配置参数
        this.config = {
            threshold: 0.15,        // 峰值检测阈值
            windowSize: 512,        // 分析窗口大小(ms)
            maxLag: 100,            // 最大搜索延迟范围(ms)
        };
        
        // 测量结果
        this.measurements = [];
        this.maxMeasurements = 100;
        
        // UI 元素
        this.elements = {};
        
        // 绘图优化
        this.animationId = null;
        this.lastRenderTime = 0;
        this.renderInterval = 33; // ~30fps，降低渲染负担
        this.canvasSizes = {}; // 缓存 canvas 尺寸
        
        // 互相关计算队列（避免阻塞主线程）
        this.correlationPending = false;
        
        // 实时音量显示
        this.usbRMS = 0;
        this.micRMS = 0;
        
        // 调试
        this.debug = false;
    }

    /**
     * 初始化测试器
     */
    async init() {
        this.log('初始化延迟测试器...');
        
        // 获取 UI 元素
        this.cacheElements();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化画布
        this.initCanvases();
        
        // 启动渲染循环
        this.startRenderLoop();
        
        this.log('延迟测试器初始化完成');
    }

    /**
     * 缓存 UI 元素引用
     */
    cacheElements() {
        this.elements = {
            // 按钮
            btnConnectUsb: document.getElementById('btn-connect-usb'),
            btnConnectMic: document.getElementById('btn-connect-mic'),
            btnStartTest: document.getElementById('btn-start-test'),
            btnStopTest: document.getElementById('btn-stop-test'),
            btnClearData: document.getElementById('btn-clear-data'),
            
            // 状态指示器
            usbStatusIndicator: document.getElementById('usb-status-indicator'),
            micStatusIndicator: document.getElementById('mic-status-indicator'),
            
            // 设备信息
            deviceInfo: document.getElementById('device-info'),
            usbInfo: document.getElementById('usb-info'),
            micInfo: document.getElementById('mic-info'),
            usbLevel: document.getElementById('usb-level'),
            micLevel: document.getElementById('mic-level'),
            
            // 配置控件
            thresholdSlider: document.getElementById('threshold-slider'),
            thresholdValue: document.getElementById('threshold-value'),
            windowSize: document.getElementById('window-size'),
            
            // 统计显示
            statAvg: document.getElementById('stat-avg'),
            statStd: document.getElementById('stat-std'),
            statMin: document.getElementById('stat-min'),
            statMax: document.getElementById('stat-max'),
            statCount: document.getElementById('stat-count'),
            statLatest: document.getElementById('stat-latest'),
            latencyDirection: document.getElementById('latency-direction'),
            
            // 画布
            waveformUsb: document.getElementById('waveform-usb'),
            waveformMic: document.getElementById('waveform-mic'),
            correlationChart: document.getElementById('correlation-chart'),
            historyChart: document.getElementById('history-chart'),
            
            // 其他
            correlationStatus: document.getElementById('correlation-status'),
            historyCount: document.getElementById('history-count'),
            historyList: document.getElementById('history-list'),
        };
    }

    /**
     * 绑定事件处理
     */
    bindEvents() {
        // USB 连接
        this.elements.btnConnectUsb.addEventListener('click', () => this.connectUsb());
        
        // 麦克风连接
        this.elements.btnConnectMic.addEventListener('click', () => this.connectMicrophone());
        
        // 开始/停止测试
        this.elements.btnStartTest.addEventListener('click', () => this.startTest());
        this.elements.btnStopTest.addEventListener('click', () => this.stopTest());
        
        // 清除数据
        this.elements.btnClearData.addEventListener('click', () => this.clearData());
        
        // 阈值滑块
        this.elements.thresholdSlider.addEventListener('input', (e) => {
            this.config.threshold = parseFloat(e.target.value);
            this.elements.thresholdValue.textContent = this.config.threshold.toFixed(2);
        });
        
        // 窗口大小
        this.elements.windowSize.addEventListener('change', (e) => {
            this.config.windowSize = parseInt(e.target.value);
        });
    }

    /**
     * 初始化画布
     */
    initCanvases() {
        // 设置画布分辨率并缓存尺寸
        const canvasIds = ['waveformUsb', 'waveformMic', 'correlationChart', 'historyChart'];
        
        canvasIds.forEach(id => {
            const canvas = this.elements[id];
            if (canvas) {
                this.setupCanvas(canvas, id);
            }
        });
        
        // 窗口大小变化时重新初始化（防抖）
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                canvasIds.forEach(id => {
                    const canvas = this.elements[id];
                    if (canvas) {
                        this.setupCanvas(canvas, id);
                    }
                });
            }, 100);
        });
    }

    /**
     * 设置单个画布并缓存尺寸
     */
    setupCanvas(canvas, id) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        // 缓存尺寸，避免每帧调用 getBoundingClientRect
        this.canvasSizes[id] = {
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * 初始化音频上下文
     */
    async initAudioContext() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: this.targetSampleRate
            });
            
            // 确保上下文运行
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.log(`AudioContext 初始化: ${this.audioContext.sampleRate}Hz`);
            
            // 初始化缓冲区
            const bufferSize = Math.floor(this.bufferDuration / 1000 * this.targetSampleRate);
            this.usbBuffer = new Float32Array(bufferSize);
            this.micBuffer = new Float32Array(bufferSize);
            this.usbTimestamps = new Float64Array(bufferSize);
            this.micTimestamps = new Float64Array(bufferSize);
            
        } catch (error) {
            this.log('AudioContext 初始化失败: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * 连接 USB 音频设备
     */
    async connectUsb() {
        try {
            this.updateUsbStatus('connecting');
            
            // 检查 Web Serial API 支持
            if (!UsbAudioReceiver.isSupported()) {
                throw new Error('浏览器不支持 Web Serial API');
            }
            
            // 初始化音频上下文
            await this.initAudioContext();
            
            // 创建接收器
            this.usbReceiver = new UsbAudioReceiver({
                sampleRate: this.usbSampleRate,
                baudrate: 9216000,
                onFrame: (samples) => this.onUsbFrame(samples),
                onError: (error) => this.log('USB 错误: ' + error.message, 'error')
            });
            
            // 请求连接
            await this.usbReceiver.connect();
            await this.usbReceiver.start();
            
            this.usbConnected = true;
            this.updateUsbStatus('connected');
            this.elements.btnConnectUsb.textContent = '已连接';
            this.elements.btnConnectUsb.disabled = true;
            
            this.elements.deviceInfo.classList.remove('hidden');
            this.elements.usbInfo.textContent = `USB: ${this.usbSampleRate}Hz`;
            
            this.checkReadyState();
            this.log('USB 设备已连接');
            
        } catch (error) {
            this.updateUsbStatus('error');
            this.log('USB 连接失败: ' + error.message, 'error');
            alert('USB 连接失败: ' + error.message);
        }
    }

    /**
     * 连接普通麦克风
     */
    async connectMicrophone() {
        try {
            this.updateMicStatus('connecting');
            
            // 初始化音频上下文
            await this.initAudioContext();
            
            // 请求麦克风权限
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0
                }
            });
            
            // 获取实际采样率
            const track = this.micStream.getAudioTracks()[0];
            const settings = track.getSettings();
            this.micSampleRate = settings.sampleRate || this.audioContext.sampleRate;
            
            // 创建音频源
            const source = this.audioContext.createMediaStreamSource(this.micStream);
            
            // 创建脚本处理器
            const bufferSize = 2048;
            this.micProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            
            this.micProcessor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                this.onMicFrame(new Float32Array(inputData));
            };
            
            // 连接节点（不连接到目的地，仅用于处理）
            source.connect(this.micProcessor);
            this.micProcessor.connect(this.audioContext.destination);
            
            // 静音输出（避免回声）
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;
            this.micProcessor.disconnect();
            this.micProcessor.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            this.micConnected = true;
            this.updateMicStatus('connected');
            this.elements.btnConnectMic.textContent = '已连接';
            this.elements.btnConnectMic.disabled = true;
            
            this.elements.deviceInfo.classList.remove('hidden');
            this.elements.micInfo.textContent = `MIC: ${this.micSampleRate}Hz`;
            
            this.checkReadyState();
            this.log(`麦克风已连接: ${track.label}`);
            
        } catch (error) {
            this.updateMicStatus('error');
            this.log('麦克风连接失败: ' + error.message, 'error');
            alert('麦克风连接失败: ' + error.message);
        }
    }

    /**
     * USB 音频帧处理
     */
    onUsbFrame(samples) {
        if (!this.usbBuffer) return;
        
        const now = performance.now();
        
        // 将 Int16 转换为 Float32 并写入缓冲区
        for (let i = 0; i < samples.length; i++) {
            const floatSample = samples[i] / 32768.0;
            this.usbBuffer[this.usbWriteIndex] = floatSample;
            this.usbTimestamps[this.usbWriteIndex] = now;
            this.usbWriteIndex = (this.usbWriteIndex + 1) % this.usbBuffer.length;
        }
        
        // 峰值检测
        if (this.isRunning) {
            this.detectPeak(samples, 'usb', now);
        }
    }

    /**
     * 麦克风音频帧处理
     */
    onMicFrame(samples) {
        if (!this.micBuffer) return;
        
        const now = performance.now();
        const audioContextTime = this.audioContext ? this.audioContext.currentTime : 0;
        
        // 写入缓冲区
        for (let i = 0; i < samples.length; i++) {
            this.micBuffer[this.micWriteIndex] = samples[i];
            this.micTimestamps[this.micWriteIndex] = now;
            this.micWriteIndex = (this.micWriteIndex + 1) % this.micBuffer.length;
        }
        
        // 峰值检测
        if (this.isRunning) {
            this.detectPeak(samples, 'mic', now);
        }
    }

    /**
     * 峰值检测（双通道独立检测）
     */
    detectPeak(samples, source, timestamp) {
        // 冷却期内不检测
        if (timestamp - this.lastPeakTime < this.peakCooldown) {
            return;
        }
        
        // 计算 RMS
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
            const sample = typeof samples[i] === 'number' ? samples[i] : samples[i] / 32768.0;
            sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        
        // 更新实时音量（用于 UI 显示）
        if (source === 'usb') {
            this.usbRMS = rms;
        } else {
            this.micRMS = rms;
        }
        
        // 检测是否超过阈值
        if (rms > this.config.threshold) {
            if (source === 'usb' && !this.usbPeakDetected) {
                this.usbPeakDetected = true;
                this.usbPeakTime = timestamp;
                this.log(`峰值检测 [USB]: RMS=${rms.toFixed(3)}`);
            } else if (source === 'mic' && !this.micPeakDetected) {
                this.micPeakDetected = true;
                this.micPeakTime = timestamp;
                this.log(`峰值检测 [MIC]: RMS=${rms.toFixed(3)}`);
            }
            
            // 检查两个通道是否都检测到了峰值（在时间窗口内）
            this.checkDualChannelPeak(timestamp);
        }
    }

    /**
     * 检查双通道峰值并触发分析
     */
    checkDualChannelPeak(timestamp) {
        if (!this.usbPeakDetected || !this.micPeakDetected) {
            return;
        }
        
        // 检查两个峰值是否在时间窗口内
        const timeDiff = Math.abs(this.usbPeakTime - this.micPeakTime);
        if (timeDiff > this.peakWindow) {
            // 超出窗口，重置较早的那个
            if (this.usbPeakTime < this.micPeakTime) {
                this.usbPeakDetected = false;
            } else {
                this.micPeakDetected = false;
            }
            return;
        }
        
        // 两个通道都检测到峰值，触发分析
        this.lastPeakTime = timestamp;
        this.usbPeakDetected = false;
        this.micPeakDetected = false;
        
        this.log('双通道峰值确认，开始互相关分析...');
        
        // 使用 setTimeout 避免阻塞音频处理
        if (!this.correlationPending) {
            this.correlationPending = true;
            setTimeout(() => {
                this.performCorrelationAnalysis();
                this.correlationPending = false;
            }, 20);
        }
    }

    /**
     * 执行互相关分析（优化版）
     */
    performCorrelationAnalysis() {
        if (!this.usbBuffer || !this.micBuffer) {
            this.log('缓冲区未初始化', 'warn');
            return;
        }
        
        const startTime = performance.now();
        
        // 使用较小的分析窗口和降采样来加速计算
        const windowMs = Math.min(this.config.windowSize, 300); // 最大 300ms
        const downsampleFactor = 4; // 降采样因子
        const effectiveSampleRate = this.targetSampleRate / downsampleFactor;
        
        const windowSamples = Math.floor(windowMs / 1000 * this.targetSampleRate);
        const maxLagSamples = Math.floor(this.config.maxLag / 1000 * effectiveSampleRate);
        
        // 提取并降采样
        const usbWindow = this.extractAndDownsample(this.usbBuffer, this.usbWriteIndex, windowSamples, downsampleFactor);
        const micWindow = this.extractAndDownsample(this.micBuffer, this.micWriteIndex, windowSamples, downsampleFactor);
        
        // 归一化
        const usbNorm = this.normalize(usbWindow);
        const micNorm = this.normalize(micWindow);
        
        // 计算互相关（使用优化算法）
        const correlation = this.crossCorrelateFast(usbNorm, micNorm, maxLagSamples);
        
        // 找到最大相关位置
        let maxCorr = -Infinity;
        let maxLagIdx = 0;
        for (let i = 0; i < correlation.length; i++) {
            if (correlation[i] > maxCorr) {
                maxCorr = correlation[i];
                maxLagIdx = i;
            }
        }
        
        // 转换为毫秒（考虑降采样）
        const maxLag = maxLagIdx - maxLagSamples;
        const latencyMs = (maxLag / effectiveSampleRate) * 1000;
        
        const computeTime = performance.now() - startTime;
        
        // 检查相关系数是否足够高（降低阈值以提高成功率）
        if (maxCorr < 0.2) {
            this.log(`相关系数过低: ${maxCorr.toFixed(3)}，跳过此次测量 (耗时 ${computeTime.toFixed(1)}ms)`, 'warn');
            this.elements.correlationStatus.textContent = `相关系数过低: ${maxCorr.toFixed(3)}`;
            return;
        }
        
        // 记录测量结果
        this.addMeasurement({
            timestamp: performance.now(),
            latencyMs: latencyMs,
            correlation: maxCorr,
            lagSamples: maxLag
        });
        
        // 更新 UI
        this.updateStats();
        this.drawCorrelation(correlation, maxLagIdx);
        this.updateHistory();
        
        this.elements.correlationStatus.textContent = `相关系数: ${maxCorr.toFixed(3)} (${computeTime.toFixed(0)}ms)`;
        
        this.log(`测量完成: 延迟=${latencyMs.toFixed(2)}ms, 相关=${maxCorr.toFixed(3)}, 耗时=${computeTime.toFixed(1)}ms`);
    }

    /**
     * 提取窗口并降采样
     */
    extractAndDownsample(buffer, writeIndex, windowSize, factor) {
        const outputSize = Math.floor(windowSize / factor);
        const output = new Float32Array(outputSize);
        const startIndex = (writeIndex - windowSize + buffer.length) % buffer.length;
        
        for (let i = 0; i < outputSize; i++) {
            // 取每个区间的平均值
            let sum = 0;
            for (let j = 0; j < factor; j++) {
                const idx = (startIndex + i * factor + j) % buffer.length;
                sum += buffer[idx];
            }
            output[i] = sum / factor;
        }
        
        return output;
    }

    /**
     * 快速互相关（优化版）
     */
    crossCorrelateFast(signal1, signal2, maxLag) {
        const n = signal1.length;
        const result = new Float32Array(2 * maxLag + 1);
        
        // 使用步进式计算减少运算量
        for (let lag = -maxLag; lag <= maxLag; lag++) {
            let sum = 0;
            let count = 0;
            
            // 使用步进 2 加速（牺牲一点精度换取速度）
            const step = lag === 0 ? 1 : 2;
            
            for (let i = 0; i < n; i += step) {
                const j = i + lag;
                if (j >= 0 && j < n) {
                    sum += signal1[i] * signal2[j];
                    count++;
                }
            }
            
            result[lag + maxLag] = count > 0 ? sum / count : 0;
        }
        
        return result;
    }

    /**
     * 归一化信号
     */
    normalize(signal) {
        // 减去均值
        let mean = 0;
        for (let i = 0; i < signal.length; i++) {
            mean += signal[i];
        }
        mean /= signal.length;
        
        const normalized = new Float32Array(signal.length);
        let sumSquares = 0;
        
        for (let i = 0; i < signal.length; i++) {
            normalized[i] = signal[i] - mean;
            sumSquares += normalized[i] * normalized[i];
        }
        
        // 除以标准差
        const std = Math.sqrt(sumSquares / signal.length);
        if (std > 0) {
            for (let i = 0; i < normalized.length; i++) {
                normalized[i] /= std;
            }
        }
        
        return normalized;
    }

    /**
     * 添加测量结果
     */
    addMeasurement(measurement) {
        this.measurements.push(measurement);
        
        // 限制最大数量
        if (this.measurements.length > this.maxMeasurements) {
            this.measurements.shift();
        }
    }

    /**
     * 更新统计显示
     */
    updateStats() {
        if (this.measurements.length === 0) return;
        
        const latencies = this.measurements.map(m => m.latencyMs);
        
        // 计算统计值
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const min = Math.min(...latencies);
        const max = Math.max(...latencies);
        
        // 标准差
        const squaredDiffs = latencies.map(l => Math.pow(l - avg, 2));
        const std = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / latencies.length);
        
        // 最新值
        const latest = latencies[latencies.length - 1];
        
        // 更新 UI
        this.elements.statAvg.textContent = avg.toFixed(1);
        this.elements.statStd.textContent = std.toFixed(1);
        this.elements.statMin.textContent = min.toFixed(1);
        this.elements.statMax.textContent = max.toFixed(1);
        this.elements.statCount.textContent = this.measurements.length;
        
        // 最新值
        const latestSpan = this.elements.statLatest.querySelector('span') || this.elements.statLatest;
        latestSpan.textContent = latest.toFixed(1);
        latestSpan.className = latest > 0 ? 'text-accent-cyan' : latest < 0 ? 'text-accent-purple' : 'text-green-400';
        
        // 延迟方向说明
        let directionText = '';
        let directionClass = '';
        if (Math.abs(latest) < 1) {
            directionText = '两者延迟相当';
            directionClass = 'latency-equal';
        } else if (latest > 0) {
            directionText = `USB 设备快 ${Math.abs(latest).toFixed(1)}ms`;
            directionClass = 'latency-usb-faster';
        } else {
            directionText = `普通麦克风快 ${Math.abs(latest).toFixed(1)}ms`;
            directionClass = 'latency-mic-faster';
        }
        
        this.elements.latencyDirection.textContent = directionText;
        this.elements.latencyDirection.className = `text-xs text-center mt-2 ${directionClass}`;
        
        // 添加更新动画
        [this.elements.statAvg, this.elements.statStd].forEach(el => {
            el.classList.add('stat-value-update');
            setTimeout(() => el.classList.remove('stat-value-update'), 300);
        });
    }

    /**
     * 更新历史记录
     */
    updateHistory() {
        // 更新计数
        this.elements.historyCount.textContent = `${this.measurements.length} 次测量`;
        
        // 更新列表
        const listHtml = this.measurements.slice().reverse().slice(0, 20).map((m, i) => {
            const time = new Date(m.timestamp).toLocaleTimeString();
            const latency = m.latencyMs.toFixed(1);
            const latencyClass = m.latencyMs > 0 ? 'text-accent-cyan' : m.latencyMs < 0 ? 'text-accent-purple' : 'text-green-400';
            const isNew = i === 0 ? 'history-item-new' : '';
            
            return `<div class="history-item ${isNew}">
                <span class="text-slate-500">${time}</span>
                <span class="${latencyClass}">${latency}ms</span>
            </div>`;
        }).join('');
        
        this.elements.historyList.innerHTML = listHtml || '<div class="text-slate-600 text-center py-4">暂无测量数据</div>';
        
        // 绘制历史图表
        this.drawHistoryChart();
    }

    /**
     * 绘制波形（优化版）
     */
    drawWaveforms() {
        this.drawWaveform('waveformUsb', this.usbBuffer, this.usbWriteIndex, '#06b6d4', this.usbRMS);
        this.drawWaveform('waveformMic', this.micBuffer, this.micWriteIndex, '#a855f7', this.micRMS);
    }

    /**
     * 绘制单个波形（使用缓存尺寸）
     */
    drawWaveform(canvasId, buffer, writeIndex, color, rms) {
        const canvas = this.elements[canvasId];
        if (!canvas || !buffer) return;
        
        const size = this.canvasSizes[canvasId];
        if (!size) return;
        
        const ctx = canvas.getContext('2d');
        const width = size.width;
        const height = size.height;
        
        // 清除画布
        ctx.fillStyle = 'rgba(15, 18, 25, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制波形 - 使用降采样减少绘制点数
        const displaySamples = Math.floor(0.5 * this.targetSampleRate); // 显示 500ms
        const maxPoints = Math.min(width, 400); // 最多绘制 400 个点
        const samplesPerPoint = Math.ceil(displaySamples / maxPoints);
        const startIndex = (writeIndex - displaySamples + buffer.length) % buffer.length;
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        for (let i = 0; i < maxPoints; i++) {
            // 对每个点取最大绝对值（保留峰值信息）
            let maxSample = 0;
            for (let j = 0; j < samplesPerPoint; j++) {
                const sampleIndex = (startIndex + i * samplesPerPoint + j) % buffer.length;
                const sample = buffer[sampleIndex];
                if (Math.abs(sample) > Math.abs(maxSample)) {
                    maxSample = sample;
                }
            }
            
            const x = (i / maxPoints) * width;
            const y = height / 2 - maxSample * height * 0.4;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // 绘制中心线
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 绘制阈值线
        const thresholdY = height / 2 - this.config.threshold * height * 0.4;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(width, thresholdY);
        ctx.moveTo(0, height - thresholdY);
        ctx.lineTo(width, height - thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 绘制实时音量条（右侧）
        if (rms !== undefined) {
            const barWidth = 4;
            const barHeight = Math.min(rms * height * 2, height - 10);
            const barX = width - barWidth - 5;
            const barY = height / 2 - barHeight / 2;
            
            // 背景
            ctx.fillStyle = 'rgba(100, 116, 139, 0.2)';
            ctx.fillRect(barX, 5, barWidth, height - 10);
            
            // 音量条
            const gradient = ctx.createLinearGradient(barX, height / 2 + barHeight / 2, barX, height / 2 - barHeight / 2);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, rms > this.config.threshold ? '#ef4444' : color);
            ctx.fillStyle = gradient;
            ctx.fillRect(barX, barY, barWidth, barHeight);
        }
    }

    /**
     * 绘制互相关图
     */
    drawCorrelation(correlation, peakIndex) {
        const canvas = this.elements.correlationChart;
        if (!canvas) return;
        
        const size = this.canvasSizes['correlationChart'];
        if (!size) return;
        
        const ctx = canvas.getContext('2d');
        const width = size.width;
        const height = size.height;
        
        // 清除画布
        ctx.fillStyle = 'rgba(15, 18, 25, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制相关曲线
        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        
        const maxVal = Math.max(...Array.from(correlation).map(Math.abs));
        
        for (let i = 0; i < correlation.length; i++) {
            const x = (i / (correlation.length - 1)) * width;
            const y = height / 2 - (correlation[i] / maxVal) * height * 0.4;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // 绘制中心线
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 标记峰值位置
        if (peakIndex >= 0 && peakIndex < correlation.length) {
            const peakX = (peakIndex / (correlation.length - 1)) * width;
            const peakY = height / 2 - (correlation[peakIndex] / maxVal) * height * 0.4;
            
            ctx.beginPath();
            ctx.fillStyle = '#22c55e';
            ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制峰值垂直线
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.lineWidth = 1;
            ctx.moveTo(peakX, 0);
            ctx.lineTo(peakX, height);
            ctx.stroke();
        }
    }

    /**
     * 绘制历史图表
     */
    drawHistoryChart() {
        const canvas = this.elements.historyChart;
        if (!canvas || this.measurements.length === 0) return;
        
        const size = this.canvasSizes['historyChart'];
        if (!size) return;
        
        const ctx = canvas.getContext('2d');
        const width = size.width;
        const height = size.height;
        
        // 清除画布
        ctx.fillStyle = 'rgba(15, 18, 25, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        const latencies = this.measurements.map(m => m.latencyMs);
        const maxAbs = Math.max(Math.abs(Math.min(...latencies)), Math.abs(Math.max(...latencies)), 50);
        
        // 绘制网格
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        
        // 水平线
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        
        // 中心线（0ms）
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 绘制数据点和线
        if (latencies.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < latencies.length; i++) {
                const x = (i / (latencies.length - 1)) * width;
                const y = height / 2 - (latencies[i] / maxAbs) * height * 0.4;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        // 绘制数据点
        latencies.forEach((latency, i) => {
            const x = (i / Math.max(latencies.length - 1, 1)) * width;
            const y = height / 2 - (latency / maxAbs) * height * 0.4;
            
            ctx.beginPath();
            ctx.fillStyle = latency > 0 ? '#06b6d4' : latency < 0 ? '#a855f7' : '#22c55e';
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // 绘制 Y 轴标签
        ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`+${maxAbs.toFixed(0)}ms`, 5, 12);
        ctx.fillText(`-${maxAbs.toFixed(0)}ms`, 5, height - 5);
    }

    /**
     * 检查是否准备就绪
     */
    checkReadyState() {
        const isReady = this.usbConnected && this.micConnected;
        
        this.elements.btnStartTest.disabled = !isReady;
        if (isReady) {
            this.elements.btnStartTest.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    /**
     * 开始测试
     */
    startTest() {
        if (!this.usbConnected || !this.micConnected) {
            alert('请先连接两个音频设备');
            return;
        }
        
        this.isRunning = true;
        this.lastPeakTime = 0;
        
        // 更新 UI
        this.elements.btnStartTest.classList.add('hidden');
        this.elements.btnStopTest.classList.remove('hidden');
        this.elements.btnStopTest.disabled = false;
        
        this.log('测试已开始，请敲击桌面或拍手...');
    }

    /**
     * 停止测试
     */
    stopTest() {
        this.isRunning = false;
        
        // 更新 UI
        this.elements.btnStopTest.classList.add('hidden');
        this.elements.btnStartTest.classList.remove('hidden');
        
        this.log('测试已停止');
    }

    /**
     * 清除数据
     */
    clearData() {
        this.measurements = [];
        this.updateStats();
        this.updateHistory();
        
        // 重置统计显示
        this.elements.statAvg.textContent = '--';
        this.elements.statStd.textContent = '--';
        this.elements.statMin.textContent = '--';
        this.elements.statMax.textContent = '--';
        this.elements.statCount.textContent = '0';
        this.elements.statLatest.innerHTML = '<span class="text-slate-600">--</span><span class="text-sm text-slate-500 ml-1">ms</span>';
        this.elements.latencyDirection.textContent = '等待测量...';
        this.elements.latencyDirection.className = 'text-xs text-center mt-2 text-slate-500';
        
        // 清除历史图表
        const canvas = this.elements.historyChart;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const size = this.canvasSizes['historyChart'];
            if (size) {
                ctx.fillStyle = 'rgba(15, 18, 25, 0.5)';
                ctx.fillRect(0, 0, size.width, size.height);
            }
        }
        
        this.log('数据已清除');
    }

    /**
     * 更新 USB 状态指示器
     */
    updateUsbStatus(status) {
        const indicator = this.elements.usbStatusIndicator;
        indicator.className = 'w-3 h-3 rounded-full';
        
        switch (status) {
            case 'connected':
                indicator.classList.add('status-connected');
                break;
            case 'connecting':
                indicator.classList.add('status-connecting');
                break;
            case 'error':
                indicator.classList.add('status-error');
                break;
            default:
                indicator.classList.add('bg-slate-600');
        }
    }

    /**
     * 更新麦克风状态指示器
     */
    updateMicStatus(status) {
        const indicator = this.elements.micStatusIndicator;
        indicator.className = 'w-3 h-3 rounded-full';
        
        switch (status) {
            case 'connected':
                indicator.classList.add('status-connected');
                break;
            case 'connecting':
                indicator.classList.add('status-connecting');
                break;
            case 'error':
                indicator.classList.add('status-error');
                break;
            default:
                indicator.classList.add('bg-slate-600');
        }
    }

    /**
     * 启动渲染循环（带帧率限制）
     */
    startRenderLoop() {
        const render = (timestamp) => {
            // 帧率限制
            if (timestamp - this.lastRenderTime >= this.renderInterval) {
                this.lastRenderTime = timestamp;
                
                if (this.usbBuffer && this.micBuffer) {
                    this.drawWaveforms();
                }
                
                // 更新 RMS 显示
                this.updateLevelDisplays();
            }
            
            this.animationId = requestAnimationFrame(render);
        };
        render(0);
    }

    /**
     * 更新音量电平显示
     */
    updateLevelDisplays() {
        if (this.elements.usbLevel && this.usbConnected) {
            const levelText = this.usbRMS > 0.001 ? this.usbRMS.toFixed(3) : '--';
            const isHot = this.usbRMS > this.config.threshold;
            this.elements.usbLevel.textContent = `RMS: ${levelText}`;
            this.elements.usbLevel.className = `text-xs font-mono ${isHot ? 'text-red-400' : 'text-slate-500'}`;
        }
        
        if (this.elements.micLevel && this.micConnected) {
            const levelText = this.micRMS > 0.001 ? this.micRMS.toFixed(3) : '--';
            const isHot = this.micRMS > this.config.threshold;
            this.elements.micLevel.textContent = `RMS: ${levelText}`;
            this.elements.micLevel.className = `text-xs font-mono ${isHot ? 'text-red-400' : 'text-slate-500'}`;
        }
    }

    /**
     * 停止渲染循环
     */
    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 日志输出
     */
    log(message, level = 'info') {
        const prefix = '[LatencyTester]';
        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }

    /**
     * 销毁测试器
     */
    destroy() {
        this.stopRenderLoop();
        this.stopTest();
        
        if (this.usbReceiver) {
            this.usbReceiver.close();
        }
        
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.LatencyTester = LatencyTester;
}

