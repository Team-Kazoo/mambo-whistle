/**
 * @fileoverview Liquid Visualizer - High-performance Pitch Visualization
 * Renders a glowing, fluid line chart representing pitch history in real-time.
 * Optimized for 60fps rendering using requestAnimationFrame.
 * 
 * Updated: Added Full Session Export (Piano Roll Style)
 */

export class VisualizerManager {
    constructor(canvasElement, config = {}) {
        if (!canvasElement) throw new Error('VisualizerManager requires a canvas element');
        
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: true }); // Optimize for transparency
        
        // Configuration
        this.config = {
            minMidi: 36, // C2
            maxMidi: 84, // C6
            historySize: 300, // Number of points to keep for live view
            lineColor: '#60A5FA', // Blue-400
            glowColor: '#3B82F6', // Blue-500
            lineWidth: 3,
            gridColor: 'rgba(255, 255, 255, 0.05)',
            textColor: 'rgba(255, 255, 255, 0.4)',
            ...config
        };

        // Live View State (Ring Buffer)
        this.points = []; 
        
        // Session State (Full History for Export)
        this.fullSessionData = []; 
        this.startTime = 0;

        this.isRunning = false;
        this.animationId = null;
        
        // Resize Observer for responsive canvas
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement);
        
        // Initial setup
        this.resize();
    }

    init() {
        this.isRunning = true;
        this.points = [];
        this.fullSessionData = [];
        this.startTime = performance.now() / 1000;
        this._loop();
    }

    /**
     * Push new pitch data into the visualizer
     * @param {Object} pitchFrame 
     */
    update(pitchFrame) {
        if (!this.isRunning) return;

        const { frequency, confidence } = pitchFrame;
        
        // --- 1. Live View Logic (Ring Buffer) ---
        // Convert Freq to Y position (normalized 0-1)
        let normalizedY = 0.5; 
        let valid = false;
        let midi = null;

        if (frequency && confidence > 0.1) {
            midi = 69 + 12 * Math.log2(frequency / 440);
            // Map MIDI range to 0-1 (inverted for Canvas)
            normalizedY = 1 - (midi - this.config.minMidi) / (this.config.maxMidi - this.config.minMidi);
            normalizedY = Math.max(0, Math.min(1, normalizedY)); // Clamp
            valid = true;
        }

        this.points.push({
            y: normalizedY,
            valid: valid,
            confidence: confidence
        });

        if (this.points.length > this.config.historySize) {
            this.points.shift();
        }

        // --- 2. Session Recording Logic (Full History) ---
        const now = performance.now() / 1000;
        this.fullSessionData.push({
            t: now - this.startTime, // Relative time
            m: midi, // Raw MIDI value (float) or null
            c: confidence
        });
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            // Set actual canvas size to handle high-DPI screens (Retina)
            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();
            
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            
            // Scale context to match
            this.ctx.scale(dpr, dpr);
            
            // Store logical size for drawing calculations
            this.width = rect.width;
            this.height = rect.height;
        }
    }

    _loop() {
        if (!this.isRunning) return;

        this.draw();
        this.animationId = requestAnimationFrame(() => this._loop());
    }

    draw() {
        const { ctx, width, height, points } = this;
        if (!ctx || !width || !height) return;

        // 1. Clear & Fade Effect (Trail)
        ctx.clearRect(0, 0, width, height);

        // 2. Draw Grid (Background)
        this._drawGrid(ctx, width, height);

        if (points.length < 2) return;

        // 3. Draw Liquid Line
        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = this.config.lineWidth;
        
        // Glow Effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.config.glowColor;
        ctx.strokeStyle = this.config.lineColor;

        let hasStarted = false;

        // We draw from right (newest) to left (oldest)
        const stepX = width / (this.config.historySize - 1);

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const x = i * stepX;
            const y = point.y * height;

            if (point.valid) {
                if (!hasStarted) {
                    ctx.moveTo(x, y);
                    hasStarted = true;
                } else {
                    // Smooth curve (Quadratic Bezier)
                    const prevPoint = points[i - 1];
                    if (prevPoint && prevPoint.valid) {
                        const xc = (x + (i - 1) * stepX) / 2;
                        const yc = (y + prevPoint.y * height) / 2;
                        ctx.quadraticCurveTo(xc, yc, x, y);
                    } else {
                        ctx.moveTo(x, y);
                    }
                }
            } else {
                hasStarted = false;
            }
        }
        ctx.stroke();

        // Reset shadow for other elements
        ctx.shadowBlur = 0;

        // 4. Draw Current Note Indicator
        const lastPoint = points[points.length - 1];
        if (lastPoint && lastPoint.valid) {
            const y = lastPoint.y * height;
            
            ctx.beginPath();
            ctx.fillStyle = '#FFFFFF';
            ctx.arc(width - 10, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.fillStyle = `rgba(96, 165, 250, ${lastPoint.confidence})`;
            ctx.arc(width - 10, y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawGrid(ctx, width, height) {
        ctx.lineWidth = 1;
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = this.config.textColor;
        
        for (let midi = this.config.minMidi; midi <= this.config.maxMidi; midi++) {
            if (midi % 12 === 0) { // C notes
                const normalizedY = 1 - (midi - this.config.minMidi) / (this.config.maxMidi - this.config.minMidi);
                const y = normalizedY * height;
                
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();

                const octave = Math.floor(midi / 12) - 1;
                ctx.fillText(`C${octave}`, 5, y - 4);
            }
        }
    }

    /**
     * Export the full session as a high-resolution Piano Roll image
     */
    exportSessionImage() {
        if (this.fullSessionData.length === 0) {
            alert("No data to export. Start the engine and make some noise first!");
            return;
        }

        console.log(`[Visualizer] Exporting session: ${this.fullSessionData.length} points`);

        // 1. Configure Export Dimensions
        const duration = this.fullSessionData[this.fullSessionData.length - 1].t;
        const width = Math.max(1200, Math.ceil(duration * 50)); // 50 pixels per second
        const height = 1080;
        const keyHeight = 15;

        // 2. Create Offscreen Canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const ctx = offCanvas.getContext('2d');

        // 3. Draw Background (Dark)
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);

        // 4. Draw Piano Roll Grid (Black/White Keys)
        // Auto-center the pitch range
        let sumMidi = 0, count = 0;
        this.fullSessionData.forEach(p => { if(p.m) { sumMidi += p.m; count++; }});
        const avgMidi = count > 0 ? sumMidi / count : 60; // Default C4
        const centerY = height / 2;

        // Draw Grid Rows
        const visibleKeysHalf = (height / 2) / keyHeight;
        const minVisMidi = Math.floor(avgMidi - visibleKeysHalf);
        const maxVisMidi = Math.ceil(avgMidi + visibleKeysHalf);

        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'middle';

        for (let m = minVisMidi; m <= maxVisMidi; m++) {
            const y = centerY + (avgMidi - m) * keyHeight;
            const isWhite = [0, 2, 4, 5, 7, 9, 11].includes(m % 12);
            
            // Row Background
            ctx.fillStyle = isWhite ? '#1E1E1E' : '#121212';
            ctx.fillRect(0, y - keyHeight/2, width, keyHeight);

            // Octave Line
            if (m % 12 === 0) {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                
                ctx.fillStyle = '#666';
                ctx.fillText(`C${Math.floor(m/12)-1}`, 10, y);
            }
        }

        // 5. Draw Pitch Curve
        ctx.beginPath();
        ctx.strokeStyle = '#60A5FA'; // Mambo Blue
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3B82F6';

        let isDrawing = false;
        this.fullSessionData.forEach(p => {
            const x = p.t * 50; // Match width scale
            
            if (p.m !== null) {
                const y = centerY + (avgMidi - p.m) * keyHeight;
                
                if (!isDrawing) {
                    ctx.moveTo(x, y);
                    isDrawing = true;
                } else {
                    ctx.lineTo(x, y);
                }
            } else {
                isDrawing = false; // Gap on silence
            }
        });
        ctx.stroke();

        // 6. Download
        const link = document.createElement('a');
        link.download = `mambo-session-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        link.href = offCanvas.toDataURL('image/png');
        link.click();
    }

    destroy() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}