/**
 * USB Audio Receiver - Web 前端实现
 * 
 * 从 ESP32 设备通过 USB CDC 串口接收音频数据
 * 实现与 scripts/usb_audio/receiver.py 相同的帧格式解析逻辑
 * 
 * 帧格式:
 * - Magic: 0xAA55 (2 bytes, little-endian)
 * - Sequence Number: uint16 (2 bytes, little-endian)
 * - Length: uint16 (2 bytes, little-endian) - 音频数据长度
 * - Audio Data: int16[] (length bytes)
 * - Checksum: uint16 (2 bytes, little-endian) - 所有前面数据的校验和
 */

// 帧格式常量
const FRAME_MAGIC = 0xAA55;
const FRAME_HEADER_SIZE = 6;  // magic(2) + seq_num(2) + length(2)
const CHECKSUM_SIZE = 2;

class UsbAudioReceiver {
    /**
     * USB 音频接收器
     * 
     * @param {Object} options - 配置选项
     * @param {number} options.sampleRate - 采样率 (Hz)，默认 48000
     * @param {number} options.baudrate - 波特率，默认 9216000
     * @param {Function} options.onFrame - 音频帧回调 (samples: Int16Array) => void
     * @param {Function} options.onError - 错误回调 (error: Error) => void
     * @param {Function} options.onStats - 统计回调 (stats: Object) => void
     */
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 48000;
        this.baudrate = options.baudrate || 9216000;
        this.onFrame = options.onFrame || null;
        this.onError = options.onError || null;
        this.onStats = options.onStats || null;

        // 串口连接
        this.port = null;
        this.reader = null;
        this.isRunning = false;

        // 接收缓冲区
        this.buffer = new Uint8Array(0);

        // 统计信息
        this.stats = {
            framesReceived: 0,
            framesDropped: 0,
            checksumErrors: 0,
            syncErrors: 0,
            bytesReceived: 0,
            lastSeq: null
        };

        // 定期更新统计信息
        this.statsInterval = null;
    }

    /**
     * 检查浏览器是否支持 Web Serial API
     * @returns {boolean}
     */
    static isSupported() {
        return 'serial' in navigator;
    }

    /**
     * 请求串口权限并连接设备
     * @param {Object} options - 串口选项
     * @param {number} options.baudRate - 波特率
     * @returns {Promise<SerialPort>}
     */
    async connect(options = {}) {
        if (!UsbAudioReceiver.isSupported()) {
            throw new Error('浏览器不支持 Web Serial API。请使用 Chrome 89+、Edge 89+ 或 Opera 75+。');
        }

        try {
            console.log('[UsbAudioReceiver] 请求串口权限...');
            
            // 请求串口访问权限
            this.port = await navigator.serial.requestPort();
            
            // 打开串口
            const baudRate = options.baudRate || this.baudrate;
            await this.port.open({ 
                baudRate: baudRate,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: 'none'
            });

            console.log(`[UsbAudioReceiver] 串口已连接 @ ${baudRate} baud`);

            // 清空输入缓冲区
            await this._flushInputBuffer();

            return this.port;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                throw new Error('未选择串口设备。请重新尝试并选择一个设备。');
            } else if (error.name === 'SecurityError') {
                throw new Error('串口访问被拒绝。请允许浏览器访问串口设备。');
            } else {
                throw new Error(`连接串口失败: ${error.message}`);
            }
        }
    }

    /**
     * 连接到指定的串口（如果已授权）
     * @param {SerialPort} port - 已授权的串口对象
     * @param {Object} options - 串口选项
     */
    async connectToPort(port, options = {}) {
        if (!port) {
            throw new Error('无效的串口对象');
        }

        this.port = port;

        if (!this.port.readable) {
            const baudRate = options.baudRate || this.baudrate;
            await this.port.open({ 
                baudRate: baudRate,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: 'none'
            });
        }

        console.log(`[UsbAudioReceiver] 已连接到串口 @ ${options.baudRate || this.baudrate} baud`);
        await this._flushInputBuffer();
    }

    /**
     * 开始接收音频数据
     */
    async start() {
        if (this.isRunning) {
            console.warn('[UsbAudioReceiver] 已在运行中');
            return;
        }

        if (!this.port || !this.port.readable) {
            throw new Error('串口未连接。请先调用 connect() 或 connectToPort()。');
        }

        this.isRunning = true;
        this.buffer = new Uint8Array(0);
        this.stats = {
            framesReceived: 0,
            framesDropped: 0,
            checksumErrors: 0,
            syncErrors: 0,
            bytesReceived: 0,
            lastSeq: null
        };

        console.log('[UsbAudioReceiver] 开始接收音频数据...');

        // 启动读取循环
        this._readLoop();

        // 启动统计信息更新
        this.statsInterval = setInterval(() => {
            if (this.onStats) {
                this.onStats(this.getStats());
            }
        }, 1000);
    }

    /**
     * 停止接收音频数据
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[UsbAudioReceiver] 停止接收...');
        this.isRunning = false;

        // 停止统计更新
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        // 取消读取器
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (error) {
                // 忽略取消错误
            }
            this.reader = null;
        }
    }

    /**
     * 关闭串口连接
     */
    async close() {
        await this.stop();

        if (this.port) {
            try {
                await this.port.close();
                console.log('[UsbAudioReceiver] 串口已关闭');
            } catch (error) {
                console.error('[UsbAudioReceiver] 关闭串口时出错:', error);
            }
            this.port = null;
        }
    }

    /**
     * 获取统计信息
     * @returns {Object}
     */
    getStats() {
        const stats = { ...this.stats };
        
        if (stats.framesReceived > 0) {
            const totalFrames = stats.framesReceived + stats.framesDropped;
            stats.successRate = (stats.framesReceived / totalFrames) * 100;
        } else {
            stats.successRate = 0;
        }

        return stats;
    }

    /**
     * 清空输入缓冲区
     * @private
     */
    async _flushInputBuffer() {
        if (!this.port || !this.port.readable) {
            return;
        }

        try {
            const reader = this.port.readable.getReader();
            const startTime = performance.now();
            
            // 读取并丢弃所有可用数据（最多 200ms）
            while (performance.now() - startTime < 200) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!value || value.length === 0) break;
            }
            
            reader.releaseLock();
        } catch (error) {
            // 忽略清空错误
        }
    }

    /**
     * 读取循环（持续读取串口数据）
     * @private
     */
    async _readLoop() {
        if (!this.port || !this.port.readable) {
            return;
        }

        try {
            this.reader = this.port.readable.getReader();

            while (this.isRunning) {
                const { value, done } = await this.reader.read();

                if (done) {
                    console.log('[UsbAudioReceiver] 读取流已结束');
                    break;
                }

                if (value && value.length > 0) {
                    // 将新数据追加到缓冲区
                    const newBuffer = new Uint8Array(this.buffer.length + value.length);
                    newBuffer.set(this.buffer);
                    newBuffer.set(value, this.buffer.length);
                    this.buffer = newBuffer;

                    this.stats.bytesReceived += value.length;

                    // 尝试解析帧
                    this._processFrames();
                }
            }
        } catch (error) {
            if (this.isRunning) {
                console.error('[UsbAudioReceiver] 读取错误:', error);
                if (this.onError) {
                    this.onError(error);
                }
            }
        } finally {
            if (this.reader) {
                this.reader.releaseLock();
                this.reader = null;
            }
        }
    }

    /**
     * 处理缓冲区中的帧
     * @private
     */
    _processFrames() {
        while (this.buffer.length >= FRAME_HEADER_SIZE) {
            // 查找同步标记
            const syncPos = this._findSync();
            if (syncPos === -1) {
                // 没有找到同步标记，丢弃第一个字节
                if (this.buffer.length > 0) {
                    this.buffer = this.buffer.slice(1);
                    this.stats.syncErrors++;
                } else {
                    break;
                }
                continue;
            }

            // 移除同步标记之前的数据
            if (syncPos > 0) {
                this.buffer = this.buffer.slice(syncPos);
            }

            // 检查是否有完整的帧头
            if (this.buffer.length < FRAME_HEADER_SIZE) {
                break;
            }

            // 解析帧头
            const magic = this._readUint16LE(0);
            const seqNum = this._readUint16LE(2);
            const length = this._readUint16LE(4);

            // 检查帧大小
            const frameSize = FRAME_HEADER_SIZE + length + CHECKSUM_SIZE;
            if (this.buffer.length < frameSize) {
                // 数据不完整，等待更多数据
                break;
            }

            // 提取完整帧
            const frameData = this.buffer.slice(0, frameSize);
            this.buffer = this.buffer.slice(frameSize);

            // 验证校验和
            const receivedChecksum = this._readUint16LE(frameSize - CHECKSUM_SIZE, frameData);
            const calculatedChecksum = this._calculateChecksum(frameData.slice(0, -CHECKSUM_SIZE));

            if (receivedChecksum !== calculatedChecksum) {
                this.stats.checksumErrors++;
                continue;
            }

            // 检查序列号连续性
            if (this.stats.lastSeq !== null) {
                const expectedSeq = (this.stats.lastSeq + 1) & 0xFFFF;
                if (seqNum !== expectedSeq) {
                    const dropped = (seqNum - expectedSeq) & 0xFFFF;
                    this.stats.framesDropped += dropped;
                }
            }

            this.stats.lastSeq = seqNum;
            this.stats.framesReceived++;

            // 提取音频数据
            const audioData = frameData.slice(FRAME_HEADER_SIZE, -CHECKSUM_SIZE);
            const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);

            // 调用回调
            if (this.onFrame) {
                try {
                    this.onFrame(samples);
                } catch (error) {
                    console.error('[UsbAudioReceiver] 帧回调错误:', error);
                }
            }
        }
    }

    /**
     * 查找同步标记位置
     * @private
     * @returns {number} 同步标记位置，如果未找到返回 -1
     */
    _findSync() {
        for (let i = 0; i <= this.buffer.length - 2; i++) {
            const magic = this._readUint16LE(i);
            if (magic === FRAME_MAGIC) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 从缓冲区读取 16 位无符号整数（小端序）
     * @private
     * @param {number} offset - 偏移量
     * @param {Uint8Array} [buffer] - 缓冲区（默认使用 this.buffer）
     * @returns {number}
     */
    _readUint16LE(offset, buffer = this.buffer) {
        return buffer[offset] | (buffer[offset + 1] << 8);
    }

    /**
     * 计算校验和
     * @private
     * @param {Uint8Array} data - 数据
     * @returns {number} 16 位校验和
     */
    _calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum = (sum + data[i]) & 0xFFFF;
        }
        return sum;
    }
}

// 导出到全局作用域（用于非模块环境）
if (typeof window !== 'undefined') {
    window.UsbAudioReceiver = UsbAudioReceiver;
}

// 导出类（用于模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UsbAudioReceiver };
}

