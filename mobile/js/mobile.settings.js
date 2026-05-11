/* =========================================================
   AIVO MOBILE — SETTINGS
   File: /mobile/js/mobile.settings.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_SETTINGS__) return;
  window.__AIVO_MOBILE_SETTINGS__ = true;

  const KEY_SETTINGS = "aivo_settings_v1";
  const KEY_TAB = "aivo_mobile_settings_active_tab_v1";

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function safeParse(value, fallback){
    try {
      return JSON.parse(String(value || ""));
    } catch (_) {
      return fallback;
    }
  }

  function defaults(state){
    const st = state && typeof state === "object" ? state : {};

    if (typeof st.notify_email_done !== "boolean") st.notify_email_done = true;
    if (typeof st.notify_email_lowcredit !== "boolean") st.notify_email_lowcredit = true;
    if (typeof st.notify_email_weekly !== "boolean") st.notify_email_weekly = false;
    if (typeof st.notify_email_promos !== "boolean") st.notify_email_promos = false;

    if (!st.music_quality) st.music_quality = "high";
    if (typeof st.music_autoplay !== "boolean") st.music_autoplay = false;
    if (typeof st.music_volume !== "number") st.music_volume = 80;

    if (!st.profile_visibility) st.profile_visibility = "private";
    if (typeof st.privacy_activity_share !== "boolean") st.privacy_activity_share = true;
    if (typeof st.privacy_analytics !== "boolean") st.privacy_analytics = true;

    if (!st.security_session_timeout) st.security_session_timeout = "1h";

    if (!st.data_export_format) st.data_export_format = "json";
    if (typeof st.data_rectification_note !== "string") st.data_rectification_note = "";
    if (typeof st.data_delete_ack !== "boolean") st.data_delete_ack = false;

    return st;
  }

  function loadState(){
    return defaults(safeParse(localStorage.getItem(KEY_SETTINGS), null));
  }

  function saveState(state){
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(defaults(state)));
    } catch (_) {}
  }

  function toast(message){
    if (window.toast && typeof window.toast.success === "function") {
      window.toast.success(message);
      return;
    }

    if (typeof window.toast === "function") {
      window.toast(message);
      return;
    }

    alert(message);
  }

  function setActiveTab(root, tab){
    const key = String(tab || "notifications").trim().toLowerCase();

    qsa("[data-mobile-settings-tab]", root).forEach(function(btn){
      const btnKey = String(btn.getAttribute("data-mobile-settings-tab") || "").trim().toLowerCase();
      const active = btnKey === key;

      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    qsa("[data-mobile-settings-pane]", root).forEach(function(pane){
      const paneKey = String(pane.getAttribute("data-mobile-settings-pane") || "").trim().toLowerCase();
      const active = paneKey === key;

      pane.classList.toggle("is-active", active);
      pane.hidden = !active;
    });

    try {
      localStorage.setItem(KEY_TAB, key);
    } catch (_) {}
  }

  function applyToDOM(root, state){
    const st = defaults(state);

    qsa("[data-mobile-setting]", root).forEach(function(el){
      const key = el.getAttribute("data-mobile-setting");
      const tag = String(el.tagName || "").toLowerCase();
      const type = String(el.getAttribute("type") || "").toLowerCase();

      if (!key) return;

      if (tag === "input" && type === "checkbox") {
        el.checked = !!st[key];
        return;
      }

      if (tag === "input" && type === "radio") {
        el.checked = String(st[key]) === String(el.value);
        return;
      }

      if (tag === "input" && type === "range") {
        el.value = String(st[key] != null ? st[key] : 80);

        if (key === "music_volume") {
          const label = qs("[data-mobile-settings-volume-label]", root);
          if (label) label.textContent = "%" + String(el.value || "0");
        }

        return;
      }

      if (tag === "select") {
        if (st[key] != null) el.value = String(st[key]);
        return;
      }

      if (tag === "textarea") {
        el.value = st[key] != null ? String(st[key]) : "";
      }
    });
  }

  function collectFromDOM(root){
    const st = loadState();

    qsa("[data-mobile-setting]", root).forEach(function(el){
      const key = el.getAttribute("data-mobile-setting");
      const tag = String(el.tagName || "").toLowerCase();
      const type = String(el.getAttribute("type") || "").toLowerCase();

      if (!key) return;

      if (tag === "input" && type === "checkbox") {
        st[key] = el.checked === true;
        return;
      }

      if (tag === "input" && type === "radio") {
        if (el.checked) st[key] = String(el.value || "");
        return;
      }

      if (tag === "input" && type === "range") {
        const n = parseInt(el.value, 10);
        if (Number.isFinite(n)) st[key] = n;
        return;
      }

      if (tag === "select") {
        st[key] = String(el.value || "");
        return;
      }

      if (tag === "textarea") {
        st[key] = String(el.value || "");
      }
    });

    return defaults(st);
  }

  function collectExportPayload(){
    return {
      meta: {
        exported_at: new Date().toISOString(),
        export_version: "aivo-mobile-export-v1",
        format: "json"
      },
      data: {
        settings: loadState()
      }
    };
  }

  function downloadJSON(payload){
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "aivo-export.json";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function(){
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 400);
  }

  function bind(root){
    if (!root || root.__aivoMobileSettingsBound) return;
    root.__aivoMobileSettingsBound = true;

    applyToDOM(root, loadState());

    let savedTab = "notifications";

    try {
      savedTab = localStorage.getItem(KEY_TAB) || "notifications";
    } catch (_) {}

    setActiveTab(root, savedTab);

    qsa("[data-mobile-settings-tab]", root).forEach(function(btn){
      btn.addEventListener("click", function(){
        const tab = btn.getAttribute("data-mobile-settings-tab") || "notifications";
        setActiveTab(root, tab);
      });
    });

    qsa('input[type="range"][data-mobile-setting="music_volume"]', root).forEach(function(input){
      input.addEventListener("input", function(){
        const label = qs("[data-mobile-settings-volume-label]", root);
        if (label) label.textContent = "%" + String(input.value || "0");
      });
    });

    const saveBtn = qs("[data-mobile-settings-save]", root);
    if (saveBtn) {
      saveBtn.addEventListener("click", function(){
        const next = collectFromDOM(root);
        saveState(next);
        toast("Ayarlar kaydedildi.");
      });
    }

    const exportBtn = qs("[data-mobile-settings-export]", root);
    if (exportBtn) {
      exportBtn.addEventListener("click", function(){
        downloadJSON(collectExportPayload());
        toast("Export hazırlandı.");
      });
    }
     const privacyBtn = qs("[data-mobile-policy-privacy]", root);
if (privacyBtn) {
  privacyBtn.addEventListener("click", function(){
    window.location.href = "/mobile/modules/mobile-policy-privacy.html";
  });
}

const termsBtn = qs("[data-mobile-policy-terms]", root);
if (termsBtn) {
  termsBtn.addEventListener("click", function(){
    window.location.href = "/mobile/modules/mobile-policy-terms.html";
  });
}
  }

  function mobileSettingsInit(){
    const root = document.getElementById("mobileAccountSettingsSection");

    if (!root) {
      console.warn("[AIVO_MOBILE_SETTINGS] root_not_found");
      return;
    }

    bind(root);
  }

  window.mobileSettingsInit = mobileSettingsInit;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mobileSettingsInit);
  } else {
    mobileSettingsInit();
  }
})();
