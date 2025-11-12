import { Card } from '@/components/ui/card'
import { useRef, useEffect } from 'react'

export function LiveVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Initialize canvas with dark background
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [])

  return (
    <div className="hidden" id="visualizer">
      <Card className="p-6 border border-gray-200 mb-6">
        {/* Current Note Display */}
        <div className="flex items-center gap-6 mb-6">
          <div className="min-w-[140px]">
            <div className="text-sm text-gray-500 mb-1">Current Note</div>
            <div
              className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              id="currentNote"
            >
              --
            </div>
            <div className="text-sm text-gray-500 mt-1" id="currentFreq">
              --
            </div>
          </div>

          {/* Pitch Canvas */}
          <Card className="flex-1 bg-gray-900 p-4 border border-gray-300">
            <canvas
              ref={canvasRef}
              id="pitchCanvas"
              width={600}
              height={80}
              className="w-full h-20 rounded"
            />
          </Card>
        </div>

        {/* Status Bar - Metrics Grid */}
        <div className="grid grid-cols-3 gap-4" id="statusBar">
          <div className="flex flex-col items-center">
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <div className="text-lg font-semibold text-gray-900" id="systemStatus">
              Ready
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-sm text-gray-500 mb-1">Latency</div>
            <div className="text-lg font-semibold text-gray-900" id="latency">
              --
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-sm text-gray-500 mb-1">Confidence</div>
            <div className="text-lg font-semibold text-gray-900" id="confidence">
              --
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
