/**
 * PerformanceMonitor Unit Tests
 *
 * Phase 1.1: End-to-End Latency Measurement Enhancement
 *
 * Tests for:
 * - End-to-end latency tracking (capture → detection → synthesis → output)
 * - Percentile calculations (p50, p95, p99)
 * - Worklet vs ScriptProcessor mode detection
 * - Latency component breakdown
 *
 * @version 0.3.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import PerformanceMonitor from '../../js/performance.js';

// ============================================================================
// Tests
// ============================================================================

describe('PerformanceMonitor', () => {
    let monitor;
    let mockAudioContext;

    beforeEach(() => {
        monitor = new PerformanceMonitor();

        mockAudioContext = {
            sampleRate: 44100,
            baseLatency: 0.005, // 5ms
            outputLatency: 0.010 // 10ms
        };
    });

    // ========================================================================
    // Existing Tests (Basic Functionality)
    // ========================================================================

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(monitor.metrics.latency.audio).toBe(0);
            expect(monitor.metrics.fps).toBe(0);
            expect(monitor.metrics.mode).toBe('unknown');
            expect(monitor.latencySamples).toEqual([]);
        });
    });

    describe('initialize()', () => {
        it('should initialize with worklet mode', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');

            expect(monitor.metrics.bufferSize).toBe(128);
            expect(monitor.metrics.sampleRate).toBe(44100);
            expect(monitor.metrics.mode).toBe('worklet');
            expect(monitor.metrics.latency.audio).toBeGreaterThan(0);
        });

        it('should initialize with script-processor mode', () => {
            monitor.initialize(mockAudioContext, 2048, 'script-processor');

            expect(monitor.metrics.bufferSize).toBe(2048);
            expect(monitor.metrics.mode).toBe('script-processor');
        });

        it('should calculate audio latency correctly', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');

            // 128 / 44100 * 1000 = ~2.9ms buffer
            // + 5ms baseLatency + 10ms outputLatency = ~17.9ms
            expect(monitor.metrics.latency.audio).toBeCloseTo(17.9, 1);
        });
    });

    describe('calculateAudioLatency()', () => {
        it('should calculate for worklet mode (128 samples)', () => {
            const latency = monitor.calculateAudioLatency(mockAudioContext, 128);

            // 128/44100*1000 + 5 + 10 ≈ 17.9ms
            expect(latency).toBeCloseTo(17.9, 1);
        });

        it('should calculate for script-processor mode (2048 samples)', () => {
            const latency = monitor.calculateAudioLatency(mockAudioContext, 2048);

            // 2048/44100*1000 + 5 + 10 ≈ 61.4ms
            expect(latency).toBeCloseTo(61.4, 1);
        });

        it('should handle missing baseLatency/outputLatency', () => {
            const ctx = { sampleRate: 44100 };
            const latency = monitor.calculateAudioLatency(ctx, 128);

            // Only buffer latency
            expect(latency).toBeCloseTo(2.9, 1);
        });
    });

    // ========================================================================
    // Phase 1.1: End-to-End Latency Tracking
    // ========================================================================

    describe('recordLatencySample()', () => {
        it('should record latency sample with component breakdown', () => {
            // NEW API: Pass durations, not timestamps
            const captureDuration = 3;  // 3ms capture
            const detectionDuration = 10; // 10ms detection
            const synthesisDuration = 5;  // 5ms synthesis
            const outputDuration = 2;     // 2ms output

            const sample = monitor.recordLatencySample(
                captureDuration,
                detectionDuration,
                synthesisDuration,
                outputDuration
            );

            expect(sample).toEqual({
                capture: 3,
                detection: 10,
                synthesis: 5,
                output: 2,
                total: 20, // 3 + 10 + 5 + 2
                timestamp: expect.any(Number)
            });

            expect(monitor.latencySamples.length).toBe(1);
        });

        it('should maintain maximum 240 samples', () => {
            // Add 250 samples (durations: 3, 10, 5, 2 → total 20ms)
            for (let i = 0; i < 250; i++) {
                monitor.recordLatencySample(3, 10, 5, 2);
            }

            expect(monitor.latencySamples.length).toBe(240);
        });

        it('should update current metrics', () => {
            monitor.recordLatencySample(3, 10, 5, 2);

            expect(monitor.metrics.latency.endToEnd).toEqual({
                capture: 3,
                detection: 10,
                synthesis: 5,
                output: 2,
                total: 20
            });
        });
    });

    describe('getLatencyStats()', () => {
        it('should return zeros when no samples', () => {
            const stats = monitor.getLatencyStats();

            expect(stats).toEqual({
                count: 0,
                min: 0,
                max: 0,
                avg: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                mode: 'unknown',
                breakdown: null
            });
        });

        it('should calculate statistics for single sample', () => {
            // Durations: 5, 10, 8, 2 → total 25ms
            monitor.recordLatencySample(5, 10, 8, 2);

            const stats = monitor.getLatencyStats();

            expect(stats.count).toBe(1);
            expect(stats.min).toBe(25);
            expect(stats.max).toBe(25);
            expect(stats.avg).toBe(25);
            expect(stats.p50).toBe(25);
            expect(stats.p95).toBe(25);
        });

        it('should calculate percentiles correctly for 100 samples', () => {
            // Generate 100 samples with evenly distributed totals 0-80ms
            for (let i = 0; i < 100; i++) {
                const total = i * 0.8; // 0, 0.8, 1.6, ..., 79.2
                // Split evenly across stages
                const capture = total * 0.25;
                const detection = total * 0.50;
                const synthesis = total * 0.15;
                const output = total * 0.10;
                monitor.recordLatencySample(capture, detection, synthesis, output);
            }

            const stats = monitor.getLatencyStats();

            expect(stats.count).toBe(100);
            expect(stats.min).toBeCloseTo(0, 0.5);
            expect(stats.max).toBeCloseTo(79.2, 0.5);
            expect(stats.avg).toBeCloseTo(39.6, 0.5); // Average of 0-79.2

            // p50 (50th sample) ≈ 39.2
            expect(stats.p50).toBeCloseTo(39.2, 0.5);

            // p95 (95th sample) ≈ 75.2
            expect(stats.p95).toBeCloseTo(75.2, 0.5);

            // p99 (99th sample) ≈ 78.4
            expect(stats.p99).toBeCloseTo(78.4, 0.5);
        });

        it('should include mode in stats', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');
            monitor.recordLatencySample(3, 10, 5, 2); // Durations

            const stats = monitor.getLatencyStats();

            expect(stats.mode).toBe('worklet');
        });

        it('should include latency breakdown', () => {
            monitor.recordLatencySample(3, 10, 5, 7); // total 25ms
            monitor.recordLatencySample(4, 12, 6, 8); // total 30ms

            const stats = monitor.getLatencyStats();

            expect(stats.breakdown.capture).toBe(3.5); // Average of 3 and 4
            expect(stats.breakdown.detection).toBe(11); // Average of 10 and 12
            expect(stats.breakdown.synthesis).toBe(5.5); // Average of 5 and 6
            expect(stats.breakdown.output).toBe(7.5); // Average of 7 and 8
        });
    });

    describe('getModeWarning()', () => {
        it('should warn about ScriptProcessor fallback', () => {
            monitor.initialize(mockAudioContext, 2048, 'script-processor');

            const warning = monitor.getModeWarning();

            expect(warning.warning).toBe(true);
            expect(warning.message).toContain('ScriptProcessor fallback');
            expect(warning.message).toContain('+46ms');
            expect(warning.recommendation).toContain('HTTPS or localhost');
        });

        it('should not warn for Worklet mode', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');

            const warning = monitor.getModeWarning();

            expect(warning.warning).toBe(false);
        });
    });

    describe('getLatencyReport()', () => {
        it('should generate comprehensive latency report for Worklet', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');
            monitor.recordLatencySample(3, 10, 7, 5); // Durations → total 25ms

            const report = monitor.getLatencyReport();

            expect(report.mode).toBe('worklet');
            expect(report.baseLatency).toBe('~3ms (128 samples)');
            expect(report.contextLatency).toBeCloseTo(17.9, 1);
            expect(report.stats.count).toBe(1);
            expect(report.warning.warning).toBe(false);
        });

        it('should generate report for ScriptProcessor with warning', () => {
            monitor.initialize(mockAudioContext, 2048, 'script-processor');
            monitor.recordLatencySample(15, 50, 20, 15); // Durations → total 100ms

            const report = monitor.getLatencyReport();

            expect(report.mode).toBe('script-processor');
            expect(report.baseLatency).toBe('~46ms (2048 samples)');
            expect(report.contextLatency).toBeCloseTo(61.4, 1);
            expect(report.warning.warning).toBe(true);
        });
    });

    // ========================================================================
    // Phase 1.1: Percentile Calculation Edge Cases
    // ========================================================================

    describe('_calculatePercentile()', () => {
        it('should return 0 for empty array', () => {
            const result = monitor._calculatePercentile([], 0.95);
            expect(result).toBe(0);
        });

        it('should return only element for single-element array', () => {
            const result = monitor._calculatePercentile([42], 0.95);
            expect(result).toBe(42);
        });

        it('should calculate p50 (median) correctly', () => {
            const sorted = [10, 20, 30, 40, 50];
            const p50 = monitor._calculatePercentile(sorted, 0.50);

            // 50th percentile = 3rd element (index 2)
            expect(p50).toBe(30);
        });

        it('should calculate p95 correctly', () => {
            const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100
            const p95 = monitor._calculatePercentile(sorted, 0.95);

            // 95th percentile = 95th element
            expect(p95).toBe(95);
        });

        it('should handle boundary cases', () => {
            const sorted = [1, 2, 3, 4, 5];

            expect(monitor._calculatePercentile(sorted, 0.00)).toBe(1);
            expect(monitor._calculatePercentile(sorted, 1.00)).toBe(5);
        });
    });

    // ========================================================================
    // Phase 1.1: Integration Scenarios
    // ========================================================================

    describe('Integration: Real-world latency tracking', () => {
        it('should track realistic latency over time (deterministic)', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');

            // Simulate 120 detection cycles with DETERMINISTIC jitter pattern
            // Pattern repeats every 10 cycles: jitter = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]
            const jitterPattern = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];

            for (let i = 0; i < 120; i++) {
                const jitter = jitterPattern[i % 10];
                const captureDuration = 3; // Fixed capture
                const detectionDuration = 10 + jitter; // Variable detection
                const synthesisDuration = 3; // Fixed synthesis
                const outputDuration = 4; // Fixed output

                monitor.recordLatencySample(
                    captureDuration,
                    detectionDuration,
                    synthesisDuration,
                    outputDuration
                );
            }

            const stats = monitor.getLatencyStats();

            expect(stats.count).toBe(120);
            // Min: 3 + 10 + 3 + 4 = 20ms (jitter = 0)
            expect(stats.min).toBe(20);
            // Max: 3 + 15 + 3 + 4 = 25ms (jitter = 5)
            expect(stats.max).toBe(25);
            // Average: 20 + avg(jitter) = 20 + 2.5 = 22.5ms
            expect(stats.avg).toBe(22.5);
            // p95 ≈ 25ms (high jitter samples)
            expect(stats.p95).toBeGreaterThanOrEqual(24);
        });

        it('should detect high latency outliers', () => {
            monitor.initialize(mockAudioContext, 128, 'worklet');

            // Normal latency: ~20ms (samples 1-95)
            for (let i = 0; i < 95; i++) {
                monitor.recordLatencySample(3, 10, 5, 2); // total 20ms
            }

            // Outliers: ~100ms (samples 96-100)
            for (let i = 0; i < 5; i++) {
                monitor.recordLatencySample(15, 50, 20, 15); // total 100ms
            }

            const stats = monitor.getLatencyStats();

            expect(stats.avg).toBe(24); // (95*20 + 5*100)/100 = 24
            // p95 = 95th percentile = ceil(100 * 0.95) - 1 = 94th index = 20ms
            // (sorted: [20,20,...,20 (95 times), 100,100,100,100,100])
            expect(stats.p95).toBe(20); // 95th percentile still in normal range
            expect(stats.p50).toBe(20); // Median unaffected by outliers
        });
    });

    // ========================================================================
    // Phase 1.1: Performance (Non-blocking)
    // ========================================================================

    describe('Performance', () => {
        it('should handle 240 samples without performance degradation', () => {
            const start = performance.now();

            for (let i = 0; i < 240; i++) {
                monitor.recordLatencySample(3, 10, 5, 2); // Durations
            }

            monitor.getLatencyStats();

            const duration = performance.now() - start;

            // Should complete in < 5ms (very conservative)
            expect(duration).toBeLessThan(5);
        });

        it('should not block on percentile calculation', () => {
            // Populate with 240 samples with varying durations
            for (let i = 0; i < 240; i++) {
                const cap = 2 + (i % 5);
                const det = 10 + (i % 10);
                const syn = 5 + (i % 3);
                const out = 2 + (i % 4);
                monitor.recordLatencySample(cap, det, syn, out);
            }

            const start = performance.now();
            monitor.getLatencyStats();
            const duration = performance.now() - start;

            // Percentile calculation should be < 1ms
            expect(duration).toBeLessThan(1);
        });
    });
});
