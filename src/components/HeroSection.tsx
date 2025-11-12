import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  isPlaying: boolean
  isReady: boolean
  status: string
  onStart: () => void
  onStop: () => void
}

export function HeroSection({ isPlaying, isReady, status, onStart, onStop }: HeroSectionProps) {
  return (
    <section className="text-center py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg mb-8 mt-6">
      <div className="text-6xl mb-4">🎵</div>
      <h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-3">
        Transform Your Voice
      </h1>
      <p className="text-lg md:text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
        Sing or hum, and hear yourself as any instrument in real-time
      </p>
      <div className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-4 py-2 rounded-full mb-8">
        Ultra-low latency • Zero setup
      </div>

      {/* Steps Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
            1
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Pick Your Sound</h3>
            <p className="text-gray-600">
              Choose from 6 realistic instruments: Saxophone, Violin, Piano, Flute, Guitar, or Synth.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
            2
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Start Playing</h3>
            <p className="text-gray-600">
              Click start, allow microphone access, and begin humming. Hear yourself instantly!
            </p>
          </div>
        </div>
      </div>

      {/* Main Control Buttons */}
      <div className="flex flex-col items-center gap-4">
        <Button
          id="startBtn"
          size="lg"
          onClick={onStart}
          disabled={!isReady || isPlaying}
          className={`bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ${isPlaying ? 'hidden' : 'animate-pulse'}`}
        >
          <span className="text-2xl mr-2">▶️</span>
          <span>Start Playing</span>
        </Button>
        <Button
          id="stopBtn"
          size="lg"
          variant="destructive"
          onClick={onStop}
          disabled={!isPlaying}
          className={`bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ${!isPlaying ? 'hidden' : ''}`}
        >
          <span className="text-2xl mr-2">⏹️</span>
          <span>Stop</span>
        </Button>
        <p className="text-sm text-gray-500" id="recordingHelper">
          {status}
        </p>
      </div>
    </section>
  )
}
