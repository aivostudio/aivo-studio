// studio.sections/settings.js
(function () {
  "use strict";

  if (window.__AIVO_STUDIO_SECTIONS_SETTINGS__) return;
  window.__AIVO_STUDIO_SECTIONS_SETTINGS__ = true;

  const KEY_SETTINGS = "aivo_settings_v1";
  const KEY_ACTIVE_TAB = "aivo_settings_active_tab_v1";

  function qs(sel, root) {
    try { return (root || document).querySelector(sel); }
    catch (_) { return null; }
  }

  function qsa(sel, root) {
    try { return Array.from((root || document).querySelectorAll(sel)); }
    catch (_) { return []; }
  }

  function safeParse(str, fallback) {
    try { return JSON.parse(String(str || "")); }
    catch (_) { return fallback; }
  }

  function getSettingsRoot() {
    return (
      qs("#moduleHost .main-panel") ||
      qs('.page[data-page="settings"]') ||
      null
    );
  }

  function getDefaultState() {
    return {
      notify_email_done: true,
      notify_email_lowcredit: true,
      notify_email_weekly: false,
      notify_email_promos: false,

      music_quality: "high",
      music_autoplay: false,
      music_volume: 80,

      profile_visibility: "private",
      privacy_activity_share: true,
      privacy_analytics: true,

      security_session_timeout: "1h",

      data_export_format: "json",
      data_rectification_note: "",
      data_delete_ack: false
    };
  }

  function loadState() {
    const raw = safeParse(localStorage.getItem(KEY_SETTINGS), {});
    return Object.assign({}, getDefaultState(), raw || {});
  }

  function saveState(state) {
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(state || {}));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getActiveTab() {
    try {
      const url = new URL(window.location.href);
      const fromUrl = String(url.searchParams.get("stab") || "").trim().toLowerCase();
      if (fromUrl) return fromUrl;
    } catch (_) {}

    try {
      const fromLs = String(localStorage.getItem(KEY_ACTIVE_TAB) || "").trim().toLowerCase();
      if (fromLs) return fromLs;
    } catch (_) {}

    return "notifications";
  }

  function setActiveTab(tabKey) {
    const root = getSettingsRoot();
    if (!root) return;

    const key = String(tabKey || "notifications").trim().toLowerCase();

    qsa("[data-settings-tab]", root).forEach((btn) => {
      const btnKey = String(btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
      const isOn = btnKey === key;
      btn.classList.toggle("is-active", isOn);
      btn.setAttribute("aria-selected", isOn ? "true" : "false");
    });

    qsa("[data-settings-pane]", root).forEach((pane) => {
      const paneKey = String(pane.getAttribute("data-settings-pane") || "").trim().toLowerCase();
      const isOn = paneKey === key;
      pane.classList.toggle("is-active", isOn);
      pane.style.display = isOn ? "" : "none";
    });

    try {
      localStorage.setItem(KEY_ACTIVE_TAB, key);
    } catch (_) {}

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("stab", key);
      history.replaceState({}, "", url.toString());
    } catch (_) {}
  }

  function applyStateToDOM(state) {
    const root = getSettingsRoot();
    if (!root) return;

    qsa('input[type="checkbox"][data-setting]', root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      if (Object.prototype.hasOwnProperty.call(state, key)) {
        el.checked = !!state[key];
      }
    });

    qsa('input[type="radio"][data-setting]', root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      el.checked = String(state[key]) === String(el.value);
    });

    qsa('select[data-setting]', root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      if (state[key] != null) el.value = String(state[key]);
    });

    qsa('textarea[data-setting]', root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      el.value = state[key] != null ? String(state[key]) : "";
    });

    qsa('input[type="range"][data-setting]', root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      if (state[key] != null) el.value = String(state[key]);

      if (key === "music_volume") {
        const label = qs("[data-settings-volume-label]", root);
        if (label) label.textContent = "%" + String(el.value || "0");
      }
    });
  }

  function collectStateFromDOM() {
    const root = getSettingsRoot();
    const state = loadState();
    if (!root) return state;

    qsa("[data-setting]", root).forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;

      const tag = String(el.tagName || "").toLowerCase();
      const type = String(el.getAttribute("type") || "").toLowerCase();

      if (tag === "input" && type === "checkbox") {
        state[key] = !!el.checked;
        return;
      }

      if (tag === "input" && type === "radio") {
        if (el.checked) state[key] = String(el.value || "");
        return;
      }

      if (tag === "input" && type === "range") {
        state[key] = Number(el.value || 0);
        return;
      }

      if (tag === "select") {
        state[key] = String(el.value || "");
        return;
      }

      if (tag === "textarea") {
        state[key] = String(el.value || "");
      }
    });

    return state;
  }

  function bindTabs(root) {
    if (root.__aivoSettingsTabsBound) return;
    root.__aivoSettingsTabsBound = true;

    root.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-tab]");
      if (!btn || !root.contains(btn)) return;

      e.preventDefault();

      const key = btn.getAttribute("data-settings-tab");
      if (!key) return;

      setActiveTab(key);
    });
  }

  function bindSave(root) {
    if (root.__aivoSettingsSaveBound) return;
    root.__aivoSettingsSaveBound = true;

    root.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-save]");
      if (!btn || !root.contains(btn)) return;

      e.preventDefault();

      const state = collectStateFromDOM();
      saveState(state);

      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success("Ayarlar kaydedildi");
      } else {
        console.log("[settings] saved");
      }
    });
  }

  function bindVolume(root) {
    if (root.__aivoSettingsVolumeBound) return;
    root.__aivoSettingsVolumeBound = true;

    root.addEventListener("input", function (e) {
      const el = e.target.closest('input[type="range"][data-setting="music_volume"]');
      if (!el || !root.contains(el)) return;

      const label = qs("[data-settings-volume-label]", root);
      if (label) label.textContent = "%" + String(el.value || "0");
    });
  }

  function boot() {
    const root = getSettingsRoot();
    if (!root) return;

    applyStateToDOM(loadState());
    setActiveTab(getActiveTab());
    bindTabs(root);
    bindSave(root);
    bindVolume(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
