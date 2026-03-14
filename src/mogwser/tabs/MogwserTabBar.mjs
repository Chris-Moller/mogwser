/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserTabBar — Vertical sidebar tab bar.
 *
 * Renders browser tabs as a vertical list inside #mogwser-tabs-container.
 * Supports pinned tabs, audio indicators, close buttons, middle-click close,
 * and a full right-click context menu.
 */

const { MogwserTabDragDrop } = ChromeUtils.importESModule(
  "chrome://mogwser/content/tabs/MogwserTabDragDrop.mjs"
);

export class MogwserTabBar {
  static _initialized = false;

  /** Map<BrowserTab, HTMLElement> — maps Firefox tab objects to our DOM rows */
  static _tabElements = new Map();

  /** Reference to the container element */
  static _container = null;

  /** Pinned tabs section */
  static _pinnedSection = null;

  /** Unpinned tabs list */
  static _tabsList = null;

  /** Currently active context menu, if any */
  static _contextMenu = null;

  /**
   * Initialize the vertical tab bar.
   * Creates the DOM structure and binds to Firefox tab events.
   */
  static async init() {
    if (MogwserTabBar._initialized) {
      return;
    }

    MogwserTabBar._container = document.getElementById("mogwser-tabs-container");
    if (!MogwserTabBar._container) {
      console.error("MogwserTabBar: #mogwser-tabs-container not found");
      return;
    }

    // Build the tab bar structure
    MogwserTabBar._pinnedSection = document.createElement("div");
    MogwserTabBar._pinnedSection.className = "mogwser-tabs__pinned";
    MogwserTabBar._container.appendChild(MogwserTabBar._pinnedSection);

    MogwserTabBar._tabsList = document.createElement("div");
    MogwserTabBar._tabsList.className = "mogwser-tabs__list";
    MogwserTabBar._container.appendChild(MogwserTabBar._tabsList);

    // Render existing tabs
    for (const tab of gBrowser.tabs) {
      MogwserTabBar._onTabOpen({ target: tab });
    }

    // Select the current tab
    if (gBrowser.selectedTab) {
      MogwserTabBar._onTabSelect({ target: gBrowser.selectedTab });
    }

    // Bind Firefox tab events
    const tabEvents = [
      "TabOpen",
      "TabClose",
      "TabMove",
      "TabAttrModified",
      "TabSelect",
    ];

    for (const eventName of tabEvents) {
      gBrowser.tabContainer.addEventListener(eventName, MogwserTabBar);
    }

    // Dismiss context menu on click outside
    document.addEventListener("click", MogwserTabBar._dismissContextMenu);

    // Initialize drag-and-drop
    MogwserTabDragDrop.init(
      MogwserTabBar._pinnedSection,
      MogwserTabBar._tabsList,
      MogwserTabBar._tabElements
    );

    MogwserTabBar._initialized = true;
    console.log("MogwserTabBar: Initialized");
  }

  /**
   * EventListener interface — dispatches DOM events to handlers.
   */
  static handleEvent(event) {
    switch (event.type) {
      case "TabOpen":
        MogwserTabBar._onTabOpen(event);
        break;
      case "TabClose":
        MogwserTabBar._onTabClose(event);
        break;
      case "TabMove":
        MogwserTabBar._onTabMove(event);
        break;
      case "TabAttrModified":
        MogwserTabBar._onTabAttrModified(event);
        break;
      case "TabSelect":
        MogwserTabBar._onTabSelect(event);
        break;
    }
  }

  // ─── Tab Event Handlers ────────────────────────────────────────────

  /**
   * Handle a new tab being opened.
   * Creates the DOM element and inserts it in the correct section.
   */
  static _onTabOpen(event) {
    const tab = event.target;
    if (MogwserTabBar._tabElements.has(tab)) {
      return;
    }

    const el = MogwserTabBar._createTabElement(tab);
    MogwserTabBar._tabElements.set(tab, el);
    MogwserTabBar._insertTabElement(tab, el);
  }

  /**
   * Handle a tab being closed.
   * Removes its DOM element from the bar.
   */
  static _onTabClose(event) {
    const tab = event.target;
    const el = MogwserTabBar._tabElements.get(tab);
    if (el) {
      el.remove();
      MogwserTabBar._tabElements.delete(tab);
    }
  }

  /**
   * Handle a tab being moved (reordered).
   * Repositions the DOM element.
   */
  static _onTabMove(event) {
    const tab = event.target;
    const el = MogwserTabBar._tabElements.get(tab);
    if (!el) {
      return;
    }
    // Remove and re-insert at correct position
    el.remove();
    MogwserTabBar._insertTabElement(tab, el);
  }

  /**
   * Handle tab attribute changes (title, favicon, pinned, muted, busy).
   */
  static _onTabAttrModified(event) {
    const tab = event.target;
    MogwserTabBar._updateTabElement(tab);
  }

  /**
   * Handle tab selection — update active state.
   */
  static _onTabSelect(event) {
    const tab = event.target;

    // Remove active class from all tabs
    for (const el of MogwserTabBar._tabElements.values()) {
      el.classList.remove("mogwser-tab--active");
    }

    // Add active class to selected tab
    const el = MogwserTabBar._tabElements.get(tab);
    if (el) {
      el.classList.add("mogwser-tab--active");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // ─── DOM Creation ──────────────────────────────────────────────────

  /**
   * Create the DOM element for a tab row.
   * Structure:
   *   .mogwser-tab
   *     .mogwser-tab__favicon > img
   *     .mogwser-tab__title
   *     .mogwser-tab__audio-btn  (if audible/muted)
   *     .mogwser-tab__close-btn
   */
  static _createTabElement(tab) {
    const el = document.createElement("div");
    el.className = "mogwser-tab";
    el.setAttribute("draggable", "true");

    // Favicon
    const faviconWrap = document.createElement("div");
    faviconWrap.className = "mogwser-tab__favicon";
    const faviconImg = document.createElement("img");
    faviconImg.className = "mogwser-tab__favicon-img";
    faviconImg.alt = "";
    faviconImg.draggable = false;
    faviconWrap.appendChild(faviconImg);
    el.appendChild(faviconWrap);

    // Title
    const title = document.createElement("span");
    title.className = "mogwser-tab__title";
    el.appendChild(title);

    // Audio indicator button
    const audioBtn = document.createElement("button");
    audioBtn.className = "mogwser-tab__audio-btn";
    audioBtn.title = "Toggle mute";
    audioBtn.hidden = true;
    audioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tab.toggleMuteAudio();
    });
    el.appendChild(audioBtn);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "mogwser-tab__close-btn";
    closeBtn.title = "Close tab";
    closeBtn.textContent = "\u00D7"; // multiplication sign
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      gBrowser.removeTab(tab, { animate: true });
    });
    el.appendChild(closeBtn);

    // Click to select
    el.addEventListener("click", () => {
      gBrowser.selectedTab = tab;
    });

    // Middle-click to close
    el.addEventListener("auxclick", (e) => {
      MogwserTabBar._onMiddleClick(e, tab);
    });

    // Right-click context menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      MogwserTabBar._buildContextMenu(tab, e.clientX, e.clientY);
    });

    // Populate initial state
    MogwserTabBar._updateTabElementDOM(tab, el);

    return el;
  }

  /**
   * Update an existing tab's DOM element to reflect current state.
   */
  static _updateTabElement(tab) {
    const el = MogwserTabBar._tabElements.get(tab);
    if (!el) {
      return;
    }

    MogwserTabBar._updateTabElementDOM(tab, el);

    // Handle pin state change — may need to move between sections
    const isPinned = tab.pinned;
    const isInPinnedSection =
      el.parentElement === MogwserTabBar._pinnedSection;

    if (isPinned && !isInPinnedSection) {
      el.remove();
      MogwserTabBar._insertTabElement(tab, el);
    } else if (!isPinned && isInPinnedSection) {
      el.remove();
      MogwserTabBar._insertTabElement(tab, el);
    }
  }

  /**
   * Update the DOM contents of a tab element (favicon, title, audio, pinned).
   */
  static _updateTabElementDOM(tab, el) {
    // Favicon
    const faviconImg = el.querySelector(".mogwser-tab__favicon-img");
    const iconUrl = tab.image || "chrome://global/skin/icons/defaultFavicon.svg";
    if (faviconImg.src !== iconUrl) {
      faviconImg.src = iconUrl;
    }

    // Title
    const titleEl = el.querySelector(".mogwser-tab__title");
    const label = tab.label || "New Tab";
    if (titleEl.textContent !== label) {
      titleEl.textContent = label;
    }
    el.title = label;

    // Pinned state
    el.classList.toggle("mogwser-tab--pinned", tab.pinned);

    // Loading state
    el.classList.toggle(
      "mogwser-tab--loading",
      tab.hasAttribute("busy")
    );

    // Audio indicator
    const audioBtn = el.querySelector(".mogwser-tab__audio-btn");
    const isAudible = tab.hasAttribute("soundplaying");
    const isMuted = tab.hasAttribute("muted");

    if (isAudible || isMuted) {
      audioBtn.hidden = false;
      audioBtn.classList.toggle("mogwser-tab__audio-btn--muted", isMuted);
      audioBtn.textContent = isMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A";
      audioBtn.title = isMuted ? "Unmute tab" : "Mute tab";
    } else {
      audioBtn.hidden = true;
    }
  }

  /**
   * Insert a tab element into the correct section and position.
   */
  static _insertTabElement(tab, el) {
    const section = tab.pinned
      ? MogwserTabBar._pinnedSection
      : MogwserTabBar._tabsList;

    // Find the correct insertion index among siblings
    const tabIndex = Array.prototype.indexOf.call(gBrowser.tabs, tab);
    const children = Array.from(section.children);
    let inserted = false;

    for (const child of children) {
      // Find the tab corresponding to this child element
      for (const [otherTab, otherEl] of MogwserTabBar._tabElements) {
        if (otherEl === child) {
          const otherIndex = Array.prototype.indexOf.call(
            gBrowser.tabs,
            otherTab
          );
          if (otherIndex > tabIndex) {
            section.insertBefore(el, child);
            inserted = true;
          }
          break;
        }
      }
      if (inserted) {
        break;
      }
    }

    if (!inserted) {
      section.appendChild(el);
    }
  }

  // ─── Context Menu ──────────────────────────────────────────────────

  /**
   * Build and show a context menu for a tab.
   */
  static _buildContextMenu(tab, x, y) {
    MogwserTabBar._dismissContextMenu();

    const menu = document.createElement("div");
    menu.className = "mogwser-tab__context-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [];

    // Pin / Unpin
    items.push({
      label: tab.pinned ? "Unpin Tab" : "Pin Tab",
      action() {
        if (tab.pinned) {
          gBrowser.unpinTab(tab);
        } else {
          gBrowser.pinTab(tab);
        }
      },
    });

    // Mute / Unmute
    items.push({
      label: tab.hasAttribute("muted") ? "Unmute Tab" : "Mute Tab",
      action() {
        tab.toggleMuteAudio();
      },
    });

    // Duplicate
    items.push({
      label: "Duplicate Tab",
      action() {
        gBrowser.duplicateTab(tab);
      },
    });

    // Move to Workspace submenu
    if (window.gMogwserWorkspaces) {
      const workspaces = window.gMogwserWorkspaces.getAllWorkspaces();
      if (workspaces.length > 1) {
        const currentWsId = tab.getAttribute("mogwser-workspace-id");
        for (const ws of workspaces) {
          if (ws.id === currentWsId) {
            continue;
          }
          items.push({
            label: `Move to "${ws.name}"`,
            action() {
              window.gMogwserWorkspaces.assignTabToWorkspace(tab, ws.id);
            },
          });
        }
      }
    }

    // Separator
    items.push({ separator: true });

    // Close
    items.push({
      label: "Close Tab",
      action() {
        gBrowser.removeTab(tab, { animate: true });
      },
    });

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "mogwser-tab__context-menu-separator";
        menu.appendChild(sep);
        continue;
      }

      const menuItem = document.createElement("div");
      menuItem.className = "mogwser-tab__context-menu-item";
      menuItem.textContent = item.label;
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        MogwserTabBar._dismissContextMenu();
        item.action();
      });
      menu.appendChild(menuItem);
    }

    document.body.appendChild(menu);
    MogwserTabBar._contextMenu = menu;

    // Clamp menu position to viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    });
  }

  /**
   * Dismiss the context menu if open.
   */
  static _dismissContextMenu = () => {
    if (MogwserTabBar._contextMenu) {
      MogwserTabBar._contextMenu.remove();
      MogwserTabBar._contextMenu = null;
    }
  };

  // ─── Middle Click ──────────────────────────────────────────────────

  /**
   * Handle middle-click on a tab — close it.
   */
  static _onMiddleClick(event, tab) {
    // Button 1 is middle mouse button
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      gBrowser.removeTab(tab, { animate: true });
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Get the DOM element for a given browser tab.
   */
  static getElementForTab(tab) {
    return MogwserTabBar._tabElements.get(tab) || null;
  }

  /**
   * Get the pinned tabs section element.
   */
  static get pinnedSection() {
    return MogwserTabBar._pinnedSection;
  }

  /**
   * Get the unpinned tabs list element.
   */
  static get tabsList() {
    return MogwserTabBar._tabsList;
  }
}
