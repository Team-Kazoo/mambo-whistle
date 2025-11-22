# Documentation Index

Documentation for Mambo Whistle - Real-time neural vocal synthesis engine.

## Quick Links

| I want to... | See |
|--------------|-----|
| **Quick start for new sessions** | [sessions/QUICK_REFERENCE.md](sessions/QUICK_REFERENCE.md) |
| **Understand design principles** | [../.claude.md](../.claude.md) (root) |
| **Configure audio system** | [guides/configuration.md](guides/configuration.md) |
| **Troubleshoot issues** | [guides/troubleshooting.md](guides/troubleshooting.md) |
| **Understand architecture** | [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) |
| **Optimize latency** | [LATENCY_OPTIMIZATION.md](LATENCY_OPTIMIZATION.md) |
| **Explore future tech** | [research/FUTURE_TECHNOLOGIES.md](research/FUTURE_TECHNOLOGIES.md) |

## Directory Structure

```
docs/
├── README.md                      # This file
├── ARCHITECTURE_OVERVIEW.md       # System architecture details
├── LATENCY_OPTIMIZATION.md        # Performance optimization guide
├── guides/
│   ├── configuration.md           # Audio system configuration
│   └── troubleshooting.md         # Common issues and solutions
├── research/
│   └── FUTURE_TECHNOLOGIES.md     # Neural audio & hardware roadmap
└── sessions/                      # Session summaries
    ├── QUICK_REFERENCE.md         # Quick start guide for new sessions
    ├── REFACTOR_SUMMARY.md        # Architecture refactor decisions
    └── SESSION_SUMMARY.md         # Device selection bug fixes
```

## Document Descriptions

### Core Documentation

- **[../.claude.md](../.claude.md)** - Design principles and best practices (read by Claude Code every session)
- **ARCHITECTURE_OVERVIEW.md** - System components, data flow, and design decisions
- **LATENCY_OPTIMIZATION.md** - Latency reduction strategies (Target: <60ms, Current: ~50-60ms)

### User Guides

- **guides/configuration.md** - How to configure the audio system
- **guides/troubleshooting.md** - Common problems and solutions

### Research & Future

- **research/FUTURE_TECHNOLOGIES.md** - Neural audio synthesis & embedded hardware roadmap

### Session Summaries

- **sessions/QUICK_REFERENCE.md** - Quick start guide for new sessions
- **sessions/REFACTOR_SUMMARY.md** - Architecture refactor decisions and lessons learned
- **sessions/SESSION_SUMMARY.md** - Device selection bug fixes (2025-11-22)

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
4. Follow the project's documentation standards (see [.claude.md](../.claude.md))

---

**Last Updated**: 2025-11-22
**Documentation Version**: v1.0.0
