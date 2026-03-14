/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test MogwserPrivacyPanel functionality.
 */

add_task(async function test_privacy_panel_loaded() {
  Assert.ok(
    window.gMogwserPrivacyPanel,
    "Privacy panel module should be available"
  );
});

add_task(async function test_protection_level_calculation() {
  const panel = window.gMogwserPrivacyPanel;
  const level = panel.getProtectionLevel();
  Assert.ok(
    ["strict", "standard", "minimal"].includes(level),
    "Protection level should be one of strict, standard, or minimal"
  );
});

add_task(async function test_toggle_tracking_protection() {
  const panel = window.gMogwserPrivacyPanel;
  const originalValue = Services.prefs.getBoolPref(
    "privacy.trackingprotection.enabled",
    false
  );

  panel._onToggle("privacy.trackingprotection.enabled", !originalValue);
  const newValue = Services.prefs.getBoolPref(
    "privacy.trackingprotection.enabled",
    false
  );
  Assert.equal(
    newValue,
    !originalValue,
    "Tracking protection pref should be toggled"
  );

  // Restore original
  Services.prefs.setBoolPref(
    "privacy.trackingprotection.enabled",
    originalValue
  );
});
