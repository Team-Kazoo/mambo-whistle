# 快速开始 - 5分钟上手

## 1. 安装依赖

```bash
cd scripts/usb_audio
pip install -r requirements.txt
```

## 2. 查找串口设备

### macOS
```bash
ls /dev/tty.usb* /dev/cu.usb*
# 通常是 /dev/tty.usbmodem1101
```

### Linux
```bash
ls /dev/ttyACM* /dev/ttyUSB*
# 通常是 /dev/ttyACM0
```

## 3. 录制测试（推荐）

```bash
# 录制5秒音频
python record.py --port /dev/tty.usbmodem1101 --duration 5 --output test.wav

# 播放测试
afplay test.wav  # macOS
aplay test.wav   # Linux
```

## 4. 实时播放（可选）

需要先安装pyaudio：

```bash
# macOS
brew install portaudio
pip install pyaudio

# Linux
sudo apt-get install portaudio19-dev
pip install pyaudio

# 然后播放
python play.py --port /dev/tty.usbmodem1101
```

## 常见问题

### Q: 找不到串口
A: 关闭 `idf.py monitor`，确认ESP32已连接

### Q: 收不到数据
A: 按ESP32板子上的BOOT按钮启动音频流

### Q: 有丢帧
A: 换更短的USB线，避免USB Hub

---

**完成！** 现在你可以接收ESP32的音频了 🎉

