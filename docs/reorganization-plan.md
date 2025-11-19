# Project File Reorganization Plan

**Date**: 2025-11-17
**Purpose**: Clean up project structure following Kazoo development standards
**Principle**: Code > Docs, delete redundant files, organize logically

---

## Current Issues Identified

### 1. Root Directory Clutter
**Problems**:
- `README copy.md` - Duplicate file
- `debug-check.html` - Test file in root
- Multiple markdown files (should be max 3)

### 2. CSS Redundancy
**Problems**:
- `css/styles.old.css` - Old version
- `css/styles.backup.css` - Backup version
- Only `css/styles.css` should exist

### 3. Dist Folder
**Problems**:
- `dist/` folder exists (build artifacts)
- Should be in `.gitignore` and deleted from repo

### 4. Documentation Overload
**Current docs/ structure**:
- 6 files total
- Acceptable per CLAUDE.md standards
- Keep essential, remove redundant

### 5. .specify Folder
**Not examined yet** - Need to check contents

---

## Reorganization Actions

### Phase 1: Root Directory Cleanup

#### DELETE (Redundant/Obsolete)
- [ ] `README copy.md` - Duplicate of README.md
- [ ] `debug-check.html` - Move to tests/ or delete
- [ ] `dist/` - Build artifacts (regenerate when needed)

#### KEEP (Essential - max 3)
- [x] `README.md` - User guide
- [x] `PROJECT_STATUS.md` - Current state
- [x] `CLAUDE.md` - AI agent guide

#### EVALUATE
- [ ] `CURRENT_STATE_ANALYSIS.md` - Move to docs/ or keep (decision needed)

### Phase 2: CSS Cleanup

#### DELETE
- [ ] `css/styles.old.css` - Old version
- [ ] `css/styles.backup.css` - Backup version

#### KEEP
- [x] `css/styles.css` - Current styles

### Phase 3: Documentation Organization

#### Keep in docs/
- [x] `docs/CLEANUP_PLAN.md` - Historical reference
- [x] `docs/CLEANUP_SUMMARY.md` - Historical reference
- [x] `docs/guides/troubleshooting.md` - User guide
- [x] `docs/guides/configuration.md` - User guide

#### Move or Delete
- [ ] `docs/README.md` - Check if redundant with root README.md
- [ ] `docs/v0.3.0-plan.md` - Move to .specify/ or delete

### Phase 4: Test Files Organization

#### Current: tests/
- [x] `tests/unit/` - Unit tests (keep)
- [x] `tests/BROWSER_SMOKE_TEST.md` - Test guide (keep)
- [x] `tests/run-all-tests.js` - Test runner (keep)

#### Move to tests/
- [ ] `debug-check.html` (if keeping) → `tests/debug-check.html`

### Phase 5: .claude/ Organization

#### Current structure is GOOD
- [x] `.claude/skills/` - 12 skills
- [x] `.claude/commands/` - 8 speckit commands
- [x] `.claude/WORKFLOW_SETUP.md` - Workflow guide
- [x] `.claude/QUICK_START_GUIDE.md` - Quick reference
- [x] `.claude/INSTALLATION_CHECKLIST.md` - Installation guide

**No changes needed**

### Phase 6: .specify/ Organization

**Need to examine** - Check for:
- Redundant files
- Old session notes
- Duplicate documentation

---

## Proposed Final Structure

```
kazoo-proto-web/
├── index.html                          # Main app
├── README.md                           # User guide (< 300 lines)
├── PROJECT_STATUS.md                   # Current state (< 250 lines)
├── CLAUDE.md                           # AI guide (< 200 lines)
├── package.json
├── package-lock.json
├── vercel.json
├── vitest.config.js
├── .gitignore
├── .gitattributes
│
├── css/
│   └── styles.css                      # Current styles only
│
├── js/
│   ├── main.js
│   ├── audio-io.js
│   ├── pitch-detector.js
│   ├── pitch-worklet.js
│   ├── continuous-synth.js
│   ├── synthesizer.js
│   ├── performance.js
│   ├── expressive-features.js
│   ├── audio-config.js
│   ├── audio-input.js
│   ├── calibration.js
│   ├── core/
│   │   └── app-container.js
│   ├── config/
│   │   ├── app-config.js
│   │   ├── constants.js
│   │   ├── instrument-presets.js
│   │   └── README.md
│   ├── features/
│   │   ├── onset-detector.js
│   │   ├── smoothing-filters.js
│   │   └── spectral-features.js
│   ├── managers/
│   │   └── ui-manager.js
│   ├── types/
│   │   └── pitch-frame.js
│   ├── utils/
│   │   ├── audio-utils.js
│   │   └── logger.js
│   └── lib/
│       ├── tone.js
│       └── pitchfinder-browser.js
│
├── tests/
│   ├── unit/
│   │   ├── app-container.test.js
│   │   ├── audio-io.test.js
│   │   └── pitch-detector.test.js
│   ├── BROWSER_SMOKE_TEST.md
│   ├── run-all-tests.js
│   └── debug-check.html               # Moved from root
│
├── docs/
│   ├── CLEANUP_PLAN.md                # Historical
│   ├── CLEANUP_SUMMARY.md             # Historical
│   ├── CURRENT_STATE_ANALYSIS.md      # Moved from root
│   └── guides/
│       ├── troubleshooting.md
│       └── configuration.md
│
├── .claude/
│   ├── WORKFLOW_SETUP.md
│   ├── QUICK_START_GUIDE.md
│   ├── INSTALLATION_CHECKLIST.md
│   ├── settings.local.json
│   ├── commands/
│   │   └── speckit.*.md
│   └── skills/
│       └── */SKILL.md
│
└── .specify/
    ├── memory/
    │   └── constitution.md
    ├── templates/
    │   └── *.md
    ├── scripts/
    │   └── bash/*.sh
    └── specs/
        └── 001-ui-modernization/
            ├── spec.md
            ├── plan.md
            ├── tasks.md
            ├── progress.md
            └── research.md
```

---

## Files to DELETE

### Confirmed Deletions
1. `README copy.md` - Duplicate
2. `css/styles.old.css` - Old version
3. `css/styles.backup.css` - Backup version
4. `dist/` - Build artifacts
5. `docs/v0.3.0-plan.md` - Redundant (info in .specify/)

### To Evaluate
1. `debug-check.html` - Move to tests/ or delete
2. `docs/README.md` - Check if redundant
3. `.specify/specs/001-ui-modernization/SESSION_HANDOVER.md` - Old session notes
4. `.specify/specs/001-ui-modernization/LATENCY_ANALYSIS.md` - Merge into main docs
5. `.specify/specs/001-ui-modernization/USER_TESTING_NEEDED.md` - Old checklist
6. `.specify/specs/001-ui-modernization/RESUME_HERE.md` - Old session notes

---

## Files to MOVE

1. `CURRENT_STATE_ANALYSIS.md` → `docs/CURRENT_STATE_ANALYSIS.md`
2. `debug-check.html` → `tests/debug-check.html`

---

## Implementation Steps

1. **Backup current state** (create git tag)
2. **Delete redundant files** (CSS backups, README copy, dist/)
3. **Move files** (CURRENT_STATE_ANALYSIS, debug-check)
4. **Clean .specify/** (remove old session notes)
5. **Update .gitignore** (add dist/)
6. **Commit changes** with clear message
7. **Update documentation** to reflect new structure

---

## Safety Checks Before Deletion

- [ ] All tests passing (`npm test`)
- [ ] Create git tag: `git tag pre-reorganization`
- [ ] Verify no uncommitted changes
- [ ] Backup important files if uncertain
- [ ] Can rollback: `git reset --hard pre-reorganization`

---

## Next Actions

1. Review this plan
2. Get user confirmation
3. Execute reorganization
4. Update documentation references
5. Commit with message: "refactor: Reorganize project structure, remove redundant files"
