# MAMBO Web - Architecture Overview

**Version**: 0.1.0 (Performance First)
**Date**: 2025-11-21
**Goal**: Real-time Voice-to-Instrument System (Target Latency < 50ms)

---

## I. Project Overview

### Core Features
User hums/speaks into microphone → System detects pitch and expression in real-time → Drives virtual instrument synthesis

### Technical Highlights
- **Zero Installation**: Runs purely in the browser, no backend server required.
- **Low Latency**: Uses AudioWorklet (128 sample buffer).
- **Expressive Mapping**: Extraction of volume, timbre, breathiness, and other features.
- **Dual Engine Mode**:
  - Continuous Mode (Default): Continuous frequency sliding, suitable for vocals/strings.
  - Legacy Mode: Discrete note steps, suitable for piano/guitar.

### Current Performance Metrics
| Metric | Target | Current | Status |
|------|------|------|------|
| End-to-End Latency | < 50ms | 180ms | ❌ 3.6x Over |
| Test Coverage | 40% | 10% | ⚠️ In Progress |
| Global Variables | 0 | 2 | ✅ Acceptable |
| Console Logs | < 50 | 286 | ❌ Too Many |

---

## II. Tech Stack

### Frontend
- **HTML/CSS**: Tailwind CSS (via CDN)
- **JavaScript**: ES6 Modules (no bundler)
- **Audio Processing**: Web Audio API + AudioWorklet
- **Audio Synthesis**: Tone.js v15.1.22
- **Test Framework**: Vitest
- **Dev Server**: npx serve

### Core Algorithms
- **Pitch Detection**: YIN algorithm (Time-domain autocorrelation)
- **Feature Extraction**: FFT (Frequency-domain analysis) + EMA smoothing
- **Attack Detection**: Energy change rate + Silence detection

---

## III. Project Structure

```
mambo-pine/
├── index.html                  # Main Page (Apple-style UI)
├── css/
│   └── styles.css             # Custom Styles
├── js/
│   ├── main.js                # Main App Entry (AppContainer + MamboApp)
│   ├── audio-io.js            # Audio I/O Abstraction (Worklet + ScriptProcessor)
│   ├── pitch-detector.js      # YIN Algorithm Wrapper
│   ├── pitch-worklet.js       # AudioWorklet Processor (Multi-threaded)
│   ├── continuous-synth.js    # Continuous Mode Synthesizer
│   ├── synthesizer.js         # Legacy Mode Synthesizer
│   ├── performance.js         # Performance Monitoring
│   ├── expressive-features.js # Expressive Feature Extraction Pipeline
│   ├── core/
│   │   └── app-container.js   # Dependency Injection Container
│   ├── managers/
│   │   └── ui-manager.js      # UI State Management (Event-driven)
│   ├── config/
│   │   ├── app-config.js      # Centralized Configuration
│   │   └── instrument-presets.js # Instrument Definitions
│   ├── features/
│   │   ├── onset-detector.js  # Attack Detection
│   │   ├── smoothing-filters.js # Kalman + EMA Filters
│   │   └── spectral-features.js # FFT Feature Extraction
│   └── utils/
│       ├── audio-utils.js     # Audio Processing Utilities
│       └── logger.js          # Logger Utility
├── tests/
│   ├── unit/
│   │   ├── app-container.test.js (19 tests)
│   │   └── pitch-detector.test.js (48 tests)
│   └── config-system.test.js  # Configuration Verification Tests
├── docs/
│   ├── guides/
│   │   ├── troubleshooting.md
│   │   └── configuration.md
│   ├── CLEANUP_PLAN.md
│   └── CLEANUP_SUMMARY.md
├── PROJECT_STATUS.md           # Current Status Tracking
└── README.md                   # User Guide
```

---

## IV. Core Architecture Design

### 4.1 Dependency Injection Container (AppContainer)

**Pattern**: IoC (Inversion of Control)
**Location**: [js/core/app-container.js](js/core/app-container.js)

```javascript
// Service Registration (in main.js)
container.register('configManager', () => configManager, { singleton: true });
container.register('pitchDetector', () => new PitchDetector(), { singleton: true });
container.register('app', (c) => new MamboApp({
    config: c.get('config'),
    pitchDetector: c.get('pitchDetector'),
    // ... other dependencies
}), { singleton: true });

// Service Access
window.container.get('pitchDetector')
window.app.getLatencyStats()
```

**Registered Services** (9 total):
1. `configManager` - Configuration Manager
2. `config` - Configuration Object
3. `instrumentPresetManager` - Instrument Presets
4. `ExpressiveFeatures` - Feature Extraction Class
5. `pitchDetector` - Pitch Detector
6. `performanceMonitor` - Performance Monitor
7. `synthesizerEngine` - Legacy Synthesizer
8. `continuousSynthEngine` - Continuous Synthesizer
9. `app` - Main App Instance

### 4.2 Audio Processing Pipeline

#### Flowchart
```
User Microphone
    ↓
AudioContext.getUserMedia()
    ↓
[Branch 1: AudioWorklet Mode - Default]
    MediaStreamSource → AudioWorkletNode (pitch-worklet.js)
        ↓ (Worklet Thread)
        - YIN Pitch Detection (every 128 samples)
        - FFT Spectral Analysis
        - Volume Detection (RMS)
        - Attack Detection (OnsetDetector)
        - EMA Smoothing
        ↓
    postMessage (PitchFrame Object, 11 fields)
        ↓
    main.js: handleWorkletPitchFrame()
        ↓
    ContinuousSynthEngine.processPitchFrame()
        ↓
    Tone.js Synthesizer → Speaker Output

[Branch 2: ScriptProcessor Mode - Fallback]
    MediaStreamSource → ScriptProcessorNode (2048 buffer)
        ↓ (Main Thread)
        PitchDetector.detect() (YIN Algorithm)
        ↓
        ExpressiveFeatures.process() (Feature Extraction)
        ↓
        main.js: onAudioProcess()
        ↓
        (Same as above, flow to synthesizer)
```

#### Data Structure: PitchFrame
```javascript
{
    frequency: 440.0,      // Hz
    note: 'A',             // Note Name
    octave: 4,             // Octave
    confidence: 0.95,      // 0-1
    cents: -5,             // Cents Offset (-50 ~ +50)
    volumeDb: -20,         // dB
    brightness: 0.6,       // 0-1 (High Frequency Energy Ratio)
    breathiness: 0.3,      // 0-1 (Noise Ratio)
    isOnset: false,        // Attack Detection
    timestamp: 1234567890, // ms
    captureTime: 1234567890 // AudioContext.currentTime (for latency measurement)
}
```

### 4.3 Configuration Management System

**Single Source of Truth**: [js/config/app-config.js](js/config/app-config.js)

```javascript
// Load Config
const config = configManager.load(); // Returns complete config object

// Config Structure
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

### 4.4 UI Event Driven System

**Pattern**: Observer Pattern (Pub-Sub)
**Location**: [js/managers/ui-manager.js](js/managers/ui-manager.js)

```javascript
// Subscribe
uiManager.on(UI_EVENTS.PITCH_UPDATE, (data) => {
    console.log('Pitch updated:', data.frequency);
});

// Emit
uiManager.emit(UI_EVENTS.PITCH_UPDATE, {
    frequency: 440,
    note: 'A',
    octave: 4
});

// Available Event Types
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

## V. Key Code Paths

### 5.1 Startup Process

```javascript
// 1. index.html loaded
document.addEventListener('DOMContentLoaded', () => {
    // 2. Get app instance from container
    app = container.get('app'); // Triggers dependency injection chain

    // 3. Initialize app
    app.initialize(); // Bind events, init UI
});

// 4. User clicks "Start Engine" button
main.js: MamboApp.start()
    ↓
    _startWithAudioIO()
    ↓
    audioIO = new AudioIO()
    audioIO.configure({ useWorklet: true, ... })
    audioIO.start() // Request microphone permission
    ↓
    _initializeEngines(audioContext, bufferSize, mode)
    ↓
    continuousSynthEngine.initialize() // Create Tone.js synth
    ↓
    UI Update: startBtn → hidden, stopBtn → visible
```

### 5.2 Real-time Audio Processing Path

```javascript
// AudioWorklet Mode (Default)
pitch-worklet.js: process(inputs, outputs, parameters)
    ↓ (Called every 128 samples)
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
    - Frequency Map: setFrequency(pitchFrame.frequency)
    - Volume Map: setVolume(pitchFrame.volumeDb)
    - Timbre Map: setBrightness(pitchFrame.brightness)
    - Attack Trigger: triggerNote() if pitchFrame.isOnset
    ↓
Tone.js → Speaker Output
```

### 5.3 Instrument Switching Path

```javascript
// 1. User clicks instrument button
index.html: <button class="instrument-btn" data-instrument="violin">
    ↓ (Two event listeners)

// Listener 1 (index.html inline script)
btn.addEventListener('click', function() {
    // Visual effects only (Google color border)
    btns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
});

// Listener 2 (main.js)
btn.addEventListener('click', (e) => {
    const instrument = e.currentTarget.dataset.instrument;

    // Update status badge
    instrumentStatus.textContent = instrumentName;

    // Switch instrument preset
    if (currentEngine && currentEngine.currentSynth) {
        currentEngine.changeInstrument(instrument);
        // ↓
        // continuous-synth.js: changeInstrument('violin')
        //   → Load preset: instrumentPresets['violin']
        //   → Update synth params: oscillator type, filter, envelope
    }
});
```

---

## VI. Performance Bottleneck Analysis

### Current Latency Composition (Estimated)

| Stage | Estimated Latency | Notes |
|------|----------|------|
| Microphone Buffer | 3ms | 128 samples @ 44.1kHz |
| AudioWorklet Processing | 5-10ms | YIN + FFT + Feature Extraction |
| Main Thread Transfer | 1-2ms | postMessage |
| Synth Response | 5-10ms | Tone.js setFrequency() |
| Audio Output Buffer | 10-20ms | Browser Audio Stack |
| **Measured Value** | **180ms** | window.app.getLatencyStats() |

### Possible Bottlenecks

1. **ScriptProcessor Fallback** (46ms Base Latency)
   - Check: `window.container.get('audioIO').mode === 'worklet'`
   - If 'script-processor', then 2048 buffer = 46ms

2. **FFT Calculation** (SpectralFeatures)
   - 2048 point FFT executed every frame
   - Solution: Decrease fftSize or increase fftInterval

3. **Expressive Feature Extraction** (ExpressiveFeatures)
   - Multiple filters chained (Kalman + EMA)
   - Solution: Disable non-critical features

4. **Tone.js Synth Latency**
   - Filter chain (LowPass + HighPass + Noise)
   - Solution: Simplify effect chain

### Debug Commands

```javascript
// Browser Console
window.app.getLatencyStats()
// Returns: { min, max, avg, p50, p95, count }

window.container.get('audioIO').mode
// Returns: 'worklet' or 'script-processor'

window.container.get('performanceMonitor').getMetrics()
// Returns: { processingTime, totalLatency, fps, ... }
```

---

## VII. Frontend UI Architecture

### HTML Structure (index.html)

```html
<nav> Navigation Bar
    - Logo (MAMBO)
    - Nav Links (Instruments, Visualizer, Tips)
    - Mode Switcher (Continuous/Legacy)
</nav>

<main>
    <section> Hero Area
        - Title "Turn your voice into any instrument"
        - Subtitle "Advanced pitch tracking meets AudioWorklet"
    </section>

    <div class="grid"> Core Features
        <div class="lg:col-span-7"> Instrument Selection (6 Buttons)
            - Saxophone (Default, .active class)
            - Violin, Piano, Flute, Guitar, Synth
            - Google Color Border Effect (CSS Animation)
        </div>

        <div class="lg:col-span-5"> Control Center
            - Start Engine / Stop Session Buttons
            - Status Display: System, Latency, Confidence
        </div>
    </div>

    <div id="statusBar"> Compatibility Elements (Hidden)

    <div id="visualizer"> Visualizer Area
        - Current Note Display (Large Font)
        - Frequency Display (Hz)
        - Pitch Curve Canvas
    </div>

    <section id="tipsSection"> Usage Tips
        - Audio Environment Recommendations
        - Mode Explanations
        - Troubleshooting
    </section>

    <section> Early Bird Form
        - Email Subscription (MAMBO Pro Desktop)
    </section>

    <footer> Copyright
</main>
```

### CSS Design System

**Style**: Apple Official Style + Google Material Design Elements

```css
/* Color System */
--apple-text: #1D1D1F
--apple-gray: #86868B
--apple-sub: #6e6e73
--google-gradient: linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853)

/* Glassmorphism */
.glass {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.6);
}

/* Google Color Border (Focus) */
.card-border-gradient {
    position: absolute;
    inset: -3px;
    background: linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853);
    background-size: 300% 300%;
    opacity: 0; /* Hidden by default */
    animation: borderRotate 4s linear infinite;
}

.instrument-btn.active .card-border-gradient {
    opacity: 1; /* Show when active */
}
```

### Key Interaction Logic

```javascript
// DOMContentLoaded Safety Patch
document.addEventListener('DOMContentLoaded', () => {
    // 1. Ensure key elements exist (prevent classList errors)
    ['stopBtn', 'startBtn', 'warningBox', 'warningText'].forEach(id => {
        if (!document.getElementById(id)) {
            const div = document.createElement('div');
            div.id = id;
            div.style.display = 'none';
            document.body.appendChild(div);
        }
    });

    // 2. Instrument Button Visual Switch (Google Border)
    document.querySelectorAll('.instrument-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.instrument-btn').forEach(b =>
                b.classList.remove('active')
            );
            this.classList.add('active');
        });
    });

    // 3. Tips Collapse/Expand
    helpToggle.addEventListener('click', () => {
        helpContent.classList.toggle('hidden');
        helpToggle.textContent = helpContent.classList.contains('hidden')
            ? "Show Details"
            : "Hide Details";
    });
});
```

---

## VIII. Testing Strategy

### Current Test Coverage

```bash
npm test

# Output
✓ tests/unit/app-container.test.js (19 tests)
✓ tests/unit/pitch-detector.test.js (48 tests)

Test Files  2 passed (2)
Tests  67 passed (67)
Coverage  10% (target 15% for v0.1.0)
```

### Test Principles

1. **Real Tests**: Every test must be able to fail.
2. **Vitest CLI Mode**: Use `npm test`, not UI mode.
3. **No Mock Preference**: Test actual implementation unless necessary.
4. **Coverage Targets**:
   - v0.1.0: 15%
   - v1.0: 40%

### Test File Structure

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

## IX. Development Workflow

### Common Commands

```bash
# Start Dev Server
npm start
# → http://localhost:3000

# Run Tests
npm test

# Run Tests (Watch Mode)
npm run test:watch

# Generate Coverage Report
npm run test:coverage
```

### Debugging Tips

```javascript
// 1. Latency Stats
window.app.getLatencyStats()

// 2. Check Audio Mode
window.container.get('audioIO').mode

// 3. View Registered Services
window.container.getServiceNames()

// 4. Get Config
window.container.get('config')

// 5. Performance Metrics
window.container.get('performanceMonitor').getMetrics()
```

### Git Branch Strategy

- `main`: Stable version
- `feature/ui-optimization`: Current work branch
- `refactor/modularization`: Architecture refactoring branch

---

## X. Known Issues & Improvement Directions

### P0: Latency Optimization (Critical)
- **Current**: 180ms
- **Goal**: < 50ms (v1.0), < 90ms (v0.1.0)
- **Actions**:
  1. Verify AudioWorklet mode activation.
  2. Profile FFT and feature extraction overhead.
  3. Optimize Tone.js synth chain.
  4. Consider WebAssembly for YIN algorithm.

### P1: Test Coverage
- **Current**: 10%
- **Goal**: 15% (v0.1.0), 40% (v1.0)
- **Actions**: Add unit tests for AudioIO, ExpressiveFeatures, ContinuousSynth.

### P2: Log Pollution
- **Current**: 286 console.logs
- **Goal**: < 50 (Production < 10)
- **Actions**: Use Logger module, set log levels.

### P3: Documentation Overload
- **Current**: 192+ files
- **Goal**: < 50 core docs
- **Actions**: Archive historical docs to `/docs/archive/`.

---

## XI. Collaboration with Gemini

### Sharing Sequence

1. **Step 1**: Share this document (ARCHITECTURE_OVERVIEW.md)
   - Let Gemini understand the global architecture.

2. **Step 2**: Share core code
   - [js/main.js](js/main.js) (Main app logic)
   - [js/audio-io.js](js/audio-io.js) (Audio abstraction layer)
   - [js/pitch-worklet.js](js/pitch-worklet.js) (Worklet processor)

3. **Step 3**: Share config and tools
   - [js/config/app-config.js](js/config/app-config.js)
   - [js/core/app-container.js](js/core/app-container.js)

4. **Step 4**: Share frontend code
   - [index.html](index.html) (Full UI)
   - [css/styles.css](css/styles.css)

5. **Step 5**: Share tests and docs
   - [tests/unit/](tests/unit/)
   - [PROJECT_STATUS.md](PROJECT_STATUS.md)

### Key Review Areas

Ask Gemini to focus on:

1. **Performance Bottlenecks**: Help locate the source of 180ms latency.
2. **Architecture Soundness**: Evaluate DI, Event-driven patterns.
3. **Code Quality**: Point out potential bugs, readability issues.
4. **Test Strategy**: Suggest modules to test first.
5. **UI/UX**: Frontend interaction logic clarity.
6. **Maintainability**: Code extensibility and refactoring.

### Example Prompts

> "Please review [js/pitch-worklet.js](js/pitch-worklet.js), help me find latency bottlenecks. Current YIN + FFT runs in Worklet, is there room for optimization?"

> "Please evaluate [index.html](index.html) UI interaction logic. Two event listeners for instrument buttons, is this reasonable?"

> "Please check [js/config/app-config.js](js/config/app-config.js) config passing logic. Config needs serialization for Worklet, any issues in current implementation?"

---

## XII. Resources

### External Docs
- [Web Audio API Spec](https://www.w3.org/TR/webaudio/)
- [AudioWorklet Best Practices](https://developer.chrome.com/blog/audio-worklet/)
- [Tone.js Documentation](https://tonejs.github.io/)
- [YIN Algorithm Paper](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)

### Internal Docs
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current Status
- [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) - Troubleshooting
- [docs/guides/configuration.md](docs/guides/configuration.md) - Configuration Reference

---

**Last Update**: 2025-11-21
**Maintainer**: Ziming Wang & Team Kazoo
**Contact**: GitHub Issues