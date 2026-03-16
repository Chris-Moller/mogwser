/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserWorkspaceStorage — Persistence layer for workspace state.
 *
 * Reads and writes workspace data to `mogwser-sessions.jsonlz4` in the
 * user's profile directory. Uses IOUtils for file I/O and LZ4 compression.
 *
 * File format:
 * {
 *   "version": 1,
 *   "workspaces": [ { id, name, icon, theme, isDefault }, ... ],
 *   "tabAssignments": { tabSyncId: workspaceId, ... },
 *   "splitGroups": { ... }
 * }
 *
 * The `splitGroups` key is reserved for the split-view module (sub-2) and
 * is preserved during read/write even if this module doesn't manage it.
 */

const STORAGE_FILENAME = "mogwser-sessions.jsonlz4";
const STORAGE_VERSION = 1;

export class MogwserWorkspaceStorage {
  /** Cached file path */
  static _filePath = null;

  /** Debounce timer for save operations */
  static _saveTimer = null;

  /** Save debounce interval in milliseconds */
  static _saveDebounceMs = 1000;

  /** Cached data from last load (to preserve keys we don't manage) */
  static _lastLoadedData = null;

  /**
   * Get the full path to the storage file.
   * @returns {string}
   */
  static get filePath() {
    if (!MogwserWorkspaceStorage._filePath) {
      MogwserWorkspaceStorage._filePath = PathUtils.join(
        PathUtils.profileDir,
        STORAGE_FILENAME
      );
    }
    return MogwserWorkspaceStorage._filePath;
  }

  /**
   * Load workspace data from disk.
   * @returns {Promise<object|null>} The parsed data, or null if no file exists.
   */
  static async load() {
    try {
      const bytes = await IOUtils.read(MogwserWorkspaceStorage.filePath, {
        decompress: true,
      });

      const text = new TextDecoder().decode(bytes);
      const data = JSON.parse(text);

      // Version check
      if (data.version !== STORAGE_VERSION) {
        console.warn(
          `MogwserWorkspaceStorage: Unknown version ${data.version}, attempting migration`
        );
        return MogwserWorkspaceStorage._migrate(data);
      }

      MogwserWorkspaceStorage._lastLoadedData = data;
      return data;
    } catch (e) {
      if (DOMException.isInstance?.(e) && e.name === "NotFoundError") {
        // File doesn't exist yet — that's fine on first run
        return null;
      }
      // IOUtils may throw a different error type
      if (e.result === Cr.NS_ERROR_FILE_NOT_FOUND) {
        return null;
      }
      console.error("MogwserWorkspaceStorage: Failed to load:", e);
      return null;
    }
  }

  /**
   * Save workspace data to disk.
   * Merges with previously loaded data to preserve keys from other modules.
   *
   * @param {object} data — { workspaces, tabAssignments }
   * @param {boolean} [immediate=false] — skip debounce and save immediately
   */
  static save(data, immediate = false) {
    if (immediate) {
      MogwserWorkspaceStorage._doSave(data);
      return;
    }

    // Debounce rapid saves
    if (MogwserWorkspaceStorage._saveTimer) {
      clearTimeout(MogwserWorkspaceStorage._saveTimer);
    }

    MogwserWorkspaceStorage._saveTimer = setTimeout(() => {
      MogwserWorkspaceStorage._saveTimer = null;
      MogwserWorkspaceStorage._doSave(data);
    }, MogwserWorkspaceStorage._saveDebounceMs);
  }

  /**
   * Perform the actual save operation.
   * @param {object} data — { workspaces, tabAssignments }
   */
  static async _doSave(data) {
    try {
      // Merge with last loaded data to preserve keys from other modules
      const base = MogwserWorkspaceStorage._lastLoadedData || {};
      const merged = {
        ...base,
        version: STORAGE_VERSION,
      };

      // Only overwrite keys that are explicitly provided
      if ("workspaces" in data) {
        merged.workspaces = data.workspaces;
      } else if (!merged.workspaces) {
        merged.workspaces = [];
      }
      if ("tabAssignments" in data) {
        merged.tabAssignments = data.tabAssignments;
      } else if (!merged.tabAssignments) {
        merged.tabAssignments = {};
      }
      if ("splitGroups" in data) {
        merged.splitGroups = data.splitGroups;
      } else if (!merged.splitGroups) {
        merged.splitGroups = {};
      }

      const text = JSON.stringify(merged, null, 0);
      const bytes = new TextEncoder().encode(text);

      await IOUtils.write(MogwserWorkspaceStorage.filePath, bytes, {
        compress: true,
        tmpPath: `${MogwserWorkspaceStorage.filePath}.tmp`,
      });

      MogwserWorkspaceStorage._lastLoadedData = merged;
    } catch (e) {
      console.error("MogwserWorkspaceStorage: Failed to save:", e);
    }
  }

  /**
   * Migrate data from an older version format.
   * Currently only version 1 is supported, so this is a placeholder.
   * @param {object} data — the raw parsed data
   * @returns {object|null}
   */
  static _migrate(data) {
    // Future migrations would go here.
    // For now, attempt to use the data as-is with defaults.
    return {
      version: STORAGE_VERSION,
      workspaces: data.workspaces || [],
      tabAssignments: data.tabAssignments || {},
      splitGroups: data.splitGroups || {},
    };
  }

  /**
   * Delete the storage file (for testing or reset).
   */
  static async clear() {
    try {
      await IOUtils.remove(MogwserWorkspaceStorage.filePath, {
        ignoreAbsent: true,
      });
      MogwserWorkspaceStorage._lastLoadedData = null;
    } catch (e) {
      console.error("MogwserWorkspaceStorage: Failed to clear:", e);
    }
  }

  /**
   * Force an immediate flush of any pending save.
   */
  static async flush() {
    if (MogwserWorkspaceStorage._saveTimer) {
      clearTimeout(MogwserWorkspaceStorage._saveTimer);
      MogwserWorkspaceStorage._saveTimer = null;
    }
    // Re-save the last known state immediately
    if (MogwserWorkspaceStorage._lastLoadedData) {
      await MogwserWorkspaceStorage._doSave(
        MogwserWorkspaceStorage._lastLoadedData
      );
    }
  }
}
