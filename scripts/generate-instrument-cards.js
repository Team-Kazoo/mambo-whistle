/**
 * Generate updated instrument cards HTML with SVG icons
 * Usage: node scripts/generate-instrument-cards.js > output.html
 */

const instruments = [
  {
    id: 'flute',
    name: 'Flute',
    subtitle: 'Pure & Airy',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    active: true
  },
  {
    id: 'clarinet',
    name: 'Clarinet',
    subtitle: 'Woody Hollow',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    id: 'dizi',
    name: 'Dizi',
    subtitle: 'Bamboo Buzz',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 'soprano_sax',
    name: 'Soprano Sax',
    subtitle: 'Kenny G Style',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  },
  {
    id: 'alto_sax',
    name: 'Alto Sax',
    subtitle: 'Jazz Standard',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    id: 'trumpet',
    name: 'Trumpet',
    subtitle: 'Bright Lead',
    gradient: 'linear-gradient(135deg, #ffa751 0%, #ffe259 100%)'
  },
  {
    id: 'trombone',
    name: 'Trombone',
    subtitle: 'Slide Master',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  },
  {
    id: 'suona',
    name: 'Suona',
    subtitle: 'High Energy',
    gradient: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)'
  },
  {
    id: 'violin',
    name: 'Violin',
    subtitle: 'Solo Strings',
    gradient: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)'
  },
  {
    id: 'cello',
    name: 'Cello',
    subtitle: 'Deep Warmth',
    gradient: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)'
  },
  {
    id: 'erhu',
    name: 'Erhu',
    subtitle: 'Chinese Fiddle',
    gradient: 'linear-gradient(135deg, #eea2a2 0%, #bbc1bf 56%, #57c6e1 100%)'
  },
  {
    id: 'harmonica',
    name: 'Harmonica',
    subtitle: 'Blues Reed',
    gradient: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)'
  }
];

// SVG Icons (simplified inline version)
const svgIcons = {
  flute: '<path d="M4 12h16"/><circle cx="8" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><path d="M2 12l2-2v4l-2-2z"/><path d="M20 10v4"/>',
  clarinet: '<rect x="10" y="2" width="4" height="3" rx="1"/><path d="M10 5h4v14c0 1.1-.9 2-2 2s-2-.9-2-2V5z"/><circle cx="10.5" cy="8" r="0.8" fill="currentColor"/><circle cx="13.5" cy="8" r="0.8" fill="currentColor"/><circle cx="10.5" cy="11" r="0.8" fill="currentColor"/><circle cx="13.5" cy="11" r="0.8" fill="currentColor"/><circle cx="10.5" cy="14" r="0.8" fill="currentColor"/><circle cx="13.5" cy="14" r="0.8" fill="currentColor"/><path d="M11 19l-2 2m4-2l2 2"/>',
  dizi: '<path d="M3 12h18"/><circle cx="6" cy="12" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/><path d="M3 10v4M21 10v4"/><path d="M4 8h16"/><path d="M4 16h16"/>',
  soprano_sax: '<path d="M10 3h4v3h-4z"/><path d="M11 6v8c0 2-1 4-2 5l-1 2"/><path d="M13 6v8c0 2 1 4 2 5l1 2"/><circle cx="9" cy="10" r="0.8" fill="currentColor"/><circle cx="9" cy="13" r="0.8" fill="currentColor"/><circle cx="9" cy="16" r="0.8" fill="currentColor"/><circle cx="15" cy="10" r="0.8" fill="currentColor"/><circle cx="15" cy="13" r="0.8" fill="currentColor"/><circle cx="15" cy="16" r="0.8" fill="currentColor"/>',
  alto_sax: '<path d="M10 2h4v3h-4z"/><path d="M11 5v6c0 3-2 5-3 6l-2 3"/><path d="M13 5v6c0 3 2 5 3 6l2 3"/><circle cx="8" cy="9" r="0.8" fill="currentColor"/><circle cx="8" cy="12" r="0.8" fill="currentColor"/><circle cx="8" cy="15" r="0.8" fill="currentColor"/><circle cx="16" cy="9" r="0.8" fill="currentColor"/><circle cx="16" cy="12" r="0.8" fill="currentColor"/><circle cx="16" cy="15" r="0.8" fill="currentColor"/>',
  trumpet: '<path d="M21 12h-6"/><path d="M15 10v4"/><rect x="9" y="10" width="6" height="4" rx="0.5"/><circle cx="6" cy="12" r="3"/><path d="M12 11v2"/><path d="M10 11v2"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/><circle cx="10" cy="12" r="0.5" fill="currentColor"/><circle cx="14" cy="12" r="0.5" fill="currentColor"/>',
  trombone: '<path d="M20 12h-4"/><rect x="12" y="10" width="4" height="4" rx="0.5"/><path d="M12 12H4"/><circle cx="2" cy="12" r="1.5"/><path d="M6 10v4"/><path d="M8 10v4"/><path d="M10 10v4"/>',
  suona: '<path d="M12 2v8"/><circle cx="12" cy="10" r="2"/><path d="M12 12v6"/><path d="M12 18c0 2.2-1.8 4-4 4h8c-2.2 0-4-1.8-4-4z"/><circle cx="10" cy="14" r="0.6" fill="currentColor"/><circle cx="14" cy="14" r="0.6" fill="currentColor"/><circle cx="10" cy="16" r="0.6" fill="currentColor"/><circle cx="14" cy="16" r="0.6" fill="currentColor"/>',
  violin: '<ellipse cx="12" cy="16" rx="4" ry="5"/><path d="M12 11v-1a2 2 0 012-2h0a2 2 0 012-2V3"/><path d="M10 13l4 0"/><path d="M10 15l4 0"/><path d="M10 17l4 0"/><path d="M10 19l4 0"/><circle cx="12" cy="8" r="1"/>',
  cello: '<ellipse cx="12" cy="14" rx="5" ry="7"/><path d="M12 7V4"/><circle cx="12" cy="3" r="1"/><path d="M9 11h6"/><path d="M9 13h6"/><path d="M9 15h6"/><path d="M9 17h6"/><path d="M12 21v1"/>',
  erhu: '<path d="M12 2v20"/><rect x="10" y="10" width="4" height="6" rx="1"/><path d="M8 12h8"/><path d="M8 14h8"/><circle cx="10" cy="4" r="1"/><circle cx="14" cy="4" r="1"/><path d="M10 5l2 3"/><path d="M14 5l-2 3"/>',
  harmonica: '<rect x="4" y="9" width="16" height="6" rx="1"/><path d="M6 9v6"/><path d="M9 9v6"/><path d="M12 9v6"/><path d="M15 9v6"/><path d="M18 9v6"/><circle cx="7.5" cy="12" r="0.8" fill="currentColor"/><circle cx="10.5" cy="12" r="0.8" fill="currentColor"/><circle cx="13.5" cy="12" r="0.8" fill="currentColor"/><circle cx="16.5" cy="12" r="0.8" fill="currentColor"/>'
};

// Generate HTML
console.log(`<!-- Generated Instrument Cards with SVG Icons -->
<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
`);

instruments.forEach(inst => {
  const activeClass = inst.active ? ' active' : '';
  const svg = svgIcons[inst.id] || svgIcons.flute;

  console.log(`    <!-- ${inst.name} -->
    <button class="instrument-btn${activeClass} group relative w-full text-left focus:outline-none" data-instrument="${inst.id}">
        <div class="card-border-gradient"></div>
        <div class="card-inner h-36 rounded-[20px] overflow-hidden relative">
            <!-- Gradient Background -->
            <div class="absolute inset-0 transition-opacity duration-300 opacity-30 group-hover:opacity-40" style="background: ${inst.gradient}"></div>

            <!-- White Overlay -->
            <div class="absolute inset-0 bg-white/85 group-[.active]:bg-white/95 transition-colors"></div>

            <!-- Content -->
            <div class="relative z-10 h-full p-4 flex flex-col justify-between">
                <!-- SVG Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#1D1D1F] opacity-80">
                    ${svg}
                </svg>

                <!-- Text -->
                <div>
                    <p class="font-semibold text-sm text-[#1D1D1F]">${inst.name}</p>
                    <p class="text-[10px] text-apple-gray mt-0.5">${inst.subtitle}</p>
                </div>
            </div>
        </div>
    </button>
`);
});

console.log(`</div>`);

console.log(`\n<!-- Add this to main.js to import icons -->`);
console.log(`// import { instrumentIcons } from './config/instrument-icons.js';`);
