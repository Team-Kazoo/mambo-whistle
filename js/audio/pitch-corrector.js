/**
 * Pitch Corrector - 音高修正模块 (Auto-Tune)
 *
 * 功能:
 * - 将检测到的音高自动"吸附"到最近的正确音高
 * - 支持可调的修正强度(0% = 不修正, 100% = 完全修正)
 * - 支持音阶过滤(只修正到特定音阶,如C大调、A小调等)
 *
 * 实现方法:
 * - 方法1: 简单量化 (Pitch Quantization) - 低延迟,适合实时
 * - 方法2: (未来) Phase Vocoder - 音质更好但延迟高
 *
 * @module PitchCorrector
 * @version 0.4.0
 */

/**
 * 音阶定义 (Scale Definitions)
 */
export const SCALES = {
  CHROMATIC: {
    name: 'Chromatic (全音阶)',
    notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // 所有半音
  },
  MAJOR: {
    name: 'Major (大调)',
    notes: [0, 2, 4, 5, 7, 9, 11] // C大调: C D E F G A B
  },
  MINOR: {
    name: 'Minor (小调)',
    notes: [0, 2, 3, 5, 7, 8, 10] // A小调: A B C D E F G
  },
  PENTATONIC_MAJOR: {
    name: 'Pentatonic Major (大调五声)',
    notes: [0, 2, 4, 7, 9] // C D E G A
  },
  PENTATONIC_MINOR: {
    name: 'Pentatonic Minor (小调五声)',
    notes: [0, 3, 5, 7, 10] // A C D E G
  },
  BLUES: {
    name: 'Blues (布鲁斯)',
    notes: [0, 3, 5, 6, 7, 10] // A C D Eb E G
  }
};

/**
 * 音符名称映射 (Note Names)
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * PitchCorrector 类
 */
export class PitchCorrector {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} [options.correctionAmount=0.5] - 修正强度 (0-1)
   * @param {string} [options.scale='CHROMATIC'] - 音阶类型
   * @param {string} [options.key='C'] - 调号 (C, C#, D, ...)
   * @param {number} [options.referenceFreq=440] - 参考音高 A4 (Hz)
   */
  constructor(options = {}) {
    this.correctionAmount = options.correctionAmount !== undefined ? options.correctionAmount : 0.5;
    this.scale = options.scale || 'CHROMATIC';
    this.key = options.key || 'C';
    this.referenceFreq = options.referenceFreq || 440; // A4 = 440Hz

    // 计算调号偏移 (C=0, C#=1, D=2, ...)
    this.keyOffset = NOTE_NAMES.indexOf(this.key);
    if (this.keyOffset === -1) {
      console.warn(`[PitchCorrector] Invalid key: ${this.key}, using C`);
      this.keyOffset = 0;
    }

    // 获取音阶定义
    this.scaleNotes = SCALES[this.scale]?.notes || SCALES.CHROMATIC.notes;

    // 统计信息
    this.stats = {
      processedCount: 0,
      correctedCount: 0,
      avgCentsError: 0,
      totalCentsError: 0
    };

    console.log('[PitchCorrector] 初始化完成');
    console.log(`  修正强度: ${(this.correctionAmount * 100).toFixed(0)}%`);
    console.log(`  音阶: ${SCALES[this.scale]?.name || this.scale}`);
    console.log(`  调号: ${this.key}`);
    console.log(`  参考音高: A4 = ${this.referenceFreq}Hz`);
  }

  /**
   * 修正音高
   * @param {number} inputFreq - 输入频率 (Hz)
   * @param {number} [confidence=1.0] - 检测置信度 (0-1)
   * @returns {Object} 修正后的结果
   * @returns {number} result.frequency - 修正后的频率 (Hz)
   * @returns {string} result.note - 目标音符
   * @returns {number} result.octave - 八度
   * @returns {number} result.cents - 原始频率偏离目标的音分数
   * @returns {number} result.targetFrequency - 目标频率 (Hz)
   */
  correct(inputFreq, confidence = 1.0) {
    this.stats.processedCount++;

    // 输入验证
    if (!inputFreq || inputFreq <= 0) {
      return this._createNullResult();
    }

    // 低置信度时不修正
    if (confidence < 0.3) {
      return this._createPassthroughResult(inputFreq);
    }

    // 1. 将频率转换为MIDI音符号 (浮点数)
    const midiNote = this._freqToMidi(inputFreq);

    // 2. 找到最近的音阶内音符
    const targetMidiNote = this._snapToScale(midiNote);

    // 3. 将目标MIDI音符转换回频率
    const targetFreq = this._midiToFreq(targetMidiNote);

    // 4. 计算偏移量(音分)
    const cents = (midiNote - targetMidiNote) * 100;

    // 5. 应用修正强度 (线性插值)
    const correctedFreq = this._lerp(inputFreq, targetFreq, this.correctionAmount);

    // 6. 获取音符信息
    const noteInfo = this._midiToNote(targetMidiNote);

    // 更新统计
    this.stats.correctedCount++;
    this.stats.totalCentsError += Math.abs(cents);
    this.stats.avgCentsError = this.stats.totalCentsError / this.stats.correctedCount;

    return {
      frequency: correctedFreq,
      note: noteInfo.note,
      octave: noteInfo.octave,
      cents: cents,
      targetFrequency: targetFreq,
      correctionApplied: this.correctionAmount > 0
    };
  }

  /**
   * 设置修正强度
   * @param {number} amount - 修正强度 (0-1)
   */
  setCorrectionAmount(amount) {
    this.correctionAmount = Math.max(0, Math.min(1, amount));
    console.log(`[PitchCorrector] 修正强度更新: ${(this.correctionAmount * 100).toFixed(0)}%`);
  }

  /**
   * 设置音阶和调号
   * @param {string} scale - 音阶类型 (CHROMATIC, MAJOR, MINOR, etc.)
   * @param {string} key - 调号 (C, C#, D, ...)
   */
  setScale(scale, key) {
    if (!SCALES[scale]) {
      console.warn(`[PitchCorrector] Invalid scale: ${scale}`);
      return;
    }

    this.scale = scale;
    this.key = key || this.key;
    this.scaleNotes = SCALES[scale].notes;
    this.keyOffset = NOTE_NAMES.indexOf(this.key);

    console.log(`[PitchCorrector] 音阶更新: ${SCALES[scale].name}, 调号: ${this.key}`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      processedCount: 0,
      correctedCount: 0,
      avgCentsError: 0,
      totalCentsError: 0
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 频率转MIDI音符号
   * @private
   * @param {number} freq - 频率 (Hz)
   * @returns {number} MIDI音符号 (浮点数)
   */
  _freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / this.referenceFreq);
  }

  /**
   * MIDI音符号转频率
   * @private
   * @param {number} midi - MIDI音符号
   * @returns {number} 频率 (Hz)
   */
  _midiToFreq(midi) {
    return this.referenceFreq * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * 吸附到最近的音阶内音符
   * @private
   * @param {number} midiNote - 输入MIDI音符号 (浮点数)
   * @returns {number} 最近的音阶内MIDI音符号 (整数)
   */
  _snapToScale(midiNote) {
    // 1. 四舍五入到最近的半音
    const roundedMidi = Math.round(midiNote);

    // 2. 分解为八度和音符
    const octave = Math.floor(roundedMidi / 12);
    const noteInOctave = roundedMidi % 12;

    // 3. 应用调号偏移
    const adjustedNote = (noteInOctave - this.keyOffset + 12) % 12;

    // 4. 找到音阶内最近的音符
    let closestNote = this.scaleNotes[0];
    let minDistance = Math.abs(adjustedNote - closestNote);

    for (const scaleNote of this.scaleNotes) {
      const distance = Math.abs(adjustedNote - scaleNote);
      if (distance < minDistance) {
        minDistance = distance;
        closestNote = scaleNote;
      }
    }

    // 5. 转换回绝对MIDI音符号
    const finalNote = (closestNote + this.keyOffset) % 12;
    return octave * 12 + finalNote;
  }

  /**
   * MIDI音符号转音符信息
   * @private
   * @param {number} midi - MIDI音符号 (整数)
   * @returns {Object} {note, octave}
   */
  _midiToNote(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const note = NOTE_NAMES[midi % 12];
    return { note, octave };
  }

  /**
   * 线性插值
   * @private
   */
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * 创建空结果
   * @private
   */
  _createNullResult() {
    return {
      frequency: 0,
      note: '',
      octave: 0,
      cents: 0,
      targetFrequency: 0,
      correctionApplied: false
    };
  }

  /**
   * 创建直通结果 (不修正)
   * @private
   */
  _createPassthroughResult(freq) {
    const midiNote = this._freqToMidi(freq);
    const noteInfo = this._midiToNote(Math.round(midiNote));

    return {
      frequency: freq,
      note: noteInfo.note,
      octave: noteInfo.octave,
      cents: 0,
      targetFrequency: freq,
      correctionApplied: false
    };
  }
}

export default PitchCorrector;
