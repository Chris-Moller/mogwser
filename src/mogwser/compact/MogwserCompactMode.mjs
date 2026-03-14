/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserCompactMode — Compact/expanded sidebar toggle singleton.
 * Toggles the sidebar between a full-width expanded view and a narrow
 * icon-only compact view. In compact mode, hovering over the sidebar
 * temporarily expands it with a short leave-delay to avoid flickering.
 */

const lazy = {};
ChromeUtils.defineLazyGetter(lazy, "prefs", () =>
  Services.prefs.getBranch("mogwser.compact.")
);

const HOVER_EXPAND_DELAY = 300; // ms before collapsing again on mouse leave

export class MogwserCompactMode {
  static _initialized = false;
  static _compact = false;
  static _sidebar = null;
  static _hoverTimeout = null;
  static _hoverExpanded = false; // true when temporarily expanded via hover

  /**
   * Initialize compact mode: read persisted pref, set initial state,
   * register keyboard shortcut and hover listeners.
   */
  static async init() {
    if (MogwserCompactMode._initialized) {
      return;
    }

    MogwserCompactMode._sidebar = document.getElementById("mogwser-sidebar");

    // Read persisted preference
    let startCompact = false;
    try {
      startCompact = lazy.prefs.getBoolPref("enabled", false);
    } catch {
      // Pref not set — default to expanded
    }

    if (startCompact) {
      MogwserCompactMode.enable(/* silent */ true);
    } else {
      MogwserCompactMode.disable(/* silent */ true);
    }

    // Keyboard shortcut: Ctrl+Shift+C
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        MogwserCompactMode.toggle();
      }
    });

    // Hover-expand when compact
    MogwserCompactMode._sidebar?.addEventListener("mouseenter", () => {
      MogwserCompactMode._onMouseEnter();
    });
    MogwserCompactMode._sidebar?.addEventListener("mouseleave", () => {
      MogwserCompactMode._onMouseLeave();
    });

    MogwserCompactMode._initialized = true;
  }

  /**
   * Toggle between compact and expanded modes.
   */
  static toggle() {
    if (MogwserCompactMode._compact) {
      MogwserCompactMode.disable();
    } else {
      MogwserCompactMode.enable();
    }
  }

  /**
   * Enable compact mode.
   * @param {boolean} silent — if true, skip event and pref write (used during init)
   */
  static enable(silent = false) {
    MogwserCompactMode._compact = true;
    MogwserCompactMode._hoverExpanded = false;

    const sidebar = MogwserCompactMode._sidebar;
    if (sidebar) {
      sidebar.setAttribute("mogwser-compact", "true");
      sidebar.style.width = "";
    }

    document.documentElement.style.setProperty(
      "--mogwser-compact-mode",
      "1"
    );

    if (!silent) {
      MogwserCompactMode._persist();
      MogwserCompactMode._fireEvent();
    }
  }

  /**
   * Disable compact mode (expand sidebar).
   * @param {boolean} silent — if true, skip event and pref write (used during init)
   */
  static disable(silent = false) {
    MogwserCompactMode._compact = false;
    MogwserCompactMode._hoverExpanded = false;

    const sidebar = MogwserCompactMode._sidebar;
    if (sidebar) {
      sidebar.removeAttribute("mogwser-compact");
      sidebar.style.width = "";
    }

    document.documentElement.style.setProperty(
      "--mogwser-compact-mode",
      "0"
    );

    if (!silent) {
      MogwserCompactMode._persist();
      MogwserCompactMode._fireEvent();
    }
  }

  /**
   * Whether compact mode is currently active.
   */
  static get compact() {
    return MogwserCompactMode._compact;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Mouse enters sidebar while compact — temporarily expand.
   */
  static _onMouseEnter() {
    if (!MogwserCompactMode._compact) return;

    if (MogwserCompactMode._hoverTimeout) {
      clearTimeout(MogwserCompactMode._hoverTimeout);
      MogwserCompactMode._hoverTimeout = null;
    }

    MogwserCompactMode._hoverExpanded = true;
    const sidebar = MogwserCompactMode._sidebar;
    if (sidebar) {
      sidebar.setAttribute("mogwser-compact-hover", "true");
    }
  }

  /**
   * Mouse leaves sidebar while compact — collapse after delay.
   */
  static _onMouseLeave() {
    if (!MogwserCompactMode._compact || !MogwserCompactMode._hoverExpanded) {
      return;
    }

    MogwserCompactMode._hoverTimeout = setTimeout(() => {
      MogwserCompactMode._hoverExpanded = false;
      const sidebar = MogwserCompactMode._sidebar;
      if (sidebar) {
        sidebar.removeAttribute("mogwser-compact-hover");
      }
      MogwserCompactMode._hoverTimeout = null;
    }, HOVER_EXPAND_DELAY);
  }

  /**
   * Persist compact state to preferences.
   */
  static _persist() {
    try {
      lazy.prefs.setBoolPref("enabled", MogwserCompactMode._compact);
    } catch (e) {
      console.error("MogwserCompactMode: failed to persist pref:", e);
    }
  }

  /**
   * Fire MogwserCompactModeChanged CustomEvent.
   */
  static _fireEvent() {
    window.dispatchEvent(
      new CustomEvent("MogwserCompactModeChanged", {
        detail: { compact: MogwserCompactMode._compact },
      })
    );
  }
}
