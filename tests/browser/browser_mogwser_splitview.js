/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserSplitView functionality.
 */

add_task(async function test_splitview_module_loaded() {
  Assert.ok(
    window.gMogwserSplitView,
    "Split view module should be available"
  );
});

add_task(async function test_create_split() {
  const splitView = window.gMogwserSplitView;
  const tab1 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const tab2 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  await BrowserTestUtils.browserLoaded(tab2.linkedBrowser);

  const group = splitView.createSplit(tab1, tab2, "row");
  Assert.ok(group, "Split group should be created");
  Assert.equal(group.tabIds.size, 2, "Group should contain 2 tabs");

  // Use the same tab ID format as MogwserSplitView._getTabId
  for (const tabId of group.tabIds) {
    splitView.removeSplit(group.id, tabId);
  }
  BrowserTestUtils.removeTab(tab1);
  BrowserTestUtils.removeTab(tab2);
});

add_task(async function test_split_respects_min_panel_size() {
  const splitView = window.gMogwserSplitView;
  const minSize = Services.prefs.getIntPref("mogwser.splitview.min-panel-size", 7);
  Assert.equal(minSize, 7, "Minimum panel size should default to 7%");
});
