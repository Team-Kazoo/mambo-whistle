import './App.css'
import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { InstrumentPalette } from '@/components/InstrumentPalette'
import { LiveVisualizer } from '@/components/LiveVisualizer'
import { Footer } from '@/components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <HeroSection />

          <section className="control-section">
            <InstrumentPalette />
          </section>

          <LiveVisualizer />

          <Footer />
        </div>
      </main>
    </div>
  )
}

export default App
