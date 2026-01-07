/* =========================================================
   SETTINGS (MVP) — TABS + PERSIST + SAVE/LOAD + TOAST (SAFE) v3
   - Tabs: [data-settings-tab] -> [data-settings-pane]
   - Persist active tab: aivo_settings_active_tab_v1
   - Persist values: aivo_settings_v1
   - SAFE: Sadece .page-settings içinde çalışır
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoSettingsBoundV3) return;
  window.__aivoSettingsBoundV3 = true;

  var KEY_TAB  = "aivo_settings_active_tab_v1";
  var KEY_DATA = "aivo_settings_v1";

  function qs(sel, root){
    try { return (root || document).querySelector(sel); } catch(e){ return null; }
  }
  function qsa(sel, root){
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch(e){ return []; }
  }
  function safeParse(s, fallback){
    try { return JSON.parse(String(s || "")); } catch(e){ return fallback; }
  }

  function getPage(){
    // Sadece settings page içinde çalış
    return qs('.page.page-settings[data-page="settings"]') || qs('.page-settings[data-page="settings"]') || qs('.page-settings');
  }

  function isSettingsActive(page){
    // SPA: body data-active-page varsa onu baz al
    var ap = (document.body && document.body.getAttribute("data-active-page")) || "";
    if (String(ap).toLowerCase() === "settings") return true;

    // Fallback: page görünür mü?
    if (!page) return false;
    if (page.classList && page.classList.contains("is-active")) return true;
    return page.offsetParent !== null; // görünür
  }

  // ---------- Toast ----------
  function ensureToast(page){
    var t = qs('[data-settings-toast]', page);
    if (t) return t;

    t = document.createElement("div");
    t.setAttribute("data-settings-toast", "1");
    t.setAttribute("aria-live", "polite");
    t.style.position = "fixed";
    t.style.right = "18px";
    t.style.bottom = "18px";
    t.style.zIndex = "9999";
    t.style.padding = "10px 12px";
    t.style.borderRadius = "12px";
    t.style.background = "rgba(20,20,26,.9)";
    t.style.border = "1px solid rgba(255,255,255,.10)";
    t.style.backdropFilter = "blur(10px)";
    t.style.webkitBackdropFilter = "blur(10px)";
    t.style.color = "rgba(255,255,255,.92)";
    t.style.fontSize = "13px";
    t.style.boxShadow = "0 12px 40px rgba(0,0,0,.35)";
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    t.style.transition = "opacity .18s ease, transform .18s ease";
    t.hidden = true;

    document.body.appendChild(t);
    return t;
  }

  var toastTimer = null;
  function showToast(page, msg){
    var t = ensureToast(page);
    if (!t) return;

    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }

    t.textContent = msg || "Kaydedildi";
    t.hidden = false;

    // reflow
    t.getBoundingClientRect();
    t.style.opacity = "1";
    t.style.transform = "translateY(0px)";

    toastTimer = setTimeout(function(){
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      toastTimer = setTimeout(function(){
        t.hidden = true;
      }, 220);
    }, 1800);
  }

  // ---------- Tips (sol + sağ) ----------
  var TIP_MAP = {
    notifications: "Bildirimleri sade tut. MVP’de sadece toggle’lar kaydedilir (localStorage).",
    music: "Müzik tercihleri: kalite, autoplay, ses seviyesi. Slider etiketi otomatik güncellenir.",
    privacy: "Gizlilik ayarları: profil görünürlüğü + aktivite paylaşımı + anonim analytics.",
    security: "Güvenlik iskelet. 2FA ve tehlikeli işlemler şimdilik disabled.",
    data: "KVKK/GDPR talepleri iskelet. Butonlar disabled; ileride API bağlanacak."
  };

  function setTip(page, tab){
    var leftTip = qs('[data-settings-tip]', page);
    var rightTip = qs('.aivo-settings-tip-text', page) || qs('.right-panel .aivo-settings-tip-text', document);

    var msg = TIP_MAP[tab] || "Ayarları düzenle ve Kaydet’e bas. (MVP: localStorage)";
    if (leftTip) leftTip.textContent = msg;
    if (rightTip) rightTip.textContent = msg;
  }

  // ---------- Tabs ----------
  function setActiveTab(page, tab){
    var chips = qsa('[data-settings-tab]', page);
    var panes = qsa('[data-settings-pane]', page);

    chips.forEach(function(btn){
      var isOn = String(btn.getAttribute("data-settings-tab") || "") === String(tab);
      btn.classList.toggle("is-active", !!isOn);
      btn.setAttribute("aria-selected", isOn ? "true" : "false");
    });

    panes.forEach(function(p){
      var isOn = String(p.getAttribute("data-settings-pane") || "") === String(tab);
      p.classList.toggle("is-active", !!isOn);
      // pane görünürlüğü: CSS yoksa garanti
      p.style.display = isOn ? "" : "none";
    });

    try { localStorage.setItem(KEY_TAB, String(tab)); } catch(e){}
    setTip(page, tab);

    // tab değişince label güncelle
    syncVolumeLabel(page);
  }

  function getDefaultTab(page){
    var saved = null;
    try { saved = localStorage.getItem(KEY_TAB); } catch(e){}
    if (saved && qs('[data-settings-pane="'+saved+'"]', page)) return saved;

    // HTML’de is-active olan chip varsa onu al
    var activeChip = qs('[data-settings-tab].is-active', page);
    if (activeChip) return activeChip.getAttribute("data-settings-tab") || "notifications";

    return "notifications";
  }

  // ---------- Save/Load ----------
  function readValueFromEl(el){
    var tag = (el.tagName || "").toLowerCase();
    var type = String(el.type || "").toLowerCase();

    if (type === "checkbox") return !!el.checked;

    if (type === "radio") {
      // radio: aynı data-setting key’e sahip checked olanı kaydet
      return el.checked ? String(el.value || "1") : null;
    }

    if (tag === "select") return String(el.value || "");

    // range / text / textarea / number ...
    return String(el.value == null ? "" : el.value);
  }

  function applyValueToEl(el, val){
    var tag = (el.tagName || "").toLowerCase();
    var type = String(el.type || "").toLowerCase();

    if (type === "checkbox") {
      el.checked = !!val;
      return;
    }

    if (type === "radio") {
      // val string ile eşleşeni check et
      el.checked = String(el.value || "") === String(val);
      return;
    }

    if (tag === "select") {
      el.value = String(val == null ? "" : val);
      return;
    }

    el.value = String(val == null ? "" : val);
  }

  function collectSettings(page){
    var out = {};
    var els = qsa('[data-setting]', page);

    // radio’lar için önce grupla
    var radioGroups = {};

    els.forEach(function(el){
      var key = el.getAttribute("data-setting");
      if (!key) return;

      var type = String(el.type || "").toLowerCase();
      if (type === "radio") {
        if (!radioGroups[key]) radioGroups[key] = [];
        radioGroups[key].push(el);
        return;
      }

      out[key] = readValueFromEl(el);
    });

    Object.keys(radioGroups).forEach(function(key){
      var group = radioGroups[key] || [];
      var chosen = null;
      for (var i=0; i<group.length; i++){
        if (group[i].checked) { chosen = String(group[i].value || "1"); break; }
      }
      // seçili yoksa null yazma, HTML default’u koru
      if (chosen != null) out[key] = chosen;
    });

    return out;
  }

  function loadSettings(page){
    var raw = null;
    try { raw = localStorage.getItem(KEY_DATA); } catch(e){}
    var data = safeParse(raw, null);
    if (!data || typeof data !== "object") {
      // yine de default’lar (HTML selected/checked) üzerinden label sync
      syncVolumeLabel(page);
      return;
    }

    // Önce tüm elementleri uygula
    var els = qsa('[data-setting]', page);
    els.forEach(function(el){
      var key = el.getAttribute("data-setting");
      if (!key) return;
      if (!(key in data)) return;

      applyValueToEl(el, data[key]);
    });

    syncVolumeLabel(page);
  }

  function saveSettings(page){
    var data = collectSettings(page);
    try { localStorage.setItem(KEY_DATA, JSON.stringify(data)); } catch(e){}
    showToast(page, "Ayarlar kaydedildi");
  }

  // ---------- Volume label ----------
  function syncVolumeLabel(page){
    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    var label = qs('[data-settings-volume-label]', page);
    if (!range || !label) return;

    var v = Number(range.value || 0);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(100, v));
    label.textContent = "%" + v;
  }

  // ---------- Browser notifications button (MVP) ----------
  function bindBrowserNotif(page){
    var btn = qs('[data-settings-browser-enable]', page);
    if (!btn) return;

    btn.addEventListener("click", function(){
      try {
        if (!("Notification" in window)) {
          showToast(page, "Tarayıcı bildirimleri desteklenmiyor");
          return;
        }

        if (Notification.permission === "granted") {
          showToast(page, "Bildirim izni zaten açık");
          return;
        }

        Notification.requestPermission().then(function(p){
          if (p === "granted") showToast(page, "Bildirimler etkinleştirildi");
          else showToast(page, "Bildirim izni verilmedi");
        }).catch(function(){
          showToast(page, "İzin isteği başarısız");
        });
      } catch(e){
        showToast(page, "İzin isteği başarısız");
      }
    });
  }

  // ---------- Boot ----------
  function bind(){
    var page = getPage();
    if (!page) return;

    // Tab click
    qsa('[data-settings-tab]', page).forEach(function(btn){
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", function(){
        var t = btn.getAttribute("data-settings-tab") || "notifications";
        setActiveTab(page, t);
      });
    });

    // Save click
    qsa('[data-settings-save]', page).forEach(function(btn){
      btn.addEventListener("click", function(){
        saveSettings(page);
      });
    });

    // Live updates for slider label
    var vol = qs('input[type="range"][data-setting="music_volume"]', page);
    if (vol){
      vol.addEventListener("input", function(){ syncVolumeLabel(page); });
      vol.addEventListener("change", function(){ syncVolumeLabel(page); });
    }

    // Load initial
    var tab = getDefaultTab(page);
    setActiveTab(page, tab);
    loadSettings(page);
    bindBrowserNotif(page);

    // SPA: settings sayfasına her girişte state’i yenile
    try {
      var mo = new MutationObserver(function(muts){
        for (var i=0; i<muts.length; i++){
          if (muts[i].attributeName === "data-active-page"){
            if (isSettingsActive(page)){
              var t2 = getDefaultTab(page);
              setActiveTab(page, t2);
              loadSettings(page);
            }
          }
        }
      });
      if (document.body) mo.observe(document.body, { attributes: true });
    } catch(e){}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
