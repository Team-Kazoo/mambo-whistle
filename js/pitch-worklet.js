/**
 * AudioWorklet Pitch Detector Processor
 *
 * 🚀 Optimized Version:
 * - Integrated Radix-2 FFT (Cooley-Tukey) - O(N log N) vs O(N^2)
 * - Efficient Buffer Management
 * - Low Latency YIN Algorithm
 *
 * Features:
 * - Real-time Pitch Detection (YIN)
 * - Spectral Features (Brightness, Breathiness) via FFT
 * - Onset/Articulation Detection
 * - Full PitchFrame Generation
 */

/**
 * ⚡ FastFFT - Radix-2 Cooley-Tukey Implementation
 * 
 * Replaces the naive O(N^2) DFT.
 * Performance: ~100x faster for N=1024
 */
class FastFFT {
    constructor(size = 1024) {
        this.size = size;
        this.halfSize = size / 2;
        
        // Precompute sine/cosine tables
        this.sinTable = new Float32Array(size);
        this.cosTable = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            this.sinTable[i] = Math.sin(-2 * Math.PI * i / size);
            this.cosTable[i] = Math.cos(-2 * Math.PI * i / size);
        }
        
        // Precompute bit-reversal table
        this.reverseTable = new Uint32Array(size);
        let limit = 1;
        let bit = size >> 1;
        
        while (limit < size) {
            for (let i = 0; i < limit; i++) {
                this.reverseTable[i + limit] = this.reverseTable[i] + bit;
            }
            limit <<= 1;
            bit >>= 1;
        }

        // Working buffers
        this.real = new Float32Array(size);
        this.imag = new Float32Array(size);
        this.powerSpectrum = new Float32Array(this.halfSize);
    }

    /**
     * Compute Power Spectrum
     * @param {Float32Array} input - Time domain signal
     */
    computePowerSpectrum(input) {
        const size = this.size;
        const real = this.real;
        const imag = this.imag;
        
        // 1. Bit-reversal permutation & Copy input
        for (let i = 0; i < size; i++) {
            const rev = this.reverseTable[i];
            real[rev] = input[i];
            imag[rev] = 0;
        }
        
        // 2. Cooley-Tukey Butterfly Operations
        let halfSize = 1;
        
        while (halfSize < size) {
            const phaseStep = size / (halfSize * 2);
            
            for (let i = 0; i < halfSize; i++) {
                // Trigonometric lookups
                const tableIdx = i * phaseStep;
                const cos = this.cosTable[tableIdx];
                const sin = this.sinTable[tableIdx];
                
                for (let j = i; j < size; j += halfSize * 2) {
                    const k = j + halfSize;
                    
                    const tReal = real[k] * cos - imag[k] * sin;
                    const tImag = real[k] * sin + imag[k] * cos;
                    
                    real[k] = real[j] - tReal;
                    imag[k] = imag[j] - tImag;
                    
                    real[j] += tReal;
                    imag[j] += tImag;
                }
            }
            halfSize <<= 1;
        }
        
        // 3. Compute Magnitude Squared (Power)
        // Only first N/2 bins are needed (Nyquist)
        for (let i = 0; i < this.halfSize; i++) {
            this.powerSpectrum[i] = real[i] * real[i] + imag[i] * imag[i];
        }
        
        return this.powerSpectrum;
    }

    computeSpectralCentroid(powerSpectrum, sampleRate) {
        let weightedSum = 0;
        let totalPower = 0;
        const binWidth = sampleRate / this.size;

        for (let k = 0; k < this.halfSize; k++) {
            if (powerSpectrum[k] > 1e-10) {
                weightedSum += k * binWidth * powerSpectrum[k];
                totalPower += powerSpectrum[k];
            }
        }

        return totalPower > 0 ? weightedSum / totalPower : 0;
    }

    computeSpectralFlatness(powerSpectrum) {
        let geometricLogSum = 0;
        let arithmeticSum = 0;
        let count = 0;

        for (let k = 0; k < this.halfSize; k++) {
            const p = powerSpectrum[k];
            if (p > 1e-10) {
                geometricLogSum += Math.log(p);
                arithmeticSum += p;
                count++;
            }
        }

        if (count === 0 || arithmeticSum === 0) return 0;

        const geometricMean = Math.exp(geometricLogSum / count);
        const arithmeticMean = arithmeticSum / count;

        return geometricMean / arithmeticMean;
    }
}

/**
 *  EMA 滤波器 (指数移动平均)
 */
class EMAFilter {
    constructor(alpha = 0.3) {
        this.alpha = alpha;
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
 */
class SimpleOnsetDetector {
    constructor(config = {}) {
        this.energyThreshold = config.energyThreshold ?? 3;
        this.historySize = config.historySize ?? 5;
        this.silenceThreshold = config.silenceThreshold ?? -40;
        this.minStateDuration = config.minStateDuration ?? 50;

        this.energyHistory = [];
        this.currentState = 'silence';
        this.lastStateChange = 0;
        this.frameCount = 0;
    }

    detect(volumeDb, currentTime) {
        this.frameCount++;

        this.energyHistory.push(volumeDb);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const energyIncrease = volumeDb - avgEnergy;

        const timeSinceChange = (currentTime - this.lastStateChange) * 1000;
        const canChangeState = timeSinceChange >= this.minStateDuration;

        let newState = this.currentState;

        switch (this.currentState) {
            case 'silence':
                if (volumeDb > this.silenceThreshold) {
                    if (energyIncrease > this.energyThreshold || volumeDb > -20) {
                        newState = 'attack';
                    } else {
                        newState = 'sustain';
                    }
                }
                break;
            case 'attack':
                if (canChangeState) newState = 'sustain';
                break;
            case 'sustain':
                if (volumeDb < this.silenceThreshold + 10) newState = 'release';
                break;
            case 'release':
                if (volumeDb < this.silenceThreshold) newState = 'silence';
                else if (volumeDb > this.silenceThreshold + 15) newState = 'sustain';
                break;
        }

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
        console.log('[PitchWorklet] Worklet Processor Created');

        this.config = {
            sampleRate: sampleRate,
            algorithm: 'YIN',
            threshold: 0.15,
            clarityThreshold: 0.85,
            minFrequency: 80,
            maxFrequency: 800,
            smoothingSize: 5,
            minVolumeThreshold: 0.001,
            frequencyCorrection: 1.0  // 音高校正系数，默认无校正
        };

        this.detector = this._createYINDetector(this.config);
        this.pitchHistory = [];
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Buffer optimization: 1024 samples (~23ms)
        this.accumulationBuffer = new Float32Array(1024);
        this.accumulationIndex = 0;
        this.accumulationFull = false;

        // Use optimized FastFFT
        this.fft = new FastFFT(1024);

        this.volumeFilter = new EMAFilter(0.3);
        this.brightnessFilter = new EMAFilter(0.3);
        this.breathinessFilter = new EMAFilter(0.4);

        this.onsetDetector = new SimpleOnsetDetector({
            energyThreshold: 3,
            silenceThreshold: -40,
            minStateDuration: 50
        });

        this.stats = {
            framesProcessed: 0,
            pitchDetections: 0,
            fftComputations: 0,
            startTime: currentTime,
            lastReportTime: currentTime,
            processingTimes: [],
            maxProcessingTime: 0
        };

        this.port.onmessage = this._handleMessage.bind(this);
        
        this.port.postMessage({
            type: 'ready',
            data: { sampleRate: this.config.sampleRate }
        });
    }

    _createYINDetector(config) {
        const threshold = config.threshold || 0.1;
        const probabilityThreshold = 0.1;
        const sampleRate = config.sampleRate;

        return function detectPitch(buffer) {
            if (!buffer || buffer.length < 2) return null;

            const yinBufferSize = Math.floor(buffer.length / 2);
            const yinBuffer = new Float32Array(yinBufferSize);

            let delta;
            for (let t = 0; t < yinBufferSize; t++) yinBuffer[t] = 0;

            for (let t = 1; t < yinBufferSize; t++) {
                for (let i = 0; i < yinBufferSize; i++) {
                    delta = buffer[i] - buffer[i + t];
                    yinBuffer[t] += delta * delta;
                }
            }

            yinBuffer[0] = 1;
            let runningSum = 0;
            for (let t = 1; t < yinBufferSize; t++) {
                runningSum += yinBuffer[t];
                yinBuffer[t] *= t / runningSum;
            }

            let tau = -1;
            for (let t = 2; t < yinBufferSize; t++) {
                if (yinBuffer[t] < threshold) {
                    while (t + 1 < yinBufferSize && yinBuffer[t + 1] < yinBuffer[t]) t++;
                    tau = t;
                    break;
                }
            }

            if (tau === -1) return null;

            let betterTau;
            const x0 = (tau < 1) ? tau : tau - 1;
            const x2 = (tau + 1 < yinBufferSize) ? tau + 1 : tau;

            if (x0 === tau) betterTau = (yinBuffer[tau] <= yinBuffer[x2]) ? tau : x2;
            else if (x2 === tau) betterTau = (yinBuffer[tau] <= yinBuffer[x0]) ? tau : x0;
            else {
                const s0 = yinBuffer[x0];
                const s1 = yinBuffer[tau];
                const s2 = yinBuffer[x2];
                betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }

            const frequency = sampleRate / betterTau;
            if ((1 - yinBuffer[tau]) < probabilityThreshold) return null;

            return frequency;
        };
    }

    process(inputs, outputs, parameters) {
        const startTime = currentTime;
        const input = inputs[0];
        if (!input || !input[0]) {
            // 调试：检查输入是否为空
            if (this.stats.framesProcessed % 1000 === 0) {
                this.port.postMessage({
                    type: 'debug',
                    data: { message: 'No input data', inputsLength: inputs.length, input0Length: input ? input.length : 0 }
                });
            }
            return true;
        }

        const audioBuffer = input[0];
        
        // 调试：检查音频缓冲区是否为空或全零（更详细的检查）
        if (this.stats.framesProcessed % 1000 === 0) {
            let sum = 0;
            let maxAbs = 0;
            for (let i = 0; i < audioBuffer.length; i++) {
                const abs = Math.abs(audioBuffer[i]);
                sum += abs;
                if (abs > maxAbs) maxAbs = abs;
            }
            const avg = sum / audioBuffer.length;
            if (sum === 0 || avg < 0.000001) {
                this.port.postMessage({
                    type: 'debug',
                    data: { 
                        message: 'Audio buffer is empty or all zeros', 
                        bufferLength: audioBuffer.length,
                        sum: sum,
                        avg: avg,
                        maxAbs: maxAbs
                    }
                });
            } else {
                // 有数据时也报告一次，确认数据流正常
                this.port.postMessage({
                    type: 'debug',
                    data: { 
                        message: 'Audio buffer has data', 
                        bufferLength: audioBuffer.length,
                        sum: sum,
                        avg: avg.toFixed(6),
                        maxAbs: maxAbs.toFixed(6)
                    }
                });
            }
        }
        
        try {
            const volume = this._calculateRMS(audioBuffer);
            this._accumulateAudio(audioBuffer);

            if (this.accumulationFull) {
                if (volume >= this.config.minVolumeThreshold) {
                    const frequency = this.detector(this.accumulationBuffer);

                    if (frequency && frequency >= 20 && frequency <= 2000) {
                        // 应用音高校正系数
                        const correctedFrequency = frequency * (this.config.frequencyCorrection || 1.0);
                        this.pitchHistory.push(correctedFrequency);
                        if (this.pitchHistory.length > this.config.smoothingSize) this.pitchHistory.shift();

                        const smoothedFrequency = this._getSmoothedPitch();
                        const noteInfo = this._frequencyToNote(smoothedFrequency);
                        const confidence = this._calculateConfidence(this.accumulationBuffer, frequency, volume);

                        // Compute FFT Features (Optimized)
                        const powerSpectrum = this.fft.computePowerSpectrum(this.accumulationBuffer);
                        const spectralCentroid = this.fft.computeSpectralCentroid(powerSpectrum, this.config.sampleRate);
                        const spectralFlatness = this.fft.computeSpectralFlatness(powerSpectrum);
                        this.stats.fftComputations++;

                        const rawBrightness = this._normalizeBrightness(spectralCentroid);
                        const rawBreathiness = Math.min(spectralFlatness, 1.0);

                        const smoothedVolume = this.volumeFilter.update(volume);
                        const smoothedBrightness = this.brightnessFilter.update(rawBrightness);
                        const smoothedBreathiness = this.breathinessFilter.update(rawBreathiness);
                        const volumeDb = smoothedVolume > 0 ? 20 * Math.log10(smoothedVolume) : -100;

                        const articulation = this.onsetDetector.detect(volumeDb, currentTime);

                        const pitchInfo = {
                            frequency: smoothedFrequency,
                            rawFrequency: correctedFrequency,
                            note: noteInfo.note,
                            octave: noteInfo.octave,
                            cents: noteInfo.cents,
                            confidence: confidence,
                            volumeLinear: smoothedVolume,
                            volumeDb: volumeDb,
                            brightness: smoothedBrightness,
                            breathiness: smoothedBreathiness,
                            articulation: articulation,
                            captureTime: currentTime * 1000
                        };

                        this.stats.pitchDetections++;
                        this.port.postMessage({
                            type: 'pitch-frame',
                            data: pitchInfo,
                            timestamp: currentTime * 1000
                        });
                    } else if (frequency === null) {
                        this.port.postMessage({ type: 'no-pitch', data: { volume } });
                    }
                } else {
                    // Debug: Volume too low
                    this.lowVolumeFrameCount = (this.lowVolumeFrameCount || 0) + 1;
                    if (this.lowVolumeFrameCount % 100 === 0) {
                        this.port.postMessage({ 
                            type: 'volume-too-low', 
                            data: { volume: volume.toFixed(6), threshold: this.config.minVolumeThreshold } 
                        });
                    }
                }

                const halfSize = Math.floor(this.accumulationBuffer.length / 2);
                this.accumulationBuffer.copyWithin(0, halfSize);
                this.accumulationIndex = halfSize;
                this.accumulationFull = false;
            }

            const output = outputs[0];
            if (output && output[0]) output[0].set(audioBuffer);

        } catch (error) {
            this.port.postMessage({ type: 'error', error: error.message });
        }

        this._updateStats((currentTime - startTime) * 1000);
        return true;
    }

    _handleMessage(event) {
        const { type, data } = event.data;
        if (type === 'config') {
            this.config = { ...this.config, ...data };
            if (this.volumeFilter && data.volumeAlpha) this.volumeFilter.alpha = data.volumeAlpha;
            if (this.brightnessFilter && data.brightnessAlpha) this.brightnessFilter.alpha = data.brightnessAlpha;
            this.port.postMessage({ type: 'config-applied', config: this.config });
        }
    }

    _accumulateAudio(newSamples) {
        const remaining = this.accumulationBuffer.length - this.accumulationIndex;
        const copySize = Math.min(newSamples.length, remaining);
        this.accumulationBuffer.set(newSamples.subarray(0, copySize), this.accumulationIndex);
        this.accumulationIndex += copySize;
        if (this.accumulationIndex >= this.accumulationBuffer.length) this.accumulationFull = true;
    }

    _getSmoothedPitch() {
        if (this.pitchHistory.length === 0) return 0;
        const sorted = [...this.pitchHistory].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    _frequencyToNote(frequency) {
        const A4 = 440;
        const halfSteps = 12 * Math.log2(frequency / (A4 * Math.pow(2, -4.75)));
        const roundedHalfSteps = Math.round(halfSteps);
        const noteIndex = ((roundedHalfSteps % 12) + 12) % 12;
        const octave = Math.floor(roundedHalfSteps / 12);
        const cents = Math.round((halfSteps - roundedHalfSteps) * 100);
        return { note: this.noteNames[noteIndex], octave, cents };
    }

    _calculateConfidence(buffer, frequency, volume) {
        if (!frequency) return 0;
        
        // Dynamic confidence based on configured threshold
        // Allows quiet humming (e.g. 0.005) to have non-zero confidence
        const minVol = this.config.minVolumeThreshold || 0.001;
        const maxVol = 0.1; // Approximate max volume for normal speech / humming
        
        let confidence = (volume - minVol) / (maxVol - minVol);
        confidence = Math.max(0, Math.min(1, confidence));
        
        // Boost confidence for human voice range
        if (frequency >= 80 && frequency <= 800) confidence = Math.min(confidence * 1.2, 1);
        
        return confidence;
    }

    _calculateRMS(buffer) {
        if (buffer.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        return Math.sqrt(sum / buffer.length);
    }

    _normalizeBrightness(centroid) {
        if (centroid <= 200) return 0;
        if (centroid >= 8000) return 1;
        return Math.max(0, Math.min(1, Math.log(centroid / 200) / Math.log(8000 / 200)));
    }

    _updateStats(time) {
        this.stats.framesProcessed++;
        this.stats.processingTimes.push(time);
        if (this.stats.processingTimes.length > 100) this.stats.processingTimes.shift();
        if (time > this.stats.maxProcessingTime) this.stats.maxProcessingTime = time;
        if (currentTime - this.stats.lastReportTime >= 1.0) {
            const avg = this.stats.processingTimes.reduce((a,b)=>a+b,0) / this.stats.processingTimes.length;
            this.port.postMessage({
                type: 'stats',
                data: {
                    framesProcessed: this.stats.framesProcessed,
                    avgProcessingTime: avg.toFixed(3),
                    maxProcessingTime: this.stats.maxProcessingTime.toFixed(3)
                }
            });
            this.stats.lastReportTime = currentTime;
        }
    }
}

registerProcessor('pitch-detector', PitchDetectorWorklet);