<!--
Sync Impact Report:
Version: 1.0.0 (Initial)
Ratification Date: 2025-11-12
Modified Principles: N/A (Initial creation)
Added Sections: Core Principles, Technical Constraints, Development Workflow, Governance
Removed Sections: N/A
Templates Requiring Updates: All templates will reference this constitution
Follow-up TODOs: None
-->

# Kazoo Proto Web UI Modernization Constitution

## Core Principles

### I. Performance First (NON-NEGOTIABLE)
Any UI modification MUST NOT degrade audio processing performance. The audio pipeline is the heart of this application and takes absolute priority over visual enhancements.

**Rules:**
- Audio end-to-end latency MUST remain ≤ 180ms (current baseline)
- Audio latency target is < 90ms for v0.3.0
- UI rendering MUST execute on separate thread from audio processing
- New CSS/JS additions MUST NOT exceed 50KB gzipped
- Performance measurements MUST be taken before and after UI changes
- If latency increases, changes MUST be reverted immediately

**Rationale:** Real-time audio applications are latency-critical. Users will tolerate basic UI but will abandon the app if audio feels laggy.

### II. Gradual Enhancement (Progressive)
Preserve 100% of existing functionality while incrementally improving visual presentation. Big-bang rewrites are prohibited.

**Rules:**
- All existing features MUST remain functional during and after UI updates
- Changes MUST be reversible (easy rollback)
- Prioritize visual layer modifications over structural refactoring
- Audio core modules (audio-io.js, pitch-detector.js, synthesizer.js, etc.) are READ-ONLY
- New UI components MUST integrate via existing UIManager event system

**Rationale:** The application already works. Risk of breaking core functionality outweighs benefits of radical redesign.

### III. Simplicity Over Sophistication
Minimize complexity. Avoid heavyweight frameworks and build tools unless absolutely necessary.

**Rules:**
- NO React, Vue, Angular, Svelte, or similar frameworks
- MUST maintain native JavaScript + ES Modules architecture
- Use Tailwind CSS for styling (utility-first, no preprocessors)
- NO bundlers initially (Vite/Webpack deferred to future phase)
- Prefer copying minimal code over installing large dependencies
- Select lightweight animation components only (< 10KB per component)
- **CRITICAL**: When migrating CSS to Tailwind, DELETE old CSS rules immediately in the SAME commit
- **NO ZOMBIE CODE**: Every line of replaced CSS MUST be removed, not left "for reference"
- **VERIFY BEFORE COMMIT**: Test all implementations in browser, never assume classes work

**Rationale:** Adding framework overhead contradicts performance-first principle and complicates deployment. Serve-based workflow is simple and fast. Zombie code is technical debt that compounds over time.

### IV. Accessibility by Design
Music creation tools must be inclusive. Keyboard navigation and screen reader support are mandatory.

**Rules:**
- All interactive controls MUST be keyboard-navigable
- Focus states MUST be visually distinct (visible outline/ring)
- Color contrast MUST meet WCAG 2.1 AA standard (4.5:1 for text)
- Semantic HTML MUST be used (button, nav, section, etc.)
- Audio feedback controls MUST have descriptive labels (aria-label/aria-describedby)

**Rationale:** Musicians may have disabilities. Accessibility is both ethical and legally prudent.

### V. Modular Architecture
UI components MUST be decoupled from audio processing logic. Loose coupling enables independent testing and maintenance.

**Rules:**
- UI updates MUST use UIManager event-driven system (no direct DOM manipulation from audio modules)
- CSS classes MUST be scoped (Tailwind utilities or component-specific classes)
- Shared state MUST go through AppContainer DI system
- Each UI component MUST be independently testable
- No global CSS that affects audio module rendering

**Rationale:** Modular design prevents cascading failures and allows UI iteration without audio regression risk.

### VI. Visual Appeal with Restraint
Enhance aesthetics to make the app feel modern and professional, but avoid gratuitous animation or "over-design" that distracts from the core audio experience.

**Rules:**
- Use modern gradients, shadows, and subtle animations for polish
- Instrument selection MUST use interactive cards with hover effects
- Audio visualizations MAY use glow/neon effects (toggle-able if performance impact)
- Animation MUST be purposeful (feedback, state transitions), not decorative
- Design language MUST reflect professional music software (not game-like or cartoonish)

**Rationale:** The app is a music tool first, a visual showcase second. Over-animation can harm perceived performance.

### VII. Rapid Delivery
Ship incremental improvements quickly. Avoid analysis paralysis and perfectionism.

**Rules:**
- Target delivery: 3-5 days for core UI modernization
- Prioritize high-impact, user-visible changes first
- Document decisions inline (no excessive planning docs)
- Ship working code over polished documentation
- Optimize after launch, not before (measure, then improve)

**Rationale:** Perfect is the enemy of good. User feedback on a shipped product is more valuable than theoretical perfection.

## Technical Constraints

### Technology Stack
- **Core Language:** Native JavaScript (ES Modules)
- **CSS Framework:** Tailwind CSS 3.x (CDN or PostCSS)
- **Animation Library:** Aceternity UI components (selective, < 3 components)
- **Component Library:** shadcn/ui patterns (adapted to vanilla JS)
- **Build Tool:** None initially (npx serve), Vite deferred to Phase 2
- **Testing:** Vitest (existing, extend to UI components)
- **Audio Libraries:** Tone.js, pitchfinder (DO NOT MODIFY)

### Dependency Rules
- New dependencies MUST be justified and approved
- CDN delivery preferred over npm for CSS (faster iteration)
- Total added dependencies MUST be < 5 packages
- No polyfills unless Safari/Firefox compatibility breaks

### Browser Support
- Chrome/Edge 90+ (primary target)
- Firefox 88+
- Safari 14+
- No IE11 support required

## Development Workflow

### Phase-Based Approach
**Phase 1: Foundation (Day 1-2)**
- Integrate Tailwind CSS via CDN
- Convert existing HTML to use Tailwind utility classes
- Preserve all existing functionality

**Phase 2: Component Enhancement (Day 2-3)**
- Redesign instrument selection cards
- Enhance main control buttons (pulse effect)
- Improve status bar visibility (gradients, icons)

**Phase 3: Visualization Polish (Day 3-4)**
- Add animated current note display
- Enhance pitch curve with gradients
- Optional: Add frequency spectrum analyzer (performance-gated)

**Phase 4: Testing & Optimization (Day 4-5)**
- Verify audio latency unchanged
- Test keyboard navigation
- Lighthouse accessibility audit
- Mobile responsiveness check

### Commit Strategy
- One logical change per commit
- Descriptive commit messages (imperative mood: "Add Tailwind", "Refactor instrument cards")
- Run tests before committing (`npm test` must pass)
- Tag releases: v0.3.1-ui-modernization
- **CRITICAL PRE-COMMIT CHECKLIST**:
  1. Did I delete old CSS that was replaced by Tailwind? (No zombie code)
  2. Did I test the implementation in a browser? (No "pray it works" commits)
  3. Did I complete ALL subtasks in the task description? (No partial implementations)
  4. Did I document any deferred work clearly in commit message? (Honest disclosure)

### Testing Requirements
- Vitest tests MUST pass before merging
- Manual testing: Audio latency measurement (`window.app.getLatencyStats()`)
- Visual regression testing (screenshot comparison, manual)
- Accessibility testing (keyboard-only navigation, screen reader spot check)

### Performance Gates
- Audio latency MUST NOT increase by > 10ms
- Lighthouse Performance score MUST be ≥ 90
- Total page weight MUST be < 500KB (excluding audio libraries)
- First Contentful Paint (FCP) MUST be < 1.5s

## Governance

### Constitution Authority
This constitution supersedes all other development practices, documentation, and conventions for the UI modernization feature. All code reviews and merge decisions MUST reference these principles.

### Amendment Process
1. Propose amendment with rationale (GitHub issue or inline comment)
2. Discuss trade-offs with stakeholders
3. Update constitution with new version number (semantic versioning)
4. Increment MINOR version for new principles, PATCH for clarifications

### Compliance Verification
- Every pull request MUST include a compliance checklist referencing relevant principles
- Reviewers MUST verify adherence to Performance First, Simplicity, and Accessibility principles
- Violations MUST be justified in writing or rejected

### Conflict Resolution
If two principles conflict (e.g., Visual Appeal vs. Performance), the following priority order applies:
1. Performance First
2. Gradual Enhancement
3. Simplicity
4. Accessibility
5. Modular Architecture
6. Visual Appeal
7. Rapid Delivery

**Version**: 1.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12
