/* =========================================================
   AIVO SETTINGS — SINGLE OWNER (Tabs + Save/Load + Toast) v4
   - Tabs: [data-settings-tab] -> [data-settings-pane]
   - Save: [data-settings-save] -> localStorage aivo_settings_v1
   - Active tab persist: localStorage aivo_settings_active_tab_v1 + URL ?stab=
   - Toast: ONLY existing system toast (no miniToast fallback)
   - SAFE: Only touches .page[data-page="settings"]
   ========================================================= */
(function(){
  "use strict";

  var KEY_SETTINGS = "aivo_settings_v1";
  var KEY_TAB      = "aivo_settings_active_tab_v1";

  function qs(sel, root){ try { return (root||document).querySelector(sel); } catch(e){ return null; } }
  function qsa(sel, root){ try { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); } catch(e){ return []; } }
  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }

  function getPage(){
    return qs('.page[data-page="settings"]');
  }

  // ✅ sadece senin mevcut toast sistemini çağırır
  function toast(msg){
    msg = String(msg == null ? "" : msg);

    try{
      // 1) Eğer senin sistemin window.toast ise (1. görseldeki gibi)
      if (typeof window.toast === "function"){
        window.toast(msg);
        return;
      }

      // 2) Eğer AIVO_TOAST varsa
      if (window.AIVO_TOAST){
        if (typeof window.AIVO_TOAST.show === "function"){ window.AIVO_TOAST.show(msg); return; }
        if (typeof window.AIVO_TOAST.success === "function"){ window.AIVO_TOAST.success(msg); return; }
        if (typeof window.AIVO_TOAST.open === "function"){ window.AIVO_TOAST.open(msg); return; }
        if (typeof window.AIVO_TOAST.toast === "function"){ window.AIVO_TOAST.toast(msg); return; }
      }
    } catch(e){}

    // 3) Son çare (görsel bozmayacak şekilde): sadece console
    try { console.log("[AIVO SETTINGS]", msg); } catch(e){}
  }

  function defaults(st){
    st = (st && typeof st === "object") ? st : {};

    // notifications
    if (typeof st.notify_email_done     !== "boolean") st.notify_email_done = true;
    if (typeof st.notify_email_lowcredit!== "boolean") st.notify_email_lowcredit = true;
    if (typeof st.notify_email_weekly   !== "boolean") st.notify_email_weekly = false;
    if (typeof st.notify_email_promos   !== "boolean") st.notify_email_promos = false;

    // music
    if (!st.music_quality) st.music_quality = "high";
    if (typeof st.music_autoplay !== "boolean") st.music_autoplay = false;
    if (typeof st.music_volume   !== "number") st.music_volume = 80;

    // privacy
    if (!st.profile_visibility) st.profile_visibility = "private";
    if (typeof st.privacy_activity_share !== "boolean") st.privacy_activity_share = true;
    if (typeof st.privacy_analytics      !== "boolean") st.privacy_analytics = true;

    // security
    if (!st.security_session_timeout) st.security_session_timeout = "1h";

    return st;
  }

  function loadState(){
    var st = safeParse(localStorage.getItem(KEY_SETTINGS), null);
    return defaults(st);
  }

  function saveState(st){
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(st)); } catch(e){}
  }

  function applyToDOM(page, st){
    // checkboxes
    qsa('input[type="checkbox"][data-setting]', page).forEach(function(el){
      var k = el.getAttribute("data-setting");
      if (!k) return;
      if (k in st) el.checked = !!st[k];
    });

    // range: volume
    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range){
      range.value = String(Math.max(0, Math.min(100, Number(st.music_volume)||0)));
      var lbl = qs('[data-settings-volume-label]', page);
      if (lbl) lbl.textContent = "%" + range.value;
    }

    // select
    var sel = qs('select[data-setting="security_session_timeout"]', page);
    if (sel && st.security_session_timeout) sel.value = st.security_session_timeout;

    // radios: music_quality
    qsa('input[type="radio"][name="music_quality"]', page).forEach(function(el){
      el.checked = (String(el.value) === String(st.music_quality));
    });

    // radios: profile_visibility
    qsa('input[type="radio"][name="profile_visibility"]', page).forEach(function(el){
      el.checked = (String(el.value) === String(st.profile_visibility));
    });
  }

  function collectFromDOM(page){
    var st = loadState();

    // generic inputs
    qsa('[data-setting]', page).forEach(function(el){
      var k = el.getAttribute("data-setting");
      if (!k) return;

      var tag = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      if (tag === "input" && type === "checkbox"){
        st[k] = !!el.checked;
      } else if (tag === "input" && type === "range"){
        var v = parseInt(el.value, 10);
        if (isFinite(v)) st[k] = v;
      } else if (tag === "select"){
        st[k] = el.value;
      }
    });

    // radios
    var q = qs('input[name="music_quality"]:checked', page);
    if (q) st.music_quality = q.value;

    var pv = qs('input[name="profile_visibility"]:checked', page);
    if (pv) st.profile_visibility = pv.value;

    return defaults(st);
  }

  function setTip(page, tab){
    var tip = qs('[data-settings-tip]', page);
    if (!tip) return;

    var map = {
      notifications: "Bildirim tercihlerini ayarla. Tarayıcı bildirimleri sonra bağlanacak.",
      music: "Müzik varsayılanları: kalite, otomatik çalma ve başlangıç ses seviyesi.",
      privacy: "Gizlilik kontrolleri: profil görünürlüğü, aktivite paylaşımı, anonim veri.",
      security: "Hesap & güvenlik: oturum süresi ve 2FA (şimdilik iskelet).",
      data: "Veri hakları: KVKK/GDPR talepleri (şimdilik iskelet)."
    };

    tip.textContent = map[tab] || map.notifications;
  }

  function setActiveTab(page, tab){
    tab = String(tab || "").toLowerCase() || "notifications";

    // chips
    qsa('[data-settings-tab]', page).forEach(function(btn){
      var k = (btn.getAttribute("data-settings-tab")||"").toLowerCase();
      var on = (k === tab);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    // panes
    qsa('[data-settings-pane]', page).forEach(function(p){
      var k = (p.getAttribute("data-settings-pane")||"").toLowerCase();
      var on = (k === tab);
      p.classList.toggle("is-active", on);
      p.style.display = on ? "" : "none";
    });

    // persist tab
    try { localStorage.setItem(KEY_TAB, tab); } catch(e){}

    // URL stab
    try{
      var u = new URL(window.location.href);
      u.searchParams.set("stab", tab);
      history.replaceState({}, "", u.toString());
    } catch(e){}

    setTip(page, tab);
  }

  function getTabFromURL(){
    try{
      var u = new URL(window.location.href);
      var t = (u.searchParams.get("stab") || "").trim().toLowerCase();
      return t;
    } catch(e){
      return "";
    }
  }

  function bind(page){
    if (page.__aivoSettingsBoundV4) return;
    page.__aivoSettingsBoundV4 = true;

    // load -> dom
    var st = loadState();
    applyToDOM(page, st);

    // init tab
    var urlTab = getTabFromURL();
    var lastTab = "";
    try { lastTab = (localStorage.getItem(KEY_TAB) || "").trim().toLowerCase(); } catch(e){}
    setActiveTab(page, urlTab || lastTab || "notifications");

    // chip click
    qsa('[data-settings-tab]', page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var t = (btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
        if (!t) return;
        setActiveTab(page, t);
      });
    });

    // save
    qsa('[data-settings-save]', page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var now = collectFromDOM(page);
        saveState(now);
        toast("Ayarlar kaydedildi");
      });
    });

    // volume label live
    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range && !range.__aivoVolBoundV4){
      range.__aivoVolBoundV4 = true;
      range.addEventListener("input", function(){
        var lbl = qs('[data-settings-volume-label]', page);
        if (lbl) lbl.textContent = "%" + String(range.value || "0");
      });
    }

    // browser enable (MVP)
    var b = qs('[data-settings-browser-enable]', page);
    if (b && !b.__aivoBoundV4){
      b.__aivoBoundV4 = true;
      b.addEventListener("click", function(){
        toast("Tarayıcı bildirimleri (MVP) — sonra bağlanacak.");
      });
    }
  }

  function boot(){
    var page = getPage();
    if (!page) return;
    bind(page);

    // SPA geçişleri için: settings görünür olunca tekrar bind (idempotent)
    try{
      var mo = new MutationObserver(function(){
        var p = getPage();
        if (p) bind(p);
      });
      mo.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:["class","style","data-active-page"] });
    } catch(e){}
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
