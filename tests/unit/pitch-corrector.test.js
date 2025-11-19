import { describe, it, expect, beforeEach } from 'vitest';
import { PitchCorrector, SCALES } from '../../js/audio/pitch-corrector.js';

describe('PitchCorrector', () => {
  let corrector;

  beforeEach(() => {
    corrector = new PitchCorrector();
    // Default: retuneSpeed = 0 (Fast/Robot)
  });

  describe('初始化', () => {
    it('应该使用默认参数创建', () => {
      const defaultCorrector = new PitchCorrector();
      expect(defaultCorrector.retuneSpeed).toBe(0);
      expect(defaultCorrector.scale).toBe('CHROMATIC');
      expect(defaultCorrector.key).toBe('C');
    });

    it('应该使用自定义参数创建', () => {
      const customCorrector = new PitchCorrector({
        retuneSpeed: 0.8,
        scale: 'MAJOR',
        key: 'D'
      });
      expect(customCorrector.retuneSpeed).toBe(0.8);
      expect(customCorrector.scale).toBe('MAJOR');
      expect(customCorrector.key).toBe('D');
    });
  });

  describe('音高修正 - 全音阶', () => {
    beforeEach(() => {
      corrector.setRetuneSpeed(0); // Fast/Robot mode
    });

    it('应该修正到最近的半音 - A4', () => {
      const result = corrector.correct(440);
      expect(result.targetFrequency).toBeCloseTo(440, 1);
      expect(result.frequency).toBeCloseTo(440, 1); // Instant snap
      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.cents).toBeCloseTo(0, 1); // Output cents should be 0
    });

    it('应该修正到最近的半音 - C4', () => {
      const result = corrector.correct(261.63);
      expect(result.targetFrequency).toBeCloseTo(261.63, 1);
      expect(result.note).toBe('C');
      expect(result.octave).toBe(4);
    });

    it('应该处理跑调的频率', () => {
      // A4 is 440Hz. Input 445Hz.
      const result = corrector.correct(445);
      
      // Output (Speed 0) should be 440
      expect(result.frequency).toBeCloseTo(440, 1); 
      
      // Output Cents should be 0 (perfectly corrected)
      expect(result.cents).toBeCloseTo(0, 1);
      
      // Input Cents should reflect the deviation
      // 445 vs 440 is approx +20 cents
      expect(Math.abs(result.inputCents)).toBeGreaterThan(10);
    });
  });

  describe('音高修正 - 大调音阶', () => {
    beforeEach(() => {
      corrector.setScale('MAJOR', 'C');
      corrector.setRetuneSpeed(0); // Fast
    });

    it('应该只修正到C大调音阶内的音符', () => {
      const cSharpFreq = 277.18;
      const result = corrector.correct(cSharpFreq);
      const isCorD = result.note === 'C' || result.note === 'D';
      expect(isCorD).toBe(true);
    });
  });

  describe('Retune Speed 控制', () => {
    it('0 (Robot) 应该瞬间吸附', () => {
      corrector.setRetuneSpeed(0);
      const input = 445; // Target 440
      const result = corrector.correct(input);
      expect(result.frequency).toBeCloseTo(440, 1); // Snapped
    });

    it('1 (Natural) 应该缓慢移动', () => {
      corrector.setRetuneSpeed(1.0); // Very slow
      const input = 445; // Target 440
      
      // First frame: initializes state to input, then applies first step of smoothing
      let result = corrector.correct(input);
      // With dt=16ms and tau=200ms, it moves slightly
      expect(result.frequency).toBeCloseTo(445, 0); 
      
      // Simulate time passing (20ms)
      const now = Date.now();
      result = corrector.correct(input, 1.0, now + 20); 
      
      // Should move slightly towards 440
      // 445 -> 444.61 (approx)
      // Should be close to 445, but slightly less
      expect(result.frequency).toBeLessThan(445);
      expect(result.frequency).toBeGreaterThan(444); 
    });
  });

  describe('迟滞 (Hysteresis) 测试', () => {
    beforeEach(() => {
      corrector.setRetuneSpeed(0); 
      corrector.setScale('CHROMATIC', 'C');
    });

    it('应该保持锁定当前音符直到超过阈值', () => {
        let result = corrector.correct(261.63); // C4
        expect(result.note).toBe('C');
        
        const freq60_55 = 261.63 * Math.pow(2, 0.55/12);
        result = corrector.correct(freq60_55);
        expect(result.note).toBe('C'); // Should stick to C
        
        const freq60_7 = 261.63 * Math.pow(2, 0.7/12);
        result = corrector.correct(freq60_7);
        expect(result.note).toBe('C#'); // Should switch
    });
  });

  describe('边界情况', () => {
    it('应该处理无效输入', () => {
      const result = corrector.correct(0);
      expect(result.correctionApplied).toBe(false);
    });
  });

  describe('音分计算', () => {
    it('应该正确计算音分偏移', () => {
      corrector.setRetuneSpeed(0);
      const freq = 440 * Math.pow(2, 40/1200); // +40 cents
      const result = corrector.correct(freq);
      
      // Output Cents (Corrected) -> 0
      expect(result.cents).toBeCloseTo(0, 1);
      
      // Input Cents -> 40
      expect(result.inputCents).toBeCloseTo(40, 1);
    });
  });
});
