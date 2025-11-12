/**
 * 性能监控模块
 * 监控延迟、帧率和系统性能
 *
 * 增强:
 * - 支持 AudioWorklet 模式指标
 * - 记录处理器类型 (worklet/script-processor)
 * - Worklet 性能统计集成
 */

class PerformanceMonitor {
    constructor() {
        // 性能指标
        this.metrics = {
            latency: {
                audio: 0,      // 音频系统延迟
                processing: 0,  // 处理延迟
                total: 0        // 总延迟
            },
            fps: 0,             // 检测帧率
            frameCount: 0,
            lastFrameTime: 0,
            bufferSize: 0,
            sampleRate: 0,
            //  AudioWorklet 指标
            mode: 'unknown',    // 'worklet' | 'script-processor'
            workletStats: null  // Worklet 性能统计
        };

        // FPS计算
        this.fpsHistory = [];
        this.fpsHistorySize = 30;

        // 处理时间测量
        this.processingStartTime = 0;
        this.processingTimes = [];
        this.processingHistorySize = 50;

        // 更新回调
        this.onMetricsUpdate = null;
    }

    /**
     * 初始化性能监控
     * @param {AudioContext} audioContext - 音频上下文
     * @param {number} bufferSize - 缓冲大小
     * @param {string} mode - 处理器模式 ('worklet' | 'script-processor')
     */
    initialize(audioContext, bufferSize, mode = 'script-processor') {
        this.metrics.bufferSize = bufferSize;
        this.metrics.sampleRate = audioContext.sampleRate;
        this.metrics.mode = mode;

        // 计算音频缓冲延迟
        this.metrics.latency.audio = this.calculateAudioLatency(audioContext, bufferSize);

        console.log('Performance monitor initialized:', {
            mode: mode,
            bufferSize: bufferSize,
            sampleRate: this.metrics.sampleRate,
            audioLatency: this.metrics.latency.audio.toFixed(2) + 'ms'
        });
    }

    /**
     * 更新 Worklet 统计信息
     * @param {Object} workletStats - Worklet 性能统计
     */
    updateWorkletStats(workletStats) {
        this.metrics.workletStats = workletStats;
    }

    /**
     * 计算音频系统延迟
     */
    calculateAudioLatency(audioContext, bufferSize) {
        // 缓冲延迟
        const bufferLatency = (bufferSize / audioContext.sampleRate) * 1000;

        // 系统延迟
        const baseLatency = audioContext.baseLatency ?
            audioContext.baseLatency * 1000 : 0;

        const outputLatency = audioContext.outputLatency ?
            audioContext.outputLatency * 1000 : 0;

        return bufferLatency + baseLatency + outputLatency;
    }

    /**
     * 开始处理时间测量
     */
    startProcessing() {
        this.processingStartTime = performance.now();
    }

    /**
     * 结束处理时间测量
     */
    endProcessing() {
        if (this.processingStartTime === 0) return;

        const processingTime = performance.now() - this.processingStartTime;
        this.processingTimes.push(processingTime);

        if (this.processingTimes.length > this.processingHistorySize) {
            this.processingTimes.shift();
        }

        // 计算平均处理延迟
        this.metrics.latency.processing = this.getAverageProcessingTime();

        // 计算总延迟
        this.metrics.latency.total = this.metrics.latency.audio +
                                     this.metrics.latency.processing;

        this.processingStartTime = 0;
    }

    /**
     * 获取平均处理时间
     */
    getAverageProcessingTime() {
        if (this.processingTimes.length === 0) return 0;

        const sum = this.processingTimes.reduce((a, b) => a + b, 0);
        return sum / this.processingTimes.length;
    }

    /**
     * 更新帧率
     */
    updateFPS() {
        const now = performance.now();

        if (this.metrics.lastFrameTime > 0) {
            const delta = now - this.metrics.lastFrameTime;
            const fps = 1000 / delta;

            this.fpsHistory.push(fps);

            if (this.fpsHistory.length > this.fpsHistorySize) {
                this.fpsHistory.shift();
            }

            // 计算平均FPS
            this.metrics.fps = this.getAverageFPS();
        }

        this.metrics.lastFrameTime = now;
        this.metrics.frameCount++;
    }

    /**
     * 获取平均FPS
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 0;

        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.fpsHistory.length);
    }

    /**
     * 获取所有性能指标
     */
    getMetrics() {
        return {
            totalLatency: this.metrics.latency.total.toFixed(2),
            audioLatency: this.metrics.latency.audio.toFixed(2),
            processingLatency: this.metrics.latency.processing.toFixed(2),
            fps: this.metrics.fps,
            bufferSize: this.metrics.bufferSize,
            sampleRate: this.metrics.sampleRate,
            //  新增字段
            mode: this.metrics.mode,
            workletStats: this.metrics.workletStats
        };
    }

    /**
     * 检查性能是否良好
     */
    isPerformanceGood() {
        return this.metrics.latency.total < 50 && // 总延迟 < 50ms
               this.metrics.fps > 30;               // FPS > 30
    }

    /**
     * 获取性能等级
     */
    getPerformanceRating() {
        const latency = this.metrics.latency.total;

        if (latency < 20) {
            return { rating: 'excellent', color: '#10b981', text: '优秀' };
        } else if (latency < 50) {
            return { rating: 'good', color: '#3b82f6', text: '良好' };
        } else if (latency < 100) {
            return { rating: 'fair', color: '#f59e0b', text: '一般' };
        } else {
            return { rating: 'poor', color: '#ef4444', text: '较差' };
        }
    }

    /**
     * 获取性能建议
     */
    getPerformanceSuggestions() {
        const suggestions = [];

        if (this.metrics.latency.total > 50) {
            suggestions.push('延迟较高，建议使用有线耳机');
        }

        if (this.metrics.fps < 30) {
            suggestions.push('帧率较低，建议关闭其他应用程序');
        }

        if (this.metrics.latency.audio > 30) {
            suggestions.push('音频系统延迟较高，尝试减小缓冲区大小');
        }

        return suggestions;
    }

    /**
     * 重置统计数据
     */
    reset() {
        this.metrics.frameCount = 0;
        this.metrics.lastFrameTime = 0;
        this.fpsHistory = [];
        this.processingTimes = [];
    }

    /**
     * 启动自动更新
     */
    startAutoUpdate(interval = 1000) {
        this.stopAutoUpdate();

        this.updateInterval = setInterval(() => {
            if (this.onMetricsUpdate) {
                this.onMetricsUpdate(this.getMetrics());
            }
        }, interval);
    }

    /**
     * 停止自动更新
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * 获取诊断信息
     */
    getDiagnostics() {
        return {
            metrics: this.getMetrics(),
            rating: this.getPerformanceRating(),
            suggestions: this.getPerformanceSuggestions(),
            history: {
                fpsHistory: [...this.fpsHistory],
                processingHistory: [...this.processingTimes]
            }
        };
    }
}

// Step 2 Layer 2: 移除全局实例创建
// 实例现在由 AppContainer 统一管理
// 旧代码: const performanceMonitor = new PerformanceMonitor();
//
// 为向后兼容，在 main.js 中通过 window.performanceMonitor 暴露容器实例
export { PerformanceMonitor };
