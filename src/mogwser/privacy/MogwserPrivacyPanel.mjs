/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserPrivacyPanel — Privacy dashboard singleton providing a toolbar
 * button with protection-level badge, toggle switches for Firefox privacy
 * prefs, and per-site exception management.
 */

const SHIELD_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M8 1L2 3.5v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5v-4L8 1zm0 1.2l4.8 2v3.3c0 2.9-2.1 5.6-4.8 6.3-2.7-.7-4.8-3.4-4.8-6.3V4.2L8 2.2zm-1 4.3v4h2v-4H7zm0-2.5h2v1.5H7V4z"/>
</svg>`;

/**
 * Toggle definitions: label, pref name, pref type, and active value.
 */
const PRIVACY_TOGGLES = [
  {
    label: "Enhanced Tracking Protection",
    pref: "privacy.trackingprotection.enabled",
    type: "bool",
    activeValue: true,
  },
  {
    label: "Block Third-Party Cookies",
    pref: "network.cookie.cookieBehavior",
    type: "int",
    activeValue: 4, // 4 = reject trackers + partition cross-site
  },
  {
    label: "First-Party Isolation",
    pref: "privacy.firstparty.isolate",
    type: "bool",
    activeValue: true,
  },
  {
    label: "Fingerprint Resistance",
    pref: "privacy.resistFingerprinting",
    type: "bool",
    activeValue: true,
  },
  {
    label: "HTTPS-Only Mode",
    pref: "dom.security.https_only_mode",
    type: "bool",
    activeValue: true,
  },
];

/**
 * Read a preference value from Services.prefs.
 */
function readPref(pref, type) {
  try {
    if (type === "bool") {
      return Services.prefs.getBoolPref(pref, false);
    }
    if (type === "int") {
      return Services.prefs.getIntPref(pref, 0);
    }
    return Services.prefs.getStringPref(pref, "");
  } catch (e) {
    return type === "bool" ? false : type === "int" ? 0 : "";
  }
}

/**
 * Write a preference value via Services.prefs.
 */
function writePref(pref, type, value) {
  try {
    if (type === "bool") {
      Services.prefs.setBoolPref(pref, value);
    } else if (type === "int") {
      Services.prefs.setIntPref(pref, value);
    } else {
      Services.prefs.setStringPref(pref, value);
    }
  } catch (e) {
    console.error(`MogwserPrivacyPanel: failed to write pref ${pref}:`, e);
  }
}

/**
 * Check if a toggle is in its "active" (protective) state.
 */
function isToggleActive(toggle) {
  const value = readPref(toggle.pref, toggle.type);
  if (toggle.type === "int") {
    return value === toggle.activeValue;
  }
  return value === toggle.activeValue;
}

export class MogwserPrivacyPanel {
  static _initialized = false;
  static _panelEl = null;
  static _badgeEl = null;
  static _toggleEls = new Map();
  static _exceptionListEl = null;

  /**
   * Initialize the privacy panel: create toolbar button and panel.
   */
  static async init() {
    if (MogwserPrivacyPanel._initialized) {
      return;
    }

    MogwserPrivacyPanel._createToolbarButton();
    MogwserPrivacyPanel._createPanel();
    MogwserPrivacyPanel._updateBadge();

    MogwserPrivacyPanel._initialized = true;
    console.log("MogwserPrivacyPanel: initialized");
  }

  /**
   * Create the toolbar button with a shield icon and protection-level badge.
   */
  static _createToolbarButton() {
    try {
      CustomizableUI.createWidget({
        id: "mogwser-privacy-button",
        type: "button",
        label: "Mogwser Privacy",
        tooltiptext: "Privacy & Protection Settings",
        defaultArea: CustomizableUI.AREA_NAVBAR,
        onCreated(node) {
          // Set shield icon
          node.classList.add("mogwser-privacy-btn");
          const iconContainer = node.ownerDocument.createElement("div");
          iconContainer.className = "mogwser-privacy-btn__icon";
          iconContainer.innerHTML = SHIELD_ICON_SVG;
          node.appendChild(iconContainer);

          // Badge element
          const badge = node.ownerDocument.createElement("span");
          badge.className = "mogwser-privacy-btn__badge";
          node.appendChild(badge);
          MogwserPrivacyPanel._badgeEl = badge;
        },
        onCommand() {
          MogwserPrivacyPanel.togglePanel();
        },
      });
    } catch (e) {
      // CustomizableUI may not be available in all contexts;
      // fall back to a simple DOM button
      MogwserPrivacyPanel._createFallbackButton();
    }
  }

  /**
   * Fallback: create a simple DOM button if CustomizableUI is unavailable.
   */
  static _createFallbackButton() {
    const navbar = document.getElementById("nav-bar") ||
                   document.getElementById("mogwser-shell");
    if (!navbar) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "mogwser-privacy-button";
    btn.className = "mogwser-privacy-btn";
    btn.title = "Privacy & Protection Settings";
    btn.innerHTML = SHIELD_ICON_SVG;

    const badge = document.createElement("span");
    badge.className = "mogwser-privacy-btn__badge";
    btn.appendChild(badge);
    MogwserPrivacyPanel._badgeEl = badge;

    btn.addEventListener("click", () => MogwserPrivacyPanel.togglePanel());

    navbar.appendChild(btn);
  }

  /**
   * Create the privacy panel popup with header, toggles, and exceptions.
   */
  static _createPanel() {
    const panel = document.createElement("div");
    panel.id = "mogwser-privacy-panel";
    panel.className = "mogwser-privacy-panel";
    panel.hidden = true;

    // --- Header ---
    const header = document.createElement("div");
    header.className = "mogwser-privacy-panel__header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "mogwser-privacy-panel__header-left";

    const title = document.createElement("h3");
    title.className = "mogwser-privacy-panel__title";
    title.textContent = "Privacy & Protection";
    headerLeft.appendChild(title);

    const levelBadge = document.createElement("span");
    levelBadge.className = "mogwser-privacy-panel__level";
    levelBadge.id = "mogwser-privacy-level";
    headerLeft.appendChild(levelBadge);

    header.appendChild(headerLeft);

    const closeBtn = document.createElement("button");
    closeBtn.className = "mogwser-privacy-panel__close";
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", () => MogwserPrivacyPanel.hidePanel());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // --- Toggle switches ---
    const togglesSection = document.createElement("div");
    togglesSection.className = "mogwser-privacy-panel__toggles";

    for (const toggle of PRIVACY_TOGGLES) {
      const row = document.createElement("div");
      row.className = "mogwser-privacy-panel__toggle-row";

      const label = document.createElement("label");
      label.className = "mogwser-privacy-panel__toggle-label";
      label.textContent = toggle.label;

      const switchContainer = document.createElement("div");
      switchContainer.className = "mogwser-privacy-panel__switch";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "mogwser-privacy-panel__switch-input";
      input.checked = isToggleActive(toggle);
      input.dataset.pref = toggle.pref;

      input.addEventListener("change", () => {
        MogwserPrivacyPanel._onToggle(toggle, input.checked);
      });

      const slider = document.createElement("span");
      slider.className = "mogwser-privacy-panel__switch-slider";

      switchContainer.appendChild(input);
      switchContainer.appendChild(slider);

      row.appendChild(label);
      row.appendChild(switchContainer);
      togglesSection.appendChild(row);

      MogwserPrivacyPanel._toggleEls.set(toggle.pref, input);
    }

    panel.appendChild(togglesSection);

    // --- Separator ---
    const sep = document.createElement("div");
    sep.className = "mogwser-privacy-panel__separator";
    panel.appendChild(sep);

    // --- Site Exceptions ---
    const exceptionsSection = document.createElement("div");
    exceptionsSection.className = "mogwser-privacy-panel__exceptions";

    const excHeader = document.createElement("div");
    excHeader.className = "mogwser-privacy-panel__exceptions-header";

    const excTitle = document.createElement("h4");
    excTitle.className = "mogwser-privacy-panel__exceptions-title";
    excTitle.textContent = "Site Exceptions";
    excHeader.appendChild(excTitle);

    const addBtn = document.createElement("button");
    addBtn.className = "mogwser-privacy-panel__add-exception-btn";
    addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", () => MogwserPrivacyPanel._promptAddException());
    excHeader.appendChild(addBtn);

    exceptionsSection.appendChild(excHeader);

    const excList = document.createElement("ul");
    excList.className = "mogwser-privacy-panel__exception-list";
    excList.id = "mogwser-privacy-exception-list";
    MogwserPrivacyPanel._exceptionListEl = excList;
    exceptionsSection.appendChild(excList);

    panel.appendChild(exceptionsSection);

    // Attach to document
    document.documentElement.appendChild(panel);
    MogwserPrivacyPanel._panelEl = panel;

    // Populate exception list
    MogwserPrivacyPanel._refreshExceptionList();
  }

  /**
   * Toggle the panel visibility.
   */
  static togglePanel() {
    if (MogwserPrivacyPanel._panelEl) {
      if (MogwserPrivacyPanel._panelEl.hidden) {
        MogwserPrivacyPanel.showPanel();
      } else {
        MogwserPrivacyPanel.hidePanel();
      }
    }
  }

  /**
   * Show the panel and refresh toggle states.
   */
  static showPanel() {
    if (!MogwserPrivacyPanel._panelEl) {
      return;
    }
    // Refresh toggle states
    for (const toggle of PRIVACY_TOGGLES) {
      const el = MogwserPrivacyPanel._toggleEls.get(toggle.pref);
      if (el) {
        el.checked = isToggleActive(toggle);
      }
    }
    MogwserPrivacyPanel._updateProtectionLevelDisplay();
    MogwserPrivacyPanel._refreshExceptionList();
    MogwserPrivacyPanel._panelEl.hidden = false;
  }

  /**
   * Hide the panel.
   */
  static hidePanel() {
    if (MogwserPrivacyPanel._panelEl) {
      MogwserPrivacyPanel._panelEl.hidden = true;
    }
  }

  /**
   * Get the current protection level based on how many toggles are active.
   * @returns {"strict" | "standard" | "minimal"}
   */
  static getProtectionLevel() {
    let activeCount = 0;
    for (const toggle of PRIVACY_TOGGLES) {
      if (isToggleActive(toggle)) {
        activeCount++;
      }
    }
    if (activeCount >= 4) {
      return "strict";
    }
    if (activeCount >= 2) {
      return "standard";
    }
    return "minimal";
  }

  /**
   * Update the toolbar button badge color based on protection level.
   */
  static _updateBadge() {
    if (!MogwserPrivacyPanel._badgeEl) {
      return;
    }
    const level = MogwserPrivacyPanel.getProtectionLevel();
    MogwserPrivacyPanel._badgeEl.dataset.level = level;

    // Set badge text
    const labels = { strict: "S", standard: "M", minimal: "!" };
    MogwserPrivacyPanel._badgeEl.textContent = labels[level] || "?";
  }

  /**
   * Update the in-panel protection level display.
   */
  static _updateProtectionLevelDisplay() {
    const el = document.getElementById("mogwser-privacy-level");
    if (!el) {
      return;
    }
    const level = MogwserPrivacyPanel.getProtectionLevel();
    const labels = { strict: "Strict", standard: "Standard", minimal: "Minimal" };
    el.textContent = labels[level] || "Unknown";
    el.dataset.level = level;
  }

  /**
   * Handle a toggle state change: write pref and update badge.
   */
  static _onToggle(toggle, checked) {
    if (toggle.type === "bool") {
      writePref(toggle.pref, "bool", checked ? toggle.activeValue : !toggle.activeValue);
    } else if (toggle.type === "int") {
      // Int toggles: activeValue when on, 0 when off
      writePref(toggle.pref, "int", checked ? toggle.activeValue : 0);
    }
    MogwserPrivacyPanel._updateBadge();
    MogwserPrivacyPanel._updateProtectionLevelDisplay();
  }

  // -----------------------------------------------------------------------
  // Per-site exception management
  // -----------------------------------------------------------------------

  /**
   * Add a per-site exception for specified features.
   * @param {string} uri - The site URI (e.g., "https://example.com")
   * @param {string[]} features - Array of pref names to exempt
   */
  static addException(uri, features = []) {
    try {
      const ioService = Cc["@mozilla.org/network/io-service;1"]
        .getService(Ci.nsIIOService);
      const nsUri = ioService.newURI(uri);

      // Add a "trackingprotection" permission for the site
      Services.perms.addFromPrincipal(
        Services.scriptSecurityManager.createContentPrincipal(nsUri, {}),
        "trackingprotection",
        Services.perms.ALLOW_ACTION,
        Services.perms.EXPIRE_NEVER
      );

      // Store the feature list in a Mogwser-specific pref for UI purposes
      MogwserPrivacyPanel._saveExceptionMeta(uri, features);
      MogwserPrivacyPanel._refreshExceptionList();
      console.log(`MogwserPrivacyPanel: added exception for ${uri}`);
    } catch (e) {
      console.error("MogwserPrivacyPanel: failed to add exception:", e);
    }
  }

  /**
   * Remove a per-site exception.
   * @param {string} uri - The site URI
   */
  static removeException(uri) {
    try {
      const ioService = Cc["@mozilla.org/network/io-service;1"]
        .getService(Ci.nsIIOService);
      const nsUri = ioService.newURI(uri);

      Services.perms.removeFromPrincipal(
        Services.scriptSecurityManager.createContentPrincipal(nsUri, {}),
        "trackingprotection"
      );

      MogwserPrivacyPanel._removeExceptionMeta(uri);
      MogwserPrivacyPanel._refreshExceptionList();
      console.log(`MogwserPrivacyPanel: removed exception for ${uri}`);
    } catch (e) {
      console.error("MogwserPrivacyPanel: failed to remove exception:", e);
    }
  }

  /**
   * Get all current per-site exceptions.
   * @returns {Array<{ uri: string, features: string[] }>}
   */
  static getExceptions() {
    const exceptions = [];
    try {
      const enumerator = Services.perms.enumerator;
      while (enumerator.hasMoreElements()) {
        const perm = enumerator.getNext().QueryInterface(Ci.nsIPermission);
        if (perm.type === "trackingprotection" &&
            perm.capability === Services.perms.ALLOW_ACTION) {
          const uri = perm.principal.URI.spec;
          const meta = MogwserPrivacyPanel._getExceptionMeta(uri);
          exceptions.push({
            uri,
            features: meta ? meta.features : [],
          });
        }
      }
    } catch (e) {
      // Services.perms may not be available; return stored metadata instead
      return MogwserPrivacyPanel._getAllExceptionMeta();
    }
    return exceptions;
  }

  /**
   * Save exception metadata to prefs (features list for UI display).
   */
  static _saveExceptionMeta(uri, features) {
    try {
      const all = MogwserPrivacyPanel._getAllExceptionMetaRaw();
      all[uri] = { features };
      Services.prefs.setStringPref(
        "mogwser.privacy.exceptions",
        JSON.stringify(all)
      );
    } catch (e) {
      // Ignore pref write errors
    }
  }

  /**
   * Remove exception metadata from prefs.
   */
  static _removeExceptionMeta(uri) {
    try {
      const all = MogwserPrivacyPanel._getAllExceptionMetaRaw();
      delete all[uri];
      Services.prefs.setStringPref(
        "mogwser.privacy.exceptions",
        JSON.stringify(all)
      );
    } catch (e) {
      // Ignore pref write errors
    }
  }

  /**
   * Get metadata for a single exception.
   */
  static _getExceptionMeta(uri) {
    const all = MogwserPrivacyPanel._getAllExceptionMetaRaw();
    return all[uri] || null;
  }

  /**
   * Get all exception metadata as an array.
   */
  static _getAllExceptionMeta() {
    const raw = MogwserPrivacyPanel._getAllExceptionMetaRaw();
    return Object.entries(raw).map(([uri, meta]) => ({
      uri,
      features: meta.features || [],
    }));
  }

  /**
   * Get raw exception metadata object from prefs.
   */
  static _getAllExceptionMetaRaw() {
    try {
      const json = Services.prefs.getStringPref("mogwser.privacy.exceptions", "{}");
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  /**
   * Refresh the exception list UI.
   */
  static _refreshExceptionList() {
    if (!MogwserPrivacyPanel._exceptionListEl) {
      return;
    }

    const list = MogwserPrivacyPanel._exceptionListEl;
    list.innerHTML = "";

    const exceptions = MogwserPrivacyPanel.getExceptions();

    if (exceptions.length === 0) {
      const empty = document.createElement("li");
      empty.className = "mogwser-privacy-panel__exception-empty";
      empty.textContent = "No site exceptions";
      list.appendChild(empty);
      return;
    }

    for (const exc of exceptions) {
      const li = document.createElement("li");
      li.className = "mogwser-privacy-panel__exception-item";

      const uriSpan = document.createElement("span");
      uriSpan.className = "mogwser-privacy-panel__exception-uri";
      uriSpan.textContent = exc.uri;

      const removeBtn = document.createElement("button");
      removeBtn.className = "mogwser-privacy-panel__exception-remove";
      removeBtn.textContent = "\u00D7";
      removeBtn.title = "Remove exception";
      removeBtn.addEventListener("click", () => {
        MogwserPrivacyPanel.removeException(exc.uri);
      });

      li.appendChild(uriSpan);
      li.appendChild(removeBtn);
      list.appendChild(li);
    }
  }

  /**
   * Prompt user to add a new exception (simple UI prompt).
   */
  static _promptAddException() {
    // Services.prompt.prompt returns a boolean; the entered value is in the {value} object.
    const result = { value: "" };
    let ok = false;
    try {
      ok = Services.prompt.prompt(
        window,
        "Add Site Exception",
        "Enter the site URL to add an exception for:",
        result,
        null,
        {}
      );
    } catch (e) {
      // Fallback for non-browser contexts
      const uri = window.prompt?.("Enter site URL for exception:");
      if (uri) {
        MogwserPrivacyPanel.addException(uri, PRIVACY_TOGGLES.map(t => t.pref));
      }
      return;
    }

    if (ok && result.value) {
      MogwserPrivacyPanel.addException(result.value, PRIVACY_TOGGLES.map(t => t.pref));
    }
  }
}
