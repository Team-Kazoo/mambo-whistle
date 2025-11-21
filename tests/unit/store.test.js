import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../../js/state/store.js';

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const baseline = clone(store.getState());

describe('StateStore', () => {
  beforeEach(() => {
    // Hard reset singleton state between tests
    store.state = clone(baseline);
  });

  it('merges partial state updates without losing siblings', () => {
    store.setState({ synth: { instrument: 'cello' } });

    const state = store.getState();
    expect(state.synth.instrument).toBe('cello');
    expect(state.synth.continuousMode).toBe(true); // preserved
  });

  it('invokes subscribers on state change with new state', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ status: { engineState: 'running' } });

    expect(listener).toHaveBeenCalledWith(store.state);
    unsubscribe();
  });

  it('setEngineStatus updates status slice', () => {
    store.setEngineStatus('starting');
    expect(store.getState().status.engineState).toBe('starting');
  });

  it('setInstrument updates synth slice', () => {
    store.setInstrument('violin');
    expect(store.getState().synth.instrument).toBe('violin');
  });

  it('setAudioDevice updates input and output separately', () => {
    store.setAudioDevice('input', 'mic-1');
    expect(store.getState().audio.inputDeviceId).toBe('mic-1');

    store.setAudioDevice('output', 'spk-2');
    expect(store.getState().audio.outputDeviceId).toBe('spk-2');
  });
});
