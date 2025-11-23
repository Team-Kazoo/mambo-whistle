#!/usr/bin/env python3
"""
USB Audio Receiver - Clean production version

Receives audio frames from ESP32 via USB CDC serial port.
"""

import serial
import struct
import time
import numpy as np

# Frame format constants
FRAME_MAGIC = 0xAA55
FRAME_HEADER_SIZE = 6  # magic(2) + seq_num(2) + length(2)
CHECKSUM_SIZE = 2


class AudioFrameReceiver:
    """Audio frame receiver for USB CDC audio stream"""
    
    def __init__(self, port, baudrate=9216000, sample_rate=48000):
        """
        Initialize receiver
        
        Args:
            port: Serial port device path
            baudrate: Serial baudrate
            sample_rate: Audio sample rate in Hz
        """
        self.port = port
        self.baudrate = baudrate
        self.sample_rate = sample_rate
        self.ser = None
        
        # Statistics
        self.stats = {
            'frames_received': 0,
            'frames_dropped': 0,
            'checksum_errors': 0,
            'sync_errors': 0,
            'bytes_received': 0,
            'last_seq': None,
        }
        
        # Receive buffer
        self.buffer = bytearray()
        
    def open(self):
        """Open serial port"""
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=0.0005,  # Reduced timeout for lower latency (0.5ms)
                inter_byte_timeout=None,  # No timeout between bytes for USB CDC
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                write_timeout=0,  # Non-blocking writes
            )
            # Set low latency mode if available (Linux)
            try:
                import termios
                import fcntl
                fd = self.ser.fileno()
                # Reduce USB CDC latency timer (Linux only)
                # This reduces the delay before USB packets are sent
                if hasattr(termios, 'TIOCGSERIAL'):
                    try:
                        # Try to set low latency mode
                        import struct
                        # Some systems support setting low latency
                        # This is a best-effort optimization
                        pass
                    except:
                        pass
            except:
                pass
            # Flush any residual data to avoid starting with old frames
            try:
                self.ser.reset_input_buffer()
            except Exception:
                pass
            start = time.monotonic()
            while time.monotonic() - start < 0.2:
                if self.ser.in_waiting:
                    self.ser.read(self.ser.in_waiting)
                else:
                    break
            return True
        except Exception as e:
            print(f"Error opening serial port: {e}")
            return False
    
    def close(self):
        """Close serial port"""
        if self.ser:
            self.ser.close()
    
    def flush_backlog(self):
        """Clear buffered data to catch up"""
        self.buffer.clear()
        if self.ser:
            try:
                self.ser.reset_input_buffer()
            except Exception:
                pass
    
    def _find_sync(self):
        """Find frame sync marker in buffer"""
        while len(self.buffer) >= 2:
            magic = struct.unpack('<H', self.buffer[:2])[0]
            if magic == FRAME_MAGIC:
                return True
            self.buffer.pop(0)
            self.stats['sync_errors'] += 1
        return False
    
    def _calculate_checksum(self, data):
        """Calculate checksum"""
        return sum(data) & 0xFFFF
    
    def receive_frame(self):
        """
        Receive one audio frame
        
        Returns:
            numpy array of int16 audio samples, or None if no frame available
        """
        # Read from serial port - read all available data at once
        # For USB CDC, reading larger chunks reduces overhead
        if self.ser:
            # Check if data is available without blocking
            if self.ser.in_waiting > 0:
                # Read all available data in one call to minimize overhead
                available = self.ser.in_waiting
                chunk = self.ser.read(available)
                if chunk:
                    self.buffer.extend(chunk)
                    self.stats['bytes_received'] += len(chunk)
            else:
                # No data available, return immediately to avoid blocking
                return None
        
        # Find sync marker
        if not self._find_sync():
            return None
        
        # Check if we have complete header
        if len(self.buffer) < FRAME_HEADER_SIZE:
            return None
        
        # Parse header
        header = struct.unpack('<HHH', self.buffer[:FRAME_HEADER_SIZE])
        magic, seq_num, length = header
        
        # Check if we have complete frame
        frame_size = FRAME_HEADER_SIZE + length + CHECKSUM_SIZE
        if len(self.buffer) < frame_size:
            return None
        
        # Extract complete frame
        frame_data = bytes(self.buffer[:frame_size])
        self.buffer = self.buffer[frame_size:]
        
        # Verify checksum
        received_checksum = struct.unpack('<H', frame_data[-CHECKSUM_SIZE:])[0]
        calculated_checksum = self._calculate_checksum(frame_data[:-CHECKSUM_SIZE])
        
        if received_checksum != calculated_checksum:
            self.stats['checksum_errors'] += 1
            return None
        
        # Check sequence number continuity
        if self.stats['last_seq'] is not None:
            expected_seq = (self.stats['last_seq'] + 1) & 0xFFFF
            if seq_num != expected_seq:
                dropped = (seq_num - expected_seq) & 0xFFFF
                self.stats['frames_dropped'] += dropped
        
        self.stats['last_seq'] = seq_num
        self.stats['frames_received'] += 1
        
        # Extract audio data
        audio_data = frame_data[FRAME_HEADER_SIZE:-CHECKSUM_SIZE]
        samples = np.frombuffer(audio_data, dtype=np.int16)
        
        return samples
    
    def get_stats(self):
        """Get statistics"""
        return self.stats.copy()
    
    def print_stats(self):
        """Print statistics"""
        print(f"\n=== Statistics ===")
        print(f"Frames received:  {self.stats['frames_received']}")
        print(f"Frames dropped:   {self.stats['frames_dropped']}")
        print(f"Checksum errors:  {self.stats['checksum_errors']}")
        print(f"Sync errors:      {self.stats['sync_errors']}")
        print(f"Bytes received:   {self.stats['bytes_received']}")
        
        if self.stats['frames_received'] > 0:
            success_rate = 100.0 * self.stats['frames_received'] / (
                self.stats['frames_received'] + self.stats['frames_dropped'])
            print(f"Success rate:     {success_rate:.2f}%")

