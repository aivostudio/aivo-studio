(function () {
  "use strict";

  if (window.__AIVO_STUDIO_SECTIONS_SETTINGS__) return;
  window.__AIVO_STUDIO_SECTIONS_SETTINGS__ = true;

  var KEY_SETTINGS = "aivo_settings_v1";
  var KEY_TAB = "aivo_settings_active_tab_v1";

  function qs(sel, root) {
    try { return (root || document).querySelector(sel); }
    catch (_) { return null; }
  }

  function qsa(sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (_) { return []; }
  }

  function safeParse(str, fallback) {
    try { return JSON.parse(String(str || "")); }
    catch (_) { return fallback; }
  }

  function getPage() {
    return (
      qs('.page[data-page="settings"]') ||
      qs('#moduleHost .page[data-page="settings"]') ||
      qs('#moduleHost .page.page-settings[data-page="settings"]') ||
      qs('#moduleHost section.main-panel') ||
      qs('section.main-panel') ||
      null
    );
  }

  function defaults(st) {
    st = (st && typeof st === "object") ? st : {};

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

  function loadState() {
    var st = safeParse(localStorage.getItem(KEY_SETTINGS), null);
    return defaults(st);
  }

  function saveState(st) {
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(st)); } catch (_) {}
  }

  function toastSuccess(msg) {
    if (window.toast && typeof window.toast.success === "function") {
      window.toast.success(msg);
    } else if (window.toast && typeof window.toast === "function") {
      window.toast(msg);
    } else if (typeof window.AIVO_TOAST === "function") {
      window.AIVO_TOAST("success", msg);
    } else if (typeof window.showToast === "function") {
      window.showToast("success", msg);
    } else {
      console.log(msg);
    }
  }

  function toastError(msg) {
    if (window.toast && typeof window.toast.error === "function") {
      window.toast.error(msg);
    } else if (typeof window.AIVO_TOAST === "function") {
      window.AIVO_TOAST("error", msg);
    } else if (typeof window.showToast === "function") {
      window.showToast("error", msg);
    } else {
      console.error(msg);
    }
  }

  function syncDeleteSubmit(page) {
    var ack = qs('input[type="checkbox"][data-setting="data_delete_ack"]', page);
    var btn = qs('[data-delete-submit]', page);

    if (!btn) return;

    var enabled = !!(ack && ack.checked === true);

    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
    btn.classList.toggle("is-disabled", !enabled);
  }

  function syncRectificationSubmit(page) {
    var ta = qs('textarea[data-setting="data_rectification_note"]', page);
    var btn = qs('[data-rectification-submit]', page);

    if (!btn) return;

    var value = ta ? String(ta.value || "").trim() : "";
    var enabled = value.length > 0;

    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
    btn.classList.toggle("is-disabled", !enabled);
  }

  function syncDataExport(page) {
    var pane = qs('[data-settings-pane="data"]', page) || page;
    var btn =
      qs('[data-action="data-export"]', pane) ||
      qs('[data-action="export-data"]', pane) ||
      qs('[data-action="download-export"]', pane) ||
      qs('[data-data-export]', pane);

    var sel = qs('[data-setting="data_export_format"]', pane);

    if (!btn) return;

    var fmt = sel ? String(sel.value || "json").trim().toLowerCase() : "json";
    var enabled = (fmt === "json" || fmt === "");

    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
    btn.classList.toggle("is-disabled", !enabled);
  }

  function applyToDOM(page, st) {
    qsa('input[type="checkbox"][data-setting]', page).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;
      if (k in st) el.checked = !!st[k];
    });

    qsa('input[type="radio"][data-setting]', page).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;
      el.checked = String(st[k]) === String(el.value);
    });

    qsa('select[data-setting]', page).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;
      if (st[k] != null) el.value = String(st[k]);
    });

    qsa('textarea[data-setting]', page).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;
      el.value = st[k] != null ? String(st[k]) : "";
    });

    qsa('input[type="range"][data-setting]', page).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;
      if (st[k] != null) el.value = String(st[k]);

      if (k === "music_volume") {
        var lbl = qs("[data-settings-volume-label]", page);
        if (lbl) lbl.textContent = "%" + String(el.value || "0");
      }
    });

    syncDeleteSubmit(page);
    syncRectificationSubmit(page);
    syncDataExport(page);
  }

  function collectFromDOM(page) {
    var st = loadState();
    var scope = qs('[data-settings-pane].is-active', page) || page;

    qsa('[data-setting]', scope).forEach(function (el) {
      var k = el.getAttribute("data-setting");
      if (!k) return;

      var tag = String(el.tagName || "").toLowerCase();
      var type = String(el.getAttribute("type") || "").toLowerCase();

      if (tag === "input" && type === "radio") {
        if (el.checked) st[k] = String(el.value || "");
        return;
      }

      if (tag === "input" && type === "checkbox") {
        st[k] = (el.checked === true);
        return;
      }

      if (tag === "input" && type === "range") {
        var v = parseInt(el.value, 10);
        if (isFinite(v)) st[k] = v;
        return;
      }

      if (tag === "select") {
        st[k] = String(el.value || "");
        return;
      }

      if (tag === "textarea") {
        st[k] = String(el.value || "");
      }
    });

    var q = qs('input[name="music_quality"]:checked', scope);
    if (q) st.music_quality = q.value;

    var pv = qs('input[name="profile_visibility"]:checked', scope);
    if (pv) st.profile_visibility = pv.value;

    return defaults(st);
  }

  function setActiveTab(page, tab) {
    tab = String(tab || "").trim().toLowerCase() || "notifications";

    qsa('[data-settings-tab]', page).forEach(function (btn) {
      var k = String(btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
      var on = (k === tab);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    qsa('[data-settings-pane]', page).forEach(function (pane) {
      var k = String(pane.getAttribute("data-settings-pane") || "").trim().toLowerCase();
      var on = (k === tab);
      pane.classList.toggle("is-active", on);
      pane.style.display = on ? "" : "none";
    });

    try { localStorage.setItem(KEY_TAB, tab); } catch (_) {}

    try {
      var u = new URL(window.location.href);
      u.searchParams.set("stab", tab);
      history.replaceState({}, "", u.toString());
    } catch (_) {}
  }

  function getTabFromURL() {
    try {
      var u = new URL(window.location.href);
      return String(u.searchParams.get("stab") || "").trim().toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function activateTab(page, rawKey) {
    var key = String(rawKey || "").trim().toLowerCase();
    if (!key) key = "notifications";

    var tabs = qsa('[data-settings-tab]', page);
    var panes = qsa('[data-settings-pane]', page);

    if (!tabs.length || !panes.length) return;

    tabs.forEach(function (btn) {
      var btnKey = String(btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
      var on = (btnKey === key);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.setAttribute("tabindex", on ? "0" : "-1");
    });

    var anyOn = false;

    panes.forEach(function (pane) {
      var paneKey = String(pane.getAttribute("data-settings-pane") || "").trim().toLowerCase();
      var on = (paneKey === key);

      if (on) anyOn = true;

      pane.classList.toggle("is-active", on);
      pane.style.setProperty("display", on ? "block" : "none", "important");

      if (on) {
        pane.removeAttribute("aria-hidden");
      } else {
        pane.setAttribute("aria-hidden", "true");
      }
    });

    if (!anyOn && key !== "notifications") {
      activateTab(page, "notifications");
      return;
    }

    try { localStorage.setItem(KEY_TAB, key); } catch (_) {}

    try {
      var u = new URL(window.location.href);
      u.searchParams.set("stab", key);
      history.replaceState({}, "", u.toString());
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("settings:tab-changed", { detail: { tab: key } }));
    } catch (_) {}
  }

  function readLS(key) {
    var raw = localStorage.getItem(key);
    if (raw == null) return null;
    var parsed = safeParse(raw, null);
    return (parsed !== null ? parsed : String(raw));
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function collectExportPayload() {
    var settings = readLS("aivo_settings_v1");
    var profileStats = readLS("aivo_profile_stats_v1");
    var profileStatsBk = readLS("aivo_profile_stats_bk_v1");

    var jobs = null;
    try {
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS === "object") {
        if (Array.isArray(window.AIVO_JOBS.list)) jobs = window.AIVO_JOBS.list.slice(0);
        else if (typeof window.AIVO_JOBS.getList === "function") jobs = window.AIVO_JOBS.getList();
      }
    } catch (_) { jobs = null; }

    var credits = null;
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        credits = window.AIVO_STORE_V1.getCredits();
      } else {
        var lsCredits = readLS("aivo_credits_v1") || readLS("aivo_store_v1");
        if (lsCredits != null) credits = lsCredits;
      }
    } catch (_) { credits = null; }

    var user = null;
    try {
      user = {
        name: (window.AIVO_USER && window.AIVO_USER.name) ? String(window.AIVO_USER.name) : null,
        email: (window.AIVO_USER && window.AIVO_USER.email) ? String(window.AIVO_USER.email) : null
      };
    } catch (_) { user = null; }

    return {
      meta: {
        exported_at: nowISO(),
        export_version: "aivo-export-v1",
        format: "json",
        note: "MVP fake export: localStorage + globals snapshot. Backend entegre olunca gerçek export ile değişecek."
      },
      user: user,
      data: {
        settings: settings,
        profile_stats: profileStats,
        profile_stats_backup: profileStatsBk,
        jobs: jobs,
        credits: credits
      }
    };
  }

  function downloadJSON(obj, filename) {
    filename = filename || "aivo-export.json";
    var json = JSON.stringify(obj, null, 2);

    try {
      var blob = new Blob([json], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);

      var a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_self";
      document.body.appendChild(a);
      a.click();

      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (_) {}
        try { a.remove(); } catch (_) {}
      }, 400);

      return;
    } catch (_) {}

    try {
      var dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
      var a2 = document.createElement("a");
      a2.style.display = "none";
      a2.href = dataUrl;
      a2.download = filename;
      a2.rel = "noopener";
      a2.target = "_self";
      document.body.appendChild(a2);
      a2.click();

      setTimeout(function () {
        try { a2.remove(); } catch (_) {}
      }, 200);

      return;
    } catch (_) {}

    toastError("Export indirilemedi.");
  }

  function bind(page) {
    if (page.__aivoSettingsBoundV6) return;
    page.__aivoSettingsBoundV6 = true;

    var st = loadState();
    applyToDOM(page, st);

    var urlTab = getTabFromURL();
    var lastTab = "";
    try { lastTab = String(localStorage.getItem(KEY_TAB) || "").trim().toLowerCase(); } catch (_) {}

    activateTab(page, urlTab || lastTab || "notifications");

    qsa('[data-settings-tab]', page).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var t = String(btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
        if (!t) return;
        activateTab(page, t);
      });
    });

    qsa('[data-settings-save]', page).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var now = collectFromDOM(page);
        saveState(now);
        syncDeleteSubmit(page);
        syncRectificationSubmit(page);
        syncDataExport(page);
        toastSuccess("Ayarlar kaydedildi");
      });
    });

    qsa('input[type="checkbox"][data-setting="data_delete_ack"]', page).forEach(function (el) {
      if (el.__aivoDeleteAckBoundV1) return;
      el.__aivoDeleteAckBoundV1 = true;

      el.addEventListener("change", function () {
        syncDeleteSubmit(page);
      });
    });

    qsa('textarea[data-setting="data_rectification_note"]', page).forEach(function (el) {
      if (el.__aivoRectificationBoundV1) return;
      el.__aivoRectificationBoundV1 = true;

      el.addEventListener("input", function () {
        syncRectificationSubmit(page);
      });
    });

    qsa('[data-rectification-submit]', page).forEach(function (btn) {
      if (btn.__aivoRectificationSubmitBoundV1) return;
      btn.__aivoRectificationSubmitBoundV1 = true;

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        syncRectificationSubmit(page);
        if (btn.disabled) return;
        toastSuccess("Düzeltme talebi alındı");
      });
    });

    qsa('[data-action="data-export"]', page).forEach(function (btn) {
      if (btn.__aivoDataExportBoundV1) return;
      btn.__aivoDataExportBoundV1 = true;

      btn.addEventListener("click", function (e) {
        e.preventDefault();

        syncDataExport(page);
        if (btn.disabled) return;

        try {
          var payload = collectExportPayload();
          downloadJSON(payload, "aivo-export.json");
          toastSuccess("Export hazır: aivo-export.json indirildi");
        } catch (_) {
          toastError("Export oluşturulamadı");
        }
      });
    });

    qsa('select[data-setting="data_export_format"]', page).forEach(function (el) {
      if (el.__aivoExportFormatBoundV1) return;
      el.__aivoExportFormatBoundV1 = true;

      el.addEventListener("change", function () {
        syncDataExport(page);
      });
    });

    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range && !range.__aivoVolBoundV6) {
      range.__aivoVolBoundV6 = true;
      range.addEventListener("input", function () {
        var lbl = qs('[data-settings-volume-label]', page);
        if (lbl) lbl.textContent = "%" + String(range.value || "0");
      });
    }

    syncDeleteSubmit(page);
    syncRectificationSubmit(page);
    syncDataExport(page);
  }

  function tryInit() {
    var page = getPage();
    if (!page) return false;
    bind(page);
    return true;
  }

  function boot() {
    tryInit();

    try {
      var mo = new MutationObserver(function () {
        tryInit();
      });

      mo.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
