/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserThemeEngine functionality.
 */

add_task(async function test_theme_engine_loaded() {
  Assert.ok(
    window.gMogwserThemeEngine,
    "Theme engine module should be available"
  );
});

add_task(async function test_apply_theme() {
  const engine = window.gMogwserThemeEngine;
  const testTheme = {
    id: "test-theme",
    name: "Test Theme",
    type: "solid",
    colors: {
      primary: { h: 210, s: 70, l: 55 },
      secondary: { h: 210, s: 25, l: 20 },
      accent: { h: 0, s: 70, l: 55 },
      background: { h: 230, s: 20, l: 15 },
    },
    gradient: null,
    darkMode: null,
    metadata: { author: "test", version: "1.0" },
  };

  engine.applyTheme(testTheme);
  const root = document.documentElement;
  const primary = root.style.getPropertyValue("--mogwser-primary-color");
  Assert.ok(primary, "Primary color should be set after theme application");
});

add_task(async function test_theme_fires_event() {
  const engine = window.gMogwserThemeEngine;
  let eventFired = false;

  const handler = () => { eventFired = true; };
  document.addEventListener("MogwserThemeChanged", handler);

  engine.applyTheme({
    id: "event-test",
    name: "Event Test",
    type: "solid",
    colors: {
      primary: { h: 120, s: 50, l: 50 },
      secondary: { h: 120, s: 25, l: 20 },
      accent: { h: 0, s: 50, l: 50 },
      background: { h: 120, s: 10, l: 10 },
    },
    gradient: null,
    darkMode: null,
    metadata: { author: "test", version: "1.0" },
  });

  Assert.ok(eventFired, "MogwserThemeChanged event should fire");
  document.removeEventListener("MogwserThemeChanged", handler);
});
