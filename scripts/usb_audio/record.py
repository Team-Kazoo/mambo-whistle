#!/usr/bin/env python3
"""
USB Audio Recorder - Record audio to WAV file

Usage:
    python record.py --port /dev/ttyACM0 --duration 10 --output audio.wav
"""

import sys
import argparse
import numpy as np
from receiver import AudioFrameReceiver

try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    HAS_SOUNDFILE = False
    print("Error: soundfile not installed")
    print("Install with: pip install soundfile")
    sys.exit(1)


def record_audio(receiver, duration):
    """Record audio for specified duration"""
    import time
    
    audio_buffer = []
    start_time = time.time()
    last_print = start_time
    
    print(f"\nRecording for {duration} seconds...")
    print("Press Ctrl+C to stop early\n")
    
    try:
        while True:
            frame = receiver.receive_frame()
            
            if frame is not None:
                audio_buffer.append(frame)
            
            # Print progress every second
            current_time = time.time()
            if current_time - last_print >= 1.0:
                elapsed = current_time - start_time
                frames = receiver.stats['frames_received']
                print(f"[{elapsed:.1f}s] Frames: {frames}, "
                      f"Dropped: {receiver.stats['frames_dropped']}")
                last_print = current_time
            
            # Check duration
            if time.time() - start_time >= duration:
                break
                
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    
    # Concatenate audio data
    if audio_buffer:
        return np.concatenate(audio_buffer)
    return np.array([], dtype=np.int16)


def save_wav(filename, audio_data, sample_rate):
    """Save audio data to WAV file"""
    if len(audio_data) == 0:
        print("Warning: No audio data to save")
        return False
    
    # Convert to float32 [-1.0, 1.0]
    audio_float = audio_data.astype(np.float32) / 32768.0
    
    sf.write(filename, audio_float, sample_rate)
    print(f"\nSaved {len(audio_data)} samples to {filename}")
    print(f"Duration: {len(audio_data) / sample_rate:.2f} seconds")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Record audio from ESP32 via USB CDC to WAV file'
    )
    
    parser.add_argument('--port', '-p', required=True,
                        help='Serial port device (e.g., /dev/ttyACM0)')
    parser.add_argument('--duration', '-d', type=float, required=True,
                        help='Recording duration in seconds')
    parser.add_argument('--output', '-o', required=True,
                        help='Output WAV file name')
    parser.add_argument('--rate', '-r', type=int, default=24000,
                        help='Audio sample rate (default: 24000)')
    
    args = parser.parse_args()
    
    # Create receiver
    receiver = AudioFrameReceiver(args.port, sample_rate=args.rate)
    
    if not receiver.open():
        return 1
    
    print(f"Opened serial port: {args.port}")
    
    try:
        # Record
        audio_data = record_audio(receiver, args.duration)
        
        # Save
        if len(audio_data) > 0:
            save_wav(args.output, audio_data, receiver.sample_rate)
        
        # Print stats
        receiver.print_stats()
    
    finally:
        receiver.close()
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

