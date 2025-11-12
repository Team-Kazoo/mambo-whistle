import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export function Header() {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-opacity-90">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-7xl">
        <div className="text-2xl font-bold text-blue-900">Kazoo Proto</div>
        <div className="flex items-center gap-6">
          {/* Mode Toggle */}
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600 font-medium">Mode:</span>
            <Switch id="mode-toggle" defaultChecked />
            <span className="text-sm text-gray-900 font-semibold min-w-[80px]" id="modeText">
              Continuous
            </span>
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              BETA
            </span>
          </div>
          <Button variant="ghost" className="text-blue-600 hover:text-blue-800 font-semibold">
            Help
          </Button>
        </div>
      </div>
    </nav>
  )
}
