# 🚀 快速参考 - 新会话启动指南

**最后更新**: 2025-11-22
**当前分支**: `refactor/state-driven-ui-architecture`
**状态**: ✅ 所有功能正常，测试通过

---

## 📊 当前项目状态

### ✅ 完成的工作
1. **TypeScript基础设施** - 宽松配置，IDE智能提示
2. **Lighthouse CI** - 自动化性能监控
3. **设备选择Bug修复** - 3个关键Bug已修复
4. **文档完善** - 重构决策和会话总结已记录

### 📈 关键指标
- **测试通过**: 235/235 ✅
- **分支提交**: 3个新提交（领先origin 3个）
- **代码质量**: 无回归，性能优化保留
- **文档完整性**: 100%

---

## 🔧 已修复的Bug（重要！）

### Bug 1: 输出设备被覆盖
- **文件**: `js/audio-io.js:159-166`
- **症状**: 运行时切换设备后被覆盖回旧设备
- **状态**: ✅ 已修复

### Bug 2: AudioContext内存泄漏
- **文件**: `js/audio-io.js:460-470`
- **症状**: 每次重启创建新AudioContext
- **状态**: ✅ 已修复

### Bug 3: 蓝牙自动连接
- **文件**: `js/main.js:215-217, 675-727`
- **症状**: 页面加载自动激活蓝牙设备
- **状态**: ✅ 已修复

---

## 🎯 重要代码位置

### 性能关键路径（不要改动！）
**文件**: `js/main.js:256-261`
```javascript
// 7个高频DOM操作（60fps音频热路径）
this.ui.currentNote.textContent = `${note}${octave}`;
this.ui.currentFreq.textContent = `${frequency.toFixed(1)} Hz`;
this.ui.visualizerConfidence.textContent = `${Math.round(confidence * 100)}%`;
this.ui.visualizerLatency.textContent = `${latency}ms`;
```
⚠️ **不要抽象这些操作** - 已验证过度抽象会导致性能下降

### 设备选择核心逻辑
**文件**: `js/main.js:523-579` - 设备UI绑定
**文件**: `js/main.js:675-749` - 设备列表刷新
**文件**: `js/main.js:751-785` - 活动设备捕获

### AudioContext管理
**文件**: `js/audio-io.js:144-203` - start() 方法
**文件**: `js/audio-io.js:452-482` - _initializeAudioContext()

---

## 📁 重要文档

### 必读文档
1. **[REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md)** - 重构决策和经验教训
   - 为什么保留7个DOM操作
   - 性能 vs 架构纯粹性的权衡

2. **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** - 本次会话详细总结
   - 3个Bug的完整分析
   - 修复方案和代码位置
   - 测试结果和用户验证

### 配置文件
- **tsconfig.json** - TypeScript宽松配置
- **lighthouserc.json** - 性能监控阈值
- **.github/workflows/ci.yml** - CI/CD流水线

---

## 🚀 常用命令

### 开发
```bash
npm run dev              # 启动开发服务器 (localhost:3000)
npm test                 # 运行235个单元测试
npm run test:watch       # 监控模式运行测试
```

### 质量检查
```bash
npm run typecheck        # TypeScript类型检查
npm run validate         # 类型检查 + 测试
npm run perf             # Lighthouse性能审计
```

### Git操作
```bash
git status              # 查看状态
git log --oneline -5    # 查看最近5个提交
git push origin refactor/state-driven-ui-architecture  # 推送到远程
```

---

## ⚠️ 重要注意事项

### 1. 不要修改的代码
- `js/main.js:256-261` - 60fps音频热路径DOM操作
- 原因：已验证抽象会导致音频检测不灵敏

### 2. 设备选择测试要点
当修改设备相关代码时，必须测试：
- ✅ 页面加载不触发蓝牙连接
- ✅ 运行时切换设备生效
- ✅ 重启后设备选择保留
- ✅ 控制台无警告日志

### 3. AudioContext管理
- ✅ 只在首次创建AudioContext
- ✅ 重启时复用现有实例
- ✅ 输出设备仅在初始化时设置

---

## 🔍 调试技巧

### 查看设备状态
打开浏览器控制台，搜索以下日志：
```
[Main] Input device selected:      # 用户选择的设备
[Main] Capturing active device:    # 实际使用的设备
[AudioIO] 复用现有 AudioContext     # AudioContext复用
[Main] Skipping permission request # 跳过权限请求
```

### 检查localStorage
```javascript
localStorage.getItem('mambo:lastInputDeviceId')
localStorage.getItem('mambo:lastOutputDeviceId')
localStorage.getItem('mambo:lastInputDeviceLabel')
localStorage.getItem('mambo:lastOutputDeviceLabel')
```

---

## 🎯 下次会话可能的方向

### 选项1: 性能优化
- 运行 `npm run perf` 获取Lighthouse报告
- 优化低分项（FCP, LCP, TBT等）
- 目标：Performance Score ≥90分

### 选项2: TypeScript严格化
- 逐步启用strictNullChecks
- 为核心模块添加完整类型定义
- 改善IDE提示质量

### 选项3: 新功能开发
- 基于稳定的架构添加新功能
- 所有新功能应有单元测试
- 遵循MVC模式（Store → Controller → View）

### 选项4: Pull Request准备
- 代码审查checklist
- 合并到main分支
- 部署到production

---

## 📞 技术栈速查

### 核心技术
- **语言**: Vanilla JavaScript (ES2022)
- **音频**: Web Audio API + AudioWorklet
- **合成器**: Tone.js v15.1.22
- **音高检测**: Pitchfinder v2.3.2
- **测试**: Vitest v4.0.6
- **类型检查**: TypeScript v5.9.3 (仅检查，不编译)

### 架构模式
- **状态管理**: StateStore (类Redux)
- **UI渲染**: MamboView (View层抽象)
- **依赖注入**: AppContainer (DI容器)
- **音频处理**: AudioWorklet (60fps热路径)

---

## 🎓 关键经验

### 1. 性能优先
> 热路径代码（60fps）不应过度抽象
> 实用主义 > 架构纯粹性

### 2. 渐进式改进
> TypeScript宽松模式先获得智能提示
> 性能监控自动化为持续优化打基础

### 3. 诊断驱动
> 详细的日志追踪快速定位Bug
> 验证实际设备 vs 请求设备

---

**准备好了吗？** 🚀

新会话可以直接参考本文档快速上手！
