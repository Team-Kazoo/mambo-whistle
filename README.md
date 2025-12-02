<div align="center">
  <h1>Mambo Whistle</h1>
  <p>
    <strong>Makes Any Mouth Become Orchestra</strong>
  </p>
  <p>
    Real-time neural vocal synthesis engine bridging Web Audio DSP with future embedded neural hardware.
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#testing">Testing</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <br>

  <img src="images/readme/app-interface.png" alt="Mambo Whistle Interface" width="100%">
</div>

<br>

## Introduction

**Mambo Whistle** is a high-performance web application that transforms vocal input into synthesized instrument sounds in real-time. Using a custom DSP pipeline running on `AudioWorklet`, it achieves **sub-100ms latency** while preserving the nuanced expression of the human voice including vibrato, slides, and dynamics.

Whether you want to sound like a saxophone, violin, or futuristic synthesizer, Mambo Whistle provides an immersive, "liquid" playing experience that feels like a real instrument.

## Features

### Core Audio Engine
- **Low-Latency Core**: Built on `AudioWorklet` with custom ring-buffer architecture (~50-60ms end-to-end latency)
- **Dual Synthesis Modes**:
  - **Continuous Mode**: Tracks precise frequency changes for smooth slides and vibrato
  - **Legacy Mode**: Quantizes pitch to nearest semitone for classic keyboard feel
- **Pro-Grade DSP**:
  - YIN Algorithm for accurate monophonic pitch detection (down to 80Hz)
  - Custom FastFFT (Cooley-Tukey) for spectral feature extraction
  - Kalman/EMA filters for smooth pitch tracking

### AI & Expression
- **AI Jam Mode**: Real-time harmony generation powered by Google Magenta's MusicRNN
- **Smart Auto-Tune**: Pitch correction with multiple scales (Chromatic, Major, Minor, Pentatonic, Blues)
- **Expressive Mapping**: Vocal volume and timbre mapped to synth parameters (Cutoff, Resonance, Envelope)

### Modern UI/UX
- **iOS 26 Liquid Glass Theme**: Apple-inspired glassmorphism design
- **Dark/Light Theme Toggle**: System-aware theme switching
- **Liquid Visualizer**: 60fps hardware-accelerated canvas rendering
- **Responsive Design**: Works on desktop and mobile devices

### Privacy & Performance
- **Privacy First**: All processing happens locally in the browser
- **TypeScript Support**: Full type checking with JSDoc annotations
- **235 Passing Tests**: Comprehensive unit and integration test coverage

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Modern web browser (Chrome/Edge recommended for best AudioWorklet performance)
- Microphone

### Installation

```bash
# Clone the repository
git clone https://github.com/Team-Kazoo/mambo.git
cd mambo

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at `http://localhost:3000`.

### Basic Usage

1. **Select an Instrument**: Choose from presets like Flute, Saxophone, Violin, or Cello
2. **Start Engine**: Click "Start Engine" and grant microphone permissions
   - *Tip: Use headphones to prevent feedback loops!*
3. **Play**: Hum, sing, or whistle into your microphone
4. **Adjust Settings**:
   - Toggle Auto-Tune and select a scale/key
   - Add Reverb or Delay effects
   - Switch between Continuous and Legacy modes

## Testing

Mambo Whistle uses **Vitest** for testing with comprehensive coverage across unit and integration tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with visual UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck

# Watch mode
npm run typecheck:watch

# Run both typecheck and tests
npm run validate
```

### Performance Testing

```bash
# Lighthouse CI
npm run lighthouse

# Desktop preset
npm run lighthouse:desktop

# Mobile preset
npm run lighthouse:mobile
```

### Test Structure

```
tests/
├── unit/                          # Unit tests (12 test files)
│   ├── ai-harmonizer.test.js      # AI harmony generation
│   ├── audio-io.test.js           # Audio I/O abstraction
│   ├── audio-loop-controller.test.js
│   ├── continuous-synth.test.js   # Continuous mode synthesizer
│   ├── device-manager.test.js     # Audio device selection
│   ├── music-scales.test.js       # Musical scale utilities
│   ├── pitch-detector.test.js     # Pitch detection logic
│   ├── store.test.js              # State management
│   ├── synth-manager.test.js      # Synth engine routing
│   └── visualizer-manager.test.js # Visualization rendering
├── integration/
│   └── ui-state-flow.test.js      # End-to-end UI flow
└── helpers/
    └── mockTone.js                # Tone.js mock for testing
```

## Architecture

Mambo Whistle follows a modern, decoupled architecture designed for performance and maintainability.

### Core Components

| Component | Purpose |
|-----------|---------|
| **AudioIO** | Web Audio API abstraction with browser compatibility handling |
| **AudioWorklet** | Separate-thread DSP: pitch detection (YIN), FFT, onset detection |
| **AudioLoopController** | Central orchestrator for synthesis and visualization |
| **StateStore** | Flux-like centralized state management |
| **MamboView** | State-driven UI rendering layer |
| **VisualizerManager** | 60fps "Liquid Ribbon" canvas visualization |

### Data Flow

```
Microphone → AudioWorklet → PitchFrame → AudioLoopController
                                              ↓
                               ┌──────────────┴──────────────┐
                               ↓                              ↓
                        Synth Engine → Speakers        Visualizer → Canvas
```

### File Structure

```
mambo-whistle/
├── js/
│   ├── main.js                 # App entry point
│   ├── audio-io.js             # Audio I/O abstraction
│   ├── pitch-worklet.js        # AudioWorklet processor
│   ├── continuous-synth.js     # Continuous mode synthesizer
│   ├── theme-toggle.js         # Dark/light theme switching
│   ├── config/                 # Configuration
│   │   └── app-config.js       # Centralized config
│   ├── core/                   # Core logic
│   │   ├── audio-loop-controller.js
│   │   └── music-scales.js
│   ├── features/               # Advanced features
│   │   ├── ai-harmonizer.js    # AI harmony (Magenta)
│   │   └── smoothing-filters.js
│   ├── managers/               # Manager classes
│   │   ├── device-manager.js
│   │   ├── synth-manager.js
│   │   └── visualizer-manager.js
│   ├── state/
│   │   └── store.js            # Flux-like state store
│   └── ui/
│       └── mambo-view.js       # State-driven UI
├── css/
│   ├── styles.css              # Main stylesheet
│   └── ios26-theme.css         # iOS 26 Liquid Glass theme
├── tests/                      # Test suites
├── docs/                       # Documentation
└── index.html                  # Entry point
```

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Vanilla JavaScript (ES Modules) |
| **Styling** | Tailwind CSS + Custom CSS (Glassmorphism) |
| **Audio** | Web Audio API, Tone.js |
| **AI** | Google Magenta MusicRNN |
| **Testing** | Vitest, happy-dom |
| **Type Checking** | TypeScript (JSDoc annotations) |
| **CI/CD** | GitHub Actions, Lighthouse CI |
| **Deployment** | Vercel |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server on port 3000 |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Run tests with visual UI |
| `npm run test:coverage` | Generate coverage report |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run validate` | Run both typecheck and tests |
| `npm run lighthouse` | Run Lighthouse performance tests |
| `npm run deploy` | Deploy to Vercel |
| `npm run clean` | Kill process on port 3000 |

## Roadmap

- [x] **Phase 1**: Core DSP & AudioWorklet - Stable low-latency tracking
- [x] **Phase 2**: UI/UX Modernization - Glassmorphism design & Liquid Visualizer
- [x] **Phase 3**: AI Jam Mode - Google Magenta integration
- [x] **Phase 4**: State-driven UI - MamboView architecture
- [ ] **Phase 5**: Neural Audio Research - RAVE/DDSP for photorealistic synthesis
- [ ] **Phase 6**: Embedded Hardware - NVIDIA Jetson & Raspberry Pi prototypes
- [ ] **Phase 7**: Connectivity - MIDI export & VST/AU Plugin wrapper

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/AmazingFeature`)
3. Run tests to ensure everything passes (`npm run validate`)
4. Commit your changes (`git commit -m 'feat: Add AmazingFeature'`)
5. Push to the branch (`git push origin feat/AmazingFeature`)
6. Open a Pull Request

### Development Guidelines

- Follow the existing code style (ES Modules, JSDoc annotations)
- Add tests for new features
- Run `npm run validate` before committing
- Keep PRs focused and atomic

## Join Our Mission

We are a startup team building the future of expressive synthesis. We're looking for:

- **Embedded Systems Engineer**: Lead migration to NVIDIA Jetson / Raspberry Pi
- **Industrial Designer**: Define physical form factor and ergonomics
- **Neural Audio Researcher**: Optimize RAVE/DDSP for real-time edge inference

Contact: **[zwangnv@connect.ust.hk](mailto:zwangnv@connect.ust.hk)**

## License

Proprietary. Copyright (c) 2025 Ziming Wang. All Rights Reserved.

**Authors**: Ziming Wang, Chuyue Gong, Tianxing Chang
