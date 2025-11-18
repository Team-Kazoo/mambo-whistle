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
 * Phase 2 Optimization: Replace O(N²) algorithms
 * - YIN autocorrelation: 4.2M ops → 22k ops (~200x faster)
 * - Power spectrum: 2.1M ops → 11k ops (~200x faster)
 * - Expected latency reduction: ~50ms
 *
 * @module utils/fft
 */

export class CooleyTukeyFFT {
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

        // Pre-compute twiddle factors
        this._precomputeTwiddles();
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

        // Bit-reversal permutation
        for (let i = 0; i < N; i++) {
            const j = this.bitReversalIndices[i];
            if (j > i) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }

        // Iterative FFT (Cooley-Tukey butterflies)
        for (let size = 2; size <= N; size *= 2) {
            const halfSize = size / 2;
            const tableStep = N / size;

            for (let i = 0; i < N; i += size) {
                for (let j = 0; j < halfSize; j++) {
                    const k = j * tableStep;

                    let twiddleR = this.twiddleReal[k];
                    let twiddleI = this.twiddleImag[k];

                    if (inverse) {
                        twiddleI = -twiddleI;
                    }

                    const evenIdx = i + j;
                    const oddIdx = i + j + halfSize;

                    const tR = twiddleR * re[oddIdx] - twiddleI * im[oddIdx];
                    const tI = twiddleR * im[oddIdx] + twiddleI * re[oddIdx];

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

        this.real.set(input);
        this.imag.fill(0);

        this.fft(this.real, this.imag);

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

        // Zero-pad to 2N
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

        // FFT
        this.fft(this.real, this.imag);

        // Multiply by conjugate (power spectrum in frequency domain)
        for (let k = 0; k < this.size; k++) {
            const re = this.real[k];
            const im = this.imag[k];
            this.real[k] = re * re + im * im;  // |X[k]|²
            this.imag[k] = 0;
        }

        // IFFT
        this.ifft(this.real, this.imag);

        // Extract and normalize autocorrelation
        for (let i = 0; i < N; i++) {
            this.autocorrelation[i] = this.real[i];
        }

        return this.autocorrelation.subarray(0, N);
    }

    /**
     * Compute Spectral Centroid (brightness)
     *
     * Represents the "center of mass" of the spectrum
     * Higher values = brighter timbre
     *
     * @param {Float32Array} powerSpectrum - Power spectrum
     * @param {number} sampleRate - Sample rate
     * @returns {number} Centroid frequency (Hz)
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
     * Compute Spectral Flatness (breathiness)
     *
     * Geometric mean / Arithmetic mean, range [0, 1]
     * Close to 1: white noise (breathy)
     * Close to 0: pure tone (clear)
     *
     * @param {Float32Array} powerSpectrum - Power spectrum
     * @returns {number} Flatness [0, 1]
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
