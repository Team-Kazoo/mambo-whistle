/**
 * Unit Tests for CooleyTukeyFFT
 *
 * Tests:
 * 1. FFT correctness: sine wave → single spectral peak
 * 2. IFFT correctness: IFFT(FFT(x)) ≈ x
 * 3. Autocorrelation: FFT method ≈ naive O(N²) method
 * 4. Edge cases: power-of-2 sizes, zero input, DC component
 *
 * ✅ Fixed: Import shared implementation from js/utils/fft.js
 * No more code duplication - tests exercise the actual production code
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CooleyTukeyFFT } from '../../js/utils/fft.js';

// Removed duplicate CooleyTukeyFFT class definition (lines 27-283)
// Now importing from shared module to ensure tests cover production code

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

    describe('Algorithm Correctness (deterministic)', () => {
        it('should produce consistent FFT results for known input', () => {
            const fft2048 = new CooleyTukeyFFT(2048);
            const input = new Float32Array(2048);

            // Known test signal: 440 Hz sine wave at 44100 Hz sample rate
            const sampleRate = 44100;
            const freq = 440;
            for (let i = 0; i < 2048; i++) {
                input[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
            }

            const powerSpectrum = fft2048.computePowerSpectrum(input);

            // Peak should be near bin corresponding to 440 Hz
            const expectedBin = Math.round(440 * 2048 / sampleRate); // ≈ 20

            // Find peak excluding DC bin (bin 0)
            const peakBin = powerSpectrum.slice(1).indexOf(Math.max(...powerSpectrum.slice(1))) + 1;

            // Allow ±2 bin tolerance (FFT frequency resolution)
            expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(2);

            // Peak should dominate the spectrum (excluding DC)
            const totalPowerNoDC = powerSpectrum.slice(1).reduce((a, b) => a + b, 0);
            expect(powerSpectrum[peakBin]).toBeGreaterThan(totalPowerNoDC * 0.3);
        });

        it('should produce consistent autocorrelation for periodic signal', () => {
            const fft2048 = new CooleyTukeyFFT(4096);  // 2N for autocorrelation
            const period = 16;  // 16-sample period
            const input = new Float32Array(1024);

            // Periodic sawtooth wave
            for (let i = 0; i < 1024; i++) {
                input[i] = (i % period) / period;
            }

            const autocorr = fft2048.computeAutocorrelation(input);

            // Autocorrelation of periodic signal should also be periodic
            // r[0] should be maximum
            expect(autocorr[0]).toBeGreaterThan(0);

            // r[period] should be close to r[0] (allowing for decay)
            expect(autocorr[period]).toBeGreaterThan(autocorr[0] * 0.5);

            // r[period/2] should be lower (different phase)
            expect(Math.abs(autocorr[period / 2])).toBeLessThan(Math.abs(autocorr[0]) * 0.8);
        });
    });
});
