# AI Harmonizer 测试指南

**状态**: ✅ Ready to Test
**最后更新**: 2025-11-23

---

## 🚀 快速测试步骤

### 1. 启动开发服务器

```bash
npm start
# 或
npx serve . -p 3000
```

### 2. 打开浏览器

访问: http://localhost:3000

### 3. 打开 Console (F12)

**验证 Magenta 加载**:
```javascript
console.log('TensorFlow:', typeof tf);       // 应该输出 "object"
console.log('Magenta Core:', typeof core);   // 应该输出 "object"
console.log('MusicRNN:', typeof music_rnn);  // 应该输出 "object"
```

如果都是 `"object"` → ✅ Magenta 加载成功！

### 4. 测试 AI Harmonizer

#### **Step A: 激活 AudioContext**
点击页面任意位置（浏览器要求用户手势才能启动音频）

#### **Step B: 启用 AI Jam**
1. 点击右上角 **"Smart Jam"** 按钮
2. 观察按钮状态：
   - **Loading** → Spinner 图标 + "Loading Neural Net..."（~2-3秒）
   - **Ready** → Sparkles 图标 + "AI Listening..."

#### **Step C: 开始哼唱**
1. 点击 **"Start Engine"** 按钮
2. 哼唱一段旋律（至少5个清晰的音符）
   - 推荐：C大调音阶 DO-RE-MI-FA-SOL
   - 或者：小星星前4小节

#### **Step D: 等待 AI 生成**
- **4秒后**，AI 应该自动生成和声
- 按钮状态变为: **"AI Jamming ♪"**
- Console 显示:
  ```
  [AI Harmonizer] Input sequence: X notes
  [AI Harmonizer] ✓ Generated Y notes
  [AI Harmonizer] 🎵 Playing Y notes
  ```

---

## 🔍 Console 验证命令

### 检查 AI Harmonizer 实例

```javascript
// 查看实例
window.app.aiHarmonizer

// 查看状态
window.app.aiHarmonizer.status
// 应该是: 'idle' | 'loading' | 'ready' | 'processing' | 'error'

// 查看缓冲区
window.app.aiHarmonizer.noteBuffer
// 应该是一个数组，包含MIDI音符号（如 [60, 62, 64, ...]）

// 查看模型
window.app.aiHarmonizer.model
// 应该是一个 MusicRNN 对象
```

### 手动触发 AI 生成（调试用）

```javascript
// 创建测试序列（C大调音阶）
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

// 手动生成
const model = window.app.aiHarmonizer.model;
model.continueSequence(testSequence, 16, 1.1).then(result => {
    console.log('Generated result:', result);
    window.app.aiHarmonizer._playBacking(result.notes);
});
```

---

## 🐛 故障排查

### 问题1: 按钮卡在 "Loading..."

**可能原因**:
- 网络慢，模型下载超时
- TensorFlow.js 初始化失败

**解决方案**:
1. 检查 Console 是否有错误
2. 刷新页面重试
3. 检查网络连接

**验证**:
```javascript
window.app.aiHarmonizer.model.isInitialized()
// 应该返回 true
```

---

### 问题2: 没有声音

**可能原因**:
- 音量过小
- Synth 未创建
- AudioContext 未启动

**解决方案**:
```javascript
// 检查 Synth
window.app.aiHarmonizer.backingSynth
// 应该是一个 PolySynth 对象

// 检查音量
window.app.aiHarmonizer.backingSynth.volume.value
// 应该是 -12 (dB)

// 提高音量（临时测试）
window.app.aiHarmonizer.backingSynth.volume.value = -6

// 检查 AudioContext
Tone.context.state
// 应该是 'running'
```

---

### 问题3: AI 一直不触发

**可能原因**:
- 缓冲区音符不足（需要 ≥5 个）
- 音符 confidence 太低（<0.9）
- 4秒还没到

**解决方案**:
```javascript
// 检查缓冲区
window.app.aiHarmonizer.noteBuffer.length
// 应该 ≥ 5

// 检查最后处理时间
const elapsed = Date.now() - window.app.aiHarmonizer.lastProcessTime;
console.log('Time since last gen:', elapsed, 'ms (need 4000ms)');

// 手动触发（跳过4秒等待）
window.app.aiHarmonizer._generateBackingSequence();
```

---

### 问题4: Console 报错 "MusicRNN not loaded"

**可能原因**:
- HTML 中的 Magenta 脚本未加载
- 脚本加载顺序错误

**解决方案**:
1. 检查 `index.html` Line 922-924 是否有:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js"></script>
   ```

2. 刷新页面（Ctrl+Shift+R 强制刷新）

---

## 📊 性能监控

### 检查延迟

```javascript
// AI 处理时间
// 在 Console 观察日志:
// [AI Harmonizer] Input sequence: X notes
// [AI Harmonizer] ✓ Generated Y notes
// 两行之间的时间差即为推理延迟
```

**预期延迟**:
- Mac/PC: 200-400ms
- 弱设备: 可能 1-2秒

### 检查内存占用

```javascript
// 打开 Chrome DevTools → Memory tab
// 点击 "Take snapshot"
// 搜索 "MusicRNN"
```

---

## ✅ 成功标准

完成以下所有检查点，即可认为集成成功：

- [ ] Console 无 Magenta 相关错误
- [ ] `typeof music_rnn === "object"`
- [ ] Smart Jam 按钮可点击
- [ ] 点击后显示 "Loading..." → "AI Listening..."
- [ ] 哼唱后，4秒内生成和声
- [ ] Console 显示 "Playing X notes"
- [ ] **能听到和声音轨**（独立于主旋律）
- [ ] 再次点击 Smart Jam，能关闭（显示 "Off"）
- [ ] 刷新页面后，功能仍可用

---

## 🎬 Demo 准备

### Demo 脚本（1分30秒）

```
[0:00-0:10]
"Let me show you our AI Jam feature, powered by Google Magenta's MusicRNN."

[0:10-0:20]
点击 Smart Jam 按钮 → 显示 "Loading Neural Net..."

[0:20-0:30]
"The model is a recurrent neural network trained on 170,000 MIDI songs."

[0:30-0:40]
按钮变为 "AI Listening..." → 点击 Start Engine

[0:40-1:00]
哼唱 C大调音阶（DO-RE-MI-FA-SOL）

[1:00-1:10]
AI 开始播放和声 → 按钮显示 "AI Jamming"

[1:10-1:30]
"Notice how the AI doesn't just repeat my melody - it generates
complementary harmonies in real-time. This runs entirely in the
browser using TensorFlow.js and WebAssembly."
```

### 备份方案

如果 Demo 失败：
```
"Due to the stochastic nature of neural networks, results can vary.
Here's a pre-recorded example from yesterday's test."
[播放预录视频]
```

---

## 📹 录制 Demo 视频（推荐）

### 录制工具
- Mac: QuickTime Player → File → New Screen Recording
- Windows: Win+G → Game Bar
- Chrome: 安装 Loom 扩展

### 录制内容
1. 完整的测试流程（2分钟）
2. Console 输出清晰可见
3. 音频清晰（戴耳机录制）

### 备用方案
如果现场 Demo 出问题，播放这个视频

---

## 🔧 调试技巧

### 启用详细日志

在 `ai-harmonizer.js` Line 185 取消注释：
```javascript
console.log('[AI Harmonizer] Buffered note:', midi, `(${this.noteBuffer.length}/${this.maxBufferLength})`);
```

### 降低生成门槛（测试用）

在 `ai-harmonizer.js` Line 204 修改：
```javascript
if (this.noteBuffer.length < 3) { // 原来是 5，降低到 3
```

### 缩短触发间隔（测试用）

在 `ai-harmonizer.js` Line 28 修改：
```javascript
this.processInterval = 2000; // 原来是 4000，改为 2秒
```

**注意**: 测试完记得改回原值！

---

## 📚 参考资料

- [Magenta.js 官方文档](https://hello-magenta.glitch.me/)
- [MusicRNN API](https://magenta.github.io/magenta-js/music/classes/_music_rnn_model_.musicrnn.html)
- [TensorFlow.js](https://www.tensorflow.org/js)

---

**测试完成后，请在下方签名：**

- [ ] 测试通过，功能正常
- [ ] 测试者: ___________
- [ ] 日期: ___________
