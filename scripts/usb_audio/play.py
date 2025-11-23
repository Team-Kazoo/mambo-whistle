#!/usr/bin/env python3
"""
USB Audio Player - Real-time audio playback

Usage:
    python play.py --port /dev/ttyACM0
"""

import sys
import argparse
import time
from receiver import AudioFrameReceiver

try:
    import pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False
    print("Error: pyaudio not installed")
    print("Install portaudio first:")
    print("  macOS: brew install portaudio")
    print("  Linux: apt-get install portaudio19-dev")
    print("Then: pip install pyaudio")
    sys.exit(1)


class AudioPlayer:
    """Real-time audio player with low latency and buffer management"""
    
    def __init__(self, sample_rate=48000, max_buffer_ms=5.0):
        self.sample_rate = sample_rate
        self.max_buffer_frames = int(sample_rate * max_buffer_ms / 1000.0)
        self.p = pyaudio.PyAudio()
        self.stream = None
        self.frames_dropped = 0
        
    def start(self):
        """Start audio stream with minimal buffering for low latency"""
        # Use smallest possible buffer for lowest latency
        # 60 samples = 1.25ms @ 48kHz - minimal buffering
        self.stream = self.p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            output=True,
            frames_per_buffer=60,   # Ultra low latency (1.25ms @ 48kHz)
            stream_callback=None,   # No callback for lower latency
            start=False             # Don't start immediately
        )
        self.stream.start_stream()
        print(f"Audio playback started: {self.sample_rate} Hz, buffer=60 samples (1.25ms), max_buffer={self.max_buffer_frames} frames ({self.max_buffer_frames*1000.0/self.sample_rate:.1f}ms)")
    
    def get_buffer_latency_ms(self):
        """Get current buffer latency in milliseconds"""
        if not self.stream:
            return 0.0
        try:
            available = self.stream.get_write_available()
            # Total buffer size - available = queued frames
            # Note: PyAudio doesn't expose total buffer size directly,
            # so we estimate based on frames_per_buffer
            # A typical implementation uses 2-4x frames_per_buffer
            estimated_total = 60 * 4  # Conservative estimate
            queued = max(0, estimated_total - available)
            return queued * 1000.0 / self.sample_rate
        except:
            return 0.0
    
    def play(self, audio_data, drop_if_buffer_full=True):
        """
        Play audio data with buffer management
        
        Returns:
            True if played, False if dropped
        """
        if not self.stream:
            return False
        
        # Check buffer state before writing
        if drop_if_buffer_full:
            try:
                available = self.stream.get_write_available()
                # If buffer is nearly full (less than 2 frames available), drop this frame
                if available < len(audio_data) * 2:
                    self.frames_dropped += 1
                    return False
            except:
                pass
        
        try:
            # Use write() which is non-blocking if buffer is not full
            self.stream.write(audio_data.tobytes(), exception_on_underflow=False)
            return True
        except Exception as e:
            # Buffer full or other error - drop this frame
            self.frames_dropped += 1
            return False
    
    def stop(self):
        """Stop audio stream"""
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.p.terminate()


def main():
    parser = argparse.ArgumentParser(
        description='Real-time audio playback from ESP32 via USB CDC'
    )
    
    parser.add_argument('--port', '-p', required=True,
                        help='Serial port device (e.g., /dev/ttyACM0)')
    parser.add_argument('--rate', '-r', type=int, default=48000,
                        help='Audio sample rate (default: 48000)')
    parser.add_argument('--max-latency', type=float, default=5.0,
                        help='Maximum acceptable buffer latency in milliseconds before dropping frames (default: 5ms)')
    
    args = parser.parse_args()
    
    # Create receiver with optimized high-speed settings
    # Use maximum baudrate for USB CDC (9.2Mbps) to minimize latency
    receiver = AudioFrameReceiver(args.port, baudrate=9216000, sample_rate=args.rate)
    
    if not receiver.open():
        return 1
    
    print(f"Opened serial port: {args.port} @ {receiver.baudrate:,} baud")
    
    # Create player with strict buffer management
    player = AudioPlayer(sample_rate=args.rate, max_buffer_ms=args.max_latency)
    player.start()
    
    print("\nPlaying audio... Press Ctrl+C to stop\n")
    
    frame_count = 0
    last_stats_time = 0
    
    try:
        while True:
            frame = receiver.receive_frame()
            
            if frame is not None:
                # Check buffer latency before playing
                buffer_latency_ms = player.get_buffer_latency_ms()
                
                # Play frame with automatic dropping if buffer is full
                played = player.play(frame, drop_if_buffer_full=True)
                
                if played:
                    frame_count += 1
                # else: frame was dropped due to buffer being full
                
                # Print stats every second
                current_time = time.time()
                if current_time - last_stats_time >= 1.0:
                    dropped = receiver.stats['frames_dropped']
                    received = receiver.stats['frames_received']
                    checksum_errors = receiver.stats['checksum_errors']
                    player_dropped = player.frames_dropped
                    total_dropped = dropped + player_dropped
                    
                    drop_rate = 0.0
                    if received + total_dropped > 0:
                        drop_rate = 100.0 * total_dropped / (received + total_dropped)
                    
                    print(f"Frames: {frame_count}, Received: {received}, "
                          f"Dropped: {dropped} (rx) + {player_dropped} (play) = {total_dropped} total ({drop_rate:.1f}%), "
                          f"Checksum errors: {checksum_errors}, "
                          f"Buffer latency: {buffer_latency_ms:.1f} ms")
                    
                    # If buffer latency exceeds threshold, flush receiver buffer
                    if buffer_latency_ms > args.max_latency:
                        print(f"[WARN] Buffer latency {buffer_latency_ms:.1f} ms exceeds {args.max_latency} ms, flushing receiver buffer...")
                        receiver.flush_backlog()
                    
                    last_stats_time = current_time
            else:
                # Minimal delay when no frame available to reduce CPU usage
                # But keep it very small to maintain low latency
                time.sleep(0.00001)  # 0.01ms minimal delay
    
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    
    finally:
        player.stop()
        receiver.close()
        receiver.print_stats()
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

