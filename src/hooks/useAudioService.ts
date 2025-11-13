import { useState, useEffect, useRef } from 'react'
import type { AudioState, InstrumentType, AudioMode, AudioServiceControls } from '@/lib/types/audio'
import { AudioService, getAudioService } from '@/lib/audio/AudioService'

/**
 * useAudioService Hook - Clean React Integration
 *
 * Uses the new TypeScript native AudioService
 * No more legacy JS system or DOM polling
 */
export function useAudioService(): AudioState & AudioServiceControls {
  const serviceRef = useRef<AudioService | null>(null)
  const [audioState, setAudioState] = useState<AudioState>({
    isReady: false,
    isPlaying: false,
    currentInstrument: 'saxophone',
    currentMode: 'continuous',
    pitchData: null,
    latency: 0,
    status: 'initializing'
  })

  // Initialize audio service
  useEffect(() => {
    // Get singleton instance
    const service = getAudioService()
    serviceRef.current = service

    // Subscribe to state changes
    const unsubscribe = service.subscribe((state) => {
      setAudioState(state)
    })

    // Initialize the audio system
    service.initialize().catch((error) => {
      console.error('[useAudioService] Initialization failed:', error)
    })

    // Cleanup on unmount
    return () => {
      unsubscribe()
      // Note: We don't destroy the service here because it's a singleton
      // and other components might be using it
    }
  }, [])

  // Start audio
  const start = async () => {
    if (!serviceRef.current) {
      console.error('[useAudioService] Service not initialized')
      return
    }

    try {
      await serviceRef.current.start()
    } catch (error) {
      console.error('[useAudioService] Start failed:', error)
    }
  }

  // Stop audio
  const stop = () => {
    serviceRef.current?.stop()
  }

  // Change instrument
  const changeInstrument = (instrument: InstrumentType) => {
    serviceRef.current?.changeInstrument(instrument)
  }

  // Change mode
  const changeMode = (mode: AudioMode) => {
    serviceRef.current?.changeMode(mode)
  }

  return {
    ...audioState,
    start,
    stop,
    changeInstrument,
    changeMode
  }
}
