# 延迟优化报告 (Latency Optimization Report)

**日期**: 2025-11-19
**目标**: 将端到端延迟从 180ms 降低到 < 50ms
**诊断者**: Gemini (via User)
**实施者**: Claude Code

---

## 🔍 问题诊断 (Root Cause Analysis)

### 原始延迟构成 (180ms)

根据 Gemini 的详细分析，延迟由以下部分组成：

| 组件 | 延迟贡献 | 说明 |
|------|----------|------|
| **Worklet Buffer** | 46ms | 2048 samples @ 44.1kHz = 46.4ms |
| **Tone.js lookAhead** | 100ms | 默认调度前瞻时间 |
| **Ramp 平滑** | 20-50ms | frequency/filter 的 rampTo 时间 |
| **系统开销** | 10-20ms | AudioContext I/O + 计算 |
| **总计** | **~180ms** | 测量值匹配 ✓ |

### 关键发现

1. **Tone.js 的音乐编排设计**
   - Tone.js 是为音乐制作设计的，默认 `lookAhead = 0.1` (100ms)
   - 这在音乐节奏编排中保证精准性，但在实时乐器中是"死延迟"

2. **Worklet Buffer 权衡**
   - 2048 samples 是为了检测低频 (80Hz = 12.5ms 周期)
   - 但实际上 1024 samples (23.2ms) 包含 ~2 个周期，足够 YIN 算法

3. **过度平滑**
   - `rampTo(value, 0.05)` (50ms) 对于实时乐器来说太慢
   - 缩短到 10-20ms 仍能避免爆音

---

## ⚡ 优化方案 (Optimization Steps)

### ✅ Step 1: 移除 Tone.js 调度延迟

**文件**: [js/continuous-synth.js](js/continuous-synth.js:227-232)

```javascript
async initialize() {
    await Tone.start();

    // 🔥 [CRITICAL FIX] 移除 Tone.js 的调度延迟
    Tone.context.lookAhead = 0;  // 100ms → 0ms
    Tone.context.latencyHint = 'interactive';

    // ... rest of initialization
}
```

**预期收益**: -100ms

---

### ✅ Step 3: 优化频率和滤波器平滑时间

**文件**: [js/continuous-synth.js](js/continuous-synth.js)

#### 3.1 主频率更新
```javascript
// Line 405
// 之前: this.currentSynth.frequency.value = adjustedFrequency;
// 现在: this.currentSynth.frequency.rampTo(adjustedFrequency, 0.01);
```
**收益**: 更快响应 + 避免爆音

#### 3.2 Brightness 滤波器
```javascript
// Line 466
// 之前: this.filter.frequency.rampTo(filterFreq, 0.02);
// 现在: this.filter.frequency.rampTo(filterFreq, 0.01);
```
**收益**: -10ms

#### 3.3 Breathiness 噪声
```javascript
// Lines 493, 498
// 之前: 0.05 (50ms)
// 现在: 0.02 (20ms)
```
**收益**: -30ms

#### 3.4 Vibrato 深度
```javascript
// Line 565
// 之前: this.vibrato.depth.rampTo(vibratoDepth, 0.05);
// 现在: this.vibrato.depth.rampTo(vibratoDepth, 0.01);
```
**收益**: -40ms

#### 3.5 音量衰减回退
```javascript
// Line 576
// 之前: this.filter.frequency.rampTo(filterFreq, 0.05);
// 现在: this.filter.frequency.rampTo(filterFreq, 0.01);
```
**收益**: -40ms

---

### ⏳ Step 2: 缩小 Worklet Buffer (待测试后决定)

**文件**: [js/pitch-worklet.js](js/pitch-worklet.js)

```javascript
// Line 188
// 原来: this.accumulationBuffer = new Float32Array(2048); // 46ms
// 建议: this.accumulationBuffer = new Float32Array(1024); // 23ms
```

**预期收益**: -23ms
**风险**: 低频检测可能变差 (需要测试)

**重要提示**: 如果修改 buffer 大小，还需要：
1. 更新 FFT 大小: `this.fft = new SimpleFFT(1024);`
2. 调整重叠逻辑: 保持 50% overlap (512 samples)

---

## 📊 预期结果

### 已实施优化 (Steps 1 + 3)

| 项目 | 原始 | 优化后 | 节省 |
|------|------|--------|------|
| Tone.js lookAhead | 100ms | 0ms | -100ms |
| 频率 ramp | 0ms* | 10ms | +10ms** |
| Brightness ramp | 20ms | 10ms | -10ms |
| Breathiness ramp | 50ms | 20ms | -30ms |
| Vibrato ramp | 50ms | 10ms | -40ms |
| Worklet Buffer | 46ms | 46ms | 0ms |
| 系统开销 | 10ms | 10ms | 0ms |
| **总计** | **180ms** | **~60-80ms** | **-120ms** |

*原来使用直接赋值 `frequency.value =`，理论 0ms 但可能有爆音
**改为 10ms rampTo 更安全，实际上是质量提升

### 完全优化后 (Steps 1 + 2 + 3)

如果 Step 2 也实施：

| 总延迟 | 60-80ms → **35-45ms** |
|--------|---------------------|
| **目标达成** | ✅ < 50ms |

---

## 🧪 测试方法

### 1. 重启开发服务器
```bash
# 停止当前服务器
pkill -f "serve"

# 重新启动
npm start
```

### 2. 浏览器控制台测试

```javascript
// 1. 打开应用: http://localhost:3000
// 2. 点击 "Start Engine"
// 3. 哼唱或发声 10-20 秒
// 4. 执行延迟测量

window.app.getLatencyStats()
// 预期输出:
// {
//   min: "55.2",
//   max: "85.7",
//   avg: "68.4",
//   p50: "67.1",
//   p95: "78.3",
//   count: 150
// }
```

### 3. 验证 Worklet 模式

```javascript
window.container.get('audioIO').mode
// 应该返回: 'worklet'
// 如果返回 'script-processor'，则 Buffer 延迟会是 46ms (2048 samples)
```

### 4. 查看优化日志

打开浏览器控制台，应该看到：

```
[ContinuousSynth] ⚡ Tone.js lookAhead set to 0ms (real-time mode)
[ContinuousSynth] ⚡ Tone.js latencyHint set to "interactive"
[ContinuousSynth] ✓ Ready
```

---

## ⚠️ 潜在副作用与对策

### 1. 爆音 (Pops/Clicks)

**症状**: 在快速改变频率时听到"啪"的声音

**原因**: 10ms rampTo 时间太短，导致波形不连续

**解决方案**:
```javascript
// 如果出现爆音，将 rampTo 时间增加到 15ms
this.currentSynth.frequency.rampTo(adjustedFrequency, 0.015);
```

### 2. 低频检测不稳定 (Step 2 相关)

**症状**: 检测 80-100Hz 的低音时频率跳动明显

**原因**: 1024 samples buffer 对极低频不够

**解决方案**:
- 保持 2048 buffer，只应用 Steps 1+3
- 或者将 `minFrequency` 从 80Hz 提高到 100Hz (config/app-config.js)

### 3. 主线程卡顿导致延迟波动

**症状**: 延迟时好时坏，p95 远大于 avg

**原因**: JS 主线程太忙，无法及时处理 Worklet 消息

**解决方案**:
- 减少 console.log (当前 286 条，目标 < 50 条)
- 关闭不必要的浏览器插件
- 使用 Chrome (AudioWorklet 支持最好)

---

## 📈 性能监控

### 实时监控命令

```javascript
// 每 2 秒自动打印延迟统计
setInterval(() => {
    const stats = window.app.getLatencyStats();
    console.table(stats);
}, 2000);
```

### 性能指标

```javascript
window.container.get('performanceMonitor').getMetrics()
// {
//   processingTime: 2.1,    // ms (Worklet 处理时间)
//   totalLatency: 68.5,     // ms (端到端延迟)
//   fps: 60.2,              // frames per second
//   bufferSize: 128,
//   mode: 'worklet'
// }
```

---

## 🎯 下一步行动

### 立即执行

1. **测试当前优化** (Steps 1 + 3)
   - 重启服务器
   - 测量延迟: `window.app.getLatencyStats()`
   - 记录结果: min, avg, p95

2. **验证音质**
   - 测试快速颤音 (快速哼唱不同音高)
   - 测试平滑滑音 (慢慢升调/降调)
   - 检查是否有爆音

### 如果延迟仍 > 70ms

3. **应用 Step 2**
   - 修改 [pitch-worklet.js](js/pitch-worklet.js:188)
   - Buffer: 2048 → 1024
   - FFT size: 2048 → 1024
   - 测试低频检测 (80-100Hz)

### 如果出现爆音

4. **微调 rampTo 时间**
   - 0.01 → 0.015 (15ms)
   - 测试音质改善

---

## 📚 参考资料

### Tone.js 文档
- [Context.lookAhead](https://tonejs.github.io/docs/14.7.77/Context#lookAhead)
- [Signal.rampTo](https://tonejs.github.io/docs/14.7.77/Signal#rampTo)
- [AudioContext.latencyHint](https://developer.mozilla.org/en-US/docs/Web/API/AudioContextOptions/latencyHint)

### YIN 算法
- [YIN Paper (PDF)](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)
- Section 4.3: Buffer size requirements (p. 1922)

### AudioWorklet Best Practices
- [Chrome Blog: AudioWorklet](https://developer.chrome.com/blog/audio-worklet/)
- [MDN: AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor)

---

## 🙏 致谢

感谢 **Gemini** 提供的详细诊断报告，准确定位了：
1. Tone.js 的 100ms lookAhead "隐藏延迟"
2. 2048 buffer 的 46ms 物理延迟
3. rampTo 的累积平滑延迟

这些洞察使优化工作有的放矢，避免了盲目优化。

---

**最后更新**: 2025-11-19
**状态**: Steps 1+3 已完成，等待测试结果
**下一步**: 测量实际延迟，决定是否实施 Step 2
