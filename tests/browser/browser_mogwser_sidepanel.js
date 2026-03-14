/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserSidePanel functionality.
 */

add_task(async function test_sidepanel_module_loaded() {
  Assert.ok(
    window.gMogwserSidePanel,
    "Side panel module should be available"
  );
});

add_task(async function test_sidepanel_open_close() {
  const sidePanel = window.gMogwserSidePanel;

  sidePanel.open("about:blank");
  Assert.ok(sidePanel._isOpen, "Side panel should be open after open()");

  sidePanel.close();
  Assert.ok(!sidePanel._isOpen, "Side panel should be closed after close()");
});

add_task(async function test_sidepanel_toggle() {
  const sidePanel = window.gMogwserSidePanel;

  sidePanel.close();
  sidePanel.toggle();
  Assert.ok(sidePanel._isOpen, "Side panel should be open after toggle from closed");

  sidePanel.toggle();
  Assert.ok(!sidePanel._isOpen, "Side panel should be closed after second toggle");
});
