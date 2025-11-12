import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export function Footer() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="bg-gray-50 rounded-lg p-6 mt-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2 mb-4"
            id="helpToggle"
            aria-label="Toggle help tips"
          >
            💡 Tips
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="help-content text-gray-700 text-sm" id="helpContent">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">🎤 Pro Tips</h4>
            <ul className="ml-5 mb-4 space-y-1 list-disc">
              <li>🎧 Use headphones to prevent feedback (or you'll create an infinite echo loop!)</li>
              <li>📏 Keep microphone 10-20cm away (close enough to hear, far enough not to eat it)</li>
              <li>🎵 Try both modes! Continuous = smooth slides, Legacy = clear notes</li>
              <li>🤫 Quiet environment works best (your cat's meowing won't become music... unfortunately)</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-900 mb-3">🎛️ Mode Comparison</h4>
            <ul className="ml-5 mb-4 space-y-1 list-disc">
              <li>
                🌊 <strong>Continuous Mode (Default):</strong> Smooth pitch tracking, follows your
                voice like a theremin. Perfect for expressive playing and slides!
              </li>
              <li>
                🎹 <strong>Legacy Mode:</strong> Snap-to-note system, like a piano keyboard. Better
                for precise, discrete notes.
              </li>
              <li>🔄 Switch anytime using the toggle in the top-right corner (stop playback first!)</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-900 mb-3">🎭 Fun Facts</h4>
            <ul className="ml-5 mb-4 space-y-1 list-disc">
              <li>🎷 The saxophone was invented by Adolphe Sax in 1846. Now you can become Adolphe!</li>
              <li>
                ⚡ Our latency is &lt;50ms - faster than you can say
                "supercalifragilisticexpialidocious"
              </li>
              <li>🧠 The YIN algorithm behind this uses some serious math. Don't worry, we did it for you!</li>
              <li>🎹 You're basically a human MIDI controller now. Welcome to the future!</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-900 mb-3">🐛 Troubleshooting</h4>
            <ul className="ml-5 mb-4 space-y-1 list-disc">
              <li>No sound? Check if your mic is on (not on mute, not in the dishwasher)</li>
              <li>
                Weird sounds? That might just be your singing... kidding! Try a different instrument
              </li>
              <li>High latency? Close that 47-tab browser session. We know it's there.</li>
            </ul>

            <div className="hidden warning-box" id="warningBox">
              <strong>⚠️ Issues Detected:</strong>
              <div id="warningText"></div>
            </div>

            <Card className="mt-5 p-3 bg-blue-50 border-blue-200">
              <p className="text-sm">
                <strong>🎁 Secret:</strong> Try humming the main theme of your favorite movie. Does
                it sound epic? That's because YOU are epic! 🌟
              </p>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
