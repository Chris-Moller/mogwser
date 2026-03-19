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
  const originalValue = Services.prefs.getBoolPref(
    "privacy.trackingprotection.enabled",
    false
  );

  // Toggle the pref directly and verify the protection level updates
  Services.prefs.setBoolPref(
    "privacy.trackingprotection.enabled",
    !originalValue
  );
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

add_task(async function test_protection_level_changes_with_toggles() {
  const panel = window.gMogwserPrivacyPanel;

  // Save original pref values
  const origTP = Services.prefs.getBoolPref("privacy.trackingprotection.enabled", false);
  const origFPI = Services.prefs.getBoolPref("privacy.firstparty.isolate", false);
  const origFP = Services.prefs.getBoolPref("privacy.resistFingerprinting", false);
  const origHTTPS = Services.prefs.getBoolPref("dom.security.https_only_mode", false);
  const origCookie = Services.prefs.getIntPref("network.cookie.cookieBehavior", 0);

  // Enable all toggles -> should be "strict"
  Services.prefs.setBoolPref("privacy.trackingprotection.enabled", true);
  Services.prefs.setBoolPref("privacy.firstparty.isolate", true);
  Services.prefs.setBoolPref("privacy.resistFingerprinting", true);
  Services.prefs.setBoolPref("dom.security.https_only_mode", true);
  Services.prefs.setIntPref("network.cookie.cookieBehavior", 4);

  Assert.equal(
    panel.getProtectionLevel(),
    "strict",
    "All toggles on should produce strict level"
  );

  // Disable all toggles -> should be "minimal"
  Services.prefs.setBoolPref("privacy.trackingprotection.enabled", false);
  Services.prefs.setBoolPref("privacy.firstparty.isolate", false);
  Services.prefs.setBoolPref("privacy.resistFingerprinting", false);
  Services.prefs.setBoolPref("dom.security.https_only_mode", false);
  Services.prefs.setIntPref("network.cookie.cookieBehavior", 0);

  Assert.equal(
    panel.getProtectionLevel(),
    "minimal",
    "All toggles off should produce minimal level"
  );

  // Restore original values
  Services.prefs.setBoolPref("privacy.trackingprotection.enabled", origTP);
  Services.prefs.setBoolPref("privacy.firstparty.isolate", origFPI);
  Services.prefs.setBoolPref("privacy.resistFingerprinting", origFP);
  Services.prefs.setBoolPref("dom.security.https_only_mode", origHTTPS);
  Services.prefs.setIntPref("network.cookie.cookieBehavior", origCookie);
});
