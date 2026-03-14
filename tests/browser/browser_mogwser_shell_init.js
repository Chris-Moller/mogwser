/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test that MogwserShell initializes correctly.
 */

add_task(async function test_shell_initialized() {
  Assert.ok(
    window.gMogwserShell,
    "MogwserShell global should be defined"
  );
  Assert.ok(
    window.gMogwserShell.initialized,
    "MogwserShell should be initialized"
  );
});

add_task(async function test_css_variables_set() {
  const root = document.documentElement;
  const style = getComputedStyle(root);

  Assert.ok(
    style.getPropertyValue("--mogwser-sidebar-width"),
    "CSS variable --mogwser-sidebar-width should be set"
  );
  Assert.ok(
    style.getPropertyValue("--mogwser-primary-color"),
    "CSS variable --mogwser-primary-color should be set"
  );
  Assert.ok(
    style.getPropertyValue("--mogwser-secondary-color"),
    "CSS variable --mogwser-secondary-color should be set"
  );
  Assert.ok(
    style.getPropertyValue("--mogwser-accent-color"),
    "CSS variable --mogwser-accent-color should be set"
  );
  Assert.ok(
    style.getPropertyValue("--mogwser-compact-mode") !== "",
    "CSS variable --mogwser-compact-mode should be set"
  );
});

add_task(async function test_sidebar_element_exists() {
  const sidebar = document.getElementById("mogwser-sidebar");
  Assert.ok(sidebar, "Mogwser sidebar element should exist in the DOM");

  const tabsContainer = document.getElementById("mogwser-tabs-container");
  Assert.ok(tabsContainer, "Tabs container should exist in the DOM");

  const workspaceContainer = document.getElementById("mogwser-workspace-container");
  Assert.ok(workspaceContainer, "Workspace container should exist in the DOM");
});

add_task(async function test_all_modules_loaded() {
  Assert.ok(window.gMogwserThemeEngine, "Theme engine should be loaded");
  Assert.ok(window.gMogwserTabBar, "Tab bar should be loaded");
  Assert.ok(window.gMogwserWorkspaces, "Workspaces should be loaded");
  Assert.ok(window.gMogwserSplitView, "Split view should be loaded");
  Assert.ok(window.gMogwserCompactMode, "Compact mode should be loaded");
  Assert.ok(window.gMogwserSidePanel, "Side panel should be loaded");
  Assert.ok(window.gMogwserPrivacyPanel, "Privacy panel should be loaded");
});
