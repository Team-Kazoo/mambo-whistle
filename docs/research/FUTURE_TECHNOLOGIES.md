# 🔮 Future Technologies & Hardware Roadmap

**Status:** Research & Planning
**Last Updated:** 2025-11-21

This document outlines the technical roadmap for evolving MAMBO from a web-based prototype into a professional embedded hardware instrument. Our focus shifts towards state-of-the-art Deep Learning (DL) synthesis and low-latency hardware integration.

---

## 1. Next-Generation Synthesis (Neural Audio)

We are moving beyond traditional subtractive/FM synthesis towards Neural Audio Synthesis, which offers superior realism and "timbre transfer" capabilities (e.g., making a voice sound exactly like a violin, including bow noise and resonance).

### Candidates

| Technology | Developer | Type | Pros | Cons | Target Hardware |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DDSP** (Differentiable DSP) | Google Magenta | Hybrid (DSP + DL) | • Highly interpretable (Pitch/Loudness)<br>• Fast training (<10 min)<br>• Lightweight | • Mostly monophonic<br>• "Cleaner" sound, sometimes lacks grit | Raspberry Pi 4/5, ESP32-S3 (Simplified) |
| **RAVE** (Realtime Audio Variational autoEncoder) | IRCAM | End-to-End DL | • High-quality timbre transfer<br>• Handles polyphony & noise well<br>• 48kHz support | • computationally heavier<br>• "Black box" latent space | NVIDIA Jetson Nano/Orin, RPi 5 |
| **BRAVE** | IRCAM / Comm | Optimized RAVE | • Ultra-low latency (<10ms)<br>• Removing jitter | • Newer, less documentation | NVIDIA Jetson Orin |

### Recommendation: **RAVE / BRAVE**
For the "Pro" hardware version, **RAVE** (specifically the BRAVE variant) is the top contender. Its ability to handle complex textures and noise (breath, bow scrape) makes it superior for "Voice-to-Instrument" applications where nuance is key.

---

## 2. Advanced Perception (Pitch & Expression)

Current YIN/FFT algorithms are robust but can struggle with noise or polyphony. We will explore DL-based extractors.

### State-of-the-Art Models (2020-2025)
*   **CREPE:** The gold standard for accuracy. Robust to noise but computationally heavy.
*   **SPICE (Google):** Self-supervised, lighter than CREPE. Good for mobile/embedded.
*   **SwiftF0 (2025):** Promising new model claiming better noise immunity and speed than CREPE.
*   **FCPE (2025):** Fast Context-based Pitch Estimation. Extremely low Real-Time Factor (RTF), ideal for embedded.

### Integration Strategy
We will implement a **Hybrid Tracking System**:
1.  **Fast Path:** YIN/mcleod (Time-domain) for ultra-low latency (<5ms) initial attack.
2.  **Correction Path:** FCPE/SPICE (Neural) for sustaining accuracy and octave correction.

---

## 3. Hardware Migration Roadmap

The goal is a standalone physical instrument (no computer required).

### Tier A: The "Brain" (High-End)
*   **Platform:** **NVIDIA Jetson Orin Nano**
*   **Why:** TensorRT cores are essential for running RAVE/BRAVE models at <10ms latency.
*   **OS:** Embedded Linux (Yocto or specialized Ubuntu).
*   **Audio:** I2S DAC (e.g., PCM5102) or specialized Hat (HiFiBerry).

### Tier B: The "Core" (Mid-Range)
*   **Platform:** **Raspberry Pi 5** (with active cooling)
*   **Why:** CPU is strong enough for DDSP and lighter RAVE models. Broad community support.
*   **Audio:** Elk Audio OS (for ultra-low latency Linux kernel).

### Tier C: The "Micro" (Low-Cost / Controller)
*   **Platform:** **Daisy Seed (STM32H7)** or **ESP32-S3**
*   **Usage:** 
    *   Cannot run full RAVE.
    *   Can run simplified DDSP or traditional DSP.
    *   Acts as a **MIDI Controller** sending data to a computer/synth.

---

## 4. Software Ecosystem Integration

To bridge the gap between Python research and C++ deployment:

*   **nn~ (pure-data / Max):** Use the `nn~` external to load RAVE models directly into PureData. This allows us to build the audio graph visually and deploy it to Raspberry Pi/Jetson via **Camomile** or **PlugData**.
*   **ONNX Runtime:** Export PyTorch models to ONNX for optimized inference on edge devices.
*   **TorchScript:** For direct C++ integration in a custom JUCE application.

## 5. Immediate Action Items

1.  **Benchmarking:** Train a small RAVE model on a specific instrument (e.g., Cello) and test inference speed on a Raspberry Pi 4/5.
2.  **Prototype:** Build a "Headless" version of the current engine using Node.js/Python to run on a Linux device without a UI.
3.  **Dataset:** Curate a high-quality dataset of solo instrument recordings for training custom models.
