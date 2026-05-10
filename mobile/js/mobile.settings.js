/* =========================================================
   AIVO MOBILE — SETTINGS
   File: /mobile/js/mobile.settings.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_SETTINGS__) return;
  window.__AIVO_MOBILE_SETTINGS__ = true;

  function mobileSettingsInit(){
    const root = document.getElementById("mobileAccountSettingsSection");

    if (!root) {
      console.warn("[AIVO_MOBILE_SETTINGS] root_not_found");
      return;
    }

    console.log("[AIVO_MOBILE_SETTINGS] initialized");
  }

  window.mobileSettingsInit = mobileSettingsInit;
})();
