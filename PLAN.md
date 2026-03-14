# Mogwser Browser — Implementation Plan

## Overview

Mogwser is an original Firefox fork that achieves feature parity with Zen Browser. The implementation follows the Ghostery/Surfer pattern: minimal Firefox patches, modular ES module subsystems, and a build tool orchestration layer. All feature code is original — Zen's public documentation and test suites may be referenced for behavioral guidance, but no code is copied.

## Architecture Decision: Build Tool Approach

**Decision**: Use Gluon (the maintained upstream of Surfer) as the Firefox fork build orchestrator.

**Rationale**: Gluon provides the exact tooling needed — Firefox source downloading, patch management (import/export), branding configuration, and cross-platform build commands. It's MIT-licensed, npm-installable, and the proven foundation for both Pulse Browser and (via its Surfer fork) Zen Browser. This avoids reinventing a complex build system.

**Sources**:
- [Gluon — Build Firefox Forks with Ease](https://github.com/pulse-browser/gluon)
- [Ghostery's Lightweight Fork Approach](https://sammacbeth.eu/building-a-firefox-fork)
- [Firefox Source Docs — Build Configuration](https://firefox-source-docs.mozilla.org/setup/configuring_build_options.html)

## Architecture Decision: Modular ES Module Subsystems

**Decision**: Implement each feature as an independent ES module (`.mjs`) loaded via Firefox's chrome:// protocol, packaged as JAR entries in `browser/components/mogwser/`.

**Rationale**: This is the same pattern used by Zen Browser's 15+ subsystems. ES modules loaded at chrome privilege level have full access to XPCOM services, `Services.prefs`, `SessionStore`, and the DOM of `browser.xhtml`. This provides maximum integration capability while keeping Mogwser code cleanly separated from Firefox source.

**Sources**:
- [Zen Browser Code Structure](https://docs.zen-browser.app/contribute/desktop/code-structure-and-prefs)
- [Zen Browser Architecture (DeepWiki)](https://deepwiki.com/zen-browser/desktop)

## Architecture Decision: Patching Strategy

**Decision**: Apply minimal, targeted patches to three Firefox core files — `tabbrowser.js`, `tabs.js`, and `SessionStore.sys.mjs` — plus the `browser.xhtml` entry point. All other functionality is implemented as standalone modules.

**Rationale**: Ghostery's experience shows that minimal patching reduces upgrade friction dramatically. The three files above are the minimum needed for workspace-aware tab management and session persistence. The `browser.xhtml` patch simply loads our chrome shell overlay.

**Sources**:
- [Ghostery Fork Architecture](https://sammacbeth.eu/building-a-firefox-fork)
- [Zen Browser Critical Patches](https://deepwiki.com/zen-browser/desktop)

## Architecture Decision: Dual Storage for Session State

**Decision**: Use Firefox's native `sessionstore.jsonlz4` for tab/history state and a separate `mogwser-sessions.jsonlz4` for workspace metadata, split-view layouts, and folder hierarchies.

**Rationale**: This cleanly separates concerns — Firefox's session restore handles tab URLs, history, and scroll positions while Mogwser's file handles workspace assignments, split-view tree structures, and theme per-workspace. This also means Firefox upgrades don't risk corrupting Mogwser state.

**Source**: [Zen Browser Dual Storage Architecture](https://deepwiki.com/zen-browser/desktop)

---

## Project Structure

```
mogwser/
├── .gluon/                      # Gluon build tool configuration
├── branding/                    # Mogwser branding assets (icons, logos, names)
│   └── mogwser/
│       ├── configure.sh
│       ├── branding.nsi
│       └── *.png / *.ico
├── patches/                     # Git-format patches applied to Firefox source
│   ├── browser-xhtml.patch      # Load Mogwser chrome shell
│   ├── tabbrowser-js.patch      # Workspace-aware addTab/removeTab
│   ├── tabs-js.patch            # Custom allTabs getter, drag-drop
│   └── sessionstore.patch       # Persist Mogwser metadata
├── src/
│   └── mogwser/
│       ├── shell/               # Custom browser chrome/UI shell
│       │   ├── MogwserShell.mjs
│       │   ├── mogwser-shell.css
│       │   └── mogwser-shell.xhtml
│       ├── tabs/                # Vertical sidebar tab bar
│       │   ├── MogwserTabBar.mjs
│       │   ├── MogwserTabDragDrop.mjs
│       │   └── mogwser-tabs.css
│       ├── workspaces/          # Workspace/tab-group system
│       │   ├── MogwserWorkspaces.mjs
│       │   ├── MogwserWorkspaceStorage.mjs
│       │   └── mogwser-workspaces.css
│       ├── splitview/           # Split-view browsing
│       │   ├── MogwserSplitView.mjs
│       │   ├── SplitViewTree.mjs
│       │   └── mogwser-splitview.css
│       ├── compact/             # Compact/expanded UI modes
│       │   ├── MogwserCompactMode.mjs
│       │   └── mogwser-compact.css
│       ├── sidepanel/           # Web side-panels
│       │   ├── MogwserSidePanel.mjs
│       │   └── mogwser-sidepanel.css
│       ├── themes/              # Custom theme engine
│       │   ├── MogwserThemeEngine.mjs
│       │   ├── MogwserGradientPicker.mjs
│       │   └── mogwser-themes.css
│       └── privacy/             # Privacy/security tooling UI
│           ├── MogwserPrivacyPanel.mjs
│           └── mogwser-privacy.css
├── prefs/                       # Default preference YAML files
│   └── mogwser.yaml
├── tests/                       # Automated tests
│   ├── browser/                 # Mochitest browser chrome tests
│   └── unit/                    # xpcshell unit tests
├── mozconfigs/                  # Platform-specific mozconfig files
│   ├── linux-x86_64
│   ├── macos-x86_64
│   ├── macos-aarch64
│   └── windows-x86_64
├── ci/                          # CI pipeline configuration
│   └── .github/workflows/
│       └── build.yml
├── docs/                        # Build instructions
│   └── BUILDING.md
├── gluon.json                   # Gluon project configuration
└── package.json                 # npm scripts for build orchestration
```

## Feature Modules

### 1. Build System & Branding (Foundation)
- Gluon project initialization with `gluon.json`
- Custom branding directory (`branding/mogwser/`) with icons, app name, identifiers
- Platform-specific `mozconfigs/` for Linux, macOS (x86_64 + aarch64), Windows
- npm scripts: `init`, `build`, `build:ui`, `start`, `package`
- GitHub Actions CI: download Firefox source → apply patches → build → test → package
- Documented build instructions in `docs/BUILDING.md`

### 2. Custom Browser Chrome Shell
- Overlay `browser.xhtml` to inject Mogwser's sidebar-based layout
- Replace default horizontal tab bar with vertical sidebar chrome
- Layout: `[sidebar | content-area]` with resizable splitter
- Shell manages initialization of all Mogwser subsystems via `MogwserShell.mjs`
- CSS variables for theming integration at `:root` level

### 3. Vertical Sidebar Tab Bar
- Custom `<mogwser-tabbar>` XUL/HTML element in sidebar
- Renders tab list vertically with favicon, title, close button
- Drag-to-reorder via HTML5 Drag and Drop API with `moveTabTo()` integration
- Pin tabs (pinned section at top of sidebar)
- Mute/unmute via audio indicator button
- Close tab via button or middle-click
- Tab context menu (pin, mute, close, move to workspace, duplicate)
- Compact favicon-only mode when sidebar is collapsed

### 4. Workspace System
- `MogwserWorkspaces.mjs` singleton managing workspace CRUD
- Each workspace: `{ id, name, icon, theme, tabs[] }`
- Workspace switcher UI in sidebar (dropdown or horizontal strip)
- Tab visibility filtering: only show tabs belonging to active workspace
- Essential/pinned tabs optionally visible across all workspaces
- Persistent state in `mogwser-sessions.jsonlz4`
- Restore workspace assignments on session restore
- Keyboard shortcuts for workspace switching (Ctrl+1..9)

### 5. Split-View Browsing
- Binary tree data structure for panel layout (`SplitViewTree.mjs`)
  - Leaf nodes: individual tabs
  - Internal nodes: split direction (row/column) with children
- `MogwserSplitView.mjs` manages split groups (2-4 tabs per group)
- Panel positioning via CSS `inset` property (absolute positioning within container)
- Resizable splitter handles between panels (mouse drag, min 7% width)
- Create splits via: context menu, keyboard shortcut, or drag-to-edge
- Remove tab from split: collapses tree, redistributes space
- Session persistence of split layout tree

### 6. Compact/Expanded UI Modes
- `MogwserCompactMode.mjs` toggles between two states:
  - **Expanded**: Full sidebar with tab titles, workspace switcher, toolbar
  - **Compact**: Thin sidebar (favicon-only), auto-expand on hover
- Toolbar auto-hide in compact mode with hover-triggered reveal
- CSS transitions for smooth mode switching
- Preference-backed state persistence
- Keyboard shortcut toggle (Ctrl+Shift+C)

### 7. Web Side-Panels
- `MogwserSidePanel.mjs` manages a secondary browser frame in sidebar
- Load arbitrary URLs in persistent sidebar panel
- Panel appears alongside (not replacing) the main content area
- Resize handle between side-panel and content
- Panel state persists across navigation and tab switches
- Quick-access panel picker (bookmarks-like list of pinned panel URLs)

### 8. Theme Engine
- `MogwserThemeEngine.mjs` manages global and per-workspace themes
- CSS custom properties for all themeable values (colors, border-radius, etc.)
- Gradient-based themes using HSL color wheel picker
- Color harmony algorithms (complementary, analogous, triadic, split-complementary)
- Light/dark mode integration with `prefers-color-scheme`
- Theme export/import as JSON files
- User-installable themes directory with JSON manifest format
- Double-buffer CSS technique for smooth theme transitions

### 9. Privacy/Security Tooling
- `MogwserPrivacyPanel.mjs` provides a unified privacy dashboard
- Toggle switches for:
  - Enhanced Tracking Protection (leverages Firefox's built-in `privacy.trackingprotection.*` prefs)
  - Cookie management (first-party isolation, third-party cookie blocking)
  - Fingerprint resistance (`privacy.resistFingerprinting`)
  - HTTPS-Only mode
- Visual indicator in toolbar showing current protection level
- Per-site exception management
- All toggles write to Firefox's native preference system

---

## Scope Assessment

This is an **extremely large** task encompassing:
- Firefox fork build infrastructure
- 8 distinct feature modules
- Cross-platform CI pipeline
- Automated test suite

**Execution mode: `parallel`** with 4 agents:

1. **Agent 0 — Build System & Shell**: Gluon setup, branding, mozconfigs, CI pipeline, browser chrome shell, build documentation
2. **Agent 1 — Tab Management**: Vertical tab bar, workspace system, session persistence patches
3. **Agent 2 — Advanced UI**: Split-view, compact/expanded modes, web side-panels
4. **Agent 3 — Themes & Privacy**: Theme engine, gradient picker, privacy panel

**Integration task**: Merge all sub-branches, resolve conflicts in shared files (`browser.xhtml`, `mogwser-shell.xhtml`, CSS variables), run full test suite.

---

## Key Interfaces Between Modules

### Shared State
- `gMogwserWorkspaces` global singleton — all modules can query active workspace
- `gMogwserThemeEngine` global singleton — modules read CSS variable values
- Firefox `Services.prefs` — all persistent preferences

### Events (CustomEvent on `document`)
- `MogwserWorkspaceChanged` — fired when user switches workspace
- `MogwserThemeChanged` — fired when theme is applied
- `MogwserCompactModeChanged` — fired when UI mode toggles
- `MogwserSplitViewChanged` — fired when split layout changes

### CSS Variables (set on `:root`)
- `--mogwser-sidebar-width`
- `--mogwser-primary-color`, `--mogwser-secondary-color`, `--mogwser-accent-color`
- `--mogwser-compact-mode` (0 or 1)
- `--mogwser-bg-opacity`

### File Ownership
- `browser.xhtml` patch: owned by Agent 0, loads shell
- `tabbrowser-js.patch`: owned by Agent 1
- `tabs-js.patch`: owned by Agent 1
- `sessionstore.patch`: owned by Agent 1
- `mogwser-shell.xhtml`: Agent 0 creates skeleton, others add their UI sections via well-defined insertion points (`<!-- mogwser-tabs-slot -->`, `<!-- mogwser-splitview-slot -->`, etc.)

---

## Test Strategy

- **Mochitest browser chrome tests**: For UI features (tab bar interactions, workspace switching, split-view creation/resize, compact mode toggle, theme application)
- **xpcshell unit tests**: For pure logic (SplitViewTree operations, workspace storage serialization, theme color calculations)
- **CI integration**: Tests run after build in GitHub Actions, using `./mach test` with Mogwser test paths

---

## Dependencies

- **Gluon** (`gluon-build@next`): npm package, build orchestrator
- **Firefox ESR or Stable**: Base browser source (downloaded by Gluon)
- **Node.js 21+**: For Gluon and npm scripts
- **Python 3**: For Firefox build system (mach)
- **Rust/Cargo**: Required by Firefox build
- **sccache**: Build caching for faster rebuilds

No new runtime dependencies are introduced — all features use Firefox's built-in APIs (XPCOM, Services, SessionStore, CustomizableUI).

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Firefox source download (>1 GB) in CI | Use caching, shallow clone, sccache |
| Build takes 1-3 hours | Incremental builds (`build:ui`), PGO only for release |
| Patch conflicts on Firefox upgrades | Minimal patches, clear patch boundaries |
| Complex split-view tree state | Thorough unit tests for tree operations |
| Theme engine color math edge cases | Unit tests for HSL conversion, harmony algorithms |
