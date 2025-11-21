<div align="center">
  <h1>🎵 Kazoo Proto</h1>
  <p>
    <strong>Real-time Voice-to-Instrument Synthesis Engine</strong>
  </p>
  <p>
    Transform your voice into professional instruments directly in the browser with zero latency.
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <br>

  <img src="images/readme/app-interface.png" alt="Kazoo Proto Interface" width="100%">
</div>

<br>

## 🚀 Introduction

**Kazoo Proto** is a high-performance web application that leverages the Web Audio API to transform vocal input into synthesized instrument sounds in real-time. Unlike traditional pitch-to-MIDI converters, Kazoo Proto uses a custom DSP pipeline running on `AudioWorklet` to ensure sub-20ms latency, preserving the nuanced expression of the human voice including vibrato, slides, and dynamics.

Whether you want to sound like a saxophone, a violin, or a futuristic synthesizer, Kazoo Proto provides an immersive, "liquid" playing experience that feels like a real instrument.

## ✨ Key Features

-   **Zero-Latency Core**: Built on `AudioWorklet` with a custom ring-buffer architecture to decouple audio processing from the main thread, achieving <20ms end-to-end latency.
-   **Dual Engine Architecture**:
    -   **Continuous Mode**: Tracks precise frequency changes for smooth slides and vibrato (Portamento / Glissando).
    -   **Legacy Mode**: Quantizes pitch to the nearest semitone for a classic keyboard/sampler feel.
-   **Pro-Grade DSP**:
    -   **YIN Algorithm**: Optimized implementation for accurate, monophonic pitch detection down to 80Hz.
    -   **FastFFT**: Custom O(N log N) FFT implementation for spectral feature extraction (Brightness, Breathiness).
    -   **Liquid Visualizer**: 60fps hardware-accelerated canvas rendering for real-time pitch feedback.
-   **Smart Auto-Tune**: Integrated pitch correction with adjustable strength and speed, supporting multiple scales (Chromatic, Major, Minor, Pentatonic, Blues).
-   **Expressive Synthesis**: Maps vocal volume and timbre to synth parameters (Cutoff, Resonance, Envelope) for dynamic expression.
-   **Privacy First**: All processing happens locally in the browser. No audio data is ever sent to a server.

## 🏗 Architecture

Kazoo Proto follows a modern, decoupled architecture designed for performance and maintainability.

### Core Components

1.  **AudioIO Layer**: A robust abstraction over the Web Audio API that handles browser compatibility, sample rate conversion, and graceful degradation (Worklet -> ScriptProcessor).
2.  **AudioWorklet (The Engine)**: Runs in a separate thread. Handles DSP tasks:
    -   Pitch Detection (YIN)
    -   Spectral Analysis (FFT)
    -   Onset/Transient Detection
3.  **AudioLoopController**: The central nervous system. It receives `PitchFrame` data from the Worklet and orchestrates the synthesis engine and visualizer, ensuring the UI never blocks audio.
4.  **State Management**: A centralized, Flux-like `StateStore` manages application state (settings, active devices, status), promoting a unidirectional data flow.
5.  **VisualizerManager**: A decoupled rendering engine that draws the "Liquid Ribbon" visualization using `requestAnimationFrame`.

### Data Flow

```mermaid
graph LR
    A[Microphone] --> B(AudioWorklet)
    B -->|PitchFrame| C{AudioLoopController}
    C -->|Control Signals| D[Synth Engine]
    C -->|Visual Data| E[Visualizer]
    D --> F[Speakers]
```

## 🛠 Tech Stack

-   **Frontend**: Vanilla JavaScript (ES Modules) for maximum performance and zero compile-time overhead.
-   **Styling**: Tailwind CSS for utility-first design, enhanced with custom CSS for Apple-style aesthetics (Glassmorphism).
-   **Audio**: Web Audio API, Tone.js (for synthesis graph management).
-   **Testing**: Vitest for unit and integration testing.
-   **Tooling**: Node.js, npm.

## 🏁 Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   npm (v6 or higher)
-   A modern web browser (Chrome/Edge recommended for best AudioWorklet performance)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/zimingwang/Adrian-UI-UX-1.git
    cd Adrian-UI-UX-1
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

4.  **Run tests** (Optional)
    ```bash
    npm test
    ```

## 📖 Usage Guide

1.  **Select an Instrument**: Choose from a variety of presets like Flute, Saxophone, Violin, or Cello.
2.  **Start Engine**: Click the "Start Engine" button. Grant microphone permissions when prompted.
    *   *Tip: Use headphones to prevent feedback loops!*
3.  **Play**: Hum, sing, or whistle into your microphone. The visualizer will react instantly.
4.  **Adjust Settings**:
    *   **Auto-Tune**: Toggle pitch correction and select a scale/key.
    *   **Effects**: Add Reverb or Delay for atmosphere.
    *   **Mode**: Switch between "Continuous" (smooth) and "Legacy" (stepped) modes.

## 🛣 Roadmap

-   [x] **Phase 1: Core DSP & AudioWorklet** - Stable low-latency tracking.
-   [x] **Phase 2: UI/UX Modernization** - Glassmorphism design & Liquid Visualizer.
-   [ ] **Phase 3: MIDI Support** - Export MIDI data to DAWs.
-   [ ] **Phase 4: VST/AU Plugin** - Wrap as a native desktop plugin.
-   [ ] **Phase 5: Polyphony** - Experimental polyphonic voice tracking.

## 🔮 Technical Upgrade & Research

We are actively researching the migration from Web Audio API to embedded hardware and next-generation Neural Audio Synthesis. Our goal is to create a standalone physical instrument.

**Key Research Areas:**
*   **Neural Synthesis:** Moving to **RAVE** (Realtime Audio Variational autoEncoder) and **DDSP** for photorealistic instrument emulation.
*   **Deep Learning Perception:** Exploring **CREPE**, **SPICE**, and 2025-era models (SwiftF0, FCPE) for robust pitch tracking in noisy environments.
*   **Hardware:** Targeting **NVIDIA Jetson** and **Raspberry Pi 5** for embedded deployment.

👉 **[Read the full Research & Hardware Roadmap](docs/research/FUTURE_TECHNOLOGIES.md)**

## 🤝 Contributing

We welcome contributions from the community! Whether it's a bug fix, a new feature, or a documentation improvement, your help is appreciated.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feat/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

**Authors**:
*   **Ziming Wang**
*   **Chuyue Gong**
*   **Tianxing Chang**