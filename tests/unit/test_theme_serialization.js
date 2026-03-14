/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * xpcshell unit tests for theme export/import serialization.
 */

const { MogwserThemeEngine } = ChromeUtils.importESModule(
  "chrome://mogwser/content/themes/MogwserThemeEngine.mjs"
);

add_task(async function test_export_produces_valid_json() {
  const theme = {
    id: "test-export",
    name: "Export Test",
    type: "gradient",
    colors: {
      primary: { h: 210, s: 70, l: 55 },
      secondary: { h: 210, s: 25, l: 20 },
      accent: { h: 0, s: 70, l: 55 },
      background: { h: 230, s: 20, l: 15 },
    },
    gradient: {
      angle: 135,
      stops: [
        { color: "hsl(210, 70%, 55%)", position: 0 },
        { color: "hsl(210, 25%, 20%)", position: 100 },
      ],
    },
    darkMode: null,
    metadata: { author: "test", version: "1.0" },
  };

  const exported = MogwserThemeEngine.exportTheme(theme);
  const parsed = JSON.parse(exported);

  Assert.equal(parsed.id, "test-export", "Exported ID should match");
  Assert.equal(parsed.name, "Export Test", "Exported name should match");
  Assert.ok(parsed.colors.primary, "Colors should be present");
});

add_task(async function test_import_rejects_invalid_json() {
  let threw = false;
  try {
    MogwserThemeEngine.importTheme("not valid json {{{");
  } catch (e) {
    threw = true;
  }
  Assert.ok(threw, "Import should throw for invalid JSON");
});

add_task(async function test_import_rejects_missing_fields() {
  let threw = false;
  try {
    MogwserThemeEngine.importTheme(JSON.stringify({ name: "Incomplete" }));
  } catch (e) {
    threw = true;
  }
  Assert.ok(threw, "Import should throw for missing required fields");
});

add_task(async function test_roundtrip_serialization() {
  const original = {
    id: "roundtrip-test",
    name: "Roundtrip",
    type: "solid",
    colors: {
      primary: { h: 180, s: 50, l: 50 },
      secondary: { h: 180, s: 25, l: 25 },
      accent: { h: 30, s: 80, l: 60 },
      background: { h: 200, s: 15, l: 12 },
    },
    gradient: null,
    darkMode: null,
    metadata: { author: "test", version: "1.0" },
  };

  const exported = MogwserThemeEngine.exportTheme(original);
  const imported = MogwserThemeEngine.importTheme(exported);

  Assert.equal(imported.id, original.id, "ID should survive roundtrip");
  Assert.equal(imported.name, original.name, "Name should survive roundtrip");
  Assert.equal(
    imported.colors.primary.h,
    original.colors.primary.h,
    "Primary hue should survive roundtrip"
  );
});
