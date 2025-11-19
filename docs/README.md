# Documentation Index

Documentation for Kazoo Proto Web v0.4.0 - Real-time voice-to-instrument system.

## Quick Links

| I want to... | See |
|--------------|-----|
| **Understand current status** | [PROJECT_STATUS.md](../PROJECT_STATUS.md) (root) |
| **Configure audio system** | [guides/configuration.md](guides/configuration.md) |
| **Troubleshoot issues** | [guides/troubleshooting.md](guides/troubleshooting.md) |
| **Understand architecture** | [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) |
| **Optimize latency** | [LATENCY_OPTIMIZATION.md](LATENCY_OPTIMIZATION.md) |

## Directory Structure

```
docs/
├── README.md                      # This file
├── ARCHITECTURE_OVERVIEW.md       # System architecture details
├── LATENCY_OPTIMIZATION.md        # Performance optimization guide
├── CLEANUP_PLAN.md                # Code cleanup roadmap
├── CLEANUP_SUMMARY.md             # What was removed and why
├── CURRENT_STATE_ANALYSIS.md      # Codebase analysis
├── REORGANIZATION_SUMMARY.md      # Past reorganization summary
├── reorganization-plan.md         # Reorganization planning
└── guides/
    ├── configuration.md           # Audio system configuration
    └── troubleshooting.md         # Common issues and solutions
```

## Document Descriptions

### Architecture & Design
- **ARCHITECTURE_OVERVIEW.md** - System components, data flow, and design decisions
- **CURRENT_STATE_ANALYSIS.md** - Codebase quality and structure analysis

### Performance
- **LATENCY_OPTIMIZATION.md** - Latency reduction strategies and measurements
  - Target: < 50ms end-to-end latency
  - Current: ~180ms (3.6x over target)

### Cleanup & Reorganization
- **CLEANUP_PLAN.md** - Systematic cleanup roadmap
- **CLEANUP_SUMMARY.md** - What was removed during cleanup
- **REORGANIZATION_SUMMARY.md** - Past reorganization details
- **reorganization-plan.md** - Planning for reorganizations

### User Guides
- **guides/configuration.md** - How to configure the audio system
- **guides/troubleshooting.md** - Common problems and solutions

## Development Workflow

### Before Making Changes
```bash
npm test                          # Ensure tests pass
npm start                         # Test in browser
```

### In Browser Console
```javascript
window.app.getLatencyStats()      # Check latency metrics
window.container.get('audioIO').mode  # Check audio mode (worklet/script-processor)
window.container.getServiceNames()    # List registered services
```

### After Making Changes
```bash
npm test                          # Verify tests still pass
npm start                         # Test changes in browser
```

## Contributing

When adding new documentation:
1. Place in appropriate location (root docs/ or docs/guides/)
2. Update this README with a link
3. Keep documents focused and concise
4. Follow the project's documentation standards (see [CLAUDE.md](../CLAUDE.md))

---

**Last Updated**: 2025-11-19
**Documentation Version**: v0.4.0
