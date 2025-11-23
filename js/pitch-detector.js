/**
 * 音高检测模块
 * 使用YIN算法进行实时音高检测
 */

class PitchDetector {
    constructor() {
        this.detector = null;
        this.sampleRate = 44100;
        this.threshold = 0.1; // YIN算法阈值

        // 音高历史记录（用于平滑）
        this.pitchHistory = [];
        this.historySize = 5;

        // 音符映射表
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // 最小音量阈值（避免检测静音）
        this.minVolumeThreshold = 0.01;
    }

    /**
     * 初始化YIN检测器
     */
    initialize(sampleRate) {
        this.sampleRate = sampleRate;

        // 检查Pitchfinder库是否加载
        const PitchfinderLib = window.Pitchfinder || window.pitchfinder;

        if (!PitchfinderLib) {
            console.error('Pitchfinder library not loaded!');
            console.error('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('pitch')));
            throw new Error('音高检测库未加载，请检查网络连接或刷新页面');
        }

        // 使用pitchfinder库的YIN算法
        try {
            this.detector = PitchfinderLib.YIN({
                sampleRate: this.sampleRate,
                threshold: this.threshold
            });
            console.log('YIN pitch detector initialized successfully');
            console.log('Sample rate:', this.sampleRate);
            console.log('Threshold:', this.threshold);
        } catch (error) {
            console.error('Failed to create YIN detector:', error);
            throw new Error('无法创建音高检测器: ' + error.message);
        }
    }

    /**
     * 检测音频缓冲区的音高
     * @param {Float32Array} audioBuffer - 音频数据
     * @param {number} volume - 当前音量 (RMS)
     * @returns {Object|null} 音高信息对象或null
     */
    detect(audioBuffer, volume = null) {
        if (!this.detector) {
            console.warn('Detector not initialized');
            return null;
        }

        // 检查音量阈值
        if (volume !== null && volume < this.minVolumeThreshold) {
            return null;
        }

        // 使用YIN算法检测音高
        const frequency = this.detector(audioBuffer);

        if (frequency && frequency > 0 && frequency < 2000) {
            // 添加到历史记录
            this.pitchHistory.push(frequency);
            if (this.pitchHistory.length > this.historySize) {
                this.pitchHistory.shift();
            }

            // 计算平滑后的频率
            const smoothedFrequency = this.getSmoothedPitch();

            // 转换为音符信息
            const noteInfo = this.frequencyToNote(smoothedFrequency);

            return {
                frequency: smoothedFrequency,
                rawFrequency: frequency,
                note: noteInfo.note,
                octave: noteInfo.octave,
                cents: noteInfo.cents,
                confidence: this.calculateConfidence(audioBuffer, frequency),
                volume: volume
            };
        }

        return null;
    }

    /**
     * 获取平滑后的音高（中值滤波）
     */
    getSmoothedPitch() {
        if (this.pitchHistory.length === 0) return 0;

        // 使用中值滤波减少抖动
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
     * @param {number} frequency - 频率 (Hz)
     * @returns {Object} 音符信息
     */
    frequencyToNote(frequency) {
        // A4 = 440 Hz 为参考
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75); // C0 frequency

        // 计算与C0的半音差
        const halfSteps = 12 * Math.log2(frequency / C0);
        const roundedHalfSteps = Math.round(halfSteps);

        // 计算音符和八度
        const noteIndex = roundedHalfSteps % 12;
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
     * 将音符转换为频率
     * @param {string} note - 音符 (如 "A4", "C#5")
     * @returns {number} 频率 (Hz)
     */
    noteToFrequency(note) {
        const A4 = 440;
        const noteRegex = /^([A-G]#?)(\d+)$/;
        const match = note.match(noteRegex);

        if (!match) return 0;

        const noteName = match[1];
        const octave = parseInt(match[2]);

        const noteIndex = this.noteNames.indexOf(noteName);
        if (noteIndex === -1) return 0;

        // 计算与A4的半音差
        const halfStepsFromA4 = (octave - 4) * 12 + (noteIndex - 9);

        // 计算频率
        const frequency = A4 * Math.pow(2, halfStepsFromA4 / 12);

        return frequency;
    }

    /**
     * 计算检测置信度
     * @param {Float32Array} audioBuffer - 音频数据
     * @param {number} frequency - 检测到的频率
     * @returns {number} 置信度 (0-1)
     */
    calculateConfidence(audioBuffer, frequency) {
        // 🔥 修复抖动: 统一置信度算法，与Worklet保持一致

        if (!frequency || frequency <= 0) return 0;
        if (!audioBuffer || audioBuffer.length === 0) return 0;

        // 计算 RMS (均方根) 音量
        let sumSquares = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            sumSquares += audioBuffer[i] * audioBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / audioBuffer.length);

        // 🔥 修复: 使用与Worklet相同的阈值范围，避免间歇性检测丢失
        // 最小阈值: 与 config.pitchDetector.minVolumeThreshold 保持一致
        // 最大阈值: 0.1 (匹配Worklet，避免算法不一致)
        const minRMS = this.minVolumeThreshold;  // 使用类属性（可从配置注入）
        const maxRMS = 0.1;                       // 匹配Worklet算法

        let confidence = (rms - minRMS) / (maxRMS - minRMS);
        confidence = Math.max(0, Math.min(1, confidence));

        // 人声范围增强 (与Worklet一致)
        if (frequency >= 80 && frequency <= 800) {
            confidence = Math.min(confidence * 1.2, 1);
        }

        return confidence;
    }

    /**
     * 量化音高到最近的半音
     * @param {number} frequency - 原始频率
     * @returns {number} 量化后的频率
     */
    quantizePitch(frequency) {
        const noteInfo = this.frequencyToNote(frequency);
        return this.noteToFrequency(noteInfo.fullNote);
    }

    /**
     * 清空音高历史
     */
    reset() {
        this.pitchHistory = [];
    }

    /**
     * 设置音量阈值
     */
    setVolumeThreshold(threshold) {
        this.minVolumeThreshold = threshold;
    }

    /**
     * 设置平滑度
     */
    setSmoothingSize(size) {
        this.historySize = Math.max(1, Math.min(20, size));
    }

    /**
     * 获取音高范围的音符列表
     * @param {number} minFreq - 最低频率
     * @param {number} maxFreq - 最高频率
     * @returns {Array} 音符列表
     */
    getNoteRange(minFreq, maxFreq) {
        const minNote = this.frequencyToNote(minFreq);
        const maxNote = this.frequencyToNote(maxFreq);

        const notes = [];
        const minOctave = minNote.octave;
        const maxOctave = maxNote.octave;

        for (let octave = minOctave; octave <= maxOctave; octave++) {
            for (let i = 0; i < 12; i++) {
                const fullNote = `${this.noteNames[i]}${octave}`;
                const freq = this.noteToFrequency(fullNote);

                if (freq >= minFreq && freq <= maxFreq) {
                    notes.push({
                        note: fullNote,
                        frequency: freq
                    });
                }
            }
        }

        return notes;
    }
}

// Instance managed by AppContainer (no global instance created here)
