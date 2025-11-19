# Auto-Tune (Pitch Correction) 使用指南

## 什么是 Auto-Tune?

Auto-Tune 是一个音高修正功能,可以将你唱出的音高自动"吸附"到最近的正确音符上,让演奏听起来更加准确。

就像歌手录音时使用的修音软件一样,它会帮你纠正跑调的音符!

## 核心功能

### 1. 音高量化 (Pitch Quantization)

将检测到的频率自动修正到最近的音符:
- **输入**: 442Hz (稍微跑调的A4)
- **输出**: 440Hz (标准的A4)

### 2. 可调修正强度

控制修正的程度:
- **0%**: 完全不修正,保持原始音高
- **50%**: 修正一半,自然但有帮助
- **100%**: 完全修正,绝对准确但可能失去表现力

### 3. 音阶过滤

只修正到特定音阶内的音符:
- **全音阶** (CHROMATIC): 所有12个半音
- **大调** (MAJOR): 如C大调 (C D E F G A B)
- **小调** (MINOR): 如A小调 (A B C D E F G)
- **五声音阶**: 中国传统五声或布鲁斯

## 使用方法

### 浏览器控制台

打开浏览器控制台(F12),然后:

```javascript
// 获取合成器实例
const synth = window.container.get('continuousSynthEngine');

// ===== 基本使用 =====

// 1. 启用 Auto-Tune (50%修正强度)
synth.setAutoTune(true, 0.5);

// 2. 关闭 Auto-Tune
synth.setAutoTune(false);

// ===== 高级设置 =====

// 启用100%修正(完全自动调音)
synth.setAutoTune(true, 1.0);

// 设置为C大调音阶
synth.setAutoTuneScale('MAJOR', 'C');

// 设置为A小调音阶
synth.setAutoTuneScale('MINOR', 'A');

// 设置为中国五声音阶 (C调)
synth.setAutoTuneScale('PENTATONIC_MAJOR', 'C');

// 布鲁斯音阶
synth.setAutoTuneScale('BLUES', 'E');

// ===== 查看统计 =====

// 查看修正统计信息
console.log(synth.getAutoTuneStats());
// 输出: { processedCount, correctedCount, avgCentsError, ... }
```

## 可用音阶

| 音阶类型 | 代码 | 说明 | 音符数 |
|---------|------|------|-------|
| 全音阶 | `CHROMATIC` | 所有半音 | 12 |
| 大调 | `MAJOR` | 明亮欢快 (如C大调) | 7 |
| 小调 | `MINOR` | 忧郁深沉 (如A小调) | 7 |
| 大调五声 | `PENTATONIC_MAJOR` | 中国传统五声 | 5 |
| 小调五声 | `PENTATONIC_MINOR` | 民谣布鲁斯 | 5 |
| 布鲁斯 | `BLUES` | 蓝调音阶 | 6 |

## 常用调号

| 调号 | 说明 | 常见音阶 |
|-----|------|---------|
| C | C调 | C大调、A小调 |
| D | D调 | D大调、B小调 |
| E | E调 | E大调、C#小调 |
| F | F调 | F大调、D小调 |
| G | G调 | G大调、E小调 |
| A | A调 | A大调、F#小调 |

## 使用建议

### 适合使用 Auto-Tune 的场景

✅ **初学者练习**: 帮助你快速找到正确的音高
✅ **演奏歌曲**: 让你的演奏听起来更专业
✅ **录音**: 修正小瑕疵,提升录音质量

### 不建议使用的场景

❌ **自由即兴**: 会限制表现力和创造力
❌ **滑音效果**: Auto-Tune会"纠正"你故意的滑音
❌ **颤音效果**: 可能会破坏自然的颤音

### 推荐参数

| 使用场景 | 修正强度 | 音阶 |
|---------|----------|------|
| 新手练习 | 70%-100% | CHROMATIC |
| 一般演奏 | 30%-50% | MAJOR/MINOR |
| 专业演奏 | 10%-30% | CHROMATIC |
| 特殊效果 | 100% | PENTATONIC |

## 示例场景

### 场景1: 练习C大调歌曲

```javascript
// 设置C大调,50%修正
synth.setAutoTune(true, 0.5);
synth.setAutoTuneScale('MAJOR', 'C');

// 现在你唱的音会自动修正到C大调音阶
// 即使稍微跑调也会被修正到最近的正确音符
```

### 场景2: 模仿T-Pain效果

```javascript
// 100%修正 + 极短的Portamento
synth.setAutoTune(true, 1.0);
synth.setAutoTuneScale('CHROMATIC', 'C');

// 这会产生明显的"机器人"音效
// 就像T-Pain的自动调音效果
```

### 场景3: 自然修正

```javascript
// 30%修正,保持自然感
synth.setAutoTune(true, 0.3);
synth.setAutoTuneScale('CHROMATIC', 'C');

// 只修正明显跑调的部分
// 保留自然的音高变化和表现力
```

## 技术细节

### 算法流程

1. **检测**: 从麦克风检测原始音高 (例如: 442Hz)
2. **转换**: 频率 → MIDI音符号 (442Hz ≈ MIDI 69.08)
3. **量化**: 吸附到最近的音阶内音符 (69.08 → 69)
4. **计算**: 目标MIDI → 目标频率 (69 → 440Hz)
5. **插值**: 根据修正强度混合原始和目标频率
6. **输出**: 修正后的频率传给合成器

### 性能指标

- **CPU开销**: < 0.1ms (纯数学计算)
- **延迟**: < 1ms (不影响实时性)
- **内存占用**: < 1KB

### 与Portamento的区别

| 特性 | Auto-Tune | Portamento |
|------|-----------|------------|
| 作用 | 修正音高到正确音符 | 平滑音符间过渡 |
| 效果 | 音准更好 | 滑音效果 |
| 延迟 | < 1ms | 10-100ms |
| 是否改变音高 | 是 | 否 |

两者可以同时使用,效果叠加!

## 故障排查

### Q: Auto-Tune不起作用?

A: 检查以下几点:
1. 确认已调用 `setAutoTune(true, amount)`
2. 修正强度不能为0
3. 检查 `autotuneEnabled` 状态: `synth.autotuneEnabled`

### Q: 音质变差了?

A: 降低修正强度:
```javascript
synth.setAutoTune(true, 0.3); // 从1.0降到0.3
```

### Q: 滑音效果消失了?

A: Auto-Tune会修正音高偏移,与滑音冲突:
```javascript
// 临时关闭 Auto-Tune
synth.setAutoTune(false);
```

### Q: 如何查看是否生效?

A: 查看统计信息:
```javascript
const stats = synth.getAutoTuneStats();
console.log(`已修正: ${stats.correctedCount} 次`);
console.log(`平均误差: ${stats.avgCentsError.toFixed(1)} cents`);
```

## 下一步

- 🎤 试试不同的修正强度,找到最适合你的设置
- 🎵 尝试不同的音阶,探索不同的音乐风格
- 📊 查看统计数据,了解你的音准水平
- 🎸 结合其他效果器(Vibrato, Reverb)创造独特音色

---

**版本**: v0.4.1
**最后更新**: 2025-11-19
