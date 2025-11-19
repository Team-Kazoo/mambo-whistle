/**
 * PitchCorrector 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PitchCorrector, SCALES } from '../../js/audio/pitch-corrector.js';

describe('PitchCorrector', () => {
  let corrector;

  beforeEach(() => {
    corrector = new PitchCorrector({
      correctionAmount: 1.0, // 100% 修正
      scale: 'CHROMATIC',
      key: 'C'
    });
  });

  describe('初始化', () => {
    it('应该使用默认参数创建', () => {
      const defaultCorrector = new PitchCorrector();
      expect(defaultCorrector.correctionAmount).toBe(0.5);
      expect(defaultCorrector.scale).toBe('CHROMATIC');
      expect(defaultCorrector.key).toBe('C');
    });

    it('应该使用自定义参数创建', () => {
      const customCorrector = new PitchCorrector({
        correctionAmount: 0.8,
        scale: 'MAJOR',
        key: 'D'
      });
      expect(customCorrector.correctionAmount).toBe(0.8);
      expect(customCorrector.scale).toBe('MAJOR');
      expect(customCorrector.key).toBe('D');
    });
  });

  describe('音高修正 - 全音阶', () => {
    it('应该修正到最近的半音 - A4', () => {
      // 输入 442Hz (稍高于 A4=440Hz)
      const result = corrector.correct(442);

      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.targetFrequency).toBeCloseTo(440, 1);
      expect(result.frequency).toBeCloseTo(440, 1); // 100%修正
    });

    it('应该修正到最近的半音 - C4', () => {
      // 输入 263Hz (稍高于 C4≈261.63Hz)
      const result = corrector.correct(263);

      expect(result.note).toBe('C');
      expect(result.octave).toBe(4);
      expect(result.targetFrequency).toBeCloseTo(261.63, 1);
    });

    it('应该处理跑调的频率', () => {
      // 输入 450Hz (A4和A#4之间,偏向A#4)
      const result = corrector.correct(450);

      // 450Hz更接近A#4 (466.16Hz) 还是 A4 (440Hz)?
      // log2(450/440) ≈ 0.0315 octaves ≈ 0.38 semitones
      // 所以应该吸附到A4
      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
    });
  });

  describe('音高修正 - 大调音阶', () => {
    beforeEach(() => {
      corrector.setScale('MAJOR', 'C'); // C大调
    });

    it('应该只修正到C大调音阶内的音符', () => {
      // C大调音阶: C D E F G A B (没有升降号)
      const testCases = [
        { input: 261.63, expectedNote: 'C' }, // C4
        { input: 293.66, expectedNote: 'D' }, // D4
        { input: 329.63, expectedNote: 'E' }, // E4
        { input: 349.23, expectedNote: 'F' }, // F4
        { input: 392.00, expectedNote: 'G' }, // G4
        { input: 440.00, expectedNote: 'A' }, // A4
        { input: 493.88, expectedNote: 'B' }  // B4
      ];

      testCases.forEach(({ input, expectedNote }) => {
        const result = corrector.correct(input);
        expect(result.note).toBe(expectedNote);
      });
    });

    it('应该将C#修正到最近的C大调音符', () => {
      // C#4 (277.18Hz) 应该被修正到 C4 或 D4
      const result = corrector.correct(277.18);

      // C#4更接近D4还是C4?
      // 理论上应该吸附到D4 (293.66Hz)
      expect(['C', 'D']).toContain(result.note);
    });
  });

  describe('音高修正 - 小调音阶', () => {
    beforeEach(() => {
      corrector.setScale('MINOR', 'A'); // A小调
    });

    it('应该只修正到A小调音阶内的音符', () => {
      // A小调音阶: A B C D E F G
      const result = corrector.correct(440); // A4
      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
    });
  });

  describe('修正强度控制', () => {
    it('0%修正应该保持原频率', () => {
      corrector.setCorrectionAmount(0);
      const result = corrector.correct(442);

      expect(result.frequency).toBeCloseTo(442, 1);
      expect(result.targetFrequency).toBeCloseTo(440, 1);
    });

    it('50%修正应该在原频率和目标频率之间', () => {
      corrector.setCorrectionAmount(0.5);
      const result = corrector.correct(442);

      // 442 和 440 之间的50%应该是441
      expect(result.frequency).toBeCloseTo(441, 0.5);
    });

    it('100%修正应该完全吸附到目标频率', () => {
      corrector.setCorrectionAmount(1.0);
      const result = corrector.correct(442);

      expect(result.frequency).toBeCloseTo(440, 1);
    });
  });

  describe('置信度处理', () => {
    it('高置信度应该应用修正', () => {
      const result = corrector.correct(442, 0.8);
      expect(result.correctionApplied).toBe(true);
    });

    it('低置信度应该跳过修正', () => {
      const result = corrector.correct(442, 0.2);
      expect(result.correctionApplied).toBe(false);
      expect(result.frequency).toBe(442);
    });
  });

  describe('边界情况', () => {
    it('应该处理无效输入', () => {
      const result = corrector.correct(0);
      expect(result.frequency).toBe(0);
    });

    it('应该处理负数频率', () => {
      const result = corrector.correct(-100);
      expect(result.frequency).toBe(0);
    });

    it('应该处理极低频率', () => {
      const result = corrector.correct(20); // 人耳下限
      expect(result.frequency).toBeGreaterThan(0);
    });

    it('应该处理极高频率', () => {
      const result = corrector.correct(10000); // 高音
      expect(result.frequency).toBeGreaterThan(0);
    });
  });

  describe('音分计算', () => {
    it('应该正确计算音分偏移', () => {
      // 442Hz 比 440Hz 高约 7.85 cents
      const result = corrector.correct(442);
      expect(Math.abs(result.cents)).toBeLessThan(10);
    });

    it('完全准确的音高应该有0音分偏移', () => {
      const result = corrector.correct(440); // 完美的A4
      expect(Math.abs(result.cents)).toBeLessThan(1);
    });
  });

  describe('统计信息', () => {
    it('应该追踪处理次数', () => {
      corrector.correct(440);
      corrector.correct(442);
      corrector.correct(445);

      const stats = corrector.getStats();
      expect(stats.processedCount).toBe(3);
      expect(stats.correctedCount).toBe(3);
    });

    it('应该计算平均音分误差', () => {
      corrector.correct(442); // ~7.85 cents
      corrector.correct(438); // ~-7.85 cents

      const stats = corrector.getStats();
      expect(stats.avgCentsError).toBeGreaterThan(0);
      expect(stats.avgCentsError).toBeLessThan(10);
    });

    it('应该能重置统计', () => {
      corrector.correct(440);
      corrector.resetStats();

      const stats = corrector.getStats();
      expect(stats.processedCount).toBe(0);
      expect(stats.correctedCount).toBe(0);
    });
  });

  describe('音阶定义', () => {
    it('应该有全音阶定义', () => {
      expect(SCALES.CHROMATIC.notes).toHaveLength(12);
    });

    it('应该有大调音阶定义', () => {
      expect(SCALES.MAJOR.notes).toHaveLength(7);
    });

    it('应该有小调音阶定义', () => {
      expect(SCALES.MINOR.notes).toHaveLength(7);
    });

    it('应该有五声音阶定义', () => {
      expect(SCALES.PENTATONIC_MAJOR.notes).toHaveLength(5);
      expect(SCALES.PENTATONIC_MINOR.notes).toHaveLength(5);
    });
  });
});
