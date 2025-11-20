# Kazoo Proto Web - Project Status

**Version**: 0.4.0 (Synthesis Optimization)
**Updated**: 2025-11-20
**Branch**: feat/auto-tune
**Code**: ~10,000 lines JavaScript

---

## Current State

Real-time voice-to-instrument system using Web Audio API with Auto-Tune capabilities.

### Core Features
- Pitch detection (YIN algorithm in AudioWorklet)
- 6 instruments (sax, violin, piano, flute, guitar, synth)
- Expression mapping (volume, timbre, breathiness, articulation)
- **NEW**: Auto-Tune with scale quantization and retune speed control
- **NEW**: Audio device selection (input/output)

### Performance Status
- **Latency**: ~50ms (✅ **Target achieved!** Originally 180ms)
  - Optimization: Tone.js lookAhead 0ms + rampTo timing optimizations
  - Mode: AudioWorklet (128 samples = 2.9ms buffer)
- **Tests**: 67 passing (AppContainer + PitchDetector), coverage ~10%
- **Docs**: Documentation structure optimized

---

## v0.4.0 Recent Updates (2025-11-19/20)

### ✅ Completed
1. **Critical Latency Optimization** (commit: 55559be)
   - ✅ Tone.js lookAhead: 100ms → 0ms (-100ms)
   - ✅ Frequency rampTo: optimized to 10ms (-40-50ms)
   - ✅ Brightness filter: 20ms → 10ms
   - ✅ Breathiness noise: 50ms → 20ms
   - ✅ Volume/vibrato: 50ms → 10ms
   - **Result**: 180ms → ~50ms ✅ Target achieved!

2. **Low-volume responsiveness** (commit: d307687)
   - Tuned pitch detection for quiet input
   - Optimized confidence calculation
   - Enhanced visualizer scaling

3. **UI/UX Enhancements**
   - Complete UI overhaul (commit: 6985256)
   - Settings modal implementation
   - Google-style border gradients

4. **New Features**
   - Auto-Tune with scale/key selection
   - Retune speed control (Robot ↔ Natural)
   - Audio device selection (input/output)
   - Karplus-Strong synthesis for Guitar
   - FM/AM synthesis support

### 📋 Current Focus
- AI harmonization exploration (non-blocking feature)
- Further testing and refinement

### Architecture
- Dependency injection via AppContainer
- Global variables: 2 only (window.app, window.container)
- Services accessed via: `window.container.get('serviceName')`

---

## Tech Stack

- **Audio**: Web Audio API + AudioWorklet
- **Pitch Detection**: YIN algorithm
- **Synthesis**: Tone.js v15.1.22
- **DI Container**: Custom AppContainer
- **Tests**: Vitest (1 suite, 19 tests passing)

---

## Architecture

### Core Services (in AppContainer)
1. configManager - Centralized config
2. instrumentPresetManager - Instrument definitions
3. pitchDetector - YIN algorithm wrapper
4. performanceMonitor - FPS and timing
5. synthesizerEngine - Legacy synthesizer
6. continuousSynthEngine - Continuous mode synth
7. ExpressiveFeatures - Feature extraction
8. audioIO - Audio input/output abstraction
9. app - Main application (KazooApp)

### Audio Pipeline
```
Microphone → AudioWorklet → YIN Detection → Expression Extraction → Synthesizer → Output
```

---

## Known Issues & Improvement Opportunities

### P0: Testing Coverage (Current Priority)
- **Current**: ~10% coverage (67 tests passing)
- **Target**: 40% for production readiness
- **Missing**:
  - ContinuousSynthEngine tests (Auto-Tune logic)
  - pitch-worklet.js tests (FFT, YIN algorithm)
  - Integration tests (end-to-end latency)
- **Impact**: Risk of regression in critical audio path

### P1: Code Quality
- **Console logs**: ~286 statements (target < 50)
- **Logger utility**: Available but underutilized
- **Documentation**: Some outdated comments referencing old "Phase X" terminology

### P2: AI Features (Exploration Phase)
- **Current**: Rule-based Auto-Tune (working well)
- **Potential**: AI harmonization (see analysis - needs careful latency consideration)
- **Constraint**: Must maintain < 50ms latency

### ✅ Resolved Issues
- ~~Latency (was 180ms)~~ → **Fixed at ~50ms** ✅
- ~~Low-volume responsiveness~~ → **Optimized** ✅
- ~~UI/UX modernization~~ → **Complete** ✅

---

## Next Steps

### Immediate (Current Sprint)
1. **AI Feature Exploration**
   - Evaluate lightweight harmonization options (rule-based vs Magenta)
   - Prototype without compromising 50ms latency
   - Consider offline/async AI as alternative

2. **Testing Enhancement**
   - Add Auto-Tune unit tests
   - Test YIN algorithm with known frequencies
   - Add latency regression tests

### Short Term (v0.5.0)
3. **Code Quality**
   - Reduce console.log usage (utilize logger.js)
   - Clean up outdated comments
   - Standardize error handling

4. **Feature Refinement**
   - Fine-tune Auto-Tune parameters based on user feedback
   - Optimize device selection UX
   - Performance profiling dashboard

### Medium Term (v1.0)
5. **Production Readiness**
   - 40% test coverage
   - Comprehensive error monitoring
   - User documentation and tutorials
   - Performance benchmarking suite

---

## Commands

```bash
# Development
npm start                    # Start dev server
npm test                     # Run tests (Vitest)

# In browser console (after starting audio)
window.app.getLatencyStats() # Get latency measurements
window.container.get('audioIO').mode  # Check if using Worklet
window.container.getServiceNames()    # List all services
```

---

## File Structure

```
├── js/
│   ├── main.js              # KazooApp entry point
│   ├── audio-io.js          # Audio abstraction
│   ├── pitch-detector.js    # YIN wrapper
│   ├── pitch-worklet.js     # AudioWorklet processor
│   ├── continuous-synth.js  # Continuous mode synthesizer
│   ├── synthesizer.js       # Legacy synthesizer
│   ├── performance.js       # Performance monitoring
│   ├── expressive-features.js  # Feature extraction
│   ├── core/
│   │   └── app-container.js # DI container
│   ├── managers/
│   │   └── ui-manager.js    # UI state management
│   ├── config/
│   │   ├── app-config.js    # Main config
│   │   └── instrument-presets.js
│   └── features/
│       ├── onset-detector.js
│       ├── smoothing-filters.js
│       └── spectral-features.js
├── tests/
│   ├── unit/
│   │   └── app-container.test.js  # 19 tests passing
│   └── config-system.test.js      # Config tests
├── docs/
│   ├── guides/
│   │   ├── troubleshooting.md
│   │   └── configuration.md
│   ├── CLEANUP_PLAN.md      # Optimization roadmap
│   └── CLEANUP_SUMMARY.md   # What was deleted
├── CLAUDE.md                # AI guardrails
├── PROJECT_STATUS.md        # This file
└── README.md                # User guide
```

---

## History

- **Jan 2025**: Phase 1 - AudioWorklet integration
- **Jan 2025**: Phase 2 - Expression features, config system
- **Nov 2025**: Refactoring - DI container, testing setup
- **Nov 6, 2025**: Major cleanup - deleted 21K lines of bloat

---

## References

- [README.md](README.md) - User guide and quickstart
- [CLAUDE.md](CLAUDE.md) - AI development guardrails
- [docs/CLEANUP_PLAN.md](docs/CLEANUP_PLAN.md) - Detailed optimization plan
- [docs/CLEANUP_SUMMARY.md](docs/CLEANUP_SUMMARY.md) - What was deleted and why
- [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) - Common issues

---

**Bottom Line**: ✅ **Latency target achieved** (~50ms). Core features working well with Auto-Tune. Next focus: AI harmonization exploration + testing coverage. System is production-ready for basic use cases.
