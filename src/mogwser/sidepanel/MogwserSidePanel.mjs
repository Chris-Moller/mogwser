/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserSidePanel — Web side-panel singleton.
 * Provides a panel at the bottom of the sidebar that can load any URL
 * in an embedded <browser> element. Includes a URL bar, close button,
 * resize handle, and a quick-access picker for pinned URLs.
 */

const lazy = {};
ChromeUtils.defineLazyGetter(lazy, "prefs", () =>
  Services.prefs.getBranch("mogwser.sidepanel.")
);

const MIN_HEIGHT = 100;   // px
const MAX_HEIGHT_PCT = 70; // % of sidebar height

export class MogwserSidePanel {
  static _initialized = false;
  static _panelBrowser = null;
  static _isOpen = false;
  static _container = null;
  static _urlInput = null;
  static _currentUrl = "";
  static _pinnedUrls = [];
  static _panelHeight = 250; // px, default height
  static _resizeHandle = null;

  /**
   * Initialize the side panel: build UI, restore persisted state.
   */
  static async init() {
    if (MogwserSidePanel._initialized) {
      return;
    }

    MogwserSidePanel._container = document.getElementById(
      "mogwser-sidepanel-container"
    );
    if (!MogwserSidePanel._container) {
      console.error("MogwserSidePanel: container element not found");
      return;
    }

    // Build panel UI
    MogwserSidePanel._buildUI();

    // Load pinned URLs from prefs
    MogwserSidePanel._loadPinnedUrls();

    // Restore persisted state
    MogwserSidePanel._restoreState();

    // Keyboard shortcut: Ctrl+Shift+P (panel toggle)
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        MogwserSidePanel.toggle();
      }
    });

    MogwserSidePanel._initialized = true;
  }

  /**
   * Open the side panel, optionally loading a URL.
   * @param {string} [url] — URL to load; if omitted, shows last URL or picker
   */
  static open(url) {
    MogwserSidePanel._isOpen = true;
    MogwserSidePanel._container.classList.add("mogwser-sidepanel--open");
    MogwserSidePanel._container.style.height = `${MogwserSidePanel._panelHeight}px`;

    if (url) {
      MogwserSidePanel._loadUrl(url);
    } else if (MogwserSidePanel._currentUrl) {
      MogwserSidePanel._loadUrl(MogwserSidePanel._currentUrl);
    } else {
      MogwserSidePanel._showPicker();
    }

    MogwserSidePanel._persistState();
  }

  /**
   * Close the side panel.
   */
  static close() {
    MogwserSidePanel._isOpen = false;
    MogwserSidePanel._container.classList.remove("mogwser-sidepanel--open");
    MogwserSidePanel._container.style.height = "";

    MogwserSidePanel._persistState();
  }

  /**
   * Toggle the side panel open/closed.
   */
  static toggle() {
    if (MogwserSidePanel._isOpen) {
      MogwserSidePanel.close();
    } else {
      MogwserSidePanel.open();
    }
  }

  /**
   * Whether the panel is currently open.
   */
  static get isOpen() {
    return MogwserSidePanel._isOpen;
  }

  /**
   * The currently loaded URL.
   */
  static get currentUrl() {
    return MogwserSidePanel._currentUrl;
  }

  // ── UI Construction ──────────────────────────────────────────────────

  /**
   * Build the side panel DOM structure inside the container.
   */
  static _buildUI() {
    const container = MogwserSidePanel._container;

    // Resize handle at top of panel
    const resizeHandle = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    resizeHandle.className = "mogwser-sidepanel__resize-handle";
    MogwserSidePanel._resizeHandle = resizeHandle;
    container.appendChild(resizeHandle);
    MogwserSidePanel._setupResizeHandle(resizeHandle);

    // Header bar: URL input + close button
    const header = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    header.className = "mogwser-sidepanel__header";

    const urlInput = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "input"
    );
    urlInput.className = "mogwser-sidepanel__urlbar";
    urlInput.type = "text";
    urlInput.placeholder = "Enter URL...";
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (url) {
          MogwserSidePanel._loadUrl(
            url.startsWith("http") ? url : `https://${url}`
          );
        }
      }
    });
    MogwserSidePanel._urlInput = urlInput;
    header.appendChild(urlInput);

    const closeBtn = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "button"
    );
    closeBtn.className = "mogwser-sidepanel__close-btn";
    closeBtn.textContent = "\u00D7"; // multiplication sign as close icon
    closeBtn.title = "Close panel";
    closeBtn.addEventListener("click", () => MogwserSidePanel.close());
    header.appendChild(closeBtn);

    container.appendChild(header);

    // Quick-access picker (shown when no URL is loaded)
    const picker = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    picker.className = "mogwser-sidepanel__picker";
    container.appendChild(picker);

    // Browser element for loading URLs
    const browser = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "iframe"
    );
    browser.className = "mogwser-sidepanel__browser";
    browser.setAttribute("type", "content");
    browser.setAttribute("remote", "true");
    browser.setAttribute("mozbrowser", "true");
    container.appendChild(browser);
    MogwserSidePanel._panelBrowser = browser;
  }

  // ── URL Loading ──────────────────────────────────────────────────────

  /**
   * Load a URL into the panel browser.
   */
  static _loadUrl(url) {
    MogwserSidePanel._currentUrl = url;

    if (MogwserSidePanel._urlInput) {
      MogwserSidePanel._urlInput.value = url;
    }

    // Hide picker, show browser
    const picker = MogwserSidePanel._container.querySelector(
      ".mogwser-sidepanel__picker"
    );
    if (picker) picker.style.display = "none";

    const browser = MogwserSidePanel._panelBrowser;
    if (browser) {
      browser.style.display = "";
      browser.setAttribute("src", url);
    }

    MogwserSidePanel._persistState();
  }

  // ── Quick-Access Picker ──────────────────────────────────────────────

  /**
   * Show the quick-access picker with pinned URLs.
   */
  static _showPicker() {
    const browser = MogwserSidePanel._panelBrowser;
    if (browser) browser.style.display = "none";

    const picker = MogwserSidePanel._container.querySelector(
      ".mogwser-sidepanel__picker"
    );
    if (!picker) return;

    picker.style.display = "";
    picker.innerHTML = "";

    if (MogwserSidePanel._pinnedUrls.length === 0) {
      const empty = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      empty.className = "mogwser-sidepanel__picker-empty";
      empty.textContent = "No pinned sites. Enter a URL above.";
      picker.appendChild(empty);
      return;
    }

    for (const pinned of MogwserSidePanel._pinnedUrls) {
      const item = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "button"
      );
      item.className = "mogwser-sidepanel__picker-item";
      item.textContent = pinned.label || pinned.url;
      item.title = pinned.url;
      item.addEventListener("click", () => {
        MogwserSidePanel._loadUrl(pinned.url);
      });
      picker.appendChild(item);
    }
  }

  /**
   * Load pinned URLs from the `mogwser.sidepanel.pinned` pref (JSON array).
   */
  static _loadPinnedUrls() {
    try {
      const raw = lazy.prefs.getStringPref("pinned", "[]");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        MogwserSidePanel._pinnedUrls = parsed.map(entry => {
          if (typeof entry === "string") {
            return { url: entry, label: entry };
          }
          return { url: entry.url || "", label: entry.label || entry.url || "" };
        });
      }
    } catch {
      MogwserSidePanel._pinnedUrls = [];
    }
  }

  // ── Resize Handle ────────────────────────────────────────────────────

  /**
   * Set up drag-to-resize on the top edge of the panel.
   */
  static _setupResizeHandle(handle) {
    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e) => {
      e.preventDefault();
      startY = e.clientY;
      startHeight = MogwserSidePanel._panelHeight;
      handle.classList.add("mogwser-sidepanel__resize-handle--active");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      // Dragging up increases height (startY > e.clientY)
      const delta = startY - e.clientY;
      let newHeight = startHeight + delta;

      // Enforce min/max
      const sidebar = document.getElementById("mogwser-sidebar");
      const maxHeight = sidebar
        ? sidebar.getBoundingClientRect().height * (MAX_HEIGHT_PCT / 100)
        : 500;

      newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, maxHeight));
      MogwserSidePanel._panelHeight = newHeight;
      MogwserSidePanel._container.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      handle.classList.remove("mogwser-sidepanel__resize-handle--active");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      MogwserSidePanel._persistState();
    };

    handle.addEventListener("mousedown", onMouseDown);
  }

  // ── Persistence ──────────────────────────────────────────────────────

  /**
   * Persist panel state to preferences.
   */
  static _persistState() {
    try {
      lazy.prefs.setBoolPref("open", MogwserSidePanel._isOpen);
      lazy.prefs.setStringPref("url", MogwserSidePanel._currentUrl);
      lazy.prefs.setIntPref("height", MogwserSidePanel._panelHeight);
    } catch (e) {
      console.error("MogwserSidePanel: failed to persist state:", e);
    }
  }

  /**
   * Restore panel state from preferences.
   */
  static _restoreState() {
    try {
      MogwserSidePanel._currentUrl = lazy.prefs.getStringPref("url", "");
      MogwserSidePanel._panelHeight = lazy.prefs.getIntPref("height", 250);

      const wasOpen = lazy.prefs.getBoolPref("open", false);
      if (wasOpen) {
        MogwserSidePanel.open(MogwserSidePanel._currentUrl || undefined);
      }
    } catch {
      // Prefs not set — use defaults
    }
  }
}
