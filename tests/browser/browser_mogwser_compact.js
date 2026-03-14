/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserCompactMode functionality.
 */

add_task(async function test_compact_mode_module_loaded() {
  Assert.ok(
    window.gMogwserCompactMode,
    "Compact mode module should be available"
  );
});

add_task(async function test_toggle_compact_mode() {
  const compactMode = window.gMogwserCompactMode;
  const root = document.documentElement;

  compactMode.disable();
  Assert.equal(
    root.style.getPropertyValue("--mogwser-compact-mode"),
    "0",
    "Compact mode CSS variable should be 0 when disabled"
  );

  compactMode.enable();
  Assert.equal(
    root.style.getPropertyValue("--mogwser-compact-mode"),
    "1",
    "Compact mode CSS variable should be 1 when enabled"
  );

  compactMode.disable();
});

add_task(async function test_compact_mode_fires_event() {
  const compactMode = window.gMogwserCompactMode;
  let eventFired = false;
  let eventDetail = null;

  const handler = (e) => {
    eventFired = true;
    eventDetail = e.detail;
  };
  document.addEventListener("MogwserCompactModeChanged", handler);

  compactMode.toggle();

  Assert.ok(eventFired, "MogwserCompactModeChanged event should fire");
  Assert.ok(
    typeof eventDetail.compact === "boolean",
    "Event detail should contain compact boolean"
  );

  document.removeEventListener("MogwserCompactModeChanged", handler);
  compactMode.disable();
});
