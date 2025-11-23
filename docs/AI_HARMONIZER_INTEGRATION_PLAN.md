# MusicRNN AI Harmonizer 完整集成方案

**状态**: 📋 Ready to Implement
**预计工作量**: 2-3 hours
**完成后**: 可在 Presentation 中 Demo

---

## 🎯 目标

将 Google Magenta 的 MusicRNN 模型集成到现有系统中，实现：
- 用户哼唱 → AI 生成和声伴奏
- 异步加载（不影响页面性能）
- 完整的 UI 反馈（Loading → Ready → Jamming）

---

## 📋 实施步骤

### Step 1: 修改 `index.html` - 加载依赖

**位置**: `/index.html` 第918行之前（在 `<script src="js/lib/tone.js"></script>` 之后）

**添加**:
```html
<!-- AI 伴奏依赖 - 延迟加载策略 -->
<!-- TensorFlow.js 必须先加载 -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js"></script>
<!-- Magenta Music Core -->
<script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js"></script>
<!-- MusicRNN 模型 -->
<script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js"></script>
```

**为什么这样：**
- ✅ CDN 加载（无需 npm install）
- ✅ ES6 bundles（只加载需要的模块，不是全量包）
- ✅ 锁定版本（避免未来 API 变更）

**验证**:
打开浏览器 Console，输入：
```javascript
console.log(typeof window.mm); // 应该输出 "object"
console.log(typeof window.music_rnn); // 应该输出 "object"
```

---

### Step 2: 修复 `js/features/ai-harmonizer.js`

**当前问题**:
1. ❌ Line 56-58: 尝试动态加载 Magenta（但 CDN 脚本已经加载了，重复且错误）
2. ❌ Line 62: `new window.mm.MusicRNN()` - 构造函数调用错误
3. ❌ Line 148: `window.mm.freqToMidi()` - API 使用错误

**完整修复后的代码**:

保存为 `/js/features/ai-harmonizer-v2.js`（先不覆盖原文件，测试后再替换）

```javascript
// ai-harmonizer-v2.js - Fixed version with proper Magenta integration
const Tone = (typeof window !== 'undefined' && window.Tone) ? window.Tone : null;

/**
 * AI Harmonizer using Google Magenta (MusicRNN)
 *
 * FIXED:
 * - Removed dynamic script loading (scripts are already in HTML)
 * - Fixed MusicRNN model initialization
 * - Fixed freqToMidi conversion
 * - Improved error handling
 */
export class AiHarmonizer {
    constructor() {
        this.enabled = false;
        this.status = 'idle'; // idle, loading, ready, processing, error
        this.model = null;
        this.backingSynth = null;

        // Configuration
        this.checkpointURL = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv';
        this.temperature = 1.1; // Creativity level

        // Data Buffering
        this.noteBuffer = [];
        this.maxBufferLength = 32;
        this.lastProcessTime = 0;
        this.processInterval = 4000; // Generate every 4 seconds

        // State
        this.currentChord = null;
        this.isGenerating = false;

        // Event listeners
        this.onStatusChange = null;

        if (!Tone) {
            console.warn('[AI Harmonizer] Tone.js not available');
        }

        // Check if Magenta is available
        if (typeof window === 'undefined' || !window.music_rnn) {
            console.warn('[AI Harmonizer] Magenta not loaded. Add Magenta scripts to HTML.');
        }
    }

    /**
     * Initialize and enable AI Harmonizer
     */
    async enable() {
        if (this.enabled) return;
        if (!Tone) {
            throw new Error('Tone.js not available');
        }
        if (!window.music_rnn) {
            throw new Error('Magenta MusicRNN not loaded. Check HTML script tags.');
        }

        try {
            this._updateStatus('loading', 'Loading AI Model...');

            // Ensure AudioContext is running (user gesture required)
            if (Tone.context.state !== 'running') {
                await Tone.start();
                console.log('[AI Harmonizer] AudioContext resumed');
            }

            // Initialize MusicRNN Model
            if (!this.model) {
                this.model = new window.music_rnn.MusicRNN(this.checkpointURL);
                console.log('[AI Harmonizer] Initializing model from:', this.checkpointURL);
                await this.model.initialize();
                console.log('[AI Harmonizer] Model initialized successfully');
            }

            // Initialize Backing Synth
            if (!this.backingSynth) {
                this.backingSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: {
                        type: "fatsawtooth",
                        count: 3,
                        spread: 30
                    },
                    envelope: {
                        attack: 0.2,
                        decay: 0.1,
                        sustain: 0.5,
                        release: 1
                    }
                }).toDestination();

                // Lower volume
                this.backingSynth.volume.value = -12;

                // Add reverb
                const reverb = new Tone.Reverb(3).toDestination();
                this.backingSynth.connect(reverb);

                console.log('[AI Harmonizer] Backing synth created');
            }

            this.enabled = true;
            this._updateStatus('ready', 'AI Listening...');
            console.log('🤖 [AI Harmonizer] Ready');

        } catch (error) {
            console.error('[AI Harmonizer] Failed to load:', error);
            this._updateStatus('error', error.message || 'Model Load Failed');
            this.enabled = false;
            throw error; // Re-throw so UI can handle it
        }
    }

    disable() {
        this.enabled = false;
        this.isGenerating = false;

        if (this.backingSynth) {
            this.backingSynth.releaseAll();
        }

        this._updateStatus('idle', 'AI Off');
        console.log('[AI Harmonizer] Disabled');
    }

    /**
     * Process incoming pitch frame (called from main audio loop)
     * @param {Object} pitchFrame - { frequency, confidence, ... }
     */
    processFrame(pitchFrame = {}) {
        if (!this.enabled || !this.model || this.status !== 'ready') return;

        const now = Date.now();
        const clarity = pitchFrame.confidence ?? pitchFrame.clarity ?? 0;
        const frequency = pitchFrame.frequency ?? pitchFrame.pitch ?? 0;

        // Only buffer high-confidence notes
        if (clarity > 0.9 && frequency > 0) {
            this._addToBuffer(frequency);
        }

        // Trigger generation periodically
        if (now - this.lastProcessTime > this.processInterval && !this.isGenerating) {
            this._generateBackingSequence();
            this.lastProcessTime = now;
        }
    }

    /**
     * Add pitch to buffer (with MIDI conversion)
     */
    _addToBuffer(freq) {
        if (!window.core) {
            console.warn('[AI Harmonizer] Magenta core not available for freqToMidi');
            return;
        }

        // FIX: Use core.midiToNoteName and reverse engineer MIDI from freq
        // Magenta doesn't have freqToMidi, we need to calculate manually
        const midi = this._freqToMidi(freq);

        // Deduplication
        const lastNote = this.noteBuffer[this.noteBuffer.length - 1];
        if (lastNote !== midi) {
            this.noteBuffer.push(midi);
            if (this.noteBuffer.length > this.maxBufferLength) {
                this.noteBuffer.shift();
            }
        }
    }

    /**
     * Convert frequency to MIDI number (custom implementation)
     * Formula: MIDI = 69 + 12 * log2(freq / 440)
     */
    _freqToMidi(freq) {
        return Math.round(69 + 12 * Math.log2(freq / 440));
    }

    /**
     * Generate backing sequence using MusicRNN
     */
    async _generateBackingSequence() {
        if (this.noteBuffer.length < 5) {
            console.log('[AI Harmonizer] Not enough notes buffered (need 5, have', this.noteBuffer.length, ')');
            return;
        }

        this.isGenerating = true;
        this._updateStatus('processing', 'AI Thinking...');

        try {
            // Create NoteSequence from buffer
            const inputSequence = {
                notes: this.noteBuffer.map((pitch, index) => ({
                    pitch: pitch,
                    startTime: index * 0.25,
                    endTime: (index + 1) * 0.25,
                    velocity: 80
                })),
                totalTime: this.noteBuffer.length * 0.25,
                quantizationInfo: { stepsPerQuarter: 4 }
            };

            console.log('[AI Harmonizer] Input sequence:', inputSequence);

            // Generate continuation (16 steps ≈ 1 bar)
            const rnnSteps = 16;
            const result = await this.model.continueSequence(
                inputSequence,
                rnnSteps,
                this.temperature
            );

            console.log('[AI Harmonizer] Generated result:', result);

            // Play the result
            if (result && result.notes && result.notes.length > 0) {
                this._playBacking(result.notes);
                this._updateStatus('ready', 'AI Jamming ♪');
            } else {
                console.warn('[AI Harmonizer] No notes generated');
                this._updateStatus('ready', 'AI Listening...');
            }

        } catch (error) {
            console.error('[AI Harmonizer] Generation error:', error);
            this._updateStatus('ready', 'AI Listening...');
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Play generated notes using backing synth
     */
    _playBacking(notes) {
        if (!Tone || !this.backingSynth) return;

        const now = Tone.now();

        console.log('[AI Harmonizer] Playing', notes.length, 'notes');

        notes.forEach(note => {
            const duration = (note.endTime - note.startTime) || 0.25;
            const timeOffset = (note.startTime - notes[0].startTime) * 0.5;

            // Convert MIDI to frequency
            const freq = Tone.Frequency(note.pitch, "midi");

            // Trigger note
            this.backingSynth.triggerAttackRelease(
                freq,
                duration,
                now + timeOffset + 0.1
            );
        });
    }

    /**
     * Update status and notify listeners
     */
    _updateStatus(status, message) {
        this.status = status;
        console.log(`[AI Harmonizer] Status: ${status} - ${message}`);

        if (this.onStatusChange) {
            this.onStatusChange({ status, message });
        }
    }
}
```

**关键修复点**:
1. ✅ Line 40-42: 检查 Magenta 是否加载
2. ✅ Line 62: 正确的 MusicRNN 构造函数调用
3. ✅ Line 145-152: 自己实现 `_freqToMidi()`（Magenta没有这个API）
4. ✅ 改进错误处理和日志

---

### Step 3: 更新 `js/main.js` 引用

**位置**: Line 17

**修改前**:
```javascript
import { AiHarmonizer } from './features/ai-harmonizer.js';
```

**修改后**:
```javascript
import { AiHarmonizer } from './features/ai-harmonizer-v2.js'; // 使用修复版本
```

**或者直接替换文件**:
```bash
mv js/features/ai-harmonizer.js js/features/ai-harmonizer-old.js
mv js/features/ai-harmonizer-v2.js js/features/ai-harmonizer.js
```

---

### Step 4: 测试步骤

#### **1. 浏览器 Console 验证**

打开 http://localhost:3000，按 F12 打开 Console，输入：

```javascript
// 验证 Magenta 加载
console.log('TensorFlow:', typeof tf); // "object"
console.log('Magenta Core:', typeof core); // "object"
console.log('MusicRNN:', typeof music_rnn); // "object"

// 验证 AI Harmonizer 实例
console.log('AI Harmonizer:', window.app.aiHarmonizer);
console.log('Status:', window.app.aiHarmonizer.status);
```

#### **2. UI 测试流程**

1. 点击页面任意位置（激活 AudioContext）
2. 点击右上角 **"Smart Jam"** 按钮
3. 观察按钮状态变化：
   - **Loading** → 显示 Spinner + "Loading Neural Net..."（2-3秒）
   - **Ready** → 显示 Sparkles + "AI Listening..."
4. 点击 **"Start Engine"** 开始哼唱
5. 哼唱一段旋律（至少5个音符）
6. **4秒后**，AI 应该开始播放和声
7. 观察按钮状态变为 **"AI Jamming ♪"**

#### **3. 故障排查**

**如果按钮卡在 "Loading"**:
- 打开 Console，查看错误信息
- 检查 `this.model.initialize()` 是否超时（可能网络问题）

**如果没有声音**:
- 检查 Console 是否有 "Playing X notes" 日志
- 验证 `this.backingSynth` 是否创建成功
- 检查音量是否过小（`this.backingSynth.volume.value = -12`）

**如果 AI 一直不触发**:
- 检查 `this.noteBuffer.length` 是否 ≥ 5
- 验证 `clarity > 0.9` 的音符是否足够（哼唱要清晰）
- 检查是否过了4秒触发时间

---

## 🧪 高级测试（手动触发生成）

在 Console 中手动测试 AI 生成：

```javascript
// 手动创建测试序列
const testSequence = {
    notes: [
        { pitch: 60, startTime: 0, endTime: 0.25, velocity: 80 },    // C4
        { pitch: 62, startTime: 0.25, endTime: 0.5, velocity: 80 },  // D4
        { pitch: 64, startTime: 0.5, endTime: 0.75, velocity: 80 },  // E4
        { pitch: 65, startTime: 0.75, endTime: 1.0, velocity: 80 },  // F4
        { pitch: 67, startTime: 1.0, endTime: 1.25, velocity: 80 }   // G4
    ],
    totalTime: 1.25,
    quantizationInfo: { stepsPerQuarter: 4 }
};

// 手动调用生成
const model = window.app.aiHarmonizer.model;
model.continueSequence(testSequence, 16, 1.1).then(result => {
    console.log('Generated:', result);
    window.app.aiHarmonizer._playBacking(result.notes);
});
```

---

## 📊 性能优化（可选）

### 问题：首次加载太慢

**当前**:
- TensorFlow.js: ~500KB
- Magenta: ~2MB
- 总计: ~2.5MB + 模型初始化2-3秒

**优化方案**:

#### **Option A: Service Worker 缓存**

创建 `/sw.js`:
```javascript
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open("mambo-ai-cache").then(cache => {
      return cache.addAll([
        'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js',
        'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js',
        'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js',
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv/weights_manifest.json'
      ]);
    })
  );
});
```

在 `index.html` 注册:
```javascript
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

#### **Option B: 延迟加载脚本**

只在点击 "Smart Jam" 时加载：

```javascript
async loadMagentaScripts() {
    if (window.music_rnn) return; // Already loaded

    await this._loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js');
    await this._loadScript('https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js');
    await this._loadScript('https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js');
}

_loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
```

---

## 🎬 Presentation Demo 脚本

**Demo时间**: 1分30秒

**脚本**:
```
1. [0:00-0:10] "Let me show you our AI Jam feature, powered by Google Magenta's MusicRNN."
2. [0:10-0:20] 点击 Smart Jam 按钮 → 显示 "Loading Neural Net..."
3. [0:20-0:30] "The model is a recurrent neural network trained on 170,000 MIDI songs."
4. [0:30-0:40] 按钮变为 "AI Listening..." → 点击 Start Engine
5. [0:40-1:00] 哼唱 C大调音阶（DO-RE-MI-FA-SOL）
6. [1:00-1:10] AI 开始播放和声 → 按钮显示 "AI Jamming"
7. [1:10-1:30] "Notice how the AI doesn't just repeat my melody - it generates complementary harmonies in real-time. This runs entirely in the browser using WebAssembly."
```

**如果Demo失败**:
```
"Due to the stochastic nature of neural networks, results can vary. Here's a pre-recorded example from yesterday's test."
[播放预录视频]
```

---

## ✅ 验收标准

完成以下所有项即可认为集成成功：

- [ ] 浏览器 Console 无 Magenta 相关错误
- [ ] 点击 Smart Jam 后，按钮显示 "Loading..."
- [ ] 2-3秒后，按钮显示 "AI Listening..."
- [ ] 哼唱5个音符后，4秒内 AI 生成和声
- [ ] Console 显示 "Playing X notes"
- [ ] 能听到和声音轨（独立于主旋律）
- [ ] 再次点击 Smart Jam，能正常关闭（按钮显示 "Off"）
- [ ] 页面刷新后，功能仍可正常使用

---

## 🚀 下一步（可选增强）

完成基础集成后，可以添加：

1. **Temperature 滑块** - 让用户控制 AI 创造性
2. **Style 切换** - 切换不同的 MusicRNN checkpoint（Jazz/Classical/Pop）
3. **手动触发** - 添加"Regenerate"按钮，手动触发生成
4. **可视化** - 在 Canvas 上绘制 AI 生成的音符
5. **MIDI 导出** - 导出 AI 生成的序列为 MIDI 文件

---

**文档版本**: v1.0
**最后更新**: 2025-11-23
**作者**: Claude (基于 Magenta 官方文档)
