# Kazoo Proto Web - 项目架构全景

**版本**: 0.3.0 (Performance First)
**日期**: 2025-11-19
**目标**: 实时语音转乐器系统 (目标延迟 < 50ms)

---

## 一、项目概述

### 核心功能
用户对着麦克风哼唱/发声 → 系统实时检测音高和表现力 → 驱动虚拟乐器合成声音

### 技术亮点
- **零安装**: 纯浏览器运行，无需后端服务器
- **低延迟**: 使用 AudioWorklet (128 sample buffer)
- **表现力映射**: 音量、音色、呼吸感等特征提取
- **双引擎模式**:
  - Continuous 模式 (默认): 连续频率滑动，适合人声/弦乐
  - Legacy 模式: 离散音符阶梯，适合钢琴/吉他

### 当前性能指标
| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| 端到端延迟 | < 50ms | 180ms | ❌ 3.6x 超标 |
| 测试覆盖率 | 40% | 10% | ⚠️ 进行中 |
| 全局变量 | 0 | 2 | ✅ 可接受 |
| 控制台日志 | < 50 | 286 | ❌ 过多 |

---

## 二、技术栈

### 前端技术
- **HTML/CSS**: Tailwind CSS (通过 CDN)
- **JavaScript**: ES6 Modules (无 bundler)
- **音频处理**: Web Audio API + AudioWorklet
- **音频合成**: Tone.js v15.1.22
- **测试框架**: Vitest
- **开发服务器**: npx serve

### 核心算法
- **音高检测**: YIN algorithm (时域自相关)
- **特征提取**: FFT (频域分析) + EMA 平滑
- **Attack 检测**: 能量变化率 + 静音检测

---

## 三、项目结构

```
Adrian-UI-UX-1/
├── index.html                  # 主页面 (Apple 风格 UI)
├── css/
│   └── styles.css             # 自定义样式
├── js/
│   ├── main.js                # 主应用入口 (AppContainer + KazooApp)
│   ├── audio-io.js            # 音频 I/O 抽象层 (Worklet + ScriptProcessor)
│   ├── pitch-detector.js      # YIN 算法封装
│   ├── pitch-worklet.js       # AudioWorklet 处理器 (多线程)
│   ├── continuous-synth.js    # Continuous 模式合成器
│   ├── synthesizer.js         # Legacy 模式合成器
│   ├── performance.js         # 性能监控
│   ├── expressive-features.js # 表现力特征提取管线
│   ├── core/
│   │   └── app-container.js   # 依赖注入容器
│   ├── managers/
│   │   └── ui-manager.js      # UI 状态管理 (事件驱动)
│   ├── config/
│   │   ├── app-config.js      # 集中式配置管理
│   │   └── instrument-presets.js # 乐器预设定义
│   ├── features/
│   │   ├── onset-detector.js  # Attack 检测
│   │   ├── smoothing-filters.js # Kalman + EMA 滤波器
│   │   └── spectral-features.js # FFT 特征提取
│   └── utils/
│       ├── audio-utils.js     # 音频处理工具函数
│       └── logger.js          # 日志工具
├── tests/
│   ├── unit/
│   │   ├── app-container.test.js (19 tests)
│   │   └── pitch-detector.test.js (48 tests)
│   └── config-system.test.js  # 配置验证测试
├── docs/
│   ├── guides/
│   │   ├── troubleshooting.md
│   │   └── configuration.md
│   ├── CLEANUP_PLAN.md
│   └── CLEANUP_SUMMARY.md
├── CLAUDE.md                   # AI Agent 开发指南
├── PROJECT_STATUS.md           # 当前状态跟踪
└── README.md                   # 用户指南
```

---

## 四、核心架构设计

### 4.1 依赖注入容器 (AppContainer)

**设计模式**: IoC (Inversion of Control)
**位置**: [js/core/app-container.js](js/core/app-container.js)

```javascript
// 服务注册 (在 main.js 中)
container.register('configManager', () => configManager, { singleton: true });
container.register('pitchDetector', () => new PitchDetector(), { singleton: true });
container.register('app', (c) => new KazooApp({
    config: c.get('config'),
    pitchDetector: c.get('pitchDetector'),
    // ... 其他依赖
}), { singleton: true });

// 服务访问
window.container.get('pitchDetector')
window.app.getLatencyStats()
```

**已注册服务** (共 9 个):
1. `configManager` - 配置管理器
2. `config` - 配置对象
3. `instrumentPresetManager` - 乐器预设
4. `ExpressiveFeatures` - 特征提取类
5. `pitchDetector` - 音高检测器
6. `performanceMonitor` - 性能监控器
7. `synthesizerEngine` - Legacy 合成器
8. `continuousSynthEngine` - Continuous 合成器
9. `app` - 主应用实例

### 4.2 音频处理流水线

#### 流程图
```
用户麦克风
    ↓
AudioContext.getUserMedia()
    ↓
[分支1: AudioWorklet 模式 - 默认]
    MediaStreamSource → AudioWorkletNode (pitch-worklet.js)
        ↓ (Worklet 线程)
        - YIN 音高检测 (每 128 samples)
        - FFT 频谱分析
        - 音量检测 (RMS)
        - Attack 检测 (OnsetDetector)
        - EMA 平滑滤波
        ↓
    postMessage (PitchFrame 对象, 11 个字段)
        ↓
    main.js: handleWorkletPitchFrame()
        ↓
    ContinuousSynthEngine.processPitchFrame()
        ↓
    Tone.js 合成器 → 扬声器输出

[分支2: ScriptProcessor 模式 - Fallback]
    MediaStreamSource → ScriptProcessorNode (2048 buffer)
        ↓ (主线程)
        PitchDetector.detect() (YIN 算法)
        ↓
        ExpressiveFeatures.process() (特征提取)
        ↓
        main.js: onAudioProcess()
        ↓
        (同上，流向合成器)
```

#### 数据结构: PitchFrame
```javascript
{
    frequency: 440.0,      // Hz
    note: 'A',             // 音符名
    octave: 4,             // 八度
    confidence: 0.95,      // 0-1
    cents: -5,             // 音分偏移 (-50 ~ +50)
    volumeDb: -20,         // dB
    brightness: 0.6,       // 0-1 (高频能量比)
    breathiness: 0.3,      // 0-1 (噪声比)
    isOnset: false,        // Attack 检测
    timestamp: 1234567890, // ms
    captureTime: 1234567890 // AudioContext.currentTime (用于延迟测量)
}
```

### 4.3 配置管理系统

**单一真相源**: [js/config/app-config.js](js/config/app-config.js)

```javascript
// 加载配置
const config = configManager.load(); // 返回完整配置对象

// 配置结构
{
    audio: {
        sampleRate: 44100,
        bufferSize: 2048,
        workletBufferSize: 128,
        useWorklet: true
    },
    pitchDetector: {
        clarityThreshold: 0.9,
        minFrequency: 80,
        maxFrequency: 800
    },
    smoothing: {
        kalman: { processNoise: 0.001, measurementNoise: 0.1 },
        volume: { alpha: 0.3 },
        brightness: { alpha: 0.2 }
    },
    onset: {
        energyThreshold: 6,
        silenceThreshold: -40,
        attackDuration: 50,
        minSilenceDuration: 100
    },
    spectral: {
        fftSize: 2048,
        fftInterval: 2,
        minFrequency: 80,
        maxFrequency: 8000
    },
    synthesizer: {
        pitchBendRange: 100,
        filterCutoffRange: { min: 200, max: 8000 },
        noiseGainMax: 0.3
    }
}
```

### 4.4 UI 事件驱动系统

**设计模式**: Observer Pattern (Pub-Sub)
**位置**: [js/managers/ui-manager.js](js/managers/ui-manager.js)

```javascript
// 订阅事件
uiManager.on(UI_EVENTS.PITCH_UPDATE, (data) => {
    console.log('Pitch updated:', data.frequency);
});

// 发布事件
uiManager.emit(UI_EVENTS.PITCH_UPDATE, {
    frequency: 440,
    note: 'A',
    octave: 4
});

// 可用事件类型
UI_EVENTS = {
    STATUS_CHANGE,
    ERROR,
    WARNING,
    PITCH_UPDATE,
    LATENCY_UPDATE,
    INSTRUMENT_CHANGE,
    START_CLICKED,
    STOP_CLICKED
}
```

---

## 五、关键代码路径

### 5.1 启动流程

```javascript
// 1. index.html 加载完成
document.addEventListener('DOMContentLoaded', () => {
    // 2. 从容器获取应用实例
    app = container.get('app'); // 触发依赖注入链

    // 3. 初始化应用
    app.initialize(); // 绑定事件、初始化 UI
});

// 4. 用户点击 "Start Engine" 按钮
main.js: KazooApp.start()
    ↓
    _startWithAudioIO()
    ↓
    audioIO = new AudioIO()
    audioIO.configure({ useWorklet: true, ... })
    audioIO.start() // 请求麦克风权限
    ↓
    _initializeEngines(audioContext, bufferSize, mode)
    ↓
    continuousSynthEngine.initialize() // 创建 Tone.js 合成器
    ↓
    UI 更新: startBtn → hidden, stopBtn → visible
```

### 5.2 实时音频处理路径

```javascript
// AudioWorklet 模式 (默认)
pitch-worklet.js: process(inputs, outputs, parameters)
    ↓ (每 128 samples 调用一次)
    - YIN.getPitch(audioBuffer) → frequency
    - calculateRMS(audioBuffer) → volume
    - SpectralFeatures.process() → brightness, breathiness
    - OnsetDetector.detect() → isOnset
    ↓
    this.port.postMessage({ type: 'pitch-frame', pitchFrame: {...} })
    ↓
main.js: audioIO.onWorkletPitchFrame((pitchFrame, timestamp) => {
    handleWorkletPitchFrame(pitchFrame, timestamp);
})
    ↓
continuous-synth.js: processPitchFrame(pitchFrame)
    ↓
    - 频率映射: setFrequency(pitchFrame.frequency)
    - 音量映射: setVolume(pitchFrame.volumeDb)
    - 音色映射: setBrightness(pitchFrame.brightness)
    - Attack 触发: triggerNote() if pitchFrame.isOnset
    ↓
Tone.js → 扬声器输出
```

### 5.3 乐器切换路径

```javascript
// 1. 用户点击乐器按钮
index.html: <button class="instrument-btn" data-instrument="violin">
    ↓ (两个事件监听器)

// 监听器 1 (index.html 内联脚本)
btn.addEventListener('click', function() {
    // 只处理视觉效果 (Google 彩色边框)
    btns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
});

// 监听器 2 (main.js)
btn.addEventListener('click', (e) => {
    const instrument = e.currentTarget.dataset.instrument;

    // 更新状态徽章
    instrumentStatus.textContent = instrumentName;

    // 切换乐器预设
    if (currentEngine && currentEngine.currentSynth) {
        currentEngine.changeInstrument(instrument);
        // ↓
        // continuous-synth.js: changeInstrument('violin')
        //   → 加载预设: instrumentPresets['violin']
        //   → 更新合成器参数: oscillator type, filter, envelope
    }
});
```

---

## 六、性能瓶颈分析

### 当前延迟构成 (推测)

| 阶段 | 预估延迟 | 备注 |
|------|----------|------|
| 麦克风缓冲 | 3ms | 128 samples @ 44.1kHz |
| AudioWorklet 处理 | 5-10ms | YIN + FFT + 特征提取 |
| 主线程传输 | 1-2ms | postMessage |
| 合成器响应 | 5-10ms | Tone.js setFrequency() |
| 音频输出缓冲 | 10-20ms | 浏览器音频栈 |
| **测量值** | **180ms** | window.app.getLatencyStats() |

### 可能的瓶颈

1. **ScriptProcessor Fallback** (46ms 基础延迟)
   - 检查: `window.container.get('audioIO').mode === 'worklet'`
   - 如果是 'script-processor'，则 2048 buffer = 46ms

2. **FFT 计算** (SpectralFeatures)
   - 每帧执行 2048 点 FFT
   - 解决方案: 降低 fftSize 或增加 fftInterval

3. **表现力特征提取** (ExpressiveFeatures)
   - 多个滤波器串联 (Kalman + EMA)
   - 解决方案: 禁用非关键特征

4. **Tone.js 合成器延迟**
   - 滤波器链 (LowPass + HighPass + Noise)
   - 解决方案: 简化效果链

### 调试命令

```javascript
// 浏览器控制台
window.app.getLatencyStats()
// 返回: { min, max, avg, p50, p95, count }

window.container.get('audioIO').mode
// 返回: 'worklet' 或 'script-processor'

window.container.get('performanceMonitor').getMetrics()
// 返回: { processingTime, totalLatency, fps, ... }
```

---

## 七、前端 UI 架构

### HTML 结构 (index.html)

```html
<nav> 导航栏
    - Logo (Kazoo Proto)
    - 导航链接 (Instruments, Visualizer, Tips)
    - 模式切换器 (Continuous/Legacy)
</nav>

<main>
    <section> Hero 区域
        - 标题 "Turn your voice into any instrument"
        - 副标题 "Advanced pitch tracking meets AudioWorklet"
    </section>

    <div class="grid"> 核心功能区
        <div class="lg:col-span-7"> 乐器选择 (6 个按钮)
            - Saxophone (默认选中, .active 类)
            - Violin, Piano, Flute, Guitar, Synth
            - Google 彩色边框效果 (CSS 动画)
        </div>

        <div class="lg:col-span-5"> 控制中心
            - Start Engine / Stop Session 按钮
            - 状态显示: System, Latency, Confidence
        </div>
    </div>

    <div id="statusBar"> 兼容性元素 (隐藏)

    <div id="visualizer"> 可视化区域
        - 当前音符显示 (大字体)
        - 频率显示 (Hz)
        - 音高曲线 Canvas
    </div>

    <section id="tipsSection"> 使用提示
        - 音频环境建议
        - 模式说明
        - 故障排查
    </section>

    <section> Early Bird 表单
        - 邮箱订阅 (Kazoo Pro Desktop)
    </section>

    <footer> 版权信息
</main>
```

### CSS 设计系统

**风格**: Apple 官网风格 + Google Material Design 元素

```css
/* 颜色系统 */
--apple-text: #1D1D1F
--apple-gray: #86868B
--apple-sub: #6e6e73
--google-gradient: linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853)

/* 玻璃拟态 */
.glass {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.6);
}

/* Google 彩色边框 (重点) */
.card-border-gradient {
    position: absolute;
    inset: -3px;
    background: linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853);
    background-size: 300% 300%;
    opacity: 0; /* 默认隐藏 */
    animation: borderRotate 4s linear infinite;
}

.instrument-btn.active .card-border-gradient {
    opacity: 1; /* 激活时显示 */
}
```

### 关键交互逻辑

```javascript
// DOMContentLoaded 安全补丁
document.addEventListener('DOMContentLoaded', () => {
    // 1. 确保关键元素存在 (防止 classList 错误)
    ['stopBtn', 'startBtn', 'warningBox', 'warningText'].forEach(id => {
        if (!document.getElementById(id)) {
            const div = document.createElement('div');
            div.id = id;
            div.style.display = 'none';
            document.body.appendChild(div);
        }
    });

    // 2. 乐器按钮视觉切换 (Google 边框)
    document.querySelectorAll('.instrument-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.instrument-btn').forEach(b =>
                b.classList.remove('active')
            );
            this.classList.add('active');
        });
    });

    // 3. Tips 折叠/展开
    helpToggle.addEventListener('click', () => {
        helpContent.classList.toggle('hidden');
        helpToggle.textContent = helpContent.classList.contains('hidden')
            ? "Show Details"
            : "Hide Details";
    });
});
```

---

## 八、测试策略

### 当前测试覆盖

```bash
npm test

# 输出
✓ tests/unit/app-container.test.js (19 tests)
✓ tests/unit/pitch-detector.test.js (48 tests)

Test Files  2 passed (2)
Tests  67 passed (67)
Coverage  10% (target 15% for v0.3.0)
```

### 测试原则 (来自 CLAUDE.md)

1. **真实测试**: 每个测试必须能够失败
2. **Vitest CLI 模式**: 使用 `npm test`，不用 UI 模式
3. **无 Mock 优先**: 测试实际实现，除非必要
4. **覆盖率目标**:
   - v0.3.0: 15%
   - v1.0: 40%

### 测试文件结构

```javascript
// tests/unit/pitch-detector.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { PitchDetector } from '../../js/pitch-detector.js';

describe('PitchDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new PitchDetector();
        detector.initialize(44100);
    });

    it('should detect 440Hz (A4) sine wave', () => {
        const buffer = generateSineWave(440, 44100, 2048);
        const result = detector.detect(buffer, 0.5);

        expect(result.frequency).toBeCloseTo(440, 0);
        expect(result.note).toBe('A');
        expect(result.octave).toBe(4);
    });
});
```

---

## 九、开发工作流

### 常用命令

```bash
# 启动开发服务器
npm start
# → http://localhost:3000

# 运行测试
npm test

# 运行测试 (watch 模式)
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

### 调试技巧

```javascript
// 1. 延迟统计
window.app.getLatencyStats()

// 2. 检查音频模式
window.container.get('audioIO').mode

// 3. 查看已注册服务
window.container.getServiceNames()

// 4. 获取配置
window.container.get('config')

// 5. 性能指标
window.container.get('performanceMonitor').getMetrics()
```

### Git 分支策略

- `main`: 稳定版本
- `合成优化`: 当前工作分支 (UI 优化)
- `refactor/step-3-modularization`: 架构重构分支

---

## 十、已知问题和改进方向

### P0: 延迟优化 (Critical)
- **当前**: 180ms
- **目标**: < 50ms (v1.0), < 90ms (v0.3.0)
- **措施**:
  1. 验证 AudioWorklet 模式激活
  2. Profile FFT 和特征提取开销
  3. 优化 Tone.js 合成器链
  4. 考虑 WebAssembly 加速 YIN 算法

### P1: 测试覆盖率
- **当前**: 10%
- **目标**: 15% (v0.3.0), 40% (v1.0)
- **措施**: 补充 AudioIO, ExpressiveFeatures, ContinuousSynth 单元测试

### P2: 日志污染
- **当前**: 286 条 console.log
- **目标**: < 50 条 (生产环境 < 10 条)
- **措施**: 使用 Logger 模块，设置日志级别

### P3: 文档过多
- **当前**: 192+ 个文件
- **目标**: < 50 个核心文档
- **措施**: 归档历史文档到 `/docs/archive/`

---

## 十一、与 Gemini 协作的建议

### 分享顺序建议

1. **第一步**: 分享此文档 (ARCHITECTURE_OVERVIEW.md)
   - 让 Gemini 了解全局架构

2. **第二步**: 分享核心代码
   - [js/main.js](js/main.js) (主应用逻辑)
   - [js/audio-io.js](js/audio-io.js) (音频抽象层)
   - [js/pitch-worklet.js](js/pitch-worklet.js) (Worklet 处理器)

3. **第三步**: 分享配置和工具
   - [js/config/app-config.js](js/config/app-config.js)
   - [js/core/app-container.js](js/core/app-container.js)

4. **第四步**: 分享前端代码
   - [index.html](index.html) (完整 UI)
   - [css/styles.css](css/styles.css)

5. **第五步**: 分享测试和文档
   - [tests/unit/](tests/unit/)
   - [CLAUDE.md](CLAUDE.md) (开发约束)
   - [PROJECT_STATUS.md](PROJECT_STATUS.md)

### 重点审查领域

请 Gemini 关注以下方面:

1. **性能瓶颈**: 帮助定位 180ms 延迟的来源
2. **架构合理性**: 评估依赖注入、事件驱动等设计模式
3. **代码质量**: 指出潜在 bug、可读性问题
4. **测试策略**: 建议优先测试的模块
5. **UI/UX**: 前端交互逻辑是否清晰
6. **可维护性**: 代码是否易于扩展和重构

### 具体问题示例

> "请审查 [js/pitch-worklet.js](js/pitch-worklet.js)，帮助我找到延迟瓶颈。当前 YIN 算法 + FFT 在 Worklet 中执行，是否有优化空间？"

> "请评估 [index.html](index.html) 的 UI 交互逻辑。当前有两个事件监听器处理乐器按钮点击，是否合理？有无更优雅的方案？"

> "请检查 [js/config/app-config.js](js/config/app-config.js) 的配置传递逻辑。配置需要从主线程序列化并传递给 Worklet，当前实现是否存在问题？"

---

## 十二、参考资源

### 外部文档
- [Web Audio API Spec](https://www.w3.org/TR/webaudio/)
- [AudioWorklet Best Practices](https://developer.chrome.com/blog/audio-worklet/)
- [Tone.js Documentation](https://tonejs.github.io/)
- [YIN Algorithm Paper](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)

### 内部文档
- [CLAUDE.md](CLAUDE.md) - AI Agent 开发指南 (必读)
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - 当前状态跟踪
- [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) - 故障排查
- [docs/guides/configuration.md](docs/guides/configuration.md) - 配置参考

---

**最后更新**: 2025-11-19
**维护者**: Ziming Wang & Claude Code
**联系方式**: GitHub Issues
