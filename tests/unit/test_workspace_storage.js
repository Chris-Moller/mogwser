/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * xpcshell unit tests for MogwserWorkspaceStorage serialization.
 */

const { MogwserWorkspaceStorage } = ChromeUtils.importESModule(
  "chrome://mogwser/content/workspaces/MogwserWorkspaceStorage.mjs"
);

add_task(async function test_serialize_workspaces() {
  const data = {
    version: 1,
    workspaces: [
      { id: "ws-1", name: "Default", icon: "🏠", theme: null, isDefault: true },
      { id: "ws-2", name: "Work", icon: "💼", theme: null, isDefault: false },
    ],
    tabAssignments: {
      "tab-sync-1": "ws-1",
      "tab-sync-2": "ws-2",
    },
    splitGroups: {},
  };

  const json = JSON.stringify(data);
  const parsed = JSON.parse(json);

  Assert.equal(parsed.version, 1, "Version should be 1");
  Assert.equal(parsed.workspaces.length, 2, "Should have 2 workspaces");
  Assert.equal(parsed.tabAssignments["tab-sync-1"], "ws-1", "Tab assignment should be correct");
});

add_task(async function test_deserialize_preserves_fields() {
  const original = {
    version: 1,
    workspaces: [
      { id: "ws-a", name: "Personal", icon: "👤", theme: null, isDefault: true },
    ],
    tabAssignments: {},
    splitGroups: {
      "group-1": {
        tree: { type: "leaf", tabId: "tab-1", size: 100 },
        tabIds: ["tab-1"],
      },
    },
  };

  const json = JSON.stringify(original);
  const restored = JSON.parse(json);

  Assert.equal(restored.workspaces[0].name, "Personal", "Workspace name preserved");
  Assert.ok(restored.splitGroups["group-1"], "Split groups preserved");
  Assert.equal(
    restored.splitGroups["group-1"].tree.type,
    "leaf",
    "Split tree type preserved"
  );
});

add_task(async function test_empty_state_serialization() {
  const emptyState = {
    version: 1,
    workspaces: [],
    tabAssignments: {},
    splitGroups: {},
  };

  const json = JSON.stringify(emptyState);
  const parsed = JSON.parse(json);

  Assert.equal(parsed.version, 1, "Version preserved for empty state");
  Assert.equal(parsed.workspaces.length, 0, "Empty workspaces array");
  Assert.deepEqual(parsed.tabAssignments, {}, "Empty tab assignments");
  Assert.deepEqual(parsed.splitGroups, {}, "Empty split groups");
});
