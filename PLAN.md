# Mogwser Browser — Implementation Plan (Final)

## Overview

Mogwser is an original Firefox fork achieving feature parity with Zen Browser. The codebase has a complete implementation from prior iterations covering all 8 feature modules (shell, tabs, workspaces, split-view, compact mode, side-panel, themes, privacy), 4 Firefox patches, build infrastructure, CI pipeline, automated tests, branding, and documentation.

This plan addresses the remaining gaps to reach full acceptance criteria compliance.

## Current State Assessment

### Verified Working (from code audit)

1. **Build System**: gluon.json, 4 platform mozconfigs, GitHub Actions CI, npm scripts, docs/BUILDING.md — all complete
2. **Browser Chrome Shell**: MogwserShell.mjs initializes 7 modules in correct dependency order (ThemeEngine → TabBar → Workspaces → SplitView → CompactMode → SidePanel → PrivacyPanel)
3. **Vertical Tab Bar**: MogwserTabBar.mjs (525 lines) with full rendering, pinned sections, context menu, audio mute, middle-click close; MogwserTabDragDrop.mjs (310 lines) with boundary enforcement
4. **Workspace System**: MogwserWorkspaces.mjs (640 lines) with CRUD, switching, keyboard shortcuts (Ctrl+1..9), tab filtering, session restore; MogwserWorkspaceStorage.mjs (197 lines) with LZ4 persistence
5. **Split-View**: MogwserSplitView.mjs (533 lines) correctly imports MogwserWorkspaceStorage directly; SplitViewTree.mjs (199 lines) with binary tree layout
6. **Compact Mode**: MogwserCompactMode.mjs (198 lines) with toggle, hover-expand, Ctrl+Shift+C
7. **Web Side-Panel**: MogwserSidePanel.mjs (368 lines) with URL loading, resize, picker, Ctrl+Shift+P
8. **Theme Engine**: MogwserThemeEngine.mjs (466 lines) with CSS variable injection, dark/light mode, per-workspace themes, double-buffer transitions; MogwserGradientPicker.mjs (567 lines) with 5 harmony algorithms
9. **Privacy Panel**: MogwserPrivacyPanel.mjs (614 lines) with toolbar button, 5 toggles, protection levels, per-site exceptions
10. **Patches**: All 4 patches correct — sessionstore.patch dispatches on `window`
11. **Event targets**: All custom events dispatch on `window` (verified)
12. **Prompt API**: Both workspace rename and privacy exception prompts use correct `{value}` object pattern
13. **Test manifests**: browser.toml lists 8 files, xpcshell.toml lists 4 files
14. **Preferences**: 31 prefs in mogwser.yaml (need 3 more for complete coverage)

### Remaining Gaps

#### Missing Preferences (3)
- `mogwser.sidebar.collapsed-width` (int, 48) — referenced by compact mode but not declared
- `mogwser.splitview.handle-size` (int, 6) — referenced by split-view but not declared
- `mogwser.tabs.show-close-button` (bool, true) — implied by tab bar feature but not declared

#### Missing Tests (5 test functions)
1. **rgbToHsl roundtrip test** — test_theme_colors.js only tests hslToRgb, not reverse direction
2. **hslToHex non-primary color test** — only tests pure red (#ff0000), needs e.g. cyan or orange
3. **Workspace keyboard shortcut test** — no test verifies Ctrl+1..9 switching
4. **Split-view resize handle minimum test** — no test verifies 7% minimum panel size enforcement
5. **Privacy protection level change test** — no test verifies toggling prefs changes protection level

## Architecture (Unchanged)

### Module Dependency Order
```
ThemeEngine → TabBar → Workspaces → SplitView → CompactMode → SidePanel → PrivacyPanel
```

### Global Singletons (on `window`)
- `gMogwserShell`, `gMogwserThemeEngine`, `gMogwserTabBar`, `gMogwserWorkspaces`
- `gMogwserSplitView`, `gMogwserCompactMode`, `gMogwserSidePanel`, `gMogwserPrivacyPanel`

### Custom Events (on `window`)
- `MogwserSessionRestored`, `MogwserWorkspaceChanged`, `MogwserThemeChanged`
- `MogwserCompactModeChanged`, `MogwserSplitViewChanged`

### Storage
- Firefox: `sessionstore.jsonlz4` (tab state)
- Mogwser: `mogwser-sessions.jsonlz4` (workspaces, tab assignments, split groups)

## Scope Assessment

**Execution mode: `parallel`** with 4 agents. The remaining work is small per-agent but spans all 4 domains:

1. **Agent 0 — Build System & Shell**: Add 3 missing prefs to mogwser.yaml, verify all branding/CI/build files
2. **Agent 1 — Tab Management**: Add workspace keyboard shortcut test, verify tab context menu completeness
3. **Agent 2 — Advanced UI**: Add split-view resize handle minimum test, verify compact mode and side-panel
4. **Agent 3 — Themes & Privacy**: Add rgbToHsl roundtrip test, hslToHex non-primary test, privacy protection level test

**Integration task**: Verify all prefs count ≥ 34, all tests parse correctly, cross-module consistency.

## Sources

- [Gluon Build Tool](https://github.com/pulse-browser/gluon) — Firefox fork build system
- [Firefox Source Docs — Build Configuration](https://firefox-source-docs.mozilla.org/setup/configuring_build_options.html)
- [Zen Browser Code Structure](https://docs.zen-browser.app/contribute/desktop/code-structure-and-prefs)
- [Zen Browser Architecture (DeepWiki)](https://deepwiki.com/zen-browser/desktop)
- [Ghostery Fork Architecture](https://sammacbeth.eu/building-a-firefox-fork)

## Risk Assessment

| Risk | Status |
|------|--------|
| Event target mismatch | **Fixed** — all events on `window` |
| Storage import in SplitView | **Fixed** — imports MogwserWorkspaceStorage directly |
| Prompt API misuse | **Fixed** — both prompts use `{value}` object pattern |
| Missing prefs | **Open** — 3 prefs need to be added |
| Missing test coverage | **Open** — 5 test functions need to be added |
