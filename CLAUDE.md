# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Version**: 0.3.0 (Performance First)

Kazoo Proto Web is a real-time voice-to-instrument system using Web Audio API. Users sing/hum into their microphone, and the system detects pitch and expression features to drive virtual instruments in real-time.

**Critical Goal**: End-to-end latency < 50ms (currently 180ms - 3.6x over target)

### Current Architecture
```
js/
├── main.js                     # KazooApp - main application
├── audio-io.js                 # Audio I/O abstraction (Worklet + ScriptProcessor)
├── pitch-detector.js           # YIN algorithm wrapper
├── pitch-worklet.js            # AudioWorklet processor (YIN + FFT)
├── continuous-synth.js         # Continuous mode synthesizer
├── synthesizer.js              # Legacy synthesizer
├── performance.js              # Performance monitoring
├── expressive-features.js      # Feature extraction pipeline
├── core/
│   └── app-container.js        # Dependency injection container
├── managers/
│   └── ui-manager.js           # UI state management (event-driven)
├── config/
│   ├── app-config.js           # Centralized configuration
│   └── instrument-presets.js   # Instrument definitions
├── features/
│   ├── onset-detector.js       # Attack detection
│   ├── smoothing-filters.js    # Kalman + EMA filters
│   └── spectral-features.js    # FFT-based feature extraction
└── utils/
    ├── audio-utils.js          # Audio processing utilities
    └── logger.js               # Logging utility

tests/
├── unit/
│   └── app-container.test.js   # 19 tests (DI container)
└── config-system.test.js       # Config validation tests

docs/
├── guides/
│   ├── troubleshooting.md      # Common issues
│   └── configuration.md        # Config reference
├── CLEANUP_PLAN.md             # Optimization roadmap
└── CLEANUP_SUMMARY.md          # What was deleted and why
```

### Audio Pipeline
```
Microphone → AudioWorklet → YIN Detection → Feature Extraction → Synthesizer → Output
             (128 samples)    (pitch, clarity)  (volume, timbre)   (Tone.js)
```

## Common Development Commands

```bash
# Development
npm start                       # Start dev server (http://localhost:3000)
npm test                        # Run tests (Vitest)
npm run test:watch              # Run tests in watch mode
npm run test:coverage           # Run tests with coverage

# Debugging (in browser console after starting audio)
window.app.getLatencyStats()    # Get latency measurements (min/max/avg/p50/p95)
window.container.get('audioIO').mode  # Check mode ('worklet' or 'script-processor')
window.container.getServiceNames()    # List all registered services
```

## Core Constraints (Must Follow)

1. **Dependency Injection**: All services registered in AppContainer
   - Access via: `window.container.get('serviceName')`
   - Only expose: `window.app` and `window.container`
   - No global singletons

2. **Configuration**: Single source of truth
   - Use: `configManager.load()`
   - Extend presets in: `js/config/instrument-presets.js`

3. **UI Updates**: Event-driven only
   - Use: `UIManager` events
   - No direct DOM manipulation

4. **Testing**: Vitest only
   - Location: `tests/unit/` or `tests/integration/`
   - Tests must be able to fail
   - No custom test frameworks
   - No predefined success messages

## Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Latency | < 50ms | 180ms | ❌ 3.6x over |
| Test Coverage | 40% | ~5% | ❌ Needs work |
| Global Variables | 0 | 2 | ⚠️ Acceptable |
| Console Logs | < 50 | 286 | ❌ Too many |

**Priority**: Performance > Architecture > Documentation

## Documentation Rules

### Root Directory (3 files only)
1. **README.md** - User guide (< 300 lines)
2. **PROJECT_STATUS.md** - Current state (< 250 lines)
3. **CLAUDE.md** - This file (< 200 lines)

### docs/ Structure
```
docs/
├── guides/           # How-to guides
└── *.md             # Planning/cleanup docs
```

### Strict Prohibitions
- ❌ Creating `docs/phase*/` or `docs/step*/` directories
- ❌ Writing "completion reports" or "stage summaries"
- ❌ Using emoji in documentation
- ❌ Creating fake tests with predefined success
- ❌ Execution plans > 200 lines

### Update Principles
1. Code > Docs - Only write if absolutely necessary
2. README first - User-facing information
3. PROJECT_STATUS second - Developer information
4. Long-term plans → GitHub issues, not docs

## Development Workflow Reminders

### Before Making Changes
- Run `npm test` to ensure baseline works
- Check current latency: `window.app.getLatencyStats()`
- Verify Worklet mode: `window.container.get('audioIO').mode`

### After Making Changes
- Run `npm test` to verify tests still pass
- Test in browser with `npm start`
- Measure latency impact with `getLatencyStats()`
- Commit focused changes (one thing per commit)

### Testing Best Practices
- Always run `npm test` before committing
- Write tests that can fail (never fake success)
- Test real audio pipeline, not mocked data
- Integration tests > unit tests for audio code

## Common Pitfalls

1. **AudioWorklet Fallback**
   - System may fall back to ScriptProcessor (2048 buffer = 46ms base latency)
   - Check mode before debugging latency issues
   - Worklet requires HTTPS or localhost

2. **Configuration Not Loading**
   - Must call `configManager.load()` before accessing config
   - Config is singleton, loaded once at startup
   - Changes require page reload

3. **Service Not Found**
   - Service must be registered in AppContainer first
   - Check: `window.container.has('serviceName')`
   - See: `js/main.js` lines 735-843 for registrations

4. **Latency Measurement**
   - `performanceMonitor` measures processing time only
   - `getLatencyStats()` measures end-to-end (capture → output)
   - Need 100+ samples for accurate stats

## Performance Optimization Guidelines

### Likely Bottlenecks (in order)
1. **ScriptProcessor Fallback** (2048 buffer = 46ms)
   - Solution: Ensure Worklet mode is active
   - Check: `window.container.get('audioIO').mode === 'worklet'`

2. **FFT Computation** (SpectralFeatures)
   - Solution: Reduce FFT size or interval
   - Location: `js/features/spectral-features.js`

3. **Expression Feature Extraction**
   - Solution: Disable non-critical features
   - Location: `js/expressive-features.js`

4. **Tone.js Synthesizer**
   - Solution: Reduce filter complexity
   - Location: `js/continuous-synth.js`

### Measurement Strategy
```javascript
// In browser console
const stats = window.app.getLatencyStats()
console.table(stats)
// Look at p95 (95th percentile) for realistic worst-case
```

## v0.3.0 Development Principles

### Testing Philosophy
- **Real tests only** - Every test must be able to fail
- **Vitest CLI mode** - Use `npm test`, not UI mode (disconnected issue)
- **No mocking unless necessary** - Test actual implementations when possible
- **Coverage target** - 15% for v0.3.0 (currently 10%)
- **Test file location** - `tests/unit/` for unit tests

### Development Workflow
- **No voice testing required** - Write tests, reduce console.log, add instrumentation first
- **Voice testing tasks** - Saved for later (latency measurement, profiling, optimization)
- **One feature per commit** - Clear, atomic commits with descriptive messages
- **Run tests before commit** - `npm test` must pass

## Agent Interaction Guidelines

- Use `/catchup` not `/compact` at session start
- When debugging, read code implementation, not docs
- Write tests that can fail, never fake tests
- Delete code rather than comment it out
- One commit per logical change
- Update PROJECT_STATUS.md when completing major tasks

## Anti-Patterns to AVOID (Lessons Learned)

### ❌ Anti-Pattern 1: "Zombie Code"
**Problem**: Replacing CSS/HTML but leaving old code in files
**Example**: Converting `.hero` to Tailwind but not deleting `.hero {}` from CSS
**Rule**: DELETE old code in the SAME commit that adds the replacement
**Why**: Creates confusion, bloats files, makes rollback harder

### ❌ Anti-Pattern 2: "Pray It Works"
**Problem**: Adding classes/code without verifying they function
**Example**: Adding `prose` class without checking if Tailwind Typography plugin is loaded
**Rule**: Test EVERY change in browser before committing
**Why**: Untested code is broken code until proven otherwise

### ❌ Anti-Pattern 3: "Partial Task Completion"
**Problem**: Marking task as "done" when subtasks remain incomplete
**Example**: Task says "modify JS if needed" but you skip checking/modifying JS
**Rule**: Complete ALL parts of a task, or explicitly defer with justification
**Why**: Partial work creates hidden debt and false progress

### ❌ Anti-Pattern 4: "Over-Optimistic Commits"
**Problem**: Commit messages that claim completion when work is incomplete
**Example**: "Complete Phase 4" when T073-T074 are skipped
**Rule**: Commit messages must be brutally honest about what was NOT done
**Why**: Misleading commits waste future developer time

## Important Instruction Reminders

**Do what has been asked; nothing more, nothing less.**

- NEVER create documentation files unless explicitly requested
- ALWAYS prefer editing existing files over creating new ones
- Focus on fixing latency (180ms → < 50ms) before architecture
- Write real tests, not fake tests with predetermined results
- Measure performance impact of every change
- Code quality matters, but working code matters more

---

**Remember**: This project's goal is "working with low latency", not "looks professional". Fix bugs > Write docs.
