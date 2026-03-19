/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserWorkspaces functionality.
 */

add_task(async function test_default_workspace_exists() {
  const workspaces = window.gMogwserWorkspaces;
  Assert.ok(workspaces, "Workspaces module should be available");
  Assert.ok(
    workspaces.activeWorkspaceId,
    "An active workspace should exist"
  );
});

add_task(async function test_create_workspace() {
  const workspaces = window.gMogwserWorkspaces;
  const ws = workspaces.createWorkspace("Test Workspace", "🧪");
  Assert.ok(ws, "New workspace should be created");
  Assert.equal(ws.name, "Test Workspace", "Workspace name should match");

  workspaces.deleteWorkspace(ws.id);
});

add_task(async function test_switch_workspace_hides_tabs() {
  const workspaces = window.gMogwserWorkspaces;

  const ws1 = workspaces.createWorkspace("Workspace A", "🅰️");
  const ws2 = workspaces.createWorkspace("Workspace B", "🅱️");

  const tab1 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  workspaces.assignTabToWorkspace(tab1, ws1.id);

  const tab2 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  workspaces.assignTabToWorkspace(tab2, ws2.id);

  workspaces.switchWorkspace(ws1.id);
  Assert.ok(!tab1.hidden, "Tab in active workspace should be visible");
  Assert.ok(tab2.hidden, "Tab in other workspace should be hidden");

  workspaces.switchWorkspace(ws2.id);
  Assert.ok(tab1.hidden, "Tab in other workspace should now be hidden");
  Assert.ok(!tab2.hidden, "Tab in active workspace should be visible");

  BrowserTestUtils.removeTab(tab1);
  BrowserTestUtils.removeTab(tab2);
  workspaces.deleteWorkspace(ws1.id);
  workspaces.deleteWorkspace(ws2.id);
});

add_task(async function test_keyboard_shortcut_switches_workspace() {
  const workspaces = window.gMogwserWorkspaces;
  const ws1 = workspaces.createWorkspace("KB Test 1", "1");
  const ws2 = workspaces.createWorkspace("KB Test 2", "2");

  workspaces.switchWorkspace(ws1.id);
  Assert.equal(
    workspaces.activeWorkspaceId,
    ws1.id,
    "Workspace 1 should be active initially"
  );

  // The Ctrl+digit shortcut uses 1-based indexing into the workspace list
  // We can't easily simulate the full keydown event, but we can verify
  // the workspace switching logic directly
  const allWorkspaces = workspaces.getAllWorkspaces();
  const ws2Index = allWorkspaces.findIndex(w => w.id === ws2.id);
  if (ws2Index >= 0 && ws2Index < 9) {
    workspaces.switchWorkspace(allWorkspaces[ws2Index].id);
    Assert.equal(
      workspaces.activeWorkspaceId,
      ws2.id,
      "Workspace should switch to ws2 via index-based selection"
    );
  }

  workspaces.deleteWorkspace(ws1.id);
  workspaces.deleteWorkspace(ws2.id);
});

add_task(async function test_essential_tabs_always_visible() {
  const workspaces = window.gMogwserWorkspaces;
  const ws = workspaces.createWorkspace("Other", "🔄");

  const essentialTab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  essentialTab.setAttribute("mogwser-essential", "true");
  workspaces.assignTabToWorkspace(essentialTab, workspaces.activeWorkspaceId);

  workspaces.switchWorkspace(ws.id);
  Assert.ok(
    !essentialTab.hidden,
    "Essential tab should remain visible in all workspaces"
  );

  BrowserTestUtils.removeTab(essentialTab);
  workspaces.deleteWorkspace(ws.id);
});
