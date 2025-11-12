import { useState, useEffect, useRef, useCallback } from 'react'
import type { AudioState, InstrumentType, AudioMode, AudioServiceControls } from '@/lib/types/audio'

/**
 * useAudioService Hook - Complete Audio Integration
 *
 * Integrates the existing vanilla JS audio system with React
 * Strategy: Load JS modules dynamically and provide React interface
 */
export function useAudioService(): AudioState & AudioServiceControls {
  const scriptLoadedRef = useRef(false)
  const updateIntervalRef = useRef<number | null>(null)

  const [audioState, setAudioState] = useState<AudioState>({
    isReady: false,
    isPlaying: false,
    currentInstrument: 'saxophone',
    currentMode: 'continuous',
    pitchData: null,
    latency: 0,
    status: 'Loading audio system...'
  })

  // Initialize audio system
  useEffect(() => {
    if (scriptLoadedRef.current) return
    scriptLoadedRef.current = true

    const init = async () => {
      try {
        // Load Tone.js and Pitchfinder
        await loadScript('/js/lib/tone.js')
        await loadScript('/js/lib/pitchfinder-browser.js')

        // Load main audio system
        await import('/js/main.js?v=' + Date.now())

        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 500))

        if ((window as any).app) {
          setAudioState(prev => ({ ...prev, isReady: true, status: 'Ready' }))
          console.log('[Audio] System ready')
        } else {
          throw new Error('Audio system not initialized')
        }
      } catch (error) {
        console.error('[Audio] Load failed:', error)
        setAudioState(prev => ({ ...prev, status: 'Error: ' + (error as Error).message }))
      }
    }

    init()

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current)
      ;(window as any).app?.stop?.()
    }
  }, [])

  // Start audio
  const start = useCallback(async () => {
    try {
      await (window as any).app?.start()
      setAudioState(prev => ({ ...prev, isPlaying: true, status: `Playing (${prev.currentInstrument})` }))
      startRealTimeUpdates()
    } catch (error) {
      console.error('[Audio] Start failed:', error)
      setAudioState(prev => ({ ...prev, status: 'Error: ' + (error as Error).message }))
    }
  }, [])

  // Stop audio
  const stop = useCallback(() => {
    ;(window as any).app?.stop()
    if (updateIntervalRef.current) clearInterval(updateIntervalRef.current)
    setAudioState(prev => ({ ...prev, isPlaying: false, pitchData: null, status: 'Ready' }))
  }, [])

  // Change instrument
  const changeInstrument = useCallback((instrument: InstrumentType) => {
    ;(window as any).app?.changeInstrument?.(instrument)
    setAudioState(prev => ({
      ...prev,
      currentInstrument: instrument,
      status: prev.isPlaying ? `Playing (${instrument})` : 'Ready'
    }))
  }, [])

  // Change mode
  const changeMode = useCallback((mode: AudioMode) => {
    const app = (window as any).app
    if (app) app.useContinuousMode = (mode === 'continuous')
    setAudioState(prev => ({ ...prev, currentMode: mode }))
  }, [])

  // Real-time updates
  const startRealTimeUpdates = () => {
    updateIntervalRef.current = window.setInterval(() => {
      const note = document.getElementById('currentNote')?.textContent?.trim() || '--'
      const freqText = document.getElementById('currentFreq')?.textContent?.trim() || '0'
      const frequency = parseFloat(freqText) || 0

      if (note !== '--' && frequency > 0) {
        setAudioState(prev => ({
          ...prev,
          pitchData: { note, frequency, confidence: 95 }
        }))
      }
    }, 100)
  }

  return { ...audioState, start, stop, changeInstrument, changeMode }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(script)
  })
}
