import './App.css'
import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { InstrumentPalette } from '@/components/InstrumentPalette'
import { LiveVisualizer } from '@/components/LiveVisualizer'
import { Footer } from '@/components/Footer'
import { useAudioService } from '@/hooks/useAudioService'

function App() {
  const audio = useAudioService()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentMode={audio.currentMode}
        onModeChange={audio.changeMode}
      />

      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <HeroSection
            isPlaying={audio.isPlaying}
            isReady={audio.isReady}
            status={audio.status}
            onStart={audio.start}
            onStop={audio.stop}
          />

          <section className="control-section">
            <InstrumentPalette
              currentInstrument={audio.currentInstrument}
              onInstrumentChange={audio.changeInstrument}
              disabled={!audio.isReady}
            />
          </section>

          <LiveVisualizer
            isVisible={audio.isPlaying}
            pitchData={audio.pitchData}
            latency={audio.latency}
          />

          <Footer />
        </div>
      </main>
    </div>
  )
}

export default App
