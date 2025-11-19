/**
 * Pitch Corrector - 音高修正模块 (Auto-Tune)
 *
 * 功能:
 * - 将检测到的音高自动"吸附"到最近的正确音高
 * - 支持可调的修正速度 (Retune Speed): 0ms (Robot) -> 200ms (Natural)
 * - 支持音阶过滤(只修正到特定音阶,如C大调、A小调等)
 * - 带有迟滞 (Hysteresis) 处理，防止在音符边界颤动
 *
 * @module PitchCorrector
 * @version 0.4.1
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
   * @param {number} [options.retuneSpeed=0] - 修正速度 (0-1, 0=Fast, 1=Slow)
   * @param {string} [options.scale='CHROMATIC'] - 音阶类型
   * @param {string} [options.key='C'] - 调号 (C, C#, D, ...)
   * @param {number} [options.referenceFreq=440] - 参考音高 A4 (Hz)
   */
  constructor(options = {}) {
    // 修正速度 (Retune Speed): 0 = Robot (0ms), 1 = Natural (~200ms)
    this.retuneSpeed = options.retuneSpeed !== undefined ? options.retuneSpeed : 0.0;
    
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

    // 状态变量
    this.currentOutputFreq = 0; // 当前输出频率 (用于平滑)
    this.lastTime = 0;          // 上次处理的时间戳
    this.currentMidiNote = -1;  // 当前锁定的MIDI音符 (用于迟滞)
    
    // 迟滞阈值 (半音) - 必须偏离当前音符这么多才能切换到新音符
    this.hysteresisThreshold = 0.6; 

    // 统计信息
    this.stats = {
      processedCount: 0,
      correctedCount: 0,
      avgCentsError: 0,
      totalCentsError: 0
    };

    console.log('[PitchCorrector] 初始化完成');
    console.log(`  Retune Speed: ${(this.retuneSpeed * 100).toFixed(0)}%`);
    console.log(`  音阶: ${SCALES[this.scale]?.name || this.scale}`);
    console.log(`  调号: ${this.key}`);
  }

  /**
   * 修正音高
   * @param {number} inputFreq - 输入频率 (Hz)
   * @param {number} [confidence=1.0] - 检测置信度 (0-1)
   * @param {number} [timestamp] - 当前时间戳 (ms)，可选，默认 Date.now()
   * @returns {Object} 修正后的结果
   */
  correct(inputFreq, confidence = 1.0, timestamp = Date.now()) {
    this.stats.processedCount++;
    const dt = this.lastTime > 0 ? (timestamp - this.lastTime) : 16; // 默认16ms
    this.lastTime = timestamp;

    // 输入验证
    if (!inputFreq || inputFreq <= 0) {
      this.currentOutputFreq = 0;
      this.currentMidiNote = -1;
      return this._createNullResult();
    }

    // 初始化
    if (this.currentOutputFreq === 0) {
      this.currentOutputFreq = inputFreq;
    }

    // 低置信度时不修正，但更新状态以避免跳变
    if (confidence < 0.3) {
      this.currentOutputFreq = inputFreq;
      return this._createPassthroughResult(inputFreq);
    }

    // 1. 频率 -> MIDI
    const inputMidi = this._freqToMidi(inputFreq);

    // 2. 找到目标音符 (带迟滞)
    // 如果当前已经锁定了一个音符，且输入音符还在该音符的迟滞范围内，则保持锁定
    let targetMidiNote = -1;
    
    if (this.currentMidiNote !== -1) {
        const dist = Math.abs(inputMidi - this.currentMidiNote);
        if (dist < this.hysteresisThreshold) {
            // 保持当前音符，即使它可能不是绝对最近的
            // 检查当前音符是否在当前音阶内 (以防音阶切换)
            if (this._isNoteInScale(this.currentMidiNote)) {
                targetMidiNote = this.currentMidiNote;
            }
        }
    }

    // 如果没有锁定或超出了迟滞范围，寻找最近的音阶内音符
    if (targetMidiNote === -1) {
        targetMidiNote = this._snapToScale(inputMidi);
        this.currentMidiNote = targetMidiNote;
    }

    // 3. 目标频率
    const targetFreq = this._midiToFreq(targetMidiNote);

    // 4. 计算 Smoothing Factor (Alpha)
    // Retune Speed 0 -> Tau = 0ms (Fast)
    // Retune Speed 1 -> Tau = 200ms (Slow)
    // Alpha = 1 - exp(-dt / tau)
    // 当 tau -> 0, alpha -> 1
    
    let alpha = 1.0;
    
    // 映射 retuneSpeed (0-1) 到 tau (ms)
    // 使用指数映射让调整更自然
    const maxTau = 200; // 最大平滑时间 200ms
    const tau = Math.pow(this.retuneSpeed, 2) * maxTau;
    
    if (tau > 1) { // 避免除以0
       alpha = 1.0 - Math.exp(-dt / tau);
    }

    // 5. 应用平滑 (Time-based Smoothing)
    this.currentOutputFreq += (targetFreq - this.currentOutputFreq) * alpha;

    // 6. 计算最终结果数据
    const finalFreq = this.currentOutputFreq;
    const finalMidi = this._freqToMidi(finalFreq); // 输出的实际 MIDI 值
    
    // 计算相对于目标音符的偏差 (用于显示)
    const cents = (finalMidi - targetMidiNote) * 100;
    const inputCents = (inputMidi - targetMidiNote) * 100;
    
    // 获取目标音符名称
    const noteInfo = this._midiToNote(targetMidiNote);
    const inputNoteInfo = this._midiToNote(Math.round(inputMidi)); // 原始输入的最近音符

    // 更新统计
    this.stats.correctedCount++;
    this.stats.totalCentsError += Math.abs(cents);
    this.stats.avgCentsError = this.stats.totalCentsError / this.stats.correctedCount;

    return {
      frequency: finalFreq,
      
      // 目标音符信息
      note: noteInfo.note,
      octave: noteInfo.octave,
      targetFrequency: targetFreq,
      
      // 原始输入音符信息 (用于 UI 显示 "C# -> D")
      inputNote: inputNoteInfo.note,
      inputOctave: inputNoteInfo.octave,
      inputCents: inputCents,

      cents: cents,
      correctionApplied: true
    };
  }

  /**
   * 设置 Retune Speed
   * @param {number} speed - 0 (Fast/Robot) to 1 (Slow/Natural)
   */
  setRetuneSpeed(speed) {
    this.retuneSpeed = Math.max(0, Math.min(1, speed));
    console.log(`[PitchCorrector] Retune Speed 更新: ${(this.retuneSpeed * 100).toFixed(0)}%`);
  }

  /**
   * 设置音阶和调号
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
    
    // 切换音阶时重置锁定，防止卡在错误的音符上
    this.currentMidiNote = -1;

    console.log(`[PitchCorrector] 音阶更新: ${SCALES[scale].name}, 调号: ${this.key}`);
  }

  getStats() { return { ...this.stats }; }
  resetStats() {
    this.stats = { processedCount: 0, correctedCount: 0, avgCentsError: 0, totalCentsError: 0 };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  _freqToMidi(freq) { return 69 + 12 * Math.log2(freq / this.referenceFreq); }
  _midiToFreq(midi) { return this.referenceFreq * Math.pow(2, (midi - 69) / 12); }

  /**
   * 检查音符是否在当前音阶内
   */
  _isNoteInScale(midiNote) {
      const noteIndex = Math.round(midiNote) % 12;
      // 将 noteIndex 转换到 Key 的相对位置
      // scaleNotes 是相对 Key 的 (例如 C 大调 [0, 2, 4...])
      // adjustedIndex = (noteIndex - keyOffset)
      let adjustedIndex = (noteIndex - this.keyOffset) % 12;
      if (adjustedIndex < 0) adjustedIndex += 12;
      
      return this.scaleNotes.includes(adjustedIndex);
  }

  _snapToScale(midiNote) {
    const roundedMidi = Math.round(midiNote);
    const octave = Math.floor(roundedMidi / 12);
    const noteInOctave = roundedMidi % 12;
    const adjustedNote = (noteInOctave - this.keyOffset + 12) % 12;

    let closestNote = this.scaleNotes[0];
    let minDistance = Math.abs(adjustedNote - closestNote);

    // 处理循环边界 (例如 11 到 0 的距离是 1)
    // 简单的线性搜索通常足够，因为音阶只有 12 个音
    for (const scaleNote of this.scaleNotes) {
      let distance = Math.abs(adjustedNote - scaleNote);
      // 处理跨越八度的距离 (如 11 和 0 距离为 1)
      if (distance > 6) distance = 12 - distance; 
      
      if (distance < minDistance) {
        minDistance = distance;
        closestNote = scaleNote;
      }
    }

    const finalNote = (closestNote + this.keyOffset) % 12;
    return octave * 12 + finalNote;
  }

  _midiToNote(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const note = NOTE_NAMES[midi % 12];
    return { note, octave };
  }

  _createNullResult() {
    return {
      frequency: 0, note: '', octave: 0, cents: 0, targetFrequency: 0,
      inputNote: '', inputOctave: 0, correctionApplied: false
    };
  }

  _createPassthroughResult(freq) {
    const midiNote = this._freqToMidi(freq);
    const noteInfo = this._midiToNote(Math.round(midiNote));
    return {
      frequency: freq, note: noteInfo.note, octave: noteInfo.octave, cents: 0, targetFrequency: freq,
      inputNote: noteInfo.note, inputOctave: noteInfo.octave, correctionApplied: false
    };
  }
}

export default PitchCorrector;