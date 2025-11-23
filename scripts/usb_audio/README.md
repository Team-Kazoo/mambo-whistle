# USB Audio Stream - Python Tools

Python工具集，用于接收和处理来自ESP32的USB音频流。

## 安装

```bash
# 进入目录
cd scripts/usb_audio

# 安装依赖
pip install -r requirements.txt
```

## 工具说明

### 1. receiver.py
核心接收器模块，提供`AudioFrameReceiver`类。

### 2. record.py
录制音频到WAV文件。

**用法：**
```bash
# 录制10秒音频
python record.py --port /dev/ttyACM0 --duration 10 --output audio.wav

# macOS
python record.py --port /dev/tty.usbmodem1101 --duration 10 --output audio.wav
```

**参数：**
- `--port, -p`: 串口设备路径（必需）
- `--duration, -d`: 录制时长（秒，必需）
- `--output, -o`: 输出WAV文件名（必需）
- `--rate, -r`: 采样率（可选，默认24000）

### 3. play.py
实时音频播放。

**用法：**
```bash
# 实时播放
python play.py --port /dev/ttyACM0

# macOS
python play.py --port /dev/tty.usbmodem1101
```

**注意：** 需要安装pyaudio和portaudio：
```bash
# macOS
brew install portaudio
pip install pyaudio

# Linux
sudo apt-get install portaudio19-dev
pip install pyaudio
```

## 查找串口设备

### macOS
```bash
ls /dev/tty.usb* /dev/cu.usb*
```

### Linux
```bash
ls /dev/ttyACM* /dev/ttyUSB*
```

### Windows
打开设备管理器，查看"端口 (COM & LPT)"

## 自定义处理

使用`receiver.py`模块创建自己的处理脚本：

```python
from receiver import AudioFrameReceiver
import numpy as np

receiver = AudioFrameReceiver('/dev/ttyACM0', sample_rate=24000)
receiver.open()

try:
    while True:
        frame = receiver.receive_frame()
        if frame is not None:
            # 你的处理代码
            volume = np.abs(frame).mean()
            print(f"Volume: {volume:.0f}")
finally:
    receiver.close()
```

## 性能参数

- **延迟**: 约10-15ms（低延迟模式）
- **采样率**: 24kHz（默认）
- **位深度**: 16-bit PCM
- **通道数**: 单声道
- **帧大小**: 60样本（2.5ms @ 24kHz）

## 故障排查

### 找不到串口
- 确认ESP32已连接
- 关闭`idf.py monitor`
- 检查串口设备路径

### 收不到数据
- 确认ESP32已启动音频流
- 按BOOT按钮启动
- 检查USB线连接

### 大量丢帧
- 使用更好的USB线
- 避免使用USB Hub
- 降低帧率（修改ESP32端代码）

## 目录结构

```
scripts/usb_audio/
├── README.md           # 本文件
├── requirements.txt    # Python依赖
├── __init__.py        # Python模块初始化
├── receiver.py        # 核心接收器
├── record.py          # 录制工具
└── play.py            # 播放工具
```

## 许可证

与xiaozhi-esp32项目保持一致。

