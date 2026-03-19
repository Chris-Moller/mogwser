/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * xpcshell unit tests for theme color conversions and harmony algorithms.
 */

const { MogwserGradientPicker } = ChromeUtils.importESModule(
  "chrome://mogwser/content/themes/MogwserGradientPicker.mjs"
);

add_task(async function test_hsl_to_rgb_red() {
  const { r, g, b } = MogwserGradientPicker.hslToRgb(0, 100, 50);
  Assert.equal(r, 255, "Red channel should be 255 for pure red");
  Assert.equal(g, 0, "Green channel should be 0 for pure red");
  Assert.equal(b, 0, "Blue channel should be 0 for pure red");
});

add_task(async function test_hsl_to_rgb_green() {
  const { r, g, b } = MogwserGradientPicker.hslToRgb(120, 100, 50);
  Assert.equal(r, 0, "Red channel should be 0 for pure green");
  Assert.equal(g, 255, "Green channel should be 255 for pure green");
  Assert.equal(b, 0, "Blue channel should be 0 for pure green");
});

add_task(async function test_hsl_to_rgb_blue() {
  const { r, g, b } = MogwserGradientPicker.hslToRgb(240, 100, 50);
  Assert.equal(r, 0, "Red should be 0 for pure blue");
  Assert.equal(g, 0, "Green should be 0 for pure blue");
  Assert.equal(b, 255, "Blue should be 255 for pure blue");
});

add_task(async function test_hsl_to_hex() {
  const hex = MogwserGradientPicker.hslToHex({ h: 0, s: 100, l: 50 });
  Assert.equal(hex, "#ff0000", "Pure red HSL should convert to #ff0000");
});

add_task(async function test_hsl_to_string() {
  const str = MogwserGradientPicker.hslToString({ h: 210, s: 70, l: 55 });
  Assert.equal(str, "hsl(210, 70%, 55%)", "HSL string format should be correct");
});

add_task(async function test_complementary_harmony() {
  const result = MogwserGradientPicker.complementary({ h: 0, s: 100, l: 50 });
  Assert.equal(result.length, 1, "Complementary should return 1 color");
  Assert.equal(result[0].h, 180, "Complement of hue 0 should be hue 180");
});

add_task(async function test_analogous_harmony() {
  const result = MogwserGradientPicker.analogous({ h: 120, s: 100, l: 50 });
  Assert.equal(result.length, 2, "Analogous should return 2 colors");
  Assert.equal(result[0].h, 150, "First analogous of 120 should be 150");
  Assert.equal(result[1].h, 90, "Second analogous of 120 should be 90");
});

add_task(async function test_triadic_harmony() {
  const result = MogwserGradientPicker.triadic({ h: 0, s: 100, l: 50 });
  Assert.equal(result.length, 2, "Triadic should return 2 colors");
  Assert.equal(result[0].h, 120, "First triadic of 0 should be 120");
  Assert.equal(result[1].h, 240, "Second triadic of 0 should be 240");
});

add_task(async function test_split_complementary_harmony() {
  const result = MogwserGradientPicker.splitComplementary({ h: 0, s: 100, l: 50 });
  Assert.equal(result.length, 2, "Split-complementary should return 2 colors");
  Assert.equal(result[0].h, 150, "First split-comp of 0 should be 150");
  Assert.equal(result[1].h, 210, "Second split-comp of 0 should be 210");
});

add_task(async function test_tetradic_harmony() {
  const result = MogwserGradientPicker.tetradic({ h: 0, s: 100, l: 50 });
  Assert.equal(result.length, 3, "Tetradic should return 3 colors");
  Assert.equal(result[0].h, 90, "First tetradic of 0 should be 90");
  Assert.equal(result[1].h, 180, "Second tetradic of 0 should be 180");
  Assert.equal(result[2].h, 270, "Third tetradic of 0 should be 270");
});

add_task(async function test_rgb_to_hsl_roundtrip() {
  // Convert HSL -> RGB -> HSL and verify it roundtrips
  const original = { h: 210, s: 70, l: 55 };
  const rgb = MogwserGradientPicker.hslToRgb(original.h, original.s, original.l);
  const back = MogwserGradientPicker.rgbToHsl(rgb.r, rgb.g, rgb.b);

  Assert.ok(
    Math.abs(back.h - original.h) <= 1,
    `Hue should roundtrip: expected ~${original.h}, got ${back.h}`
  );
  Assert.ok(
    Math.abs(back.s - original.s) <= 1,
    `Saturation should roundtrip: expected ~${original.s}, got ${back.s}`
  );
  Assert.ok(
    Math.abs(back.l - original.l) <= 1,
    `Lightness should roundtrip: expected ~${original.l}, got ${back.l}`
  );
});

add_task(async function test_hsl_to_hex_non_primary() {
  // Test a non-primary color: teal (h=180, s=100, l=50) should be #00ffff
  const hex = MogwserGradientPicker.hslToHex({ h: 180, s: 100, l: 50 });
  Assert.equal(hex, "#00ffff", "Teal HSL(180,100,50) should convert to #00ffff");

  // Test purple-ish: h=270, s=60, l=50
  const hex2 = MogwserGradientPicker.hslToHex({ h: 270, s: 60, l: 50 });
  Assert.ok(hex2.startsWith("#"), "Hex should start with #");
  Assert.equal(hex2.length, 7, "Hex should be 7 characters (#RRGGBB)");
});
