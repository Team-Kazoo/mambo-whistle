/**
 * Karplus-Strong String Synthesis Model
 * 
 * 物理建模合成器，模拟拨弦乐器（吉他、古筝、竖琴等）的声音。
 * 原理：通过短脉冲激励一个反馈延迟回路，回路中的低通滤波器模拟琴弦震动时的能量衰减。
 * 
 * @class KarplusStrongSynth
 */
export class KarplusStrongSynth {
    constructor(options = {}) {
        this.ctx = Tone.context;
        
        // 1. 输出节点
        this.output = new Tone.Gain(1);
        this.volume = this.output; // 兼容 Tone.js 接口
        
        // 2. 激励源 (Excitation) - 模拟拨片/手指的声音
        // 使用 Noise 经过包络整形
        this.noise = new Tone.Noise('white');
        this.noiseGain = new Tone.Gain(0);
        
        // 3. 物理模型回路 (The Loop)
        // Delay (弦长/音高) -> Lowpass (阻尼) -> Feedback Gain (衰减)
        this.delayLine = this.ctx.createDelay(1.0); // Max 1s delay
        this.filter = this.ctx.createBiquadFilter();
        this.feedbackGain = this.ctx.createGain();
        
        // 配置滤波器 (模拟琴弦材质)
        this.filter.type = 'lowpass';
        this.filter.Q.value = 0; // 无共振，纯阻尼
        
        // 配置反馈 (决定 Sustain 时间)
        this.feedbackGain.gain.value = options.dampening || 0.96; 

        // 连接激励源到回路
        this.noise.connect(this.noiseGain);
        this.noiseGain.connect(this.delayLine); // 注入能量
        this.noiseGain.connect(this.output);    // 直通一点瞬态声音增加冲击感
        
        // 连接回路: Delay -> Filter -> Feedback -> Delay
        // 注意：原生节点连接需要用 connect
        this.delayLine.connect(this.filter);
        this.filter.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayLine);
        
        // 输出回路声音
        this.delayLine.connect(this.output);
        
        // 初始状态
        this.noise.start();
        this.currentFreq = 440;
        this.setFrequency(440);
    }

    /**
     * 触发拨弦 (Attack)
     * @param {number} frequency - 频率
     * @param {number} time - 触发时间
     * @param {number} velocity - 力度
     */
    triggerAttack(frequency, time, velocity = 1) {
        if (frequency) {
            this.setFrequency(frequency);
        }
        
        // 模拟拨片接触琴弦的瞬间脉冲 (Noise Burst)
        // 脉冲越短，声音越亮/越脆
        const burstDuration = 0.01; 
        
        this.noiseGain.gain.cancelScheduledValues(time);
        this.noiseGain.gain.setValueAtTime(0, time);
        this.noiseGain.gain.linearRampToValueAtTime(velocity, time + 0.001);
        this.noiseGain.gain.exponentialRampToValueAtTime(0.001, time + burstDuration);
    }

    /**
     * 释放琴弦 (Release/Mute)
     * 模拟手按住琴弦止音
     */
    triggerRelease(time) {
        // 快速衰减反馈增益，使声音停止
        this.feedbackGain.gain.cancelScheduledValues(time);
        this.feedbackGain.gain.linearRampToValueAtTime(0, time + 0.1);
    }

    /**
     * 设置频率 (改变弦长)
     * DelayTime = 1 / Frequency
     */
    setFrequency(frequency, rampTime = 0) {
        if (!frequency || frequency <= 0) return;
        this.currentFreq = frequency;
        
        // 限制频率范围防止 DelayTime 报错
        const safeFreq = Math.max(20, Math.min(frequency, 10000));
        const delayTime = 1 / safeFreq;

        if (rampTime > 0) {
            this.delayLine.delayTime.linearRampToValueAtTime(delayTime, this.ctx.currentTime + rampTime);
        } else {
            this.delayLine.delayTime.value = delayTime;
        }
        
        // 动态调整 Filter，高音衰减快，低音衰减慢
        // 这增加了物理真实感
        const cutoff = safeFreq * 2 + 1000;
        this.filter.frequency.value = cutoff;
    }

    /**
     * 兼容 Tone.js 接口: frequency 属性代理
     */
    get frequency() {
        return {
            value: this.currentFreq,
            rampTo: (val, time) => this.setFrequency(val, time)
        };
    }

    connect(destination) {
        this.output.connect(destination);
        return this;
    }

    dispose() {
        this.noise.dispose();
        this.noiseGain.dispose();
        this.output.dispose();
        // 原生节点 disconnect
        this.delayLine.disconnect();
        this.filter.disconnect();
        this.feedbackGain.disconnect();
    }
}
