/**
 * Instrument SVG Icons Configuration
 *
 * SVG icons optimized for 48x48px display
 * Sources: Lucide, Heroicons, Custom SVG
 * License: MIT (Free for commercial use)
 *
 * @module instrument-icons
 */

export const instrumentIcons = {
  // ==================== Woodwinds ====================

  flute: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12h16"/>
      <circle cx="8" cy="12" r="1.5"/>
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="16" cy="12" r="1.5"/>
      <path d="M2 12l2-2v4l-2-2z"/>
      <path d="M20 10v4"/>
    </svg>
  `,

  clarinet: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="10" y="2" width="4" height="3" rx="1"/>
      <path d="M10 5h4v14c0 1.1-.9 2-2 2s-2-.9-2-2V5z"/>
      <circle cx="10.5" cy="8" r="0.8" fill="currentColor"/>
      <circle cx="13.5" cy="8" r="0.8" fill="currentColor"/>
      <circle cx="10.5" cy="11" r="0.8" fill="currentColor"/>
      <circle cx="13.5" cy="11" r="0.8" fill="currentColor"/>
      <circle cx="10.5" cy="14" r="0.8" fill="currentColor"/>
      <circle cx="13.5" cy="14" r="0.8" fill="currentColor"/>
      <path d="M11 19l-2 2m4-2l2 2"/>
    </svg>
  `,

  dizi: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12h18"/>
      <circle cx="6" cy="12" r="1.2"/>
      <circle cx="9" cy="12" r="1.2"/>
      <circle cx="12" cy="12" r="1.2"/>
      <circle cx="15" cy="12" r="1.2"/>
      <circle cx="18" cy="12" r="1.2"/>
      <path d="M3 10v4M21 10v4"/>
      <path d="M4 8h16"/>
      <path d="M4 16h16"/>
    </svg>
  `,

  // ==================== Saxophones ====================

  soprano_sax: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 3h4v3h-4z"/>
      <path d="M11 6v8c0 2-1 4-2 5l-1 2"/>
      <path d="M13 6v8c0 2 1 4 2 5l1 2"/>
      <circle cx="9" cy="10" r="0.8" fill="currentColor"/>
      <circle cx="9" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="9" cy="16" r="0.8" fill="currentColor"/>
      <circle cx="15" cy="10" r="0.8" fill="currentColor"/>
      <circle cx="15" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="15" cy="16" r="0.8" fill="currentColor"/>
    </svg>
  `,

  alto_sax: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2h4v3h-4z"/>
      <path d="M11 5v6c0 3-2 5-3 6l-2 3"/>
      <path d="M13 5v6c0 3 2 5 3 6l2 3"/>
      <circle cx="8" cy="9" r="0.8" fill="currentColor"/>
      <circle cx="8" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="8" cy="15" r="0.8" fill="currentColor"/>
      <circle cx="16" cy="9" r="0.8" fill="currentColor"/>
      <circle cx="16" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="16" cy="15" r="0.8" fill="currentColor"/>
    </svg>
  `,

  // ==================== Brass ====================

  trumpet: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12h-6"/>
      <path d="M15 10v4"/>
      <rect x="9" y="10" width="6" height="4" rx="0.5"/>
      <circle cx="6" cy="12" r="3"/>
      <path d="M12 11v2"/>
      <path d="M10 11v2"/>
      <circle cx="12" cy="12" r="0.5" fill="currentColor"/>
      <circle cx="10" cy="12" r="0.5" fill="currentColor"/>
      <circle cx="14" cy="12" r="0.5" fill="currentColor"/>
    </svg>
  `,

  trombone: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 12h-4"/>
      <rect x="12" y="10" width="4" height="4" rx="0.5"/>
      <path d="M12 12H4"/>
      <circle cx="2" cy="12" r="1.5"/>
      <path d="M6 10v4"/>
      <path d="M8 10v4"/>
      <path d="M10 10v4"/>
    </svg>
  `,

  suona: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v8"/>
      <circle cx="12" cy="10" r="2"/>
      <path d="M12 12v6"/>
      <path d="M12 18c0 2.2-1.8 4-4 4h8c-2.2 0-4-1.8-4-4z"/>
      <circle cx="10" cy="14" r="0.6" fill="currentColor"/>
      <circle cx="14" cy="14" r="0.6" fill="currentColor"/>
      <circle cx="10" cy="16" r="0.6" fill="currentColor"/>
      <circle cx="14" cy="16" r="0.6" fill="currentColor"/>
    </svg>
  `,

  // ==================== Strings ====================

  violin: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="16" rx="4" ry="5"/>
      <path d="M12 11v-1a2 2 0 012-2h0a2 2 0 012-2V3"/>
      <path d="M10 13l4 0"/>
      <path d="M10 15l4 0"/>
      <path d="M10 17l4 0"/>
      <path d="M10 19l4 0"/>
      <circle cx="12" cy="8" r="1"/>
    </svg>
  `,

  cello: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="14" rx="5" ry="7"/>
      <path d="M12 7V4"/>
      <circle cx="12" cy="3" r="1"/>
      <path d="M9 11h6"/>
      <path d="M9 13h6"/>
      <path d="M9 15h6"/>
      <path d="M9 17h6"/>
      <path d="M12 21v1"/>
    </svg>
  `,

  erhu: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v20"/>
      <rect x="10" y="10" width="4" height="6" rx="1"/>
      <path d="M8 12h8"/>
      <path d="M8 14h8"/>
      <circle cx="10" cy="4" r="1"/>
      <circle cx="14" cy="4" r="1"/>
      <path d="M10 5l2 3"/>
      <path d="M14 5l-2 3"/>
    </svg>
  `,

  // ==================== Reeds ====================

  harmonica: `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="9" width="16" height="6" rx="1"/>
      <path d="M6 9v6"/>
      <path d="M9 9v6"/>
      <path d="M12 9v6"/>
      <path d="M15 9v6"/>
      <path d="M18 9v6"/>
      <circle cx="7.5" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="10.5" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="13.5" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="16.5" cy="12" r="0.8" fill="currentColor"/>
    </svg>
  `
};

/**
 * Get SVG icon for instrument
 * @param {string} instrumentName - Instrument name (e.g., 'flute', 'trumpet')
 * @returns {string} SVG markup
 */
export function getInstrumentIcon(instrumentName) {
  return instrumentIcons[instrumentName] || instrumentIcons.flute;
}

/**
 * Get icon as data URI for CSS background-image
 * @param {string} instrumentName - Instrument name
 * @param {string} color - Stroke color (default: #1D1D1F)
 * @returns {string} Data URI
 */
export function getInstrumentIconDataURI(instrumentName, color = '#1D1D1F') {
  const svg = instrumentIcons[instrumentName] || instrumentIcons.flute;
  const coloredSvg = svg.replace(/currentColor/g, color);
  const encoded = encodeURIComponent(coloredSvg.trim());
  return `data:image/svg+xml,${encoded}`;
}

/**
 * All available instrument names
 */
export const availableInstruments = Object.keys(instrumentIcons);

export default instrumentIcons;
