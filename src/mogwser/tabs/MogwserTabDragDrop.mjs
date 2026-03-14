/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserTabDragDrop — Drag-and-drop tab reordering for the vertical tab bar.
 *
 * Uses the HTML5 Drag and Drop API. Respects pinned/unpinned boundaries:
 * pinned tabs can only be reordered among pinned tabs, and unpinned tabs
 * among unpinned tabs.
 */

export class MogwserTabDragDrop {
  static _initialized = false;

  /** Reference to the pinned tabs section */
  static _pinnedSection = null;

  /** Reference to the unpinned tabs list */
  static _tabsList = null;

  /** Map<BrowserTab, HTMLElement> — shared reference from MogwserTabBar */
  static _tabElements = null;

  /** The tab currently being dragged */
  static _draggedTab = null;

  /** The DOM element currently being dragged */
  static _draggedElement = null;

  /** The current drop indicator element */
  static _dropIndicator = null;

  /**
   * Initialize drag-and-drop on the tab bar sections.
   * @param {HTMLElement} pinnedSection — the pinned tabs container
   * @param {HTMLElement} tabsList — the unpinned tabs container
   * @param {Map} tabElements — Map<BrowserTab, HTMLElement>
   */
  static init(pinnedSection, tabsList, tabElements) {
    if (MogwserTabDragDrop._initialized) {
      return;
    }

    MogwserTabDragDrop._pinnedSection = pinnedSection;
    MogwserTabDragDrop._tabsList = tabsList;
    MogwserTabDragDrop._tabElements = tabElements;

    // Bind drag events on both sections
    for (const section of [pinnedSection, tabsList]) {
      section.addEventListener("dragstart", MogwserTabDragDrop._onDragStart);
      section.addEventListener("dragover", MogwserTabDragDrop._onDragOver);
      section.addEventListener("dragleave", MogwserTabDragDrop._onDragLeave);
      section.addEventListener("drop", MogwserTabDragDrop._onDrop);
      section.addEventListener("dragend", MogwserTabDragDrop._onDragEnd);
    }

    MogwserTabDragDrop._initialized = true;
    console.log("MogwserTabDragDrop: Initialized");
  }

  // ─── Drag Event Handlers ───────────────────────────────────────────

  /**
   * Handle dragstart — store the dragged tab and apply visual feedback.
   */
  static _onDragStart = (event) => {
    const el = event.target.closest(".mogwser-tab");
    if (!el) {
      return;
    }

    // Find the browser tab for this element
    const tab = MogwserTabDragDrop._findTabForElement(el);
    if (!tab) {
      return;
    }

    MogwserTabDragDrop._draggedTab = tab;
    MogwserTabDragDrop._draggedElement = el;

    el.classList.add("mogwser-tab--dragging");

    // Set drag data
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/x-mogwser-tab-index",
      String(Array.prototype.indexOf.call(gBrowser.tabs, tab))
    );

    // Use the tab element as the drag image
    event.dataTransfer.setDragImage(el, 20, 12);
  };

  /**
   * Handle dragover — calculate drop position and show indicator.
   */
  static _onDragOver = (event) => {
    if (!MogwserTabDragDrop._draggedTab) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const section = event.currentTarget;
    const draggedIsPinned = MogwserTabDragDrop._draggedTab.pinned;
    const sectionIsPinned =
      section === MogwserTabDragDrop._pinnedSection;

    // Enforce pinned/unpinned boundary
    if (draggedIsPinned !== sectionIsPinned) {
      event.dataTransfer.dropEffect = "none";
      MogwserTabDragDrop._removeDropIndicator();
      return;
    }

    // Determine which element we are hovering over
    const target = MogwserTabDragDrop._getDropTarget(
      section,
      event.clientY
    );

    MogwserTabDragDrop._showDropIndicator(section, target, event.clientY);
  };

  /**
   * Handle dragleave — remove the drop indicator.
   */
  static _onDragLeave = (event) => {
    // Only remove if we've actually left the section
    const related = event.relatedTarget;
    if (
      related &&
      event.currentTarget.contains(related)
    ) {
      return;
    }
    MogwserTabDragDrop._removeDropIndicator();
  };

  /**
   * Handle drop — move the tab to the new position.
   */
  static _onDrop = (event) => {
    event.preventDefault();

    const draggedTab = MogwserTabDragDrop._draggedTab;
    if (!draggedTab) {
      return;
    }

    const section = event.currentTarget;
    const draggedIsPinned = draggedTab.pinned;
    const sectionIsPinned =
      section === MogwserTabDragDrop._pinnedSection;

    // Enforce boundary
    if (draggedIsPinned !== sectionIsPinned) {
      MogwserTabDragDrop._cleanup();
      return;
    }

    // Determine the new index
    const newIndex = MogwserTabDragDrop._calculateDropIndex(
      section,
      event.clientY
    );

    if (newIndex !== -1) {
      const currentIndex = Array.prototype.indexOf.call(
        gBrowser.tabs,
        draggedTab
      );
      if (currentIndex !== newIndex) {
        gBrowser.moveTabTo(draggedTab, newIndex);
      }
    }

    MogwserTabDragDrop._cleanup();
  };

  /**
   * Handle dragend — clean up visual state.
   */
  static _onDragEnd = () => {
    MogwserTabDragDrop._cleanup();
  };

  // ─── Drop Position Calculation ─────────────────────────────────────

  /**
   * Find the tab element closest to the given Y coordinate.
   */
  static _getDropTarget(section, clientY) {
    const children = Array.from(section.children).filter(
      (el) =>
        el.classList.contains("mogwser-tab") &&
        el !== MogwserTabDragDrop._draggedElement
    );

    for (const child of children) {
      const rect = child.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return child;
      }
    }

    return null; // drop at end
  }

  /**
   * Calculate the Firefox tab index for the drop position.
   */
  static _calculateDropIndex(section, clientY) {
    const children = Array.from(section.children).filter((el) =>
      el.classList.contains("mogwser-tab")
    );

    if (children.length === 0) {
      return 0;
    }

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === MogwserTabDragDrop._draggedElement) {
        continue;
      }

      const rect = child.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        // Find the browser tab for this element
        const tab = MogwserTabDragDrop._findTabForElement(child);
        if (tab) {
          return Array.prototype.indexOf.call(gBrowser.tabs, tab);
        }
      }
    }

    // Drop at end — use the index after the last tab in this section
    const lastChild = children[children.length - 1];
    const lastTab = MogwserTabDragDrop._findTabForElement(lastChild);
    if (lastTab) {
      return Array.prototype.indexOf.call(gBrowser.tabs, lastTab) + 1;
    }

    return -1;
  }

  // ─── Drop Indicator ────────────────────────────────────────────────

  /**
   * Show a drop indicator line at the calculated position.
   */
  static _showDropIndicator(section, targetElement, clientY) {
    MogwserTabDragDrop._removeDropIndicator();

    const indicator = document.createElement("div");
    indicator.className = "mogwser-tab--drop-indicator";
    MogwserTabDragDrop._dropIndicator = indicator;

    if (targetElement) {
      section.insertBefore(indicator, targetElement);
    } else {
      section.appendChild(indicator);
    }
  }

  /**
   * Remove the drop indicator from the DOM.
   */
  static _removeDropIndicator() {
    if (MogwserTabDragDrop._dropIndicator) {
      MogwserTabDragDrop._dropIndicator.remove();
      MogwserTabDragDrop._dropIndicator = null;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  /**
   * Find the browser tab object corresponding to a DOM element.
   */
  static _findTabForElement(el) {
    if (!MogwserTabDragDrop._tabElements) {
      return null;
    }

    for (const [tab, tabEl] of MogwserTabDragDrop._tabElements) {
      if (tabEl === el) {
        return tab;
      }
    }
    return null;
  }

  /**
   * Clean up after a drag operation.
   */
  static _cleanup() {
    if (MogwserTabDragDrop._draggedElement) {
      MogwserTabDragDrop._draggedElement.classList.remove(
        "mogwser-tab--dragging"
      );
    }
    MogwserTabDragDrop._draggedTab = null;
    MogwserTabDragDrop._draggedElement = null;
    MogwserTabDragDrop._removeDropIndicator();
  }
}
