import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const instruments = [
  { id: 'saxophone', emoji: '🎷', name: 'Saxophone', description: 'Warm & Expressive', disabled: false },
  { id: 'violin', emoji: '🎻', name: 'Violin', description: 'Rich & Lyrical', disabled: false },
  { id: 'piano', emoji: '🎹', name: 'Piano', description: 'Classic & Clear', disabled: false },
  { id: 'flute', emoji: '🪈', name: 'Flute', description: 'Bright & Airy', disabled: false },
  { id: 'guitar', emoji: '🎸', name: 'Guitar', description: 'Plucked & Natural', disabled: false },
  { id: 'synth', emoji: '🎛️', name: 'Synth', description: 'Electronic & Modern', disabled: false },
  { id: 'trumpet', emoji: '🎺', name: 'Trumpet', description: 'To Be Continued...', disabled: true },
  { id: 'drums', emoji: '🥁', name: 'Drums', description: 'Coming Soon!', disabled: true },
]

export function InstrumentPalette() {
  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Instrument</h2>
        <Badge className="bg-blue-100 text-blue-800 text-sm font-semibold" id="instrumentStatus">
          Saxophone
        </Badge>
      </div>
      <p className="text-gray-600 mb-4">
        Each instrument has unique tonal characteristics. You can change it anytime!
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {instruments.map((instrument, index) => (
          <button
            key={instrument.id}
            className={cn(
              'instrument-btn rounded-xl p-4 flex flex-col items-center gap-2 transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              instrument.disabled
                ? 'bg-white border-2 border-gray-200 opacity-40 cursor-not-allowed'
                : index === 0
                ? 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-500 shadow-lg active'
                : 'bg-white border-2 border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 hover:-translate-y-1'
            )}
            data-instrument={instrument.id}
            aria-label={`Select ${instrument.name} instrument`}
            disabled={instrument.disabled}
          >
            <span className="text-4xl">{instrument.emoji}</span>
            <span className="instrument-name font-semibold text-gray-900 text-lg">
              {instrument.name}
            </span>
            <span className="text-sm text-gray-500">{instrument.description}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
