# Technical Report Figures

This directory contains MATLAB scripts for generating publication-quality figures for the Mambo Whistle Technical Report.

## Directory Structure

```
figures/
├── scripts/           # MATLAB source files
│   ├── figure1_pitch_detection_comparison.m
│   ├── figure5_yin_algorithm_visualization.m
│   └── figure7_latency_breakdown.m
├── output/            # Generated figures (PNG, PDF, EPS)
└── README.md
```

## Figure Descriptions

### Figure 1: Pitch Detection Algorithm Comparison
- **Type**: Scatter plot with logarithmic x-axis
- **Content**: Compares pitch detection algorithms across accuracy, latency, and computational cost
- **Key Feature**: Highlights YIN algorithm's optimal position for browser-based real-time processing
- **Data Points**: YIN, Autocorrelation, CREPE, FCPE, OneBitPitch, PYIN, SWIPE

### Figure 5: YIN Algorithm Visualization
- **Type**: Four-panel vertical arrangement
- **Content**: Step-by-step visualization of YIN pitch detection
- **Panels**:
  - (a) Input waveform with periodic structure
  - (b) Squared Difference Function
  - (c) Cumulative Mean Normalized Difference with threshold
  - (d) Parabolic interpolation detail with refined estimate

### Figure 7: Latency Breakdown
- **Type**: Stacked horizontal bar chart
- **Content**: Pipeline stage latency contributions
- **Key Feature**: Shows thread boundary between AudioWorklet and Main thread
- **Comparison**: AudioWorklet vs ScriptProcessor performance

## Style Guidelines

All figures follow these specifications:
- **Font**: Times New Roman
- **Color Palette**: Google brand colors
  - Blue: #4285F4 (rgb: 66, 133, 244)
  - Red: #EA4335 (rgb: 234, 67, 53)
  - Yellow: #FBBC05 (rgb: 251, 188, 5)
  - Green: #34A853 (rgb: 52, 168, 83)
- **Resolution**: 300 DPI for PNG
- **Export Formats**: PNG, PDF, EPS

## Usage

1. Open MATLAB
2. Navigate to the `scripts/` directory
3. Run any script:
   ```matlab
   run('figure1_pitch_detection_comparison.m')
   run('figure5_yin_algorithm_visualization.m')
   run('figure7_latency_breakdown.m')
   ```
4. Output files will be saved to `output/`

## Requirements

- MATLAB R2019b or later
- No additional toolboxes required (uses base MATLAB only)
