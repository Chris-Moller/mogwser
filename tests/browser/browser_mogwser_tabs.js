/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserTabBar functionality.
 */

add_task(async function test_tab_bar_renders_tabs() {
  const tabCount = gBrowser.tabs.length;
  const tabElements = document.querySelectorAll(".mogwser-tab");
  Assert.equal(
    tabElements.length,
    tabCount,
    "Tab bar should render one element per browser tab"
  );
});

add_task(async function test_active_tab_highlighted() {
  const activeTab = gBrowser.selectedTab;
  const tabBar = window.gMogwserTabBar;
  Assert.ok(tabBar, "Tab bar module should be available");

  const activeElement = document.querySelector(".mogwser-tab--active");
  Assert.ok(activeElement, "One tab should have the active class");
});

add_task(async function test_new_tab_appears_in_bar() {
  const initialCount = document.querySelectorAll(".mogwser-tab").length;
  const newTab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);

  const updatedCount = document.querySelectorAll(".mogwser-tab").length;
  Assert.equal(
    updatedCount,
    initialCount + 1,
    "New tab should appear in the tab bar"
  );

  BrowserTestUtils.removeTab(newTab);
});

add_task(async function test_close_tab_removes_from_bar() {
  const newTab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);

  const countBefore = document.querySelectorAll(".mogwser-tab").length;
  BrowserTestUtils.removeTab(newTab);

  const countAfter = document.querySelectorAll(".mogwser-tab").length;
  Assert.equal(
    countAfter,
    countBefore - 1,
    "Closing tab should remove it from the bar"
  );
});

add_task(async function test_pin_tab() {
  const tab = gBrowser.selectedTab;
  gBrowser.pinTab(tab);

  const pinnedElements = document.querySelectorAll(".mogwser-tab--pinned");
  Assert.ok(
    pinnedElements.length > 0,
    "Pinned tab should have pinned class"
  );

  gBrowser.unpinTab(tab);
});
