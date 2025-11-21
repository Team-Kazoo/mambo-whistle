# 配置系统文档

**Mambo Whistle Web - Centralized Configuration Management**

---

## 快速开始

### 1. 基础使用

```javascript
import configManager from './app-config.js';

// 加载默认配置
const config = configManager.load();

// 使用配置
const audioIO = new AudioIO({
  sampleRate: config.audio.sampleRate,
  bufferSize: config.audio.bufferSize
});
```

### 2. 使用预设

```javascript
// 低延迟预设 (实时演奏)
const config = configManager.load({}, 'low-latency');

// 高质量预设 (音高分析)
const config = configManager.load({}, 'high-quality');

// 节能预设 (移动设备)
const config = configManager.load({}, 'power-saving');
```

### 3. 自定义配置

```javascript
const config = configManager.load({
  audio: {
    sampleRate: 48000,
    bufferSize: 1024
  },
  pitchDetector: {
    clarityThreshold: 0.90
  }
});
```

---

## 文档索引

### 📖 完整文档

- **[配置参数文档](../../docs/CONFIGURATION.md)** - 所有参数的详细说明
  - 每个参数的影响范围
  - 推荐值和调优建议
  - 参数关系图
  - 故障排查指南

- **[配置使用示例](../../docs/CONFIG_EXAMPLES.md)** - 实际场景示例
  - 各种应用场景的配置
  - 动态配置调整
  - 最佳实践

### 📁 文件结构

```
js/config/
├── app-config.js           # 主配置模块 (本文件夹)
├── README.md               # 配置系统说明 (当前文件)
└── presets/                # 未来: 预设配置文件夹
    ├── performance.js
    ├── quality.js
    └── balanced.js

docs/
├── CONFIGURATION.md        # 完整配置参数文档
└── CONFIG_EXAMPLES.md      # 配置使用示例
```

---

## 设计原则

基于现代软件工程最佳实践：

### 1. 单一数据源 (Single Source of Truth)
- 所有配置集中在 `app-config.js`
- 避免配置分散导致的不一致

### 2. 类型安全 (Type Safety)
- 完整的 JSDoc 类型注解
- 运行时验证确保配置正确

### 3. 不可变性 (Immutability)
- 配置对象使用 `Object.freeze()` 冻结
- 防止运行时意外修改

### 4. 分层配置 (Layered Configuration)
```
默认配置 (Default)
    ↓
预设配置 (Preset) - 可选
    ↓
用户配置 (User Override)
    ↓
最终配置 (Merged & Frozen)
```

### 5. 验证优先 (Validation First)
- 配置加载时自动验证
- 类型检查、范围检查、关系检查
- 清晰的错误和警告信息

---

## API 参考

### ConfigManager

#### `load(userConfig, preset)`

加载并合并配置

**参数**:
- `userConfig` (Object, 可选) - 用户自定义配置
- `preset` (String, 可选) - 预设名称
  - `'low-latency'` - 低延迟预设
  - `'high-quality'` - 高质量预设
  - `'power-saving'` - 节能预设

**返回**: `AppConfigSchema` - 冻结的配置对象

**抛出**: `Error` - 配置验证失败时

**示例**:
```javascript
const config = configManager.load({
  audio: { sampleRate: 48000 }
}, 'low-latency');
```

---

#### `get()`

获取当前配置

**返回**: `AppConfigSchema` - 冻结的配置对象

**抛出**: `Error` - 配置未加载时

**示例**:
```javascript
const config = configManager.get();
console.log(config.audio.sampleRate);  // 44100
```

---

#### `getValue(path)`

获取特定路径的配置值

**参数**:
- `path` (String) - 配置路径 (例: `'audio.sampleRate'`)

**返回**: `any` - 配置值，未找到时返回 `undefined`

**示例**:
```javascript
const sampleRate = configManager.getValue('audio.sampleRate');
const kalmanQ = configManager.getValue('smoothing.kalman.processNoise');
```

---

### validateConfig(config)

验证配置对象

**参数**:
- `config` (Object) - 待验证的配置

**返回**: `{ valid: boolean, errors: string[], warnings: string[] }`

**示例**:
```javascript
import { validateConfig } from './app-config.js';

const validation = validateConfig({
  audio: { bufferSize: 1000 }  // 无效值
});

if (!validation.valid) {
  console.error('配置错误:', validation.errors);
}
```

---

## 配置结构

### AppConfigSchema

```typescript
{
  audio: {
    sampleRate: number,           // 采样率 (Hz)
    bufferSize: number,           // 缓冲区大小 (samples)
    useWorklet: boolean           // 使用 AudioWorklet
  },

  pitchDetector: {
    clarityThreshold: number,     // YIN 清晰度阈值 (0-1)
    minFrequency: number,         // 最低检测频率 (Hz)
    maxFrequency: number          // 最高检测频率 (Hz)
  },

  smoothing: {
    kalman: {
      processNoise: number,       // Q: 过程噪声
      measurementNoise: number,   // R: 测量噪声
      initialEstimate: number,
      initialError: number
    },
    volume: {
      alpha: number               // EMA 平滑系数 (0-1)
    },
    brightness: {
      alpha: number               // EMA 平滑系数 (0-1)
    }
  },

  onset: {
    energyThreshold: number,      // 能量阈值 (dB)
    silenceThreshold: number,     // 静音阈值 (dB)
    attackDuration: number,       // Attack 最短时长 (ms)
    minSilenceDuration: number,   // 最短静音时长 (ms)
    timeWindow: number,           // 时间窗口 (帧)
    debug: boolean
  },

  spectral: {
    fftSize: number,              // FFT 大小 (bins)
    fftInterval: number,          // FFT 间隔 (帧)
    minFreq: number,              // 分析频率下限 (Hz)
    maxFreq: number               // 分析频率上限 (Hz)
  },

  synthesizer: {
    pitchBendRange: number,       // Pitch Bend 范围 (cents)
    filterCutoffRange: {
      min: number,                // Filter Cutoff 最小值 (Hz)
      max: number                 // Filter Cutoff 最大值 (Hz)
    },
    noiseGainMax: number          // 噪声增益最大值 (0-1)
  },

  performance: {
    enableStats: boolean,         // 启用性能统计
    logLevel: string              // 日志级别
  }
}
```

---

## 预设对比

| 参数 | 默认 | low-latency | high-quality | power-saving |
|------|------|-------------|--------------|--------------|
| **采样率** | 44100 | 48000 | 48000 | 22050 |
| **缓冲区** | 2048 | 512 | 4096 | 2048 |
| **FFT 大小** | 2048 | 1024 | 4096 | 1024 |
| **FFT 间隔** | 2 | 2 | 1 | 4 |
| **Kalman Q** | 0.001 | 0.005 | 0.0001 | 0.001 |
| **清晰度阈值** | 0.85 | 0.85 | 0.90 | 0.85 |
| **延迟** | ~46ms | ~10ms | ~85ms | ~93ms |
| **CPU** | 中等 | 中等 | 高 | 低 |
| **质量** | 平衡 | 良好 | 极高 | 基础 |
| **适用** | 通用 | 演奏 | 分析 | 移动 |

---

## 常见问题

### Q: 如何选择预设？

**A**: 根据应用场景选择：
- 实时演奏、互动应用 → `low-latency`
- 音高分析、教学工具 → `high-quality`
- 移动设备、省电模式 → `power-saving`
- 一般使用 → 默认配置

---

### Q: 配置加载失败怎么办？

**A**: 检查错误信息，修正无效参数：
```javascript
try {
  const config = configManager.load(userConfig);
} catch (error) {
  console.error('配置错误:', error.message);
  // 回退到默认配置
  const config = configManager.load();
}
```

---

### Q: 如何在运行时切换配置？

**A**: 重新加载配置并重新初始化系统：
```javascript
// 停止当前音频流
audioIO.stop();

// 重新加载配置
const newConfig = configManager.load({}, 'high-quality');

// 重新初始化
audioIO = new AudioIO(newConfig.audio);
audioIO.start();
```

---

### Q: 配置可以修改吗？

**A**: 不可以。配置对象被冻结，确保不可变性：
```javascript
const config = configManager.get();
config.audio.sampleRate = 48000;  // TypeError!

// 正确方式: 重新加载配置
const newConfig = configManager.load({
  audio: { sampleRate: 48000 }
});
```

---

### Q: 如何验证自定义配置？

**A**: 使用 `validateConfig()` 函数：
```javascript
import { validateConfig } from './app-config.js';

const validation = validateConfig(myConfig);

if (!validation.valid) {
  console.error('错误:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('警告:', validation.warnings);
}
```

---

## 性能提示

### 降低延迟
```javascript
const config = configManager.load({
  audio: {
    bufferSize: 512,     // 减小缓冲区
    useWorklet: true     // 使用 Worklet
  }
});
```

### 降低 CPU
```javascript
const config = configManager.load({
  spectral: {
    fftSize: 1024,       // 减小 FFT
    fftInterval: 4       // 增加间隔
  }
});
```

### 提高精度
```javascript
const config = configManager.load({
  pitchDetector: {
    clarityThreshold: 0.92  // 提高阈值
  },
  spectral: {
    fftSize: 4096           // 增大 FFT
  }
});
```

---

## 参考资料

- [完整配置文档](../../docs/CONFIGURATION.md)
- [配置使用示例](../../docs/CONFIG_EXAMPLES.md)
- [API 设计文档](../../docs/phase2/API_DESIGN.md)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet](https://developer.chrome.com/blog/audio-worklet/)

---

**版本**: Alpha 4
**Maintainer**: Mambo Whistle Team
**License**: MIT
