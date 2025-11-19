/**
 * UI Manager - 统一的 UI 状态和事件管理
 *  模块化重构 - 发布-订阅模式
 *
 * 设计原则:
 * - Single Responsibility: 只负责 UI 更新和事件管理
 * - Observer Pattern: 发布-订阅解耦业务逻辑和 UI
 * - Separation of Concerns: UI 逻辑与业务逻辑分离
 *
 * @module UIManager
 * @author Ziming Wang & Claude
 * @date 2025-11-04
 */

/**
 * UI 事件类型枚举
 * @readonly
 * @enum {string}
 */
export const UI_EVENTS = {
  // 状态变化
  STATUS_CHANGE: 'status-change',
  ERROR: 'error',
  WARNING: 'warning',

  // 音频相关
  PITCH_UPDATE: 'pitch-update',
  VOLUME_UPDATE: 'volume-update',
  LATENCY_UPDATE: 'latency-update',

  // 校准相关
  CALIBRATION_START: 'calibration-start',
  CALIBRATION_PROGRESS: 'calibration-progress',
  CALIBRATION_COMPLETE: 'calibration-complete',
  CALIBRATION_ERROR: 'calibration-error',

  // 乐器选择
  INSTRUMENT_CHANGE: 'instrument-change',

  // 控制按钮
  START_CLICKED: 'start-clicked',
  STOP_CLICKED: 'stop-clicked'
};

/**
 * UI Manager 类
 *
 * 功能:
 * 1. DOM 元素管理 (缓存引用)
 * 2. UI 状态更新 (音高、音量、状态等)
 * 3. 事件管理 (发布-订阅)
 * 4. 错误和警告显示
 * 5. 可视化控制
 *
 * @example
 * const uiManager = new UIManager(logger);
 * uiManager.initialize();
 *
 * // 订阅事件
 * uiManager.on(UI_EVENTS.START_CLICKED, () => {
 *   console.log('Start button clicked!');
 * });
 *
 * // 更新 UI
 * uiManager.updatePitch(440, 'A', 4, 0);
 * uiManager.updateStatus('Running');
 */
export class UIManager {
  /**
   * 创建 UI Manager 实例
   *
   * @param {Logger} [logger] - 日志实例 (可选)
   */
  constructor(logger = null) {
    /**
     * 日志实例
     * @type {Logger}
     */
    this.logger = logger;

    /**
     * 事件监听器映射
     * @type {Map<string, Function[]>}
     */
    this.listeners = new Map();

    /**
     * DOM 元素缓存
     * @type {Object}
     */
    this.elements = {};

    /**
     * 是否已初始化
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * 当前状态
     * @type {Object}
     */
    this.state = {
      isRunning: false,
      selectedInstrument: 'saxophone',
      latency: null,
      lastPitch: null
    };
  }

  /**
   * 初始化 UI Manager
   *
   * - 缓存 DOM 元素引用
   * - 绑定事件监听器
   * - 初始化 UI 状态
   *
   * @throws {Error} 如果关键元素不存在
   */
  initialize() {
    if (this.initialized) {
      this._log('warn', 'UI Manager 已初始化，跳过');
      return;
    }

    this._log('info', '初始化 UI Manager...');

    // 缓存 DOM 元素
    this._cacheElements();

    // 绑定事件监听器
    this._bindEvents();

    // 初始化 UI 状态
    this._initializeState();

    this.initialized = true;
    this._log('info', 'UI Manager 初始化完成');
  }

  /**
   * 缓存 DOM 元素引用
   * @private
   */
  _cacheElements() {
    // 控制按钮
    this.elements.startBtn = document.getElementById('startBtn');
    this.elements.stopBtn = document.getElementById('stopBtn');

    // 状态显示
    this.elements.recordingStatus = document.getElementById('recordingStatus');
    this.elements.systemStatus = document.getElementById('systemStatus');
    this.elements.latency = document.getElementById('latency');
    this.elements.confidence = document.getElementById('confidence');

    // 音高显示
    this.elements.noteDisplay = document.getElementById('note-display');
    this.elements.noteText = document.getElementById('note-text');
    this.elements.frequencyDisplay = document.getElementById('frequency-display');
    this.elements.centsDisplay = document.getElementById('cents-display');

    // 可视化
    this.elements.visualizer = document.getElementById('visualizer');
    this.elements.statusBar = document.getElementById('statusBar');
    this.elements.pitchCanvas = document.getElementById('pitch-canvas');

    // 乐器选择
    this.elements.instrumentBtns = document.querySelectorAll('.instrument-btn:not([disabled])');

    // 警告框
    this.elements.warningBox = document.getElementById('warning-box');
    this.elements.warningText = document.getElementById('warning-text');

    // Tuner Display
    this.elements.tunerDisplay = document.getElementById('tunerDisplay');
    this.elements.tunerInput = document.getElementById('tunerInput');
    this.elements.tunerTarget = document.getElementById('tunerTarget');
    this.elements.tunerCents = document.getElementById('tunerCents');

    // 验证关键元素
    const required = ['startBtn', 'stopBtn', 'recordingStatus'];
    for (const key of required) {
      if (!this.elements[key]) {
        throw new Error(`[UIManager] 关键元素未找到: ${key}`);
      }
    }

    this._log('debug', 'DOM 元素已缓存', {
      total: Object.keys(this.elements).length,
      instruments: this.elements.instrumentBtns.length
    });
  }

  /**
   * 绑定 DOM 事件监听器
   * @private
   */
  _bindEvents() {
    // Start 按钮
    this.elements.startBtn?.addEventListener('click', () => {
      this._log('debug', 'Start 按钮被点击');
      this.emit(UI_EVENTS.START_CLICKED);
    });

    // Stop 按钮
    this.elements.stopBtn?.addEventListener('click', () => {
      this._log('debug', 'Stop 按钮被点击');
      this.emit(UI_EVENTS.STOP_CLICKED);
    });

    // 乐器选择按钮
    this.elements.instrumentBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const instrument = btn.dataset.instrument;
        this._log('debug', '乐器被选择:', instrument);
        this.selectInstrument(instrument);
        this.emit(UI_EVENTS.INSTRUMENT_CHANGE, { instrument });
      });
    });

    this._log('debug', 'DOM 事件已绑定');
  }

  /**
   * 初始化 UI 状态
   * @private
   */
  _initializeState() {
    // 默认选中 Saxophone
    this.selectInstrument('saxophone');

    // 隐藏 Stop 按钮
    this.elements.stopBtn?.classList.add('hidden');

    // 隐藏可视化
    this.elements.visualizer?.classList.add('hidden');
    this.elements.statusBar?.classList.add('hidden');

    this._log('debug', 'UI 初始状态已设置');
  }

  // ==================== 事件系统 ====================

  /**
   * 订阅事件
   *
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   *
   * @example
   * const unsubscribe = uiManager.on(UI_EVENTS.PITCH_UPDATE, (data) => {
   *   console.log('Pitch:', data.frequency);
   * });
   *
   * // 取消订阅
   * unsubscribe();
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('[UIManager] 回调必须是函数');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /**
   * 取消订阅事件
   *
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * 发布事件
   *
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        this._log('error', `事件处理器错误: ${event}`, error);
      }
    });
  }

  /**
   * 清空所有事件监听器
   */
  clearListeners() {
    this.listeners.clear();
    this._log('debug', '所有事件监听器已清空');
  }

  // ==================== UI 更新方法 ====================

  /**
   * 更新音高显示
   *
   * @param {number} frequency - 频率 (Hz)
   * @param {string} note - 音符名称 (C, C#, D, ...)
   * @param {number} octave - 八度
   * @param {number} cents - 音分偏移 (-50 ~ +50)
   */
  updatePitch(frequency, note, octave, cents) {
    if (this.elements.noteText) {
      this.elements.noteText.textContent = `${note}${octave}`;
    }

    if (this.elements.frequencyDisplay) {
      this.elements.frequencyDisplay.textContent = `${frequency.toFixed(1)} Hz`;
    }

    if (this.elements.centsDisplay) {
      const sign = cents >= 0 ? '+' : '';
      this.elements.centsDisplay.textContent = `${sign}${cents.toFixed(0)}¢`;
    }

    this.state.lastPitch = { frequency, note, octave, cents };
    this.emit(UI_EVENTS.PITCH_UPDATE, { frequency, note, octave, cents });
  }

  /**
   * 更新置信度显示
   *
   * @param {number} confidence - 置信度 (0-1)
   */
  updateConfidence(confidence) {
    if (this.elements.confidence) {
      this.elements.confidence.textContent = (confidence * 100).toFixed(0) + '%';
    }
  }

  /**
   * 更新延迟显示
   *
   * @param {number} latency - 延迟 (ms)
   */
  updateLatency(latency) {
    if (this.elements.latency) {
      this.elements.latency.textContent = `${latency.toFixed(1)}ms`;
    }

    this.state.latency = latency;
    this.emit(UI_EVENTS.LATENCY_UPDATE, { latency });
  }

  /**
   * 更新状态显示
   *
   * @param {string} status - 状态文本
   * @param {string} [type='info'] - 状态类型: info/warning/error
   */
  updateStatus(status, type = 'info') {
    // 更新录音状态
    if (this.elements.recordingStatus) {
      this.elements.recordingStatus.textContent = status;

      // 更新状态样式
      this.elements.recordingStatus.className = 'status-badge';
      if (type === 'error') {
        this.elements.recordingStatus.classList.add('status-error');
      } else if (type === 'warning') {
        this.elements.recordingStatus.classList.add('status-warning');
      } else if (status.toLowerCase().includes('running')) {
        this.elements.recordingStatus.classList.add('status-running');
      } else {
        this.elements.recordingStatus.classList.add('status-ready');
      }
    }

    // 更新系统状态
    if (this.elements.systemStatus) {
      this.elements.systemStatus.textContent = status;
    }

    this.emit(UI_EVENTS.STATUS_CHANGE, { status, type });
  }

  /**
   * 更新调音器显示 (Auto-Tune Visualizer)
   * @param {Object} info - 修正信息 { inputNote, inputOctave, note, octave, cents }
   */
  updateTunerDisplay(info) {
      if (!this.elements.tunerDisplay) return;

      if (!info) {
          this.elements.tunerDisplay.classList.add('hidden');
          return;
      }

      this.elements.tunerDisplay.classList.remove('hidden');
      
      if (this.elements.tunerInput) {
          this.elements.tunerInput.textContent = `${info.inputNote}${info.inputOctave}`;
      }
      
      if (this.elements.tunerTarget) {
          this.elements.tunerTarget.textContent = `${info.note}${info.octave}`;
      }
      
      if (this.elements.tunerCents && info.inputCents !== undefined) {
          const displayCents = info.inputCents;
          const sign = displayCents >= 0 ? '+' : '';
          this.elements.tunerCents.textContent = `(${sign}${displayCents.toFixed(0)}¢)`;
          
          // Color coding for cents
          if (Math.abs(displayCents) < 10) {
              this.elements.tunerCents.className = 'text-[10px] ml-2 text-green-500 font-bold';
          } else {
              this.elements.tunerCents.className = 'text-[10px] ml-2 text-gray-400';
          }
      }
  }

  /**
   * 选择乐器
   *
   * @param {string} instrument - 乐器名称
   */
  selectInstrument(instrument) {
    this.state.selectedInstrument = instrument;

    // 更新按钮样式
    this.elements.instrumentBtns?.forEach(btn => {
      if (btn.dataset.instrument === instrument) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    this._log('debug', '乐器已选择:', instrument);
  }

  /**
   * 显示错误
   *
   * @param {string} message - 错误消息
   */
  showError(message) {
    // Alert 弹窗
    alert(` ${message}`);

    // 更新警告框
    if (this.elements.warningBox && this.elements.warningText) {
      this.elements.warningBox.classList.remove('hidden');
      this.elements.warningText.innerHTML = `<li>${message.replace(/\n/g, '</li><li>')}</li>`;
    }

    // 更新状态
    this.updateStatus('Error', 'error');

    this.emit(UI_EVENTS.ERROR, { message });
  }

  /**
   * 显示警告
   *
   * @param {string} message - 警告消息
   */
  showWarning(message) {
    if (this.elements.warningBox && this.elements.warningText) {
      this.elements.warningBox.classList.remove('hidden');
      this.elements.warningText.innerHTML = `<li>${message}</li>`;
    }

    this.emit(UI_EVENTS.WARNING, { message });
  }

  /**
   * 隐藏警告框
   */
  hideWarning() {
    this.elements.warningBox?.classList.add('hidden');
  }

  // ==================== 控制方法 ====================

  /**
   * 显示运行状态 UI
   */
  showRunning() {
    this.state.isRunning = true;

    // 切换按钮
    this.elements.startBtn?.classList.add('hidden');
    this.elements.stopBtn?.classList.remove('hidden');

    // 显示可视化
    this.elements.visualizer?.classList.remove('hidden');
    this.elements.statusBar?.classList.remove('hidden');

    // 更新状态
    this.updateStatus('Running (Continuous)', 'info');

    this._log('debug', 'UI 切换到运行状态');
  }

  /**
   * 显示停止状态 UI
   */
  showStopped() {
    this.state.isRunning = false;

    // 切换按钮
    this.elements.startBtn?.classList.remove('hidden');
    this.elements.stopBtn?.classList.add('hidden');

    // 隐藏可视化
    this.elements.visualizer?.classList.add('hidden');
    this.elements.statusBar?.classList.add('hidden');

    // 更新状态
    this.updateStatus('Ready', 'info');

    this._log('debug', 'UI 切换到停止状态');
  }

  // ==================== 工具方法 ====================

  /**
   * 获取当前状态
   *
   * @returns {Object} 当前状态
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 日志输出 (内部使用)
   * @private
   */
  _log(level, ...args) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](...args);
    } else {
      console[level]?.(`[UIManager]`, ...args);
    }
  }

  /**
   * 销毁 UI Manager
   */
  destroy() {
    this.clearListeners();
    this.elements = {};
    this.initialized = false;
    this._log('info', 'UI Manager 已销毁');
  }
}

// 默认导出
export default UIManager;
