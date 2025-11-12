/**
 * 乐器预设配置
 *
 * P0 修复: 从代码中分离乐器参数
 *
 * 设计目标:
 * - 音色调优不需要修改代码
 * - 便于 A/B 测试不同参数
 * - 支持运行时切换预设
 * - 为 多音色扩展打基础
 *
 * @module InstrumentPresets
 */

/**
 * @typedef {Object} InstrumentPreset
 * @property {Object} oscillator - 振荡器配置
 * @property {string} oscillator.type - 波形类型: 'sawtooth' | 'sine' | 'square' | 'triangle'
 * @property {Object} envelope - ADSR 包络
 * @property {number} envelope.attack - Attack 时间 (秒)
 * @property {number} envelope.decay - Decay 时间 (秒)
 * @property {number} envelope.sustain - Sustain 电平 (0-1)
 * @property {number} envelope.release - Release 时间 (秒)
 * @property {Object} filterEnvelope - 滤波器包络
 * @property {number} filterEnvelope.baseFrequency - 基础截止频率 (Hz)
 * @property {number} filterEnvelope.octaves - 包络调制范围 (八度)
 * @property {number} filterEnvelope.attack - Attack 时间 (秒)
 * @property {number} filterEnvelope.decay - Decay 时间 (秒)
 * @property {number} filterEnvelope.sustain - Sustain 电平 (0-1)
 * @property {number} filterEnvelope.release - Release 时间 (秒)
 * @property {number} portamento - 滑音时间 (秒), 影响表现力
 */

/**
 * 默认乐器预设库
 * @type {Object.<string, InstrumentPreset>}
 */
export const DEFAULT_INSTRUMENT_PRESETS = {
    saxophone: {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.8,
            release: 0.3
        },
        filterEnvelope: {
            baseFrequency: 2000,
            octaves: 2,
            attack: 0.02,
            decay: 0.1,
            sustain: 0.5,
            release: 0.3
        },
        portamento: 0.03  // 30ms 滑音时间（中等表现力）
    },

    violin: {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.1,
            decay: 0.1,
            sustain: 0.9,
            release: 0.4
        },
        filterEnvelope: {
            baseFrequency: 1500,
            octaves: 3,
            attack: 0.08,
            decay: 0.2,
            sustain: 0.7,
            release: 0.4
        },
        portamento: 0.05  // 50ms 更明显的滑音（弦乐特征）
    },

    piano: {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.1,
            release: 1.0
        },
        filterEnvelope: {
            baseFrequency: 3000,
            octaves: 1,
            attack: 0.005,
            decay: 0.2,
            sustain: 0.2,
            release: 0.8
        },
        portamento: 0.01  // 10ms 快速（钢琴音色更清晰）
    },

    flute: {
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.8,
            release: 0.2
        },
        filterEnvelope: {
            baseFrequency: 2500,
            octaves: 2.5,
            attack: 0.03,
            decay: 0.15,
            sustain: 0.6,
            release: 0.2
        },
        portamento: 0.025  // 25ms 轻快的滑音
    },

    guitar: {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.005,
            decay: 0.4,
            sustain: 0.1,
            release: 0.6
        },
        filterEnvelope: {
            baseFrequency: 2200,
            octaves: 1.5,
            attack: 0.005,
            decay: 0.3,
            sustain: 0.2,
            release: 0.5
        },
        portamento: 0.015  // 15ms 适度滑音
    },

    synth: {
        oscillator: { type: 'square' },
        envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.7,
            release: 0.2
        },
        filterEnvelope: {
            baseFrequency: 3500,
            octaves: 2,
            attack: 0.01,
            decay: 0.05,
            sustain: 0.8,
            release: 0.15
        },
        portamento: 0.02  // 20ms 电子感觉
    }
};

/**
 * 验证乐器预设配置
 *
 * @param {InstrumentPreset} preset - 待验证的预设
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInstrumentPreset(preset) {
    const errors = [];

    // 验证振荡器
    if (!preset.oscillator) {
        errors.push('缺少 oscillator 配置');
    } else if (!['sawtooth', 'sine', 'square', 'triangle'].includes(preset.oscillator.type)) {
        errors.push(`无效的波形类型: ${preset.oscillator.type}`);
    }

    // 验证 ADSR 包络
    if (!preset.envelope) {
        errors.push('缺少 envelope 配置');
    } else {
        const { attack, decay, sustain, release } = preset.envelope;
        if (attack < 0 || attack > 2) errors.push(`无效的 attack: ${attack} (范围: 0-2 秒)`);
        if (decay < 0 || decay > 2) errors.push(`无效的 decay: ${decay} (范围: 0-2 秒)`);
        if (sustain < 0 || sustain > 1) errors.push(`无效的 sustain: ${sustain} (范围: 0-1)`);
        if (release < 0 || release > 5) errors.push(`无效的 release: ${release} (范围: 0-5 秒)`);
    }

    // 验证滤波器包络
    if (!preset.filterEnvelope) {
        errors.push('缺少 filterEnvelope 配置');
    } else {
        const { baseFrequency, octaves } = preset.filterEnvelope;
        if (baseFrequency < 50 || baseFrequency > 10000) {
            errors.push(`无效的 baseFrequency: ${baseFrequency} (范围: 50-10000 Hz)`);
        }
        if (octaves < 0 || octaves > 5) {
            errors.push(`无效的 octaves: ${octaves} (范围: 0-5)`);
        }
    }

    // 验证 portamento
    if (preset.portamento !== undefined) {
        if (preset.portamento < 0 || preset.portamento > 1) {
            errors.push(`无效的 portamento: ${preset.portamento} (范围: 0-1 秒)`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 乐器预设管理器
 */
export class InstrumentPresetManager {
    constructor() {
        this.presets = { ...DEFAULT_INSTRUMENT_PRESETS };
        this.customPresets = {};
    }

    /**
     * 获取乐器预设
     * @param {string} name - 乐器名称
     * @returns {InstrumentPreset | null}
     */
    get(name) {
        // 优先返回自定义预设
        if (this.customPresets[name]) {
            return this.customPresets[name];
        }
        return this.presets[name] || null;
    }

    /**
     * 添加自定义预设
     * @param {string} name - 预设名称
     * @param {InstrumentPreset} preset - 预设配置
     */
    add(name, preset) {
        const validation = validateInstrumentPreset(preset);
        if (!validation.valid) {
            throw new Error(`无效的预设配置: ${validation.errors.join(', ')}`);
        }

        this.customPresets[name] = preset;
        console.log(`[InstrumentPresets] 添加自定义预设: ${name}`);
    }

    /**
     * 获取所有可用的乐器名称
     * @returns {string[]}
     */
    list() {
        return [
            ...Object.keys(this.presets),
            ...Object.keys(this.customPresets)
        ];
    }
}

// 单例模式
export const instrumentPresetManager = new InstrumentPresetManager();

// 默认导出
export default instrumentPresetManager;
