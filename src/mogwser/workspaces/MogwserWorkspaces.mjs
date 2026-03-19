/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserWorkspaces — Workspace CRUD and switching.
 *
 * Manages a set of named workspaces. Each tab is assigned to exactly one
 * workspace via the `mogwser-workspace-id` attribute. Switching workspaces
 * hides non-matching tabs and fires `MogwserWorkspaceChanged`.
 *
 * Essential tabs (those with `mogwser-essential` attribute) and pinned tabs
 * are never hidden.
 */

const { MogwserWorkspaceStorage } = ChromeUtils.importESModule(
  "chrome://mogwser/content/workspaces/MogwserWorkspaceStorage.mjs"
);

export class MogwserWorkspaces {
  static _initialized = false;

  /**
   * Map<string, WorkspaceData> — workspace id -> workspace object
   * WorkspaceData: { id: string, name: string, icon: string, theme: string|null, isDefault: boolean }
   */
  static _workspaces = new Map();

  /** Currently active workspace id */
  static _activeWorkspaceId = null;

  /** Reference to the workspace switcher container */
  static _container = null;

  /** Counter for generating unique workspace ids */
  static _nextId = 1;

  /**
   * Initialize the workspace system.
   * Loads persisted state, creates a default workspace if none exist,
   * and renders the switcher UI.
   */
  static async init() {
    if (MogwserWorkspaces._initialized) {
      return;
    }

    MogwserWorkspaces._container = document.getElementById(
      "mogwser-workspace-container"
    );
    if (!MogwserWorkspaces._container) {
      console.error(
        "MogwserWorkspaces: #mogwser-workspace-container not found"
      );
      return;
    }

    // Load persisted workspaces
    const stored = await MogwserWorkspaceStorage.load();
    if (stored && stored.workspaces && stored.workspaces.length > 0) {
      for (const ws of stored.workspaces) {
        MogwserWorkspaces._workspaces.set(ws.id, ws);
        const idNum = parseInt(ws.id.replace("ws-", ""), 10);
        if (!isNaN(idNum) && idNum >= MogwserWorkspaces._nextId) {
          MogwserWorkspaces._nextId = idNum + 1;
        }
      }

      // Restore tab assignments
      MogwserWorkspaces._restoreTabAssignments(stored.tabAssignments);

      // Activate the first default workspace, or the first one
      const defaultWs = Array.from(
        MogwserWorkspaces._workspaces.values()
      ).find((ws) => ws.isDefault);
      MogwserWorkspaces._activeWorkspaceId = defaultWs
        ? defaultWs.id
        : MogwserWorkspaces._workspaces.keys().next().value;
    } else {
      // Create default workspace
      MogwserWorkspaces._createDefaultWorkspace();
    }

    // Assign any unassigned tabs to the active workspace
    MogwserWorkspaces._assignUnassignedTabs();

    // Render switcher UI
    MogwserWorkspaces._renderSwitcher();

    // Apply visibility
    MogwserWorkspaces._applyTabVisibility();

    // Listen for new tabs
    gBrowser.tabContainer.addEventListener("TabOpen", MogwserWorkspaces);

    // Listen for session restore
    window.addEventListener(
      "MogwserSessionRestored",
      MogwserWorkspaces._onSessionRestored
    );

    // Save on shutdown
    window.addEventListener("unload", () => {
      MogwserWorkspaces._saveState();
    });

    // Set up keyboard shortcuts
    MogwserWorkspaces._setupKeyboardShortcuts();

    MogwserWorkspaces._initialized = true;
    console.log("MogwserWorkspaces: Initialized");
  }

  /**
   * EventListener interface.
   */
  static handleEvent(event) {
    switch (event.type) {
      case "TabOpen":
        MogwserWorkspaces._onTabOpen(event);
        break;
    }
  }

  // ─── Workspace CRUD ────────────────────────────────────────────────

  /**
   * Create a new workspace.
   * @param {string} name — display name
   * @param {string} [icon=""] — emoji or icon identifier
   * @returns {object} the created workspace
   */
  static createWorkspace(name, icon = "") {
    const id = `ws-${MogwserWorkspaces._nextId++}`;
    const workspace = {
      id,
      name,
      icon,
      theme: null,
      isDefault: false,
    };

    MogwserWorkspaces._workspaces.set(id, workspace);
    MogwserWorkspaces._renderSwitcher();
    MogwserWorkspaces._saveState();

    return workspace;
  }

  /**
   * Delete a workspace. Tabs in this workspace are moved to the default workspace.
   * Cannot delete the last workspace.
   * @param {string} id — workspace id
   */
  static deleteWorkspace(id) {
    if (MogwserWorkspaces._workspaces.size <= 1) {
      console.warn("MogwserWorkspaces: Cannot delete the last workspace");
      return;
    }

    const ws = MogwserWorkspaces._workspaces.get(id);
    if (!ws) {
      return;
    }

    // Find fallback workspace
    const fallback = MogwserWorkspaces._getFallbackWorkspace(id);

    // Move tabs to fallback
    for (const tab of gBrowser.tabs) {
      if (tab.getAttribute("mogwser-workspace-id") === id) {
        tab.setAttribute("mogwser-workspace-id", fallback.id);
      }
    }

    MogwserWorkspaces._workspaces.delete(id);

    // If this was the active workspace, switch to fallback
    if (MogwserWorkspaces._activeWorkspaceId === id) {
      MogwserWorkspaces.switchWorkspace(fallback.id);
    }

    MogwserWorkspaces._renderSwitcher();
    MogwserWorkspaces._saveState();
  }

  /**
   * Rename a workspace.
   * @param {string} id — workspace id
   * @param {string} name — new name
   */
  static renameWorkspace(id, name) {
    const ws = MogwserWorkspaces._workspaces.get(id);
    if (!ws) {
      return;
    }

    ws.name = name;
    MogwserWorkspaces._renderSwitcher();
    MogwserWorkspaces._saveState();
  }

  /**
   * Get all workspaces as an array.
   * @returns {Array<object>}
   */
  static getAllWorkspaces() {
    return Array.from(MogwserWorkspaces._workspaces.values());
  }

  /**
   * Get a workspace by id.
   * @param {string} id
   * @returns {object|undefined}
   */
  static getWorkspace(id) {
    return MogwserWorkspaces._workspaces.get(id);
  }

  /**
   * Get the currently active workspace id.
   */
  static get activeWorkspaceId() {
    return MogwserWorkspaces._activeWorkspaceId;
  }

  // ─── Workspace Switching ───────────────────────────────────────────

  /**
   * Switch to a workspace. Hides non-matching tabs and fires event.
   * @param {string} id — workspace id to activate
   */
  static switchWorkspace(id) {
    if (!MogwserWorkspaces._workspaces.has(id)) {
      console.warn(`MogwserWorkspaces: Unknown workspace id "${id}"`);
      return;
    }

    const previousId = MogwserWorkspaces._activeWorkspaceId;
    MogwserWorkspaces._activeWorkspaceId = id;

    MogwserWorkspaces._applyTabVisibility();
    MogwserWorkspaces._renderSwitcher();

    // Select a visible tab if the current tab is hidden
    const selectedTab = gBrowser.selectedTab;
    if (selectedTab && selectedTab.hidden) {
      const visibleTab = gBrowser.tabs.find(
        (t) =>
          !t.hidden &&
          !t.closing
      );
      if (visibleTab) {
        gBrowser.selectedTab = visibleTab;
      }
    }

    // Fire workspace changed event
    window.dispatchEvent(
      new CustomEvent("MogwserWorkspaceChanged", {
        detail: {
          workspaceId: id,
          previousWorkspaceId: previousId,
          workspace: MogwserWorkspaces._workspaces.get(id),
        },
      })
    );

    MogwserWorkspaces._saveState();
  }

  // ─── Tab Assignment ────────────────────────────────────────────────

  /**
   * Assign a tab to a workspace.
   * @param {BrowserTab} tab
   * @param {string} workspaceId
   */
  static assignTabToWorkspace(tab, workspaceId) {
    if (!MogwserWorkspaces._workspaces.has(workspaceId)) {
      console.warn(
        `MogwserWorkspaces: Unknown workspace id "${workspaceId}"`
      );
      return;
    }

    tab.setAttribute("mogwser-workspace-id", workspaceId);
    MogwserWorkspaces._applyTabVisibility();
    MogwserWorkspaces._saveState();
  }

  // ─── Tab Visibility ────────────────────────────────────────────────

  /**
   * Apply tab visibility based on the active workspace.
   * Essential tabs and pinned tabs are always visible.
   */
  static _applyTabVisibility() {
    const activeId = MogwserWorkspaces._activeWorkspaceId;

    for (const tab of gBrowser.tabs) {
      const tabWsId = tab.getAttribute("mogwser-workspace-id");
      const isEssential = tab.hasAttribute("mogwser-essential");
      const isPinned = tab.pinned;

      if (isEssential || isPinned || tabWsId === activeId) {
        gBrowser.showTab(tab);
      } else {
        gBrowser.hideTab(tab);
      }
    }
  }

  // ─── Switcher UI ───────────────────────────────────────────────────

  /**
   * Render the workspace switcher UI inside #mogwser-workspace-container.
   */
  static _renderSwitcher() {
    const container = MogwserWorkspaces._container;
    if (!container) {
      return;
    }

    // Clear existing content
    container.textContent = "";

    const switcher = document.createElement("div");
    switcher.className = "mogwser-workspaces__switcher";

    // Render workspace buttons
    for (const ws of MogwserWorkspaces._workspaces.values()) {
      const btn = document.createElement("button");
      btn.className = "mogwser-workspaces__btn";
      if (ws.id === MogwserWorkspaces._activeWorkspaceId) {
        btn.classList.add("mogwser-workspaces__btn--active");
      }
      btn.title = ws.name;

      const icon = document.createElement("span");
      icon.className = "mogwser-workspaces__btn-icon";
      icon.textContent = ws.icon || ws.name.charAt(0).toUpperCase();
      btn.appendChild(icon);

      const label = document.createElement("span");
      label.className = "mogwser-workspaces__btn-label";
      label.textContent = ws.name;
      btn.appendChild(label);

      // Tab count badge
      const count = MogwserWorkspaces._getTabCountForWorkspace(ws.id);
      const badge = document.createElement("span");
      badge.className = "mogwser-workspaces__btn-badge";
      badge.textContent = String(count);
      btn.appendChild(badge);

      btn.addEventListener("click", () => {
        MogwserWorkspaces.switchWorkspace(ws.id);
      });

      // Right-click to rename/delete
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        MogwserWorkspaces._showWorkspaceContextMenu(ws, e.clientX, e.clientY);
      });

      switcher.appendChild(btn);
    }

    // Add workspace button
    const addBtn = document.createElement("button");
    addBtn.className = "mogwser-workspaces__add-btn";
    addBtn.title = "New Workspace";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      const name = `Workspace ${MogwserWorkspaces._workspaces.size + 1}`;
      const ws = MogwserWorkspaces.createWorkspace(name);
      MogwserWorkspaces.switchWorkspace(ws.id);
    });
    switcher.appendChild(addBtn);

    container.appendChild(switcher);
  }

  /**
   * Show context menu for a workspace button.
   */
  static _showWorkspaceContextMenu(ws, x, y) {
    // Remove any existing context menu
    const existing = document.querySelector(".mogwser-workspaces__context-menu");
    if (existing) {
      existing.remove();
    }

    const menu = document.createElement("div");
    menu.className = "mogwser-workspaces__context-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Rename
    const renameItem = document.createElement("div");
    renameItem.className = "mogwser-workspaces__context-menu-item";
    renameItem.textContent = "Rename";
    renameItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.remove();
      MogwserWorkspaces._promptRename(ws);
    });
    menu.appendChild(renameItem);

    // Delete (only if more than one workspace)
    if (MogwserWorkspaces._workspaces.size > 1) {
      const deleteItem = document.createElement("div");
      deleteItem.className = "mogwser-workspaces__context-menu-item mogwser-workspaces__context-menu-item--danger";
      deleteItem.textContent = "Delete";
      deleteItem.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.remove();
        MogwserWorkspaces.deleteWorkspace(ws.id);
      });
      menu.appendChild(deleteItem);
    }

    document.body.appendChild(menu);

    // Dismiss on click outside
    const dismiss = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", dismiss);
      }
    };
    // Delay to avoid immediate dismiss from the same click
    requestAnimationFrame(() => {
      document.addEventListener("click", dismiss);
    });
  }

  /**
   * Prompt to rename a workspace using a simple inline editor.
   */
  static _promptRename(ws) {
    // Services.prompt.prompt returns true if OK was clicked.
    // The entered value is read from the {value} object passed as 3rd arg.
    const result = { value: ws.name };
    let ok = false;
    try {
      ok = Services.prompt.prompt(
        window,
        "Rename Workspace",
        "Enter new name:",
        result,
        null,
        {}
      );
    } catch (e) {
      // Fallback for non-browser contexts
      const fallback = window.prompt?.("Enter new workspace name:", ws.name);
      if (fallback && fallback.trim()) {
        MogwserWorkspaces.renameWorkspace(ws.id, fallback.trim());
      }
      return;
    }

    if (ok && result.value && result.value.trim()) {
      MogwserWorkspaces.renameWorkspace(ws.id, result.value.trim());
    }
  }

  // ─── Keyboard Shortcuts ────────────────────────────────────────────

  /**
   * Set up Ctrl+1..9 keyboard shortcuts for workspace switching.
   */
  static _setupKeyboardShortcuts() {
    document.addEventListener("keydown", MogwserWorkspaces._onKeyDown);
  }

  static _onKeyDown = (event) => {
    // Ctrl+1..9 (not Cmd on macOS — we use ctrlKey for consistency)
    if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return;
    }

    const digit = parseInt(event.key, 10);
    if (isNaN(digit) || digit < 1 || digit > 9) {
      return;
    }

    const workspaces = Array.from(MogwserWorkspaces._workspaces.values());
    const index = digit - 1;

    if (index < workspaces.length) {
      event.preventDefault();
      event.stopPropagation();
      MogwserWorkspaces.switchWorkspace(workspaces[index].id);
    }
  };

  // ─── Internal Helpers ──────────────────────────────────────────────

  /**
   * Create the default workspace.
   */
  static _createDefaultWorkspace() {
    const id = `ws-${MogwserWorkspaces._nextId++}`;
    const workspace = {
      id,
      name: "Default",
      icon: "",
      theme: null,
      isDefault: true,
    };
    MogwserWorkspaces._workspaces.set(id, workspace);
    MogwserWorkspaces._activeWorkspaceId = id;
  }

  /**
   * Restore tab-to-workspace assignments from a stored map.
   * @param {Object<string, string>} tabAssignments — syncId -> workspaceId
   */
  static _restoreTabAssignments(tabAssignments) {
    if (!tabAssignments) {
      return;
    }
    for (const tab of gBrowser.tabs) {
      const syncId = MogwserWorkspaces._getTabSyncId(tab);
      if (syncId && tabAssignments[syncId]) {
        tab.setAttribute("mogwser-workspace-id", tabAssignments[syncId]);
      }
    }
  }

  /**
   * Assign any tabs without a workspace to the active workspace.
   */
  static _assignUnassignedTabs() {
    const activeId = MogwserWorkspaces._activeWorkspaceId;
    for (const tab of gBrowser.tabs) {
      if (!tab.getAttribute("mogwser-workspace-id")) {
        tab.setAttribute("mogwser-workspace-id", activeId);
      }
    }
  }

  /**
   * Handle new tab — assign to active workspace.
   */
  static _onTabOpen(event) {
    const tab = event.target;
    if (!tab.getAttribute("mogwser-workspace-id")) {
      tab.setAttribute(
        "mogwser-workspace-id",
        MogwserWorkspaces._activeWorkspaceId
      );
    }
  }

  /**
   * Handle session restore — reassign tabs from stored data.
   */
  static _onSessionRestored = async () => {
    const stored = await MogwserWorkspaceStorage.load();
    if (!stored || !stored.tabAssignments) {
      return;
    }

    MogwserWorkspaces._restoreTabAssignments(stored.tabAssignments);
    MogwserWorkspaces._assignUnassignedTabs();
    MogwserWorkspaces._applyTabVisibility();
    MogwserWorkspaces._renderSwitcher();
  };

  /**
   * Get a stable identifier for a tab (for session persistence).
   * Uses the tab's linkedBrowser's permanentKey, or falls back to
   * the current URI.
   */
  static _getTabSyncId(tab) {
    if (tab.linkedBrowser && tab.linkedBrowser.permanentKey) {
      // permanentKey is a unique object; use its string representation
      // as a stable-ish identifier within a session
      return String(tab.linkedBrowser.permanentKey);
    }
    // Fallback: use tab index (not ideal but works within a single session)
    return `tab-index-${Array.prototype.indexOf.call(gBrowser.tabs, tab)}`;
  }

  /**
   * Get the tab count for a workspace.
   */
  static _getTabCountForWorkspace(workspaceId) {
    let count = 0;
    for (const tab of gBrowser.tabs) {
      if (tab.getAttribute("mogwser-workspace-id") === workspaceId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get a fallback workspace (default, or the first one that isn't `excludeId`).
   */
  static _getFallbackWorkspace(excludeId) {
    // Try default first
    for (const ws of MogwserWorkspaces._workspaces.values()) {
      if (ws.id !== excludeId && ws.isDefault) {
        return ws;
      }
    }
    // Otherwise first available
    for (const ws of MogwserWorkspaces._workspaces.values()) {
      if (ws.id !== excludeId) {
        return ws;
      }
    }
    return null;
  }

  /**
   * Save current state to storage.
   */
  static _saveState() {
    const workspaces = Array.from(MogwserWorkspaces._workspaces.values());

    const tabAssignments = {};
    for (const tab of gBrowser.tabs) {
      const syncId = MogwserWorkspaces._getTabSyncId(tab);
      const wsId = tab.getAttribute("mogwser-workspace-id");
      if (syncId && wsId) {
        tabAssignments[syncId] = wsId;
      }
    }

    MogwserWorkspaceStorage.save({
      workspaces,
      tabAssignments,
    });
  }
}
