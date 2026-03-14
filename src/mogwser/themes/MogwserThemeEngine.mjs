/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserThemeEngine — Manages theme application, per-workspace themes,
 * dark mode adaptation, and theme installation/export.
 *
 * Theme data model:
 * {
 *   id: string,
 *   name: string,
 *   type: "light" | "dark" | "adaptive",
 *   colors: {
 *     primary:    { h: number, s: number, l: number },
 *     secondary:  { h: number, s: number, l: number },
 *     accent:     { h: number, s: number, l: number },
 *     background: { h: number, s: number, l: number }
 *   },
 *   gradient: {
 *     angle: number,
 *     stops: [{ color: { h, s, l }, position: number }, ...]
 *   },
 *   darkMode: {
 *     lightnessOffset: number,
 *     saturationOffset: number
 *   },
 *   metadata: {
 *     author: string,
 *     version: string,
 *     description: string
 *   }
 * }
 */

const THEME_DIR = "mogwser-themes";
const THEME_PREF_KEY = "mogwser.theme.active";
const WORKSPACE_THEMES_PREF_KEY = "mogwser.theme.workspaces";
const TRANSITION_DURATION_MS = 300;

const DEFAULT_THEME = Object.freeze({
  id: "mogwser-default",
  name: "Mogwser Default",
  type: "dark",
  colors: {
    primary:    { h: 213, s: 60, l: 55 },
    secondary:  { h: 207, s: 32, l: 24 },
    accent:     { h: 6, s: 78, l: 57 },
    background: { h: 234, s: 31, l: 14 },
  },
  gradient: {
    angle: 135,
    stops: [
      { color: { h: 213, s: 60, l: 55 }, position: 0 },
      { color: { h: 207, s: 32, l: 24 }, position: 100 },
    ],
  },
  darkMode: {
    lightnessOffset: -10,
    saturationOffset: -5,
  },
  metadata: {
    author: "Mogwser",
    version: "1.0.0",
    description: "Default Mogwser theme",
  },
});

/**
 * Converts an HSL object { h, s, l } to a CSS hsl() string.
 */
function hslToString({ h, s, l }) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Builds a CSS linear-gradient string from a gradient descriptor.
 */
function buildGradientCSS(gradient) {
  if (!gradient || !gradient.stops || gradient.stops.length === 0) {
    return "none";
  }
  const stops = gradient.stops
    .map(stop => `${hslToString(stop.color)} ${stop.position}%`)
    .join(", ");
  return `linear-gradient(${gradient.angle}deg, ${stops})`;
}

/**
 * Adjusts an HSL color for dark/light mode.
 */
function adjustForMode(hsl, darkModeSettings, isDark) {
  if (!darkModeSettings) {
    return hsl;
  }
  const offset = isDark ? 1 : -1;
  return {
    h: hsl.h,
    s: Math.max(0, Math.min(100, hsl.s + darkModeSettings.saturationOffset * offset)),
    l: Math.max(0, Math.min(100, hsl.l + darkModeSettings.lightnessOffset * offset)),
  };
}

export class MogwserThemeEngine {
  static _activeTheme = null;
  static _themes = new Map();
  static _darkMode = false;
  static _workspaceThemes = new Map();
  static _initialized = false;
  static _darkModeQuery = null;
  static _transitionEl = null;

  /**
   * Initialize the theme engine: load saved theme, set up dark mode
   * media query listener, listen for workspace change events.
   */
  static async init() {
    if (MogwserThemeEngine._initialized) {
      return;
    }

    // Register the default theme
    MogwserThemeEngine._themes.set(DEFAULT_THEME.id, DEFAULT_THEME);

    // Load installed themes from profile directory
    await MogwserThemeEngine.loadInstalledThemes();

    // Load per-workspace theme assignments
    MogwserThemeEngine._loadWorkspaceThemes();

    // Set up dark mode media query listener
    try {
      MogwserThemeEngine._darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      MogwserThemeEngine._darkMode = MogwserThemeEngine._darkModeQuery.matches;
      MogwserThemeEngine._darkModeQuery.addEventListener(
        "change",
        (mql) => MogwserThemeEngine._onDarkModeChange(mql)
      );
    } catch (e) {
      // matchMedia may not exist in all contexts; default to dark
      MogwserThemeEngine._darkMode = true;
    }

    // Listen for workspace change events
    window.addEventListener(
      "MogwserWorkspaceChanged",
      (event) => MogwserThemeEngine._onWorkspaceChanged(event)
    );

    // Load saved active theme or fall back to default
    let savedThemeId = null;
    try {
      savedThemeId = Services.prefs.getStringPref(THEME_PREF_KEY, null);
    } catch (e) {
      // Pref doesn't exist yet
    }

    const themeToApply = savedThemeId && MogwserThemeEngine._themes.has(savedThemeId)
      ? MogwserThemeEngine._themes.get(savedThemeId)
      : DEFAULT_THEME;

    MogwserThemeEngine.applyTheme(themeToApply);

    MogwserThemeEngine._initialized = true;
    console.log("MogwserThemeEngine: initialized");
  }

  /**
   * Apply a theme by injecting CSS custom properties on :root.
   * Fires MogwserThemeChanged event.
   */
  static applyTheme(theme) {
    if (!theme || !theme.colors) {
      console.warn("MogwserThemeEngine: invalid theme object");
      return;
    }

    const root = document.documentElement;
    const dm = MogwserThemeEngine._darkMode;
    const dmSettings = theme.darkMode;

    const primary = adjustForMode(theme.colors.primary, dmSettings, dm);
    const secondary = adjustForMode(theme.colors.secondary, dmSettings, dm);
    const accent = theme.colors.accent; // accent stays vivid
    const background = adjustForMode(theme.colors.background, dmSettings, dm);

    root.style.setProperty("--mogwser-primary-color", hslToString(primary));
    root.style.setProperty("--mogwser-secondary-color", hslToString(secondary));
    root.style.setProperty("--mogwser-accent-color", hslToString(accent));
    root.style.setProperty("--mogwser-bg-color", hslToString(background));
    root.style.setProperty("--mogwser-gradient", buildGradientCSS(theme.gradient));

    MogwserThemeEngine._activeTheme = theme;

    // Persist selection
    try {
      Services.prefs.setStringPref(THEME_PREF_KEY, theme.id);
    } catch (e) {
      // May fail outside browser context
    }

    // Fire event
    window.dispatchEvent(
      new CustomEvent("MogwserThemeChanged", { detail: { theme } })
    );
  }

  /**
   * Apply a theme with a double-buffer crossfade transition.
   * Creates a ::before overlay with the new theme, fades it in,
   * then sets properties and removes the overlay.
   */
  static _applyWithTransition(theme) {
    const sidebar = document.getElementById("mogwser-sidebar");
    if (!sidebar) {
      MogwserThemeEngine.applyTheme(theme);
      return;
    }

    // Mark the sidebar as transitioning (CSS uses this for ::after layer)
    const dm = MogwserThemeEngine._darkMode;
    const dmSettings = theme.darkMode;
    const primary = adjustForMode(theme.colors.primary, dmSettings, dm);
    const secondary = adjustForMode(theme.colors.secondary, dmSettings, dm);
    const newGradient = buildGradientCSS(theme.gradient);

    // Set the "next" gradient on a data attribute so CSS ::after can pick it up
    sidebar.style.setProperty("--mogwser-next-gradient", newGradient);
    sidebar.classList.add("mogwser-theme-transitioning");

    // After the CSS transition completes, finalize
    const onEnd = () => {
      sidebar.classList.remove("mogwser-theme-transitioning");
      sidebar.style.removeProperty("--mogwser-next-gradient");
      MogwserThemeEngine.applyTheme(theme);
    };

    sidebar.addEventListener("transitionend", onEnd, { once: true });

    // Safety timeout in case transitionend doesn't fire
    setTimeout(onEnd, TRANSITION_DURATION_MS + 50);
  }

  /**
   * Assign a theme to a specific workspace. When the workspace becomes
   * active the theme engine will apply it automatically.
   */
  static setPerWorkspaceTheme(workspaceId, theme) {
    if (!workspaceId) {
      return;
    }
    if (theme === null) {
      MogwserThemeEngine._workspaceThemes.delete(workspaceId);
    } else {
      MogwserThemeEngine._workspaceThemes.set(workspaceId, theme.id || theme);
    }
    MogwserThemeEngine._saveWorkspaceThemes();
  }

  /**
   * Handle workspace-changed event: apply per-workspace theme if one
   * is set, otherwise fall back to the global active theme.
   */
  static _onWorkspaceChanged(event) {
    const workspaceId = event.detail && event.detail.workspaceId;
    if (!workspaceId) {
      return;
    }

    const themeId = MogwserThemeEngine._workspaceThemes.get(workspaceId);
    if (themeId && MogwserThemeEngine._themes.has(themeId)) {
      MogwserThemeEngine._applyWithTransition(
        MogwserThemeEngine._themes.get(themeId)
      );
    } else if (MogwserThemeEngine._activeTheme) {
      MogwserThemeEngine._applyWithTransition(MogwserThemeEngine._activeTheme);
    }
  }

  /**
   * Respond to OS dark/light mode changes.
   */
  static _onDarkModeChange(mql) {
    MogwserThemeEngine._darkMode = mql.matches;
    if (MogwserThemeEngine._activeTheme) {
      MogwserThemeEngine.applyTheme(MogwserThemeEngine._activeTheme);
    }
  }

  /**
   * Export a theme as a JSON string.
   */
  static exportTheme(theme) {
    if (!theme) {
      return null;
    }
    return JSON.stringify(theme, null, 2);
  }

  /**
   * Import a theme from a JSON string. Validates required fields.
   * Returns the parsed theme object or null on failure.
   */
  static importTheme(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.error("MogwserThemeEngine: failed to parse theme JSON:", e);
      return null;
    }

    if (!MogwserThemeEngine._validateTheme(parsed)) {
      console.error("MogwserThemeEngine: invalid theme structure");
      return null;
    }

    // Assign an ID if missing
    if (!parsed.id) {
      parsed.id = `custom-${Date.now()}`;
    }

    MogwserThemeEngine._themes.set(parsed.id, parsed);
    return parsed;
  }

  /**
   * Validate that a theme object has the required fields.
   */
  static _validateTheme(theme) {
    if (!theme || typeof theme !== "object") {
      return false;
    }
    if (!theme.name || typeof theme.name !== "string") {
      return false;
    }
    if (!theme.colors || typeof theme.colors !== "object") {
      return false;
    }
    const requiredColors = ["primary", "secondary", "accent", "background"];
    for (const key of requiredColors) {
      const c = theme.colors[key];
      if (!c || typeof c.h !== "number" || typeof c.s !== "number" || typeof c.l !== "number") {
        return false;
      }
    }
    return true;
  }

  /**
   * Scan the profile directory for installed theme JSON files.
   */
  static async loadInstalledThemes() {
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const themesDir = profileDir.clone();
      themesDir.append(THEME_DIR);

      if (!themesDir.exists() || !themesDir.isDirectory()) {
        return;
      }

      const entries = themesDir.directoryEntries;
      while (entries.hasMoreElements()) {
        const entry = entries.getNext().QueryInterface(Ci.nsIFile);
        if (!entry.leafName.endsWith(".json")) {
          continue;
        }
        try {
          const data = await IOUtils.readUTF8(entry.path);
          const theme = MogwserThemeEngine.importTheme(data);
          if (theme) {
            console.log(`MogwserThemeEngine: loaded theme "${theme.name}"`);
          }
        } catch (e) {
          console.warn(`MogwserThemeEngine: failed to load ${entry.leafName}:`, e);
        }
      }
    } catch (e) {
      // Services may not be available in all contexts
      console.warn("MogwserThemeEngine: could not scan themes directory:", e);
    }
  }

  /**
   * Install a theme by saving its JSON to the themes directory.
   */
  static async installTheme(themeJson) {
    const theme = typeof themeJson === "string"
      ? MogwserThemeEngine.importTheme(themeJson)
      : themeJson;

    if (!theme) {
      return null;
    }

    // Ensure themes directory exists
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const themesDir = profileDir.clone();
      themesDir.append(THEME_DIR);
      if (!themesDir.exists()) {
        themesDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      }

      const filePath = PathUtils.join(themesDir.path, `${theme.id}.json`);
      await IOUtils.writeUTF8(filePath, JSON.stringify(theme, null, 2));

      MogwserThemeEngine._themes.set(theme.id, theme);
      console.log(`MogwserThemeEngine: installed theme "${theme.name}"`);
      return theme;
    } catch (e) {
      console.error("MogwserThemeEngine: failed to install theme:", e);
      return null;
    }
  }

  /**
   * Get all registered themes.
   */
  static getThemes() {
    return Array.from(MogwserThemeEngine._themes.values());
  }

  /**
   * Get the currently active theme.
   */
  static get activeTheme() {
    return MogwserThemeEngine._activeTheme;
  }

  /**
   * Get whether dark mode is active.
   */
  static get darkMode() {
    return MogwserThemeEngine._darkMode;
  }

  /**
   * Persist workspace-to-theme mappings.
   */
  static _saveWorkspaceThemes() {
    try {
      const obj = Object.fromEntries(MogwserThemeEngine._workspaceThemes);
      Services.prefs.setStringPref(WORKSPACE_THEMES_PREF_KEY, JSON.stringify(obj));
    } catch (e) {
      // May fail outside browser context
    }
  }

  /**
   * Load workspace-to-theme mappings from prefs.
   */
  static _loadWorkspaceThemes() {
    try {
      const json = Services.prefs.getStringPref(WORKSPACE_THEMES_PREF_KEY, "{}");
      const obj = JSON.parse(json);
      for (const [wsId, themeId] of Object.entries(obj)) {
        MogwserThemeEngine._workspaceThemes.set(wsId, themeId);
      }
    } catch (e) {
      // Pref doesn't exist yet or is invalid
    }
  }
}
