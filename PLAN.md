# Mogwser Browser — Implementation Plan (Revised)

## Overview

Mogwser is an original Firefox fork achieving feature parity with Zen Browser. The codebase already has a substantial implementation from prior iterations, including all 8 feature modules, 4 Firefox patches, build infrastructure, CI pipeline, automated tests, branding, and documentation. This revised plan addresses gaps, inconsistencies, and missing acceptance criteria discovered during audit.

## Current State Assessment

### What Exists (Implemented)
- **Build System**: Gluon config, 4 platform mozconfigs, GitHub Actions CI, npm scripts, docs/BUILDING.md
- **Branding**: configure.sh, branding.nsi, content/, locales/, pref/
- **Browser Chrome Shell**: MogwserShell.mjs (init orchestrator), mogwser-shell.xhtml (sidebar layout with slots), mogwser-shell.css (:root CSS variables)
- **Vertical Tab Bar**: MogwserTabBar.mjs (525 lines — full tab rendering, pinned sections, context menu, middle-click close, audio mute), MogwserTabDragDrop.mjs (310 lines — HTML5 DnD with boundary enforcement)
- **Workspace System**: MogwserWorkspaces.mjs (640 lines — CRUD, switching, tab filtering, keyboard shortcuts, session restore), MogwserWorkspaceStorage.mjs (197 lines — LZ4 compressed JSON persistence)
- **Split-View**: MogwserSplitView.mjs (533 lines — group management, resize handles, persistence), SplitViewTree.mjs (199 lines — binary tree, serialize/deserialize, position calculation)
- **Compact Mode**: MogwserCompactMode.mjs (198 lines — toggle, hover-expand, keyboard shortcut)
- **Web Side-Panel**: MogwserSidePanel.mjs (368 lines — URL loading, resize, picker, persistence)
- **Theme Engine**: MogwserThemeEngine.mjs (466 lines — CSS variable injection, dark mode, per-workspace themes, install/export), MogwserGradientPicker.mjs (567 lines — HSL wheel, 5 harmony algorithms, gradient builder)
- **Privacy Panel**: MogwserPrivacyPanel.mjs (614 lines — toolbar button, 5 toggles, protection levels, per-site exceptions)
- **Patches**: browser-xhtml.patch, tabbrowser-js.patch, tabs-js.patch, sessionstore.patch
- **Tests**: 8 browser chrome tests, 4 xpcshell unit tests, TOML manifests
- **CSS**: 1,491 lines across 8 CSS files including shell
- **Preferences**: 27 prefs in mogwser.yaml

### Gaps and Issues Found

1. **Event target inconsistency**: sessionstore.patch dispatches `MogwserSessionRestored` on `document`, but MogwserWorkspaces listens on `window`. MogwserSplitView also listens on `window`. These must be unified — all custom events should target `window` (consistent with how `MogwserWorkspaceChanged` and `MogwserThemeChanged` work).

2. **Workspace storage tests** test JSON.parse/stringify instead of actually exercising MogwserWorkspaceStorage.load/save. This is because IOUtils/Services aren't available in pure unit tests. The tests should be restructured or annotated to clarify they test the data model.

3. **MogwserSplitView._persistGroups()** attempts `window.gMogwserWorkspaces.storage.set()` but MogwserWorkspaces doesn't expose a `.storage` property. Should use MogwserWorkspaceStorage directly.

4. **Missing `rgbToHsl` roundtrip test**: The color conversion test file only tests hslToRgb, not the reverse direction.

5. **prefs/mogwser.yaml** has 27 preferences, but the plan calls for 30+. Missing: mogwser.sidebar.collapsed-width, mogwser.splitview.handle-size, mogwser.theme.transition-duration.

6. **Side panel uses `<iframe>` instead of `<browser>`**: For proper chrome-privileged browsing in Firefox, a `<xul:browser>` element is more appropriate. The current iframe approach may work but isn't optimal.

7. **Workspace rename uses `Services.prompt.prompt` with wrong signature**: The method returns boolean (OK/Cancel) and mutates the `{value}` object in place — the current code checks the return as if it's the new string.

## Architecture Decisions

### Build Tool: Gluon (Maintained)
**Rationale**: Already configured and working. Gluon handles Firefox source download, patch management, and cross-platform builds.

**Sources**:
- [Gluon — Build Firefox Forks with Ease](https://github.com/pulse-browser/gluon)
- [Firefox Source Docs — Build Configuration](https://firefox-source-docs.mozilla.org/setup/configuring_build_options.html)

### Modular ES Module Subsystems (Maintained)
**Rationale**: Each feature is an independent `.mjs` file loaded via `chrome://` protocol. This mirrors Zen Browser's 15+ subsystem architecture.

**Sources**:
- [Zen Browser Code Structure](https://docs.zen-browser.app/contribute/desktop/code-structure-and-prefs)
- [Zen Browser Architecture (DeepWiki)](https://deepwiki.com/zen-browser/desktop)

### Minimal Patching Strategy (Maintained)
**Rationale**: 4 targeted patches to `browser.xhtml`, `tabbrowser.js`, `tabs.js`, and `SessionStore.sys.mjs`. All other functionality in standalone modules.

**Sources**:
- [Ghostery Fork Architecture](https://sammacbeth.eu/building-a-firefox-fork)

### Dual Storage (Maintained)
`sessionstore.jsonlz4` for Firefox tab state + `mogwser-sessions.jsonlz4` for Mogwser metadata.

**Source**: [Zen Browser Dual Storage Architecture](https://deepwiki.com/zen-browser/desktop)

## Project Structure

```
mogwser/
├── branding/mogwser/         # Branding assets (icons, names, installer config)
├── ci/.github/workflows/     # GitHub Actions CI pipeline
│   └── build.yml
├── docs/                     # Build documentation
│   └── BUILDING.md
├── mozconfigs/               # Platform-specific mozconfig files (4 platforms)
├── patches/                  # Firefox source patches (4 files)
├── prefs/                    # Default preferences
│   └── mogwser.yaml
├── src/mogwser/
│   ├── shell/                # Browser chrome shell (3 files)
│   ├── tabs/                 # Vertical tab bar (3 files)
│   ├── workspaces/           # Workspace system (3 files)
│   ├── splitview/            # Split-view browsing (3 files)
│   ├── compact/              # Compact/expanded modes (2 files)
│   ├── sidepanel/            # Web side-panels (2 files)
│   ├── themes/               # Theme engine (3 files)
│   └── privacy/              # Privacy panel (2 files)
├── tests/
│   ├── browser/              # 8 Mochitest browser chrome tests
│   └── unit/                 # 4 xpcshell unit tests
├── gluon.json
├── package.json
├── PLAN.md
└── tasks.json
```

## Key Interfaces Between Modules

### Global Singletons (set on `window`)
- `gMogwserShell` — shell orchestrator
- `gMogwserThemeEngine` — theme management
- `gMogwserTabBar` — vertical tab bar
- `gMogwserWorkspaces` — workspace system
- `gMogwserSplitView` — split-view manager
- `gMogwserCompactMode` — compact/expanded toggle
- `gMogwserSidePanel` — web side-panels
- `gMogwserPrivacyPanel` — privacy dashboard

### Custom Events (dispatched on `window`)
- `MogwserWorkspaceChanged` — workspace switch
- `MogwserThemeChanged` — theme applied
- `MogwserCompactModeChanged` — UI mode toggle
- `MogwserSplitViewChanged` — split layout change
- `MogwserSessionRestored` — session restore complete

### CSS Variables (`:root`)
- `--mogwser-sidebar-width`, `--mogwser-sidebar-collapsed-width`
- `--mogwser-primary-color`, `--mogwser-secondary-color`, `--mogwser-accent-color`
- `--mogwser-bg-color`, `--mogwser-bg-opacity`, `--mogwser-gradient`
- `--mogwser-compact-mode`, `--mogwser-transition-speed`
- `--mogwser-text-primary`, `--mogwser-text-secondary`
- `--mogwser-border-color`, `--mogwser-border-radius`

## Scope Assessment

**Execution mode: `parallel`** with 4 agents:

1. **Agent 0 — Build System & Shell**: Fix event target consistency in sessionstore.patch, add missing prefs to mogwser.yaml, verify branding completeness, ensure CI workflow handles all platforms correctly
2. **Agent 1 — Tab Management**: Fix workspace rename prompt API, fix split-view storage integration path, improve workspace storage test coverage, ensure tab-workspace assignment is robust
3. **Agent 2 — Advanced UI**: Fix MogwserSplitView._persistGroups to use MogwserWorkspaceStorage directly, improve compact mode CSS transitions, enhance side-panel browser element type
4. **Agent 3 — Themes & Privacy**: Add rgbToHsl roundtrip tests, verify all 5 harmony algorithms work correctly, improve privacy panel toggle UX, add theme transition CSS

**Integration task**: Unify event targets, verify cross-module event names match, consolidate all prefs, ensure all test files parse correctly, verify module init ordering.

## Test Strategy

- **8 Mochitest browser chrome tests**: Shell init, tabs, workspaces, split-view, compact mode, side-panel, themes, privacy
- **4 xpcshell unit tests**: Workspace storage serialization, split-view tree operations, theme color math, theme import/export
- All tests registered in `browser.toml` and `xpcshell.toml` manifests
- CI runs tests via `npm test` → `./mach test testing/mogwser/`

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Event target mismatch between patches and modules | Standardize all events on `window`; audit in integration |
| IOUtils not available in xpcshell tests | Test data model separately, annotate tests |
| Side-panel iframe vs browser element | Fallback approach works; document limitation |
| Workspace rename prompt API mismatch | Fix to use `{value}` object pattern correctly |
| Firefox source download in CI (~1 GB) | Use caching, sccache for compilation cache |
| Build takes 1-3 hours per platform | Incremental builds, PGO only for release |
