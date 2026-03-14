/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserShell — Top-level browser chrome shell.
 * Initializes all Mogwser subsystems in dependency order.
 */

const { MogwserThemeEngine } = ChromeUtils.importESModule(
  "chrome://mogwser/content/themes/MogwserThemeEngine.mjs"
);
const { MogwserTabBar } = ChromeUtils.importESModule(
  "chrome://mogwser/content/tabs/MogwserTabBar.mjs"
);
const { MogwserWorkspaces } = ChromeUtils.importESModule(
  "chrome://mogwser/content/workspaces/MogwserWorkspaces.mjs"
);
const { MogwserSplitView } = ChromeUtils.importESModule(
  "chrome://mogwser/content/splitview/MogwserSplitView.mjs"
);
const { MogwserCompactMode } = ChromeUtils.importESModule(
  "chrome://mogwser/content/compact/MogwserCompactMode.mjs"
);
const { MogwserSidePanel } = ChromeUtils.importESModule(
  "chrome://mogwser/content/sidepanel/MogwserSidePanel.mjs"
);
const { MogwserPrivacyPanel } = ChromeUtils.importESModule(
  "chrome://mogwser/content/privacy/MogwserPrivacyPanel.mjs"
);

export class MogwserShell {
  static _initialized = false;

  /**
   * Initialize all Mogwser subsystems in dependency order.
   * Called after browser.xhtml loads.
   */
  static async init() {
    if (MogwserShell._initialized) {
      return;
    }

    try {
      // 1. Theme engine first (others depend on CSS variables)
      window.gMogwserThemeEngine = MogwserThemeEngine;
      await MogwserThemeEngine.init();

      // 2. Tab bar (needs to exist before workspaces populate it)
      window.gMogwserTabBar = MogwserTabBar;
      await MogwserTabBar.init();

      // 3. Workspaces (assigns tabs to workspaces, triggers theme per workspace)
      window.gMogwserWorkspaces = MogwserWorkspaces;
      await MogwserWorkspaces.init();

      // 4. Split view (needs tabs and workspaces ready)
      window.gMogwserSplitView = MogwserSplitView;
      await MogwserSplitView.init();

      // 5. Compact mode (visual layer, can init independently)
      window.gMogwserCompactMode = MogwserCompactMode;
      await MogwserCompactMode.init();

      // 6. Side panel (independent sidebar feature)
      window.gMogwserSidePanel = MogwserSidePanel;
      await MogwserSidePanel.init();

      // 7. Privacy panel (independent toolbar feature)
      window.gMogwserPrivacyPanel = MogwserPrivacyPanel;
      await MogwserPrivacyPanel.init();

      MogwserShell._initialized = true;
      console.log("MogwserShell: All modules initialized successfully");
    } catch (e) {
      console.error("MogwserShell: Initialization failed:", e);
    }
  }

  static get initialized() {
    return MogwserShell._initialized;
  }
}

// Auto-initialize when the shell loads
if (document.readyState === "complete") {
  MogwserShell.init();
} else {
  document.addEventListener("DOMContentLoaded", () => MogwserShell.init(), { once: true });
}

window.gMogwserShell = MogwserShell;
