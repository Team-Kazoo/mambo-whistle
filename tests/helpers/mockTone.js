import { vi } from 'vitest';

/**
 * Create a lightweight Tone.js mock that emulates the minimal API surface
 * required by our synth/AI modules. Keeps ramp calls in-memory so tests
 * can assert on the last target values without touching real audio.
 */
export const createToneMock = () => {
  class MockParam {
    constructor() {
      this.value = 0;
      this.ramps = [];
    }
    rampTo(value, time = 0) {
      this.value = value;
      this.ramps.push({ value, time });
    }
    setValueAtTime(value) {
      this.value = value;
    }
    cancelScheduledValues() {
      /* no-op */
    }
    linearRampToValueAtTime(value) {
      this.value = value;
    }
    exponentialRampToValueAtTime(value) {
      this.value = value;
    }
  }

  class MockNode {
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
  }

  class MockFilter extends MockNode {
    constructor() {
      super();
      this.frequency = new MockParam();
      this.Q = new MockParam();
      this.type = 'lowpass';
    }
  }

  class MockGain extends MockNode {
    constructor() {
      super();
      this.gain = new MockParam();
      this.volume = new MockParam();
      this.output = this;
    }
  }

  class MockVibrato extends MockNode {
    constructor() {
      super();
      this.depth = new MockParam();
    }
  }

  class MockDelay extends MockNode {
    constructor() {
      super();
      this.delayTime = new MockParam();
      this.feedback = new MockParam();
      this.wet = new MockParam();
    }
  }

  class MockReverb extends MockNode {
    constructor() {
      super();
      this.decay = 1.5;
      this.wet = new MockParam();
    }
  }

  class MockNoise extends MockNode {
    constructor() {
      super();
      this.state = 'stopped';
    }
    start() {
      this.state = 'started';
    }
  }

  class MockSynth extends MockNode {
    constructor(options = {}) {
      super();
      this.options = options;
      this.frequency = new MockParam();
      this.volume = new MockParam();
      this.modulationIndex = new MockParam();
      this.filterEnvelope = options.filterEnvelope;
      this.triggered = [];
    }
    triggerAttack(frequency, time, velocity) {
      this.triggered.push({ frequency, time, velocity, type: 'attack' });
      this.frequency.value = frequency;
    }
    triggerRelease(time) {
      this.triggered.push({ time, type: 'release' });
    }
    triggerAttackRelease(frequency, duration, at) {
      this.triggered.push({ frequency, duration, at, type: 'attackRelease' });
    }
    dispose() {
      this.disposed = true;
    }
  }

  class MockPolySynth extends MockSynth {
    releaseAll() {
      this.released = true;
    }
  }

  const Tone = {
    Vibrato: MockVibrato,
    Filter: MockFilter,
    FeedbackDelay: MockDelay,
    Reverb: MockReverb,
    Noise: MockNoise,
    Gain: MockGain,
    MonoSynth: MockSynth,
    FMSynth: MockSynth,
    AMSynth: MockSynth,
    PolySynth: MockPolySynth,
    Frequency: (value) => value,
    context: { lookAhead: 0, latencyHint: 'interactive' },
    start: vi.fn().mockResolvedValue(),
    now: vi.fn(() => 0)
  };

  return Tone;
};

/**
 * Install Tone mock on the global namespace and return the mock object.
 */
export const installToneMock = () => {
  const tone = createToneMock();
  global.Tone = tone;
  return tone;
};
