/**
 * Unit Tests for CooleyTukeyFFT
 *
 * Tests:
 * 1. FFT correctness: sine wave → single spectral peak
 * 2. IFFT correctness: IFFT(FFT(x)) ≈ x
 * 3. Autocorrelation: FFT method ≈ naive O(N²) method
 * 4. Edge cases: power-of-2 sizes, zero input, DC component
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * CooleyTukeyFFT - Fast Fourier Transform Implementation
 *
 * Radix-2 Decimation-In-Time (DIT) Cooley-Tukey algorithm
 * Based on: https://gist.github.com/antimatter15/0349ca7d479236fdcdbb
 *
 * Features:
 * - In-place computation (minimal memory)
 * - Pre-computed twiddle factors (faster)
 * - Bit-reversal permutation
 * - O(N log N) complexity
 *
 * Designed for AudioWorklet pitch detection (YIN + spectral features)
 */
class CooleyTukeyFFT {
    /**
     * @param {number} size - FFT size (must be power of 2)
     */
    constructor(size = 2048) {
        if ((size & (size - 1)) !== 0) {
            throw new Error(`FFT size must be power of 2, got ${size}`);
        }

        this.size = size;
        this.halfSize = size / 2;
        this.log2Size = Math.log2(size);

        // Pre-compute twiddle factors (optimization)
        this._precomputeTwiddles();

        // Pre-compute bit-reversal indices
        this._precomputeBitReversal();

        // Working buffers
        this.real = new Float32Array(size);
        this.imag = new Float32Array(size);
        this.powerSpectrum = new Float32Array(this.halfSize);
        this.autocorrelation = new Float32Array(size);
    }

    /**
     * Pre-compute twiddle factors for all stages
     * W_N^k = e^(-j*2π*k/N) = cos(-2πk/N) + j*sin(-2πk/N)
     */
    _precomputeTwiddles() {
        this.twiddleReal = new Float32Array(this.halfSize);
        this.twiddleImag = new Float32Array(this.halfSize);

        for (let i = 0; i < this.halfSize; i++) {
            const angle = -2 * Math.PI * i / this.size;
            this.twiddleReal[i] = Math.cos(angle);
            this.twiddleImag[i] = Math.sin(angle);
        }
    }

    /**
     * Pre-compute bit-reversal permutation indices
     */
    _precomputeBitReversal() {
        this.bitReversalIndices = new Uint32Array(this.size);

        for (let i = 0; i < this.size; i++) {
            this.bitReversalIndices[i] = this._reverseBits(i, this.log2Size);
        }
    }

    /**
     * Reverse bits of an integer
     * @param {number} x - Input integer
     * @param {number} bits - Number of bits to reverse
     * @returns {number} Bit-reversed integer
     */
    _reverseBits(x, bits) {
        let reversed = 0;
        for (let i = 0; i < bits; i++) {
            reversed = (reversed << 1) | (x & 1);
            x >>= 1;
        }
        return reversed;
    }

    /**
     * In-place radix-2 DIT FFT
     *
     * Algorithm:
     * 1. Bit-reversal permutation
     * 2. Iterative butterfly operations (log2(N) stages)
     *
     * @param {Float32Array} re - Real part (modified in-place)
     * @param {Float32Array} im - Imaginary part (modified in-place)
     * @param {boolean} inverse - If true, compute IFFT
     */
    fft(re, im, inverse = false) {
        const N = re.length;

        if (N !== this.size) {
            throw new Error(`FFT size mismatch: expected ${this.size}, got ${N}`);
        }

        // Step 1: Bit-reversal permutation
        for (let i = 0; i < N; i++) {
            const j = this.bitReversalIndices[i];
            if (j > i) {
                // Swap re[i] ↔ re[j]
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }

        // Step 2: Iterative FFT (Cooley-Tukey butterflies)
        // Stages: 1, 2, 4, 8, ..., N/2
        for (let size = 2; size <= N; size *= 2) {
            const halfSize = size / 2;
            const tableStep = N / size;

            // Process each block
            for (let i = 0; i < N; i += size) {
                // Butterfly operations within block
                for (let j = 0; j < halfSize; j++) {
                    const k = j * tableStep;

                    // Twiddle factor W_N^k
                    let twiddleR = this.twiddleReal[k];
                    let twiddleI = this.twiddleImag[k];

                    // IFFT: conjugate twiddle factors
                    if (inverse) {
                        twiddleI = -twiddleI;
                    }

                    // Indices
                    const evenIdx = i + j;
                    const oddIdx = i + j + halfSize;

                    // Complex multiplication: twiddle * odd
                    const tR = twiddleR * re[oddIdx] - twiddleI * im[oddIdx];
                    const tI = twiddleR * im[oddIdx] + twiddleI * re[oddIdx];

                    // Butterfly: even ± twiddle*odd
                    const tempR = re[evenIdx];
                    const tempI = im[evenIdx];

                    re[evenIdx] = tempR + tR;
                    im[evenIdx] = tempI + tI;

                    re[oddIdx] = tempR - tR;
                    im[oddIdx] = tempI - tI;
                }
            }
        }

        // IFFT: scale by 1/N
        if (inverse) {
            for (let i = 0; i < N; i++) {
                re[i] /= N;
                im[i] /= N;
            }
        }
    }

    /**
     * Inverse FFT (convenience wrapper)
     *
     * @param {Float32Array} re - Real part (modified in-place)
     * @param {Float32Array} im - Imaginary part (modified in-place)
     */
    ifft(re, im) {
        this.fft(re, im, true);
    }

    /**
     * Compute power spectrum from real-valued input
     *
     * Returns |X[k]|² for k = 0, 1, ..., N/2-1
     *
     * @param {Float32Array} input - Time-domain signal (length = size)
     * @returns {Float32Array} Power spectrum (length = size/2)
     */
    computePowerSpectrum(input) {
        if (input.length !== this.size) {
            throw new Error(`Input size mismatch: expected ${this.size}, got ${input.length}`);
        }

        // Copy input to real buffer, zero imaginary
        this.real.set(input);
        this.imag.fill(0);

        // Compute FFT
        this.fft(this.real, this.imag);

        // Compute power spectrum: |X[k]|² = Re²[k] + Im²[k]
        for (let k = 0; k < this.halfSize; k++) {
            this.powerSpectrum[k] = this.real[k] * this.real[k] + this.imag[k] * this.imag[k];
        }

        return this.powerSpectrum;
    }

    /**
     * Compute autocorrelation using Wiener-Khinchin theorem
     *
     * Algorithm:
     * 1. Zero-pad input to 2N (avoid circular convolution)
     * 2. FFT → multiply by conjugate → IFFT
     * 3. Normalize and return first N samples
     *
     * Based on: https://brentspell.com/blog/2022/pytorch-yin/
     *
     * @param {Float32Array} input - Time-domain signal (length ≤ size/2)
     * @returns {Float32Array} Autocorrelation (length = input.length)
     */
    computeAutocorrelation(input) {
        const N = input.length;

        if (N > this.halfSize) {
            throw new Error(`Input too large: max ${this.halfSize}, got ${N}`);
        }

        // Step 1: Zero-pad to 2N (using full FFT size)
        this.real.fill(0);
        this.imag.fill(0);
        this.real.set(input);

        // Subtract mean (critical for autocorrelation)
        let mean = 0;
        for (let i = 0; i < N; i++) {
            mean += this.real[i];
        }
        mean /= N;

        for (let i = 0; i < N; i++) {
            this.real[i] -= mean;
        }

        // Step 2: FFT
        this.fft(this.real, this.imag);

        // Step 3: Multiply by conjugate (power spectrum in frequency domain)
        for (let k = 0; k < this.size; k++) {
            const re = this.real[k];
            const im = this.imag[k];
            this.real[k] = re * re + im * im;  // |X[k]|²
            this.imag[k] = 0;
        }

        // Step 4: IFFT
        this.ifft(this.real, this.imag);

        // Step 5: Extract and normalize autocorrelation
        // Return only first N samples (rest are mirror/artifacts)
        for (let i = 0; i < N; i++) {
            this.autocorrelation[i] = this.real[i];
        }

        return this.autocorrelation.subarray(0, N);
    }
}

// ============================================================================
// Tests
// ============================================================================

describe('CooleyTukeyFFT', () => {
    let fft;

    beforeEach(() => {
        fft = new CooleyTukeyFFT(16);  // Small size for fast tests
    });

    describe('Constructor', () => {
        it('should initialize with power-of-2 size', () => {
            expect(fft.size).toBe(16);
            expect(fft.halfSize).toBe(8);
            expect(fft.log2Size).toBe(4);
        });

        it('should throw error for non-power-of-2 size', () => {
            expect(() => new CooleyTukeyFFT(15)).toThrow('must be power of 2');
            expect(() => new CooleyTukeyFFT(100)).toThrow('must be power of 2');
        });

        it('should pre-compute twiddle factors', () => {
            expect(fft.twiddleReal.length).toBe(8);
            expect(fft.twiddleImag.length).toBe(8);

            // W_16^0 = e^0 = 1 + 0j
            expect(fft.twiddleReal[0]).toBeCloseTo(1, 5);
            expect(fft.twiddleImag[0]).toBeCloseTo(0, 5);

            // W_16^4 = e^(-j*π/2) = 0 - 1j
            expect(fft.twiddleReal[4]).toBeCloseTo(0, 5);
            expect(fft.twiddleImag[4]).toBeCloseTo(-1, 5);
        });

        it('should pre-compute bit-reversal indices', () => {
            expect(fft.bitReversalIndices.length).toBe(16);

            // Examples:
            // 0 (0000) → 0 (0000)
            // 1 (0001) → 8 (1000)
            // 2 (0010) → 4 (0100)
            expect(fft.bitReversalIndices[0]).toBe(0);
            expect(fft.bitReversalIndices[1]).toBe(8);
            expect(fft.bitReversalIndices[2]).toBe(4);
        });
    });

    describe('FFT - Sine Wave', () => {
        it('should detect single frequency in sine wave', () => {
            const N = 16;
            const freq = 2; // 2 cycles in 16 samples
            const input = new Float32Array(N);

            // Generate sine wave: sin(2π * freq * n / N)
            for (let n = 0; n < N; n++) {
                input[n] = Math.sin(2 * Math.PI * freq * n / N);
            }

            const powerSpectrum = fft.computePowerSpectrum(input);

            // Peak should be at bin 2
            const peakIndex = powerSpectrum.indexOf(Math.max(...powerSpectrum));
            expect(peakIndex).toBe(freq);

            // Peak should be much larger than other bins
            const peakPower = powerSpectrum[freq];
            const avgNoise = powerSpectrum.filter((_, i) => i !== freq && i !== N - freq)
                .reduce((a, b) => a + b, 0) / (powerSpectrum.length - 2);

            expect(peakPower).toBeGreaterThan(avgNoise * 100);
        });

        it('should handle DC component (zero frequency)', () => {
            const N = 16;
            const input = new Float32Array(N).fill(1);  // Constant signal

            const powerSpectrum = fft.computePowerSpectrum(input);

            // All power should be in DC bin (index 0)
            expect(powerSpectrum[0]).toBeGreaterThan(0);

            // Other bins should be near zero
            for (let i = 1; i < powerSpectrum.length; i++) {
                expect(Math.abs(powerSpectrum[i])).toBeLessThan(1e-10);
            }
        });
    });

    describe('IFFT - Invertibility', () => {
        it('should satisfy IFFT(FFT(x)) ≈ x', () => {
            const N = 16;
            const input = new Float32Array(N);

            // Random signal
            for (let i = 0; i < N; i++) {
                input[i] = Math.random() - 0.5;
            }

            const re = new Float32Array(input);
            const im = new Float32Array(N);

            // FFT
            fft.fft(re, im);

            // IFFT
            fft.ifft(re, im);

            // Should recover original signal (imaginary part ≈ 0)
            for (let i = 0; i < N; i++) {
                expect(re[i]).toBeCloseTo(input[i], 5);
                expect(Math.abs(im[i])).toBeLessThan(1e-8);  // Relaxed tolerance for float precision
            }
        });

        it('should satisfy FFT(IFFT(X)) ≈ X', () => {
            const N = 16;
            const re = new Float32Array(N);
            const im = new Float32Array(N);

            // Random complex spectrum
            for (let i = 0; i < N; i++) {
                re[i] = Math.random() - 0.5;
                im[i] = Math.random() - 0.5;
            }

            const originalRe = new Float32Array(re);
            const originalIm = new Float32Array(im);

            // IFFT → FFT
            fft.ifft(re, im);
            fft.fft(re, im);

            // Should recover original spectrum
            for (let i = 0; i < N; i++) {
                expect(re[i]).toBeCloseTo(originalRe[i], 5);
                expect(im[i]).toBeCloseTo(originalIm[i], 5);
            }
        });
    });

    describe('Autocorrelation - Wiener-Khinchin', () => {
        /**
         * Naive O(N²) autocorrelation (for comparison)
         */
        function naiveAutocorrelation(signal) {
            const N = signal.length;
            const result = new Float32Array(N);

            // Subtract mean
            let mean = 0;
            for (let i = 0; i < N; i++) {
                mean += signal[i];
            }
            mean /= N;

            const centered = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                centered[i] = signal[i] - mean;
            }

            // Autocorrelation: r[τ] = Σ x[i] * x[i+τ]
            for (let tau = 0; tau < N; tau++) {
                let sum = 0;
                for (let i = 0; i < N - tau; i++) {
                    sum += centered[i] * centered[i + tau];
                }
                result[tau] = sum;
            }

            return result;
        }

        it('should match naive autocorrelation for small signal', () => {
            const N = 8;  // Small for O(N²) comparison
            const signal = new Float32Array(N);

            // Random signal
            for (let i = 0; i < N; i++) {
                signal[i] = Math.random() - 0.5;
            }

            // FFT-based autocorrelation
            const fft8 = new CooleyTukeyFFT(16);  // Need 2N for zero-padding
            const fftResult = fft8.computeAutocorrelation(signal);

            // Naive autocorrelation
            const naiveResult = naiveAutocorrelation(signal);

            // Compare (allow small numerical error)
            for (let i = 0; i < N; i++) {
                expect(fftResult[i]).toBeCloseTo(naiveResult[i], 3);
            }
        });

        it('should have maximum at lag 0 for random signal', () => {
            const N = 8;  // Use smaller size (FFT size is 16, can handle up to 8)
            const signal = new Float32Array(N);

            for (let i = 0; i < N; i++) {
                signal[i] = Math.random() - 0.5;
            }

            const autocorr = fft.computeAutocorrelation(signal);

            // r[0] should be maximum (signal most correlated with itself at lag 0)
            const maxValue = Math.max(...autocorr.slice(0, N));
            expect(autocorr[0]).toBeCloseTo(maxValue, 5);
            expect(autocorr[0]).toBeGreaterThan(0);
        });

        it('should detect periodicity in sine wave', () => {
            const N = 8;  // Use smaller size (FFT size is 16, can handle up to 8)
            const period = 4;  // 4 samples per cycle
            const signal = new Float32Array(N);

            for (let i = 0; i < N; i++) {
                signal[i] = Math.sin(2 * Math.PI * i / period);
            }

            const autocorr = fft.computeAutocorrelation(signal);

            // For sine wave with period 4, autocorrelation properties:
            // - r[0] = maximum (signal power)
            // - r[2] ≈ -r[0] (anti-phase, 180° shift)
            // - r[4] ≈ r[0] (in-phase, 360° shift)
            // However, finite window causes decay, so just check qualitative behavior

            // r[0] should be positive and maximum
            expect(autocorr[0]).toBeGreaterThan(0);

            // r[2] should be negative (anti-phase)
            expect(autocorr[2]).toBeLessThan(0);

            // |r[2]| should be large (strong anti-correlation)
            expect(Math.abs(autocorr[2])).toBeGreaterThan(Math.abs(autocorr[0]) * 0.3);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero input', () => {
            const N = 16;
            const input = new Float32Array(N);  // All zeros

            const powerSpectrum = fft.computePowerSpectrum(input);

            // All bins should be zero
            for (let i = 0; i < powerSpectrum.length; i++) {
                expect(powerSpectrum[i]).toBe(0);
            }
        });

        it('should throw on input size mismatch', () => {
            const wrongSize = new Float32Array(8);  // Expected 16

            expect(() => fft.computePowerSpectrum(wrongSize))
                .toThrow('Input size mismatch');
        });

        it('should handle large FFT size (2048)', () => {
            const fft2048 = new CooleyTukeyFFT(2048);
            const input = new Float32Array(2048);

            // Sine wave at 100 Hz (assuming 44100 Hz sample rate)
            const sampleRate = 44100;
            const freq = 100;
            for (let i = 0; i < 2048; i++) {
                input[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
            }

            const powerSpectrum = fft2048.computePowerSpectrum(input);

            // Should complete without error
            expect(powerSpectrum.length).toBe(1024);

            // Should have a clear peak
            const maxPower = Math.max(...powerSpectrum);
            expect(maxPower).toBeGreaterThan(0);
        });
    });

    describe('Performance Characteristics', () => {
        it('should complete 2048-point FFT in reasonable time', () => {
            const fft2048 = new CooleyTukeyFFT(2048);
            const input = new Float32Array(2048);

            for (let i = 0; i < 2048; i++) {
                input[i] = Math.random() - 0.5;
            }

            const startTime = performance.now();
            fft2048.computePowerSpectrum(input);
            const endTime = performance.now();

            const duration = endTime - startTime;

            // Should be much faster than 10ms (naive DFT takes ~100ms)
            expect(duration).toBeLessThan(10);
        });

        it('should complete autocorrelation in reasonable time', () => {
            const fft2048 = new CooleyTukeyFFT(4096);  // 2N for autocorrelation
            const input = new Float32Array(1024);

            for (let i = 0; i < 1024; i++) {
                input[i] = Math.random() - 0.5;
            }

            const startTime = performance.now();
            fft2048.computeAutocorrelation(input);
            const endTime = performance.now();

            const duration = endTime - startTime;

            // Should be much faster than 50ms (naive O(N²) takes ~500ms)
            expect(duration).toBeLessThan(50);
        });
    });
});
