/**
 * @fileoverview Liquid Visualizer - High-performance Pitch Visualization
 * Renders a glowing, fluid line chart representing pitch history in real-time.
 * Optimized for 60fps rendering using requestAnimationFrame.
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
            historySize: 300, // Number of points to keep
            lineColor: '#60A5FA', // Blue-400
            glowColor: '#3B82F6', // Blue-500
            lineWidth: 3,
            gridColor: 'rgba(255, 255, 255, 0.05)',
            textColor: 'rgba(255, 255, 255, 0.4)',
            ...config
        };

        // State
        this.points = []; // Ring buffer for drawing { y, confidence, timestamp }
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
        this._loop();
    }

    /**
     * Push new pitch data into the visualizer
     * @param {Object} pitchFrame 
     */
    update(pitchFrame) {
        if (!this.isRunning) return;

        const { frequency, confidence } = pitchFrame;
        
        // Convert Freq to Y position (normalized 0-1)
        // Y = 1 means bottom (low pitch), Y = 0 means top (high pitch)
        let normalizedY = 0.5; // Default to center if silent
        let valid = false;

        if (frequency && confidence > 0.1) {
            const midi = 69 + 12 * Math.log2(frequency / 440);
            // Map MIDI range to 0-1 (inverted for Canvas)
            normalizedY = 1 - (midi - this.config.minMidi) / (this.config.maxMidi - this.config.minMidi);
            normalizedY = Math.max(0, Math.min(1, normalizedY)); // Clamp
            valid = true;
        }

        // Push to buffer
        this.points.push({
            y: normalizedY,
            valid: valid,
            confidence: confidence
        });

        // Keep buffer size constant
        if (this.points.length > this.config.historySize) {
            this.points.shift();
        }
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
        // Instead of clearRect, we fill with semi-transparent bg to create trails if desired
        // But for a clean look, clearRect is better.
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
        // x = width corresponds to points[points.length-1]
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
                    // Use midpoint between current and previous for smoother curves
                    const prevPoint = points[i - 1];
                    if (prevPoint && prevPoint.valid) {
                        const xc = (x + (i - 1) * stepX) / 2;
                        const yc = (y + prevPoint.y * height) / 2;
                        ctx.quadraticCurveTo(xc, yc, x, y);
                    } else {
                        ctx.moveTo(x, y); // Jump over gap
                    }
                }
            } else {
                hasStarted = false; // Break line on silence
            }
        }
        ctx.stroke();

        // Reset shadow for other elements
        ctx.shadowBlur = 0;

        // 4. Draw Current Note Indicator (Right side)
        const lastPoint = points[points.length - 1];
        if (lastPoint && lastPoint.valid) {
            const y = lastPoint.y * height;
            
            // Pulsing Dot
            ctx.beginPath();
            ctx.fillStyle = '#FFFFFF';
            ctx.arc(width - 10, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow ring
            ctx.beginPath();
            ctx.fillStyle = `rgba(96, 165, 250, ${lastPoint.confidence})`; // Opacity based on confidence
            ctx.arc(width - 10, y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawGrid(ctx, width, height) {
        ctx.lineWidth = 1;
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = this.config.textColor;
        
        // C notes
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        for (let midi = this.config.minMidi; midi <= this.config.maxMidi; midi++) {
            // Only draw C notes lines
            if (midi % 12 === 0) {
                const normalizedY = 1 - (midi - this.config.minMidi) / (this.config.maxMidi - this.config.minMidi);
                const y = normalizedY * height;
                
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();

                // Label
                const octave = Math.floor(midi / 12) - 1;
                ctx.fillText(`C${octave}`, 5, y - 4);
            }
        }
    }

    destroy() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}