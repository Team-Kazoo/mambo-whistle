/**
 * Pitchfinder Browser Bundle
 * YIN Algorithm Implementation for Browser
 * Based on https://github.com/peterkhayes/pitchfinder
 */

(function(global) {
    'use strict';

    // YIN Algorithm Implementation
    function YIN(config) {
        config = config || {};
        const threshold = config.threshold || 0.1;
        const probabilityThreshold = config.probabilityThreshold || 0.1;
        const sampleRate = config.sampleRate || 44100;

        return function detectPitch(buffer) {
            if (!buffer || buffer.length < 2) {
                return null;
            }

            const yinBufferSize = buffer.length / 2;
            const yinBuffer = new Float32Array(yinBufferSize);

            // Step 1: Calculate difference function
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

            // Step 2: Calculate cumulative mean normalized difference
            yinBuffer[0] = 1;
            let runningSum = 0;
            for (let t = 1; t < yinBufferSize; t++) {
                runningSum += yinBuffer[t];
                yinBuffer[t] *= t / runningSum;
            }

            // Step 3: Absolute threshold
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

            // Step 4: No pitch found
            if (tau === -1) {
                return null;
            }

            // Step 5: Parabolic interpolation
            let betterTau;
            const x0 = (tau < 1) ? tau : tau - 1;
            const x2 = (tau + 1 < yinBufferSize) ? tau + 1 : tau;

            if (x0 === tau) {
                if (yinBuffer[tau] <= yinBuffer[x2]) {
                    betterTau = tau;
                } else {
                    betterTau = x2;
                }
            } else if (x2 === tau) {
                if (yinBuffer[tau] <= yinBuffer[x0]) {
                    betterTau = tau;
                } else {
                    betterTau = x0;
                }
            } else {
                const s0 = yinBuffer[x0];
                const s1 = yinBuffer[tau];
                const s2 = yinBuffer[x2];
                betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }

            // Calculate frequency
            const frequency = sampleRate / betterTau;

            // Check probability
            const probability = 1 - yinBuffer[tau];
            if (probability < probabilityThreshold) {
                return null;
            }

            return frequency;
        };
    }

    // AMDF Algorithm Implementation (simpler, for fallback)
    function AMDF(config) {
        config = config || {};
        const sampleRate = config.sampleRate || 44100;
        const minFrequency = config.minFrequency || 50;
        const maxFrequency = config.maxFrequency || 1000;
        const sensitivity = config.sensitivity || 0.1;
        const ratio = config.ratio || 5;

        const maxPeriod = Math.floor(sampleRate / minFrequency);
        const minPeriod = Math.floor(sampleRate / maxFrequency);

        return function detectPitch(buffer) {
            if (!buffer || buffer.length < maxPeriod) {
                return null;
            }

            const bufferLength = buffer.length;
            let amd = new Float32Array(maxPeriod);

            // Calculate AMDF
            for (let p = minPeriod; p < maxPeriod; p++) {
                let sum = 0;
                for (let i = 0; i < bufferLength - p; i++) {
                    sum += Math.abs(buffer[i] - buffer[i + p]);
                }
                amd[p] = sum;
            }

            // Find minimum
            let minValue = Infinity;
            let minIndex = -1;
            for (let p = minPeriod; p < maxPeriod; p++) {
                if (amd[p] < minValue) {
                    minValue = amd[p];
                    minIndex = p;
                }
            }

            if (minIndex === -1 || minValue > sensitivity * bufferLength) {
                return null;
            }

            return sampleRate / minIndex;
        };
    }

    // Dynamic Wavelet Algorithm (fast but less accurate for low frequencies)
    function DynamicWavelet(config) {
        config = config || {};
        const sampleRate = config.sampleRate || 44100;

        return function detectPitch(buffer) {
            // Simplified implementation - just use autocorrelation
            if (!buffer || buffer.length < 2048) {
                return null;
            }

            const SIZE = buffer.length;
            const MAX_SAMPLES = Math.floor(SIZE / 2);
            const MIN_SAMPLES = Math.floor(sampleRate / 1000); // 1000 Hz max

            let maxCorrelation = 0;
            let period = 0;

            for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
                let correlation = 0;
                for (let i = 0; i < MAX_SAMPLES; i++) {
                    correlation += buffer[i] * buffer[i + offset];
                }

                if (correlation > maxCorrelation) {
                    maxCorrelation = correlation;
                    period = offset;
                }
            }

            if (period === 0) {
                return null;
            }

            return sampleRate / period;
        };
    }

    // Export as global Pitchfinder object
    const Pitchfinder = {
        YIN: YIN,
        AMDF: AMDF,
        DynamicWavelet: DynamicWavelet,

        // Helper function to get frequencies
        frequencies: function(detector, audioBuffer, options) {
            options = options || {};
            const tempo = options.tempo || 120;
            const quantization = options.quantization || 4;

            const detectors = Array.isArray(detector) ? detector : [detector];
            const results = [];

            const samplesPerBeat = (60 / tempo) * audioBuffer.sampleRate;
            const samplesPerQuantum = samplesPerBeat / quantization;

            for (let i = 0; i < audioBuffer.length; i += samplesPerQuantum) {
                const end = Math.min(i + samplesPerQuantum, audioBuffer.length);
                const slice = audioBuffer.slice(i, end);

                let frequency = null;
                for (let j = 0; j < detectors.length; j++) {
                    frequency = detectors[j](slice);
                    if (frequency !== null) {
                        break;
                    }
                }

                results.push(frequency);
            }

            return results;
        }
    };

    // Export to window
    global.Pitchfinder = Pitchfinder;

    console.log('Pitchfinder browser bundle loaded successfully');

})(typeof window !== 'undefined' ? window : global);
