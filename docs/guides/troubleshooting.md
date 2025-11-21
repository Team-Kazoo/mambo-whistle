# 🔧 MAMBO - Troubleshooting Guide

## 📋 Quick Diagnostic Steps

### Step 1: System Check (30s)

Visit: http://localhost:3000/debug-check.html

**Expected Result**:
```
✓ AudioWorklet: Supported
✓ Microphone API: Available
✓ Config: Loaded
  clarityThreshold: 0.10
  minVolumeThreshold: 0.0005
  minConfidence: 0.01
  frequency range: 50-1500 Hz
✓ Tone.js: Loaded
```

**If you see ✗**: Browser incompatible, please use Chrome/Firefox/Edge.

---

### Step 2: Synthesizer Test (10s)

In debug-check.html, click **"Test Synthesizer (440Hz)"**

**Expected**: Hear a clear A4 note (440Hz) for 0.5 seconds.

**If no sound**:
- Check system volume.
- Check if browser audio is muted.
- Open console to check for errors.

---

### Step 3: Microphone Test (30s)

In debug-check.html, click **"Test Microphone"**

**Sing or speak loudly**, observe console output:

```
Expected:
Volume: 0.015324 RMS (-36.3 dB)  ← Should be > 0.0005
Threshold check: PASS
```

**If FAIL**:
- Move closer to the microphone (5-15cm).
- Sing louder.
- Check microphone permissions.
- Try an external microphone.

**Volume Reference**:
- Normal Singing: 0.01 - 0.1 RMS (-40 ~ -20 dB)
- Loud Singing: 0.1 - 0.3 RMS (-20 ~ -10 dB)
- Too Quiet: < 0.001 RMS (< -60 dB) ❌

---

### Step 4: Main App Test (60s)

Visit: http://localhost:3000/index.html

1. Click **"Start Playing"**
2. Allow microphone permission
3. **Sing loudly** (sustain for 3+ seconds)
4. Open console (F12)

**Expected Output**:
```javascript
[AudioIO] 📤 Config sent to Worklet: { clarityThreshold: 0.10, ... }
[PitchWorklet] 📥 Received main thread config
[PitchWorklet] 🔧 clarityThreshold: 0.85 → 0.10
[Main] 🎯 handleWorkletPitchFrame called (first time)
✅ Pitch detected: 113.7 Hz (A#2), Confidence: 0.58
[ContinuousSynth] ▶ Started at 113.7 Hz
[ContinuousSynth] 🌟 Brightness: 0.07 → Filter: 3500 Hz
```

**Key Metrics**:
- frequency: Within 50-1500 Hz
- confidence: > 0.01
- Filter: >= 3500 Hz (Ensures sound isn't muffled)

---

## 🐛 Common Issues & Solutions

### Issue 1: "No Pitch Detected"

**Symptoms**: Console shows only `⚠️ Frequency out of range` or `❌ Volume too low`

**Possible Causes**:
1. Volume too low (RMS < 0.0005)
2. Pitch too high or low (Outside 50-1500Hz)
3. Excessive background noise

**Solutions**:

A) **Temporarily Disable Filters** (Run in console):
```javascript
// Relax thresholds
app.config.pitchDetector.minVolumeThreshold = 0.00001;
app.config.pitchDetector.clarityThreshold = 0.01;
app.config.pitchDetector.minConfidence = 0.001;

// Restart
app.stop();
await app.start();

// Sing again to test
```

B) **Manually Trigger Pitch** (Skip detection):
```javascript
// Set to 440Hz (A4)
continuousSynthEngine.setFrequency(440);
// Should hear sound
```

C) **Check Config**:
```javascript
configManager.get().pitchDetector
// Should return:
// { clarityThreshold: 0.10, minVolumeThreshold: 0.0005, minFrequency: 50, maxFrequency: 1500 }
```

---

### Issue 2: "Synthesizer Started But No Sound"

**Symptoms**: Console shows `▶ Started at 113.7 Hz` but silence.

**Possible Causes**: Filter frequency too low (< 2000Hz) muffling the sound.

**Verification**:
```javascript
// Check filter frequency
continuousSynthEngine.filter.frequency.value
// Should be >= 3500 Hz

// Check synth status
continuousSynthEngine.isPlaying
// Should be true

// Check volume
continuousSynthEngine.currentSynth.volume.value
// Should be > -20 dB
```

**Temporary Fix**:
```javascript
// Force filter up
continuousSynthEngine.filter.frequency.value = 5000;

// Force volume up
continuousSynthEngine.currentSynth.volume.value = 0;  // 0 dB (Max)
```

---

### Issue 3: "Cannot Restart After Stopping"

**Symptoms**: Works first time, but silence after stop/start.

**Fixed in**: Commit 26313eb

**Verify Fix**:
```javascript
// Check reset logic
continuousSynthEngine.stop.toString().includes('lastArticulationState')
// Should return true (Fix present)
```

**If Issue Persists**:
```javascript
// Manually reset state
continuousSynthEngine.lastArticulationState = 'silence';
continuousSynthEngine.isPlaying = false;

// Sing again to restore
```

---

### Issue 4: "Config Not Sent to Worklet"

**Symptoms**: Console shows `⚠️ No appConfig provided, using fallback defaults`

**Cause**: main.js failed to pass config to AudioIO.

**Verification**:
```javascript
// Check if AudioIO has config
app.audioIO.appConfig
// Should return full config object

// Check if Worklet received config
// (Check startup logs)
// Should see: [PitchWorklet] 🔧 clarityThreshold: 0.85 → 0.10
```

**Fix**:
```javascript
// Reconfigure AudioIO
app.audioIO.configure({
    useWorklet: true,
    appConfig: configManager.get()
});

// Restart
app.stop();
await app.start();
```

---

## 🔍 Advanced Debugging

### Real-time Audio Monitoring

Run in console:
```javascript
// Monitor all PitchFrame data
let frameCount = 0;
const originalHandler = app.handleWorkletPitchFrame.bind(app);
app.handleWorkletPitchFrame = function(pitchFrame, timestamp) {
    frameCount++;
    if (frameCount % 10 === 0) {
        console.table({
            frequency: pitchFrame.frequency.toFixed(1) + ' Hz',
            note: pitchFrame.note + pitchFrame.octave,
            confidence: (pitchFrame.confidence * 100).toFixed(1) + '%',
            volumeDb: pitchFrame.volumeDb.toFixed(1) + ' dB',
            brightness: (pitchFrame.brightness * 100).toFixed(1) + '%',
            articulation: pitchFrame.articulation
        });
    }
    originalHandler(pitchFrame, timestamp);
};

console.log('✅ Frame monitor installed. Sing to see data.');
```

### Force ScriptProcessor Mode

If Worklet fails, fallback to ScriptProcessor:

```javascript
app.stop();
app.audioIO.configure({
    useWorklet: false,  // Force ScriptProcessor
    bufferSize: 2048
});
await app.start();

// Latency will increase (46ms), but might be more stable
```

---

## 📊 Performance Benchmarks

**Normal Metrics**:
- Latency: 8-15ms (Worklet) or 46ms (ScriptProcessor)
- CPU: 5-8% (Single Core)
- Detection Rate: 10-20 Hz (Pitch updates per second)
- Volume Range: -40 ~ -10 dB (Normal singing)
- Confidence: 0.3 ~ 0.9 (Clear humming)

**Abnormal Metrics**:
- ❌ Latency > 100ms: Audio system issue
- ❌ CPU > 20%: Potential performance bug
- ❌ Confidence < 0.1: Too much noise or unclear singing
- ❌ Volume < -50 dB: Microphone too far or gain too low

---

## 🚀 Ultimate Test Plan

If all else fails, run full verification:

1. Run Unit Tests:
```bash
npm test
```
Expected: 6/6 Suites Passed

2. Browser Smoke Test:
```bash
open tests/BROWSER_SMOKE_TEST.md
```
Follow the 7 steps in the doc.

3. Collect Diagnostic Info:
```javascript
// Copy all output and send to developer
console.log('=== DIAGNOSTIC INFO ===');
console.log('Browser:', navigator.userAgent);
console.log('AudioWorklet:', typeof AudioWorkletNode !== 'undefined');
console.log('Config:', JSON.stringify(configManager.get().pitchDetector, null, 2));
console.log('AudioIO mode:', app.audioIO?.mode);
console.log('Synth status:', continuousSynthEngine.isPlaying);
console.log('Filter freq:', continuousSynthEngine.filter.frequency.value);
console.log('Tone.js state:', Tone.context.state);
```

---

**Created**: 2025-11-02
**Goal**: Rapidly locate and fix "unusable" issues
**Prerequisite**: Local server started (npm start)