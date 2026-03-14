/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserSplitView — Split-view manager singleton.
 * Manages split-view groups where multiple tabs are displayed side by side
 * within the content area. Uses a binary tree (SplitViewTree) to model
 * the panel layout, with draggable resize handles between panels.
 */

const { SplitViewTree, SplitLeafNode } = ChromeUtils.importESModule(
  "chrome://mogwser/content/splitview/SplitViewTree.mjs"
);

const lazy = {};
ChromeUtils.defineLazyGetter(lazy, "prefs", () =>
  Services.prefs.getBranch("mogwser.splitview.")
);

let _nextGroupId = 1;

export class MogwserSplitView {
  static _initialized = false;
  static _groups = []; // Array of { id, tree: SplitViewTree, tabIds: Set, container: Element }
  static _container = null;
  static _handleSize = 6; // px — resize handle thickness

  /**
   * Initialize split-view: set up event listeners, restore session state.
   */
  static async init() {
    if (MogwserSplitView._initialized) {
      return;
    }

    MogwserSplitView._container = document.getElementById(
      "mogwser-splitview-container"
    );

    // Listen for session restore to rebuild split groups
    window.addEventListener("MogwserSessionRestored", (e) => {
      MogwserSplitView._onSessionRestored(e.detail);
    });

    // Listen for workspace changes — may need to hide/show groups
    window.addEventListener("MogwserWorkspaceChanged", () => {
      MogwserSplitView._onWorkspaceChanged();
    });

    // Keyboard shortcut: Ctrl+Shift+S to split current tab
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        MogwserSplitView._onShortcut();
      }
    });

    // Restore persisted split groups
    MogwserSplitView._restoreFromStorage();

    MogwserSplitView._initialized = true;
  }

  /**
   * Create a new split group from two tabs.
   * @param {object} tab1 — first tab (must have .linkedBrowser)
   * @param {object} tab2 — second tab
   * @param {string} direction — 'row' or 'column'
   * @returns {object} the new group
   */
  static createSplit(tab1, tab2, direction = "row") {
    const tree = new SplitViewTree();
    const leaf1 = new SplitLeafNode(MogwserSplitView._getTabId(tab1));
    tree.root = leaf1;

    const leaf2 = tree.insertNode(leaf1, MogwserSplitView._getTabId(tab2), direction === "row" ? "right" : "bottom");

    const group = {
      id: _nextGroupId++,
      tree,
      tabIds: new Set([leaf1.tabId, leaf2.tabId]),
      container: null,
    };

    MogwserSplitView._groups.push(group);
    MogwserSplitView._renderGroup(group);
    MogwserSplitView._persistGroups();
    MogwserSplitView._fireEvent(group);

    return group;
  }

  /**
   * Add a tab to an existing split group.
   * @param {number} groupId
   * @param {object} tab
   * @param {string} side — 'left' | 'right' | 'top' | 'bottom'
   */
  static splitIntoExisting(groupId, tab, side) {
    const group = MogwserSplitView._findGroup(groupId);
    if (!group) {
      console.error("MogwserSplitView: group not found:", groupId);
      return;
    }

    const tabId = MogwserSplitView._getTabId(tab);

    // Find a leaf to split adjacent to — use the last-added leaf
    const lastTabId = [...group.tabIds].pop();
    const existingLeaf = group.tree.findLeaf(lastTabId);
    if (!existingLeaf) {
      console.error("MogwserSplitView: cannot find leaf to split into");
      return;
    }

    group.tree.insertNode(existingLeaf, tabId, side);
    group.tabIds.add(tabId);

    MogwserSplitView._renderGroup(group);
    MogwserSplitView._persistGroups();
    MogwserSplitView._fireEvent(group);
  }

  /**
   * Remove a tab from a split group. If only one tab remains, dissolve the group.
   * @param {number} groupId
   * @param {string} tabId
   */
  static removeSplit(groupId, tabId) {
    const group = MogwserSplitView._findGroup(groupId);
    if (!group) return;

    const leaf = group.tree.findLeaf(tabId);
    if (!leaf) return;

    group.tree.removeNode(leaf);
    group.tabIds.delete(tabId);

    // Restore the removed tab's browser to normal flow
    MogwserSplitView._unsplitBrowser(tabId);

    if (group.tabIds.size <= 1) {
      // Dissolve group — unsplit remaining tab
      for (const remainingId of group.tabIds) {
        MogwserSplitView._unsplitBrowser(remainingId);
      }
      MogwserSplitView._destroyGroupContainer(group);
      MogwserSplitView._groups = MogwserSplitView._groups.filter(
        g => g.id !== groupId
      );
    } else {
      MogwserSplitView._renderGroup(group);
    }

    MogwserSplitView._persistGroups();
    MogwserSplitView._fireEvent(group);
  }

  /**
   * Adjust panel sizes by moving a resize handle.
   * @param {number} groupId
   * @param {number} handleIndex — index of the handle between children
   * @param {number} delta — size change in percentage points
   */
  static resizePanel(groupId, handleIndex, delta) {
    const group = MogwserSplitView._findGroup(groupId);
    if (!group || !group.tree.root || group.tree.root.type !== "split") return;

    const children = group.tree.root.children;
    if (handleIndex < 0 || handleIndex >= children.length - 1) return;

    const minSize = MogwserSplitView._getMinPanelSize();
    const childA = children[handleIndex];
    const childB = children[handleIndex + 1];

    let newSizeA = childA.sizeInParent + delta;
    let newSizeB = childB.sizeInParent - delta;

    // Enforce minimum panel size
    if (newSizeA < minSize) {
      newSizeB -= minSize - newSizeA;
      newSizeA = minSize;
    }
    if (newSizeB < minSize) {
      newSizeA -= minSize - newSizeB;
      newSizeB = minSize;
    }

    childA.sizeInParent = newSizeA;
    childB.sizeInParent = newSizeB;

    MogwserSplitView._renderGroup(group);
    MogwserSplitView._persistGroups();
  }

  /**
   * Get all active split groups.
   */
  static get groups() {
    return MogwserSplitView._groups;
  }

  /**
   * Find the split group containing a given tab.
   * @param {string} tabId
   * @returns {object|null}
   */
  static getGroupForTab(tabId) {
    return MogwserSplitView._groups.find(g => g.tabIds.has(tabId)) || null;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  static _findGroup(groupId) {
    return MogwserSplitView._groups.find(g => g.id === groupId) || null;
  }

  static _getTabId(tab) {
    // Support both raw tab objects (with linkedBrowser) and string IDs
    if (typeof tab === "string") return tab;
    return tab?.linkedBrowser?.browserId?.toString() ||
           tab?.getAttribute?.("mogwser-tab-id") ||
           String(tab);
  }

  static _getMinPanelSize() {
    try {
      return lazy.prefs.getIntPref("min-panel-size", 7);
    } catch {
      return 7;
    }
  }

  /**
   * Render a group: position each tab's browser using CSS inset percentages,
   * and create resize handles between panels.
   */
  static _renderGroup(group) {
    // Create or reuse group container
    if (!group.container) {
      group.container = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      group.container.className = "mogwser-splitview-group";
      group.container.dataset.groupId = group.id;
      MogwserSplitView._container.appendChild(group.container);
    }

    // Clear existing handles
    for (const handle of group.container.querySelectorAll(
      ".mogwser-splitview-handle"
    )) {
      handle.remove();
    }

    // Calculate positions from tree
    const positions = group.tree.calculatePositions();

    // Position each browser
    for (const [tabId, inset] of positions) {
      const browser = MogwserSplitView._getBrowserForTab(tabId);
      if (!browser) continue;

      // Move browser into group container if not already there
      if (browser.parentNode !== group.container) {
        group.container.appendChild(browser);
      }

      browser.style.position = "absolute";
      browser.style.top = `${inset.top}%`;
      browser.style.right = `${inset.right}%`;
      browser.style.bottom = `${inset.bottom}%`;
      browser.style.left = `${inset.left}%`;
      browser.style.display = "";
      browser.classList.add("mogwser-splitview-panel");
    }

    // Create resize handles between root-level children
    if (group.tree.root && group.tree.root.type === "split") {
      const rootNode = group.tree.root;
      for (let i = 0; i < rootNode.children.length - 1; i++) {
        MogwserSplitView._createSplitHandle(group, i);
      }
    }
  }

  /**
   * Create a draggable resize handle between two adjacent panels.
   */
  static _createSplitHandle(group, index) {
    const rootNode = group.tree.root;
    if (!rootNode || rootNode.type !== "split") return;

    const handle = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    handle.className = "mogwser-splitview-handle";
    handle.dataset.handleIndex = index;

    const isRow = rootNode.direction === "row";
    handle.classList.add(
      isRow ? "mogwser-splitview-handle--vertical" : "mogwser-splitview-handle--horizontal"
    );

    // Position the handle at the boundary between children[index] and children[index+1]
    let offset = 0;
    for (let i = 0; i <= index; i++) {
      offset += rootNode.children[i].sizeInParent;
    }

    if (isRow) {
      handle.style.left = `calc(${offset}% - ${MogwserSplitView._handleSize / 2}px)`;
      handle.style.top = "0";
      handle.style.bottom = "0";
      handle.style.width = `${MogwserSplitView._handleSize}px`;
    } else {
      handle.style.top = `calc(${offset}% - ${MogwserSplitView._handleSize / 2}px)`;
      handle.style.left = "0";
      handle.style.right = "0";
      handle.style.height = `${MogwserSplitView._handleSize}px`;
    }

    // Drag handling
    let startPos = 0;
    let startSizeA = 0;
    let startSizeB = 0;
    const children = rootNode.children;

    const onMouseDown = (e) => {
      e.preventDefault();
      startPos = isRow ? e.clientX : e.clientY;
      startSizeA = children[index].sizeInParent;
      startSizeB = children[index + 1].sizeInParent;

      handle.classList.add("mogwser-splitview-handle--active");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      const containerRect = group.container.getBoundingClientRect();
      const totalPx = isRow ? containerRect.width : containerRect.height;
      if (totalPx === 0) return;

      const currentPos = isRow ? e.clientX : e.clientY;
      const deltaPx = currentPos - startPos;
      const deltaPct = (deltaPx / totalPx) * 100;

      const minSize = MogwserSplitView._getMinPanelSize();
      let newA = startSizeA + deltaPct;
      let newB = startSizeB - deltaPct;

      if (newA < minSize) {
        newA = minSize;
        newB = startSizeA + startSizeB - minSize;
      }
      if (newB < minSize) {
        newB = minSize;
        newA = startSizeA + startSizeB - minSize;
      }

      children[index].sizeInParent = newA;
      children[index + 1].sizeInParent = newB;

      MogwserSplitView._renderGroup(group);
    };

    const onMouseUp = () => {
      handle.classList.remove("mogwser-splitview-handle--active");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      MogwserSplitView._persistGroups();
    };

    handle.addEventListener("mousedown", onMouseDown);
    group.container.appendChild(handle);
  }

  /**
   * Get the <browser> element for a given tab ID.
   */
  static _getBrowserForTab(tabId) {
    // Try Mogwser tab bar first
    if (window.gMogwserTabBar) {
      const tab = window.gMogwserTabBar.getTabById?.(tabId);
      if (tab?.linkedBrowser) return tab.linkedBrowser;
    }
    // Fall back to querying by attribute
    return document.querySelector(
      `[mogwser-tab-id="${tabId}"] browser, browser[browserId="${tabId}"]`
    );
  }

  /**
   * Restore a browser to normal (non-split) flow.
   */
  static _unsplitBrowser(tabId) {
    const browser = MogwserSplitView._getBrowserForTab(tabId);
    if (!browser) return;

    browser.style.position = "";
    browser.style.top = "";
    browser.style.right = "";
    browser.style.bottom = "";
    browser.style.left = "";
    browser.classList.remove("mogwser-splitview-panel");

    // Move browser back to the main content deck if needed
    const deck = document.getElementById("tabbrowser-tabpanels");
    if (deck && browser.parentNode !== deck) {
      deck.appendChild(browser);
    }
  }

  /**
   * Remove a group's container element from the DOM.
   */
  static _destroyGroupContainer(group) {
    if (group.container) {
      group.container.remove();
      group.container = null;
    }
  }

  /**
   * Persist split groups to workspace storage.
   */
  static _persistGroups() {
    try {
      const data = MogwserSplitView._groups.map(g => ({
        id: g.id,
        tree: g.tree.serialize(),
        tabIds: [...g.tabIds],
      }));
      if (window.gMogwserWorkspaces?.storage) {
        window.gMogwserWorkspaces.storage.set("splitGroups", data);
      }
    } catch (e) {
      console.error("MogwserSplitView: failed to persist groups:", e);
    }
  }

  /**
   * Restore split groups from workspace storage.
   */
  static _restoreFromStorage() {
    try {
      if (!window.gMogwserWorkspaces?.storage) return;
      const data = window.gMogwserWorkspaces.storage.get("splitGroups");
      if (!Array.isArray(data)) return;

      for (const groupData of data) {
        const tree = SplitViewTree.deserialize(groupData.tree);
        const group = {
          id: groupData.id,
          tree,
          tabIds: new Set(groupData.tabIds),
          container: null,
        };
        if (groupData.id >= _nextGroupId) {
          _nextGroupId = groupData.id + 1;
        }
        MogwserSplitView._groups.push(group);
        MogwserSplitView._renderGroup(group);
      }
    } catch (e) {
      console.error("MogwserSplitView: failed to restore groups:", e);
    }
  }

  /**
   * Handle session restoration event.
   */
  static _onSessionRestored(detail) {
    // Re-render all groups after tabs are restored
    for (const group of MogwserSplitView._groups) {
      MogwserSplitView._renderGroup(group);
    }
  }

  /**
   * Handle workspace change — show/hide split groups for active workspace.
   */
  static _onWorkspaceChanged() {
    // Re-render visible groups; specific workspace filtering can be
    // extended when workspace IDs are associated with groups.
    for (const group of MogwserSplitView._groups) {
      MogwserSplitView._renderGroup(group);
    }
  }

  /**
   * Keyboard shortcut handler: split the current tab with the next one.
   */
  static _onShortcut() {
    try {
      const currentTab = window.gBrowser?.selectedTab;
      if (!currentTab) return;

      // Find next tab to pair with
      const tabs = window.gBrowser?.tabs;
      if (!tabs || tabs.length < 2) return;

      const idx = Array.from(tabs).indexOf(currentTab);
      const nextTab = tabs[(idx + 1) % tabs.length];

      MogwserSplitView.createSplit(currentTab, nextTab, "row");
    } catch (e) {
      console.error("MogwserSplitView: shortcut handler failed:", e);
    }
  }

  /**
   * Fire a MogwserSplitViewChanged CustomEvent.
   */
  static _fireEvent(group) {
    window.dispatchEvent(
      new CustomEvent("MogwserSplitViewChanged", {
        detail: {
          groupId: group?.id ?? null,
          groups: MogwserSplitView._groups.map(g => ({
            id: g.id,
            tabIds: [...g.tabIds],
          })),
        },
      })
    );
  }
}
