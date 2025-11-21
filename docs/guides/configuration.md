# Mambo Whistle Web - Configuration Guide

**版本**: Alpha 4
**最后更新**: 2025-11-01
**配置架构**: 集中式配置管理 (Centralized Configuration Management)

---

## 📋 目录

1. [配置架构概述](#配置架构概述)
2. [音频引擎配置](#音频引擎配置)
3. [音高检测配置](#音高检测配置)
4. [表现力特征配置](#表现力特征配置)
5. [合成器配置](#合成器配置)
6. [性能与调试配置](#性能与调试配置)
7. [配置最佳实践](#配置最佳实践)
8. [配置示例](#配置示例)

---

## 配置架构概述

### 设计原则

基于现代软件工程最佳实践：

1. **单一数据源** (Single Source of Truth)
   - 所有配置集中在 `js/config/app-config.js`
   - 避免配置分散在多个文件

2. **类型安全** (Type Safety)
   - JSDoc 类型注解确保类型正确
   - 运行时验证防止无效配置

3. **分层配置** (Layered Configuration)
   - 默认配置 (Default Config)
   - 环境配置 (Environment Config)
   - 用户配置 (User Config)

4. **不可变性** (Immutability)
   - 配置对象使用 `Object.freeze()` 防止运行时修改
   - 配置更新需重新初始化

5. **文档化** (Documentation)
   - 每个参数都有详细注释说明影响范围
   - 包含推荐值和调优建议

### 配置文件结构

```
js/config/
├── app-config.js          # 主配置文件 (集中式)
├── presets/               # 预设配置
│   ├── performance.js     # 性能优化预设
│   ├── quality.js         # 质量优化预设
│   └── balanced.js        # 平衡预设 (默认)
└── validators.js          # 配置验证器
```

---

## 音频引擎配置

### AudioIO (音频输入/输出)

#### `sampleRate`
- **类型**: `number`
- **默认值**: `44100`
- **单位**: Hz
- **影响**:
  - 音频质量 (↑ 采样率 → ↑ 质量)
  - CPU 占用 (↑ 采样率 → ↑ CPU)
  - 延迟 (↑ 采样率 → ↓ 延迟理论值)
- **推荐值**:
  - 低端设备: `22050` Hz
  - 标准设备: `44100` Hz (CD 质量)
  - 高端设备: `48000` Hz (专业音频)
- **限制**: 必须是浏览器支持的采样率

#### `bufferSize`
- **类型**: `number`
- **默认值**: `2048`
- **单位**: samples
- **影响**:
  - 延迟 (↓ buffer → ↓ 延迟, ↑ 丢帧风险)
  - 稳定性 (↑ buffer → ↑ 稳定, ↑ 延迟)
  - 性能 (↓ buffer → ↑ 回调频率 → ↑ CPU)
- **推荐值**:
  - 实时演奏: `512` - `1024` samples (~11-23ms @ 44.1kHz)
  - 录音: `2048` samples (~46ms @ 44.1kHz)
  - 分析: `4096` samples (~93ms @ 44.1kHz)
- **限制**: 必须是 2 的幂次 (256, 512, 1024, 2048, 4096, 8192)
- **计算延迟**: `latency (ms) = (bufferSize / sampleRate) * 1000`

#### `useWorklet`
- **类型**: `boolean`
- **默认值**: `true`
- **影响**:
  - 延迟 (Worklet: 20-35ms, ScriptProcessor: 70-100ms)
  - CPU 占用 (Worklet: 分离线程, ScriptProcessor: 主线程阻塞)
  - 兼容性 (Worklet: 现代浏览器, ScriptProcessor: 旧浏览器)
- **推荐值**:
  - 现代浏览器 (Chrome 66+, Firefox 76+): `true`
  - 旧浏览器或兼容模式: `false`
- **注意**: ScriptProcessor 已被标记为废弃 (deprecated)

---

## 音高检测配置

### Pitch Detector (YIN 算法)

#### `clarityThreshold`
- **类型**: `number`
- **默认值**: `0.85`
- **范围**: `0.0` - `1.0`
- **影响**:
  - 检测灵敏度 (↓ 阈值 → ↑ 灵敏度, ↑ 误检)
  - 置信度 (↑ 阈值 → ↑ 置信度, ↓ 检出率)
- **推荐值**:
  - 人声 (稳定): `0.85` - `0.90`
  - 人声 (颤音): `0.75` - `0.80`
  - 乐器 (单音): `0.90` - `0.95`
  - 嘈杂环境: `0.90` - `0.95`
- **调优建议**: 从 0.85 开始，逐步调整直到误检和漏检平衡

#### `minFrequency`
- **类型**: `number`
- **默认值**: `80`
- **单位**: Hz
- **影响**:
  - 检测范围下限 (男低音: ~82Hz E2, 女低音: ~165Hz E3)
  - 计算成本 (↓ minFreq → ↑ 搜索范围 → ↑ CPU)
- **推荐值**:
  - 男声: `80` Hz (E2)
  - 女声: `150` Hz (D3)
  - 儿童声: `200` Hz (G3)
- **注意**: 必须 < maxFrequency

#### `maxFrequency`
- **类型**: `number`
- **默认值**: `1000`
- **单位**: Hz
- **影响**:
  - 检测范围上限 (男高音: ~523Hz C5, 女高音: ~1046Hz C6)
  - 计算成本 (↑ maxFreq → ↑ 搜索范围 → ↑ CPU)
- **推荐值**:
  - 男声: `600` Hz (D5)
  - 女声: `1200` Hz (D6)
  - 全音域: `2000` Hz
- **注意**: 必须 > minFrequency, 必须 < sampleRate / 2 (Nyquist)

---

## 表现力特征配置

### Smoothing Filters (平滑滤波器)

#### Kalman Filter (卡尔曼滤波 - 音高平滑)

##### `processNoise` (Q)
- **类型**: `number`
- **默认值**: `0.001`
- **影响**:
  - 响应速度 (↑ Q → ↑ 响应速度, ↑ 噪声)
  - 平滑度 (↓ Q → ↑ 平滑度, ↓ 响应速度)
  - 系统信任度 (↓ Q → ↑ 信任模型预测)
- **推荐值**:
  - 稳定音高: `0.0001` - `0.001` (高平滑)
  - 快速变化: `0.01` - `0.1` (快速响应)
  - 颤音保留: `0.005` - `0.02`
- **调优建议**: 先调 Q，再调 R

##### `measurementNoise` (R)
- **类型**: `number`
- **默认值**: `0.1`
- **影响**:
  - 测量信任度 (↓ R → ↑ 信任测量值)
  - 滤波强度 (↑ R → ↑ 平滑强度)
- **推荐值**:
  - 高质量麦克风: `0.01` - `0.05`
  - 普通麦克风: `0.1` - `0.2`
  - 嘈杂环境: `0.5` - `1.0`
- **关系**: `Q/R 比率` 决定响应速度 (↑ Q/R → ↑ 响应速度)

#### EMA Filter (指数移动平均 - 音量/亮度平滑)

##### `alpha` (音量平滑系数)
- **类型**: `number`
- **默认值**: `0.3`
- **范围**: `0.0` - `1.0`
- **影响**:
  - 响应速度 (↑ α → ↑ 响应速度)
  - 平滑度 (↓ α → ↑ 平滑度)
- **推荐值**:
  - 音量显示 (快速): `0.5` - `0.7`
  - 音量控制 (平滑): `0.1` - `0.3`
  - 起音检测 (极快): `0.8` - `0.9`
- **公式**: `output = α * input + (1 - α) * previous`

##### `alpha` (亮度平滑系数)
- **类型**: `number`
- **默认值**: `0.2`
- **影响**: 同上，但用于频域特征平滑
- **推荐值**:
  - 视觉反馈: `0.3` - `0.5`
  - 合成器控制: `0.1` - `0.2`

### Onset Detector (起音检测器)

#### `energyThreshold`
- **类型**: `number`
- **默认值**: `6`
- **单位**: dB
- **影响**:
  - 起音灵敏度 (↓ 阈值 → ↑ 灵敏度, ↑ 误检)
  - 误检率 (↑ 阈值 → ↓ 误检, ↑ 漏检)
- **推荐值**:
  - 人声 (正常): `6` dB
  - 人声 (轻声): `3` - `4` dB
  - 乐器 (打击): `8` - `10` dB
- **调优建议**: 观察 attack 触发频率，调整到合理范围

#### `silenceThreshold`
- **类型**: `number`
- **默认值**: `-40`
- **单位**: dB
- **影响**:
  - 静音判定 (↑ 阈值 → 更严格的静音)
  - 释放检测 (影响 release → silence 转换)
- **推荐值**:
  - 安静环境: `-50` dB
  - 正常环境: `-40` dB
  - 嘈杂环境: `-30` dB

#### `attackDuration` (attackHoldTime)
- **类型**: `number`
- **默认值**: `50`
- **单位**: ms
- **影响**:
  - Attack 状态最短持续时间
  - 防止快速抖动
- **推荐值**:
  - 人声: `50` ms
  - 快速乐器: `20` - `30` ms
  - 慢速乐器: `100` ms

#### `minSilenceDuration` (releaseHoldTime)
- **类型**: `number`
- **默认值**: `100`
- **单位**: ms
- **影响**:
  - Release → Silence 转换延迟
  - 音符尾音处理
- **推荐值**:
  - 短促音符: `50` ms
  - 正常音符: `100` ms
  - 长音符: `200` ms

### Spectral Features (频域特征)

#### `fftSize`
- **类型**: `number`
- **默认值**: `2048`
- **单位**: bins
- **影响**:
  - 频率分辨率 (↑ FFT size → ↑ 分辨率)
  - 时间分辨率 (↓ FFT size → ↑ 时间分辨率)
  - CPU 占用 (↑ FFT size → ↑ CPU, O(N log N))
- **推荐值**:
  - 实时分析: `1024` - `2048`
  - 高精度分析: `4096` - `8192`
  - 低延迟: `512` - `1024`
- **限制**: 必须是 2 的幂次
- **频率分辨率**: `Δf = sampleRate / fftSize`
  例: 44100 / 2048 = 21.5 Hz/bin

#### `fftInterval`
- **类型**: `number`
- **默认值**: `2`
- **影响**:
  - CPU 占用 (↑ interval → ↓ CPU, 每 N 帧运行一次 FFT)
  - 更新频率 (↓ interval → ↑ 更新频率)
- **推荐值**:
  - 实时控制: `1` (每帧)
  - 平衡模式: `2` - `3` (50-33% CPU)
  - 省电模式: `4` - `6` (25-16% CPU)
- **注意**: 跳过的帧使用上次结果

#### `minFreq` / `maxFreq` (频谱分析范围)
- **类型**: `number`
- **默认值**: `80` / `8000` Hz
- **影响**:
  - 分析范围 (限制在语音/音乐相关频段)
  - CPU 占用 (↓ 范围 → ↓ CPU)
- **推荐值**:
  - 人声: `80` - `8000` Hz
  - 全频段: `20` - `20000` Hz
  - 基频分析: `80` - `2000` Hz

---

## 合成器配置

### Continuous Synth (连续合成器)

#### `pitchBendRange`
- **类型**: `number`
- **默认值**: `100`
- **单位**: cents (音分)
- **影响**:
  - Cents → Pitch Bend 映射范围
  - 音高微调精度
- **推荐值**:
  - 精确音高: `50` cents (±半音)
  - 表现力: `100` cents (±全音)
  - 滑音效果: `200` cents (±2 全音)

#### `filterCutoffRange`
- **类型**: `object`
- **默认值**: `{ min: 200, max: 8000 }`
- **单位**: Hz
- **影响**:
  - Brightness → Filter Cutoff 映射
  - 音色变化范围
- **推荐值**:
  - 柔和音色: `200` - `2000` Hz
  - 标准音色: `200` - `8000` Hz
  - 明亮音色: `500` - `12000` Hz

#### `noiseGainMax`
- **类型**: `number`
- **默认值**: `0.3`
- **范围**: `0.0` - `1.0`
- **影响**:
  - Breathiness → Noise Gain 映射
  - 气声效果强度
- **推荐值**:
  - 纯净音色: `0.1`
  - 自然气声: `0.2` - `0.3`
  - 强烈气声: `0.5` - `0.7`

---

## 性能与调试配置

### Performance (性能监控)

#### `enableStats`
- **类型**: `boolean`
- **默认值**: `true`
- **影响**:
  - 性能统计收集 (轻微 CPU 开销)
  - getStats() 数据可用性
- **推荐值**:
  - 开发环境: `true`
  - 生产环境: `false` (减少开销)

#### `logLevel`
- **类型**: `string`
- **默认值**: `'info'`
- **选项**: `'none'`, `'error'`, `'warn'`, `'info'`, `'debug'`
- **影响**:
  - 控制台日志输出量
  - 调试信息详细程度
- **推荐值**:
  - 生产环境: `'error'` 或 `'none'`
  - 开发环境: `'info'`
  - 调试问题: `'debug'`

---

## 配置最佳实践

### 1. 调优流程 (Tuning Workflow)

**阶段 1: 基础设置**
```
1. 设置采样率 (sampleRate) 和缓冲区大小 (bufferSize)
2. 设置音高检测范围 (minFrequency, maxFrequency)
3. 运行基础测试，确认系统正常工作
```

**阶段 2: 音高检测优化**
```
1. 调整 clarityThreshold 平衡误检/漏检
2. 观察置信度 (confidence) 分布
3. 必要时微调 minFreq/maxFreq
```

**阶段 3: 平滑滤波优化**
```
1. 调整 Kalman processNoise (Q) 控制响应速度
2. 调整 Kalman measurementNoise (R) 适应麦克风质量
3. 调整 EMA alpha 平衡平滑度和响应
```

**阶段 4: 起音检测优化**
```
1. 调整 energyThreshold 减少误检
2. 调整 attackDuration 防止抖动
3. 调整 minSilenceDuration 处理尾音
```

**阶段 5: 性能优化**
```
1. 如有性能问题，增加 fftInterval
2. 如有延迟问题，减小 bufferSize (需权衡稳定性)
3. 如有 CPU 问题，减小 fftSize 或增加 fftInterval
```

### 2. 环境适配 (Environment Adaptation)

**低端设备**:
```javascript
{
  sampleRate: 22050,
  bufferSize: 2048,
  fftSize: 1024,
  fftInterval: 4
}
```

**高端设备 (低延迟)**:
```javascript
{
  sampleRate: 48000,
  bufferSize: 512,
  fftSize: 2048,
  fftInterval: 1
}
```

**嘈杂环境**:
```javascript
{
  clarityThreshold: 0.92,
  silenceThreshold: -30,
  energyThreshold: 8,
  measurementNoise: 0.5
}
```

### 3. 配置验证 (Configuration Validation)

所有配置在初始化时会被验证：

- **类型检查**: 确保类型正确 (number, boolean, string)
- **范围检查**: 确保值在有效范围内
- **关系检查**: 确保相关参数关系正确 (minFreq < maxFreq)
- **性能警告**: 不推荐的配置组合会发出警告

### 4. 配置迁移 (Configuration Migration)

旧配置会自动映射到新参数名：

```javascript
// 旧参数名 → 新参数名
Q → processNoise
R → measurementNoise
attackHoldTime → attackDuration
releaseHoldTime → minSilenceDuration
```

---

## 配置示例

### 示例 1: 人声实时演奏 (低延迟)

```javascript
const config = {
  // 音频引擎
  sampleRate: 48000,
  bufferSize: 512,         // ~10ms 延迟
  useWorklet: true,

  // 音高检测
  clarityThreshold: 0.85,
  minFrequency: 80,
  maxFrequency: 1000,

  // 平滑滤波
  smoothing: {
    kalman: {
      processNoise: 0.005,   // 快速响应
      measurementNoise: 0.1
    },
    ema: {
      volume: { alpha: 0.3 },
      brightness: { alpha: 0.2 }
    }
  },

  // 起音检测
  onset: {
    energyThreshold: 6,
    silenceThreshold: -40,
    attackDuration: 50,
    minSilenceDuration: 100
  },

  // 频域分析
  spectral: {
    fftSize: 2048,
    fftInterval: 2,         // 50% CPU
    minFreq: 80,
    maxFreq: 8000
  }
};
```

### 示例 2: 音高分析 (高质量)

```javascript
const config = {
  // 音频引擎
  sampleRate: 48000,
  bufferSize: 4096,        // ~85ms 延迟，高稳定性
  useWorklet: true,

  // 音高检测
  clarityThreshold: 0.90,  // 高置信度
  minFrequency: 80,
  maxFrequency: 2000,

  // 平滑滤波
  smoothing: {
    kalman: {
      processNoise: 0.0001, // 高平滑
      measurementNoise: 0.05
    },
    ema: {
      volume: { alpha: 0.1 },
      brightness: { alpha: 0.1 }
    }
  },

  // 频域分析
  spectral: {
    fftSize: 4096,         // 高频率分辨率
    fftInterval: 1,        // 每帧分析
    minFreq: 80,
    maxFreq: 8000
  }
};
```

### 示例 3: 低端设备 (节能)

```javascript
const config = {
  // 音频引擎
  sampleRate: 22050,       // 降低采样率
  bufferSize: 2048,
  useWorklet: false,       // 兼容旧浏览器

  // 音高检测
  clarityThreshold: 0.85,
  minFrequency: 100,
  maxFrequency: 800,

  // 平滑滤波
  smoothing: {
    kalman: {
      processNoise: 0.001,
      measurementNoise: 0.2
    },
    ema: {
      volume: { alpha: 0.3 },
      brightness: { alpha: 0.3 }
    }
  },

  // 频域分析
  spectral: {
    fftSize: 1024,         // 降低 FFT 大小
    fftInterval: 4,        // 仅 25% 帧运行 FFT
    minFreq: 100,
    maxFreq: 4000
  }
};
```

---

## 参数关系图

```
采样率 (sampleRate)
  ├─→ 最大检测频率上限: maxFreq < sampleRate / 2
  ├─→ 延迟: latency = bufferSize / sampleRate
  └─→ FFT 频率分辨率: Δf = sampleRate / fftSize

缓冲区大小 (bufferSize)
  ├─→ 延迟: ↓ buffer → ↓ latency
  ├─→ 稳定性: ↑ buffer → ↑ stability
  └─→ CPU: ↓ buffer → ↑ callback frequency

Kalman Q/R 比率
  ├─→ 响应速度: ↑ Q/R → ↑ response speed
  └─→ 平滑度: ↓ Q/R → ↑ smoothness

FFT Size vs Interval
  ├─→ CPU: CPU_cost ≈ (fftSize * log(fftSize)) / fftInterval
  ├─→ 频率分辨率: Δf = sampleRate / fftSize
  └─→ 时间分辨率: Δt = fftSize / sampleRate
```

---

## 故障排查

### 问题 1: 音高检测不准确

**症状**: 频繁误检，置信度低

**可能原因**:
- clarityThreshold 过低
- 麦克风质量差
- 环境噪声过大

**解决方案**:
1. 提高 clarityThreshold (0.85 → 0.90)
2. 提高 measurementNoise (0.1 → 0.3)
3. 提高 silenceThreshold (-40 → -30)

### 问题 2: 延迟过高

**症状**: 音高检测延迟明显，操作不跟手

**可能原因**:
- bufferSize 过大
- 使用 ScriptProcessor 模式

**解决方案**:
1. 减小 bufferSize (2048 → 512)
2. 启用 useWorklet: true
3. 减小 fftSize (2048 → 1024)

### 问题 3: CPU 占用过高

**症状**: 风扇狂转，浏览器卡顿

**可能原因**:
- fftInterval 过小
- fftSize 过大
- bufferSize 过小

**解决方案**:
1. 增加 fftInterval (2 → 4)
2. 减小 fftSize (4096 → 2048)
3. 增大 bufferSize (512 → 1024)

### 问题 4: 起音检测过于灵敏

**症状**: 轻微音量变化就触发 attack

**可能原因**:
- energyThreshold 过低
- 音量被过度平滑

**解决方案**:
1. 提高 energyThreshold (6 → 8)
2. 增加 attackDuration (50 → 100)
3. 检查是否使用了原始音量 (已修复)

---

## 参考资料

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet 最佳实践](https://developer.chrome.com/blog/audio-worklet/)
- [YIN 音高检测算法](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)
- [卡尔曼滤波教程](https://www.kalmanfilter.net/)
- [DSP 配置最佳实践](https://www.analog.com/en/lp/001/beginners-guide-to-dsp.html)

---

**Maintainer**: Mambo Whistle Team
**联系方式**: 请通过 GitHub Issues 提问
**License**: MIT
