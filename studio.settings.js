/* =========================================================
   AIVO SETTINGS — SINGLE OWNER v5 (Tabs + Save/Load + Toast FIX)
   - Tabs: [data-settings-tab] -> [data-settings-pane]
   - Save: [data-settings-save] -> localStorage aivo_settings_v1
   - Active tab persist: localStorage aivo_settings_active_tab_v1 + URL ?stab=
   - Toast: uses existing system + AFTER-FIX centers text for short messages
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

  // ---------- SAFE MESSAGE ----------
  // Object gelirse: message -> JSON -> String
  function safeMsg(msg){
    if (msg == null) return "";
    if (typeof msg === "string") return msg;
    if (typeof msg === "number" || typeof msg === "boolean") return String(msg);

    // Error veya {message:"..."} gibi
    try{
      if (typeof msg === "object" && typeof msg.message === "string" && msg.message.trim()){
        return msg.message;
      }
    } catch(e){}

    // JSON stringify (circular olabilir)
    try{
      var j = JSON.stringify(msg);
      if (typeof j === "string" && j !== "{}") return j;
      return String(msg);
    } catch(e){
      return String(msg);
    }
  }

  // ---------- TOAST FIXER ----------
  // Toast basıldıktan sonra DOM’da aynı metni taşıyan "son" elementi bulup
  // kısa metinlerde sola kaymayı bitirmek için inline ortalama uygular.


      // Ekranda görünen + fixed/absolute olanları tercih et
      var pick = null;
      for (var i = els.length - 1; i >= 0; i--){
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (!r || r.width < 80 || r.height < 26) continue;
        // görünürlük
        if (r.bottom <= 0 || r.top >= window.innerHeight) continue;

        var cs = window.getComputedStyle(el);
        var pos = cs ? cs.position : "";
        if (pos !== "fixed" && pos !== "absolute") continue;

        pick = el;
        break;
      }

      // Bulamadıysak biraz daha dene (toast DOM’u geç basılabiliyor)
      if (!pick){
        if (tries < 8) return setTimeout(tick, 60);
        return;
      }

      // Zaten fixlendiyse dokunma
      if (pick.__aivoToastFixed) return;
      pick.__aivoToastFixed = true;

      // Inline ortalama: “ikon/slot” boşluğu olsa bile metin ortalanır
      try{
        pick.style.display = "inline-flex";
        pick.style.alignItems = "center";
        pick.style.justifyContent = "center";
        pick.style.textAlign = "center";
        pick.style.whiteSpace = "nowrap";

        // Bazı toast sistemlerinde içeride tek child var; onu da ortala
        var child = pick.firstElementChild;
        if (child){
          child.style.display = "inline-flex";
          child.style.alignItems = "center";
          child.style.justifyContent = "center";
          child.style.textAlign = "center";
          child.style.whiteSpace = "nowrap";
          child.style.width = "100%";
        }
      } catch(e){}
    }

    tick();
  }

  // ✅ sadece mevcut toast sistemini çağırır + alignment fix uygular
  function toast(msg){
    msg = safeMsg(msg);

    try{
      // 1) window.toast varsa
      if (typeof window.toast === "function"){
        window.toast(msg);
        // sadece settings mesajlarında fix uygula (diğer toast’lara karışmayalım)
        if (msg.toLowerCase().indexOf("ayarlar") > -1) fixToastAlignment(msg);
        return;
      }

      // 2) AIVO_TOAST varsa
      if (window.AIVO_TOAST){
        if (typeof window.AIVO_TOAST.show === "function"){ window.AIVO_TOAST.show(msg); if (msg.toLowerCase().indexOf("ayarlar")>-1) fixToastAlignment(msg); return; }
        if (typeof window.AIVO_TOAST.success === "function"){ window.AIVO_TOAST.success(msg); if (msg.toLowerCase().indexOf("ayarlar")>-1) fixToastAlignment(msg); return; }
        if (typeof window.AIVO_TOAST.open === "function"){ window.AIVO_TOAST.open(msg); if (msg.toLowerCase().indexOf("ayarlar")>-1) fixToastAlignment(msg); return; }
        if (typeof window.AIVO_TOAST.toast === "function"){ window.AIVO_TOAST.toast(msg); if (msg.toLowerCase().indexOf("ayarlar")>-1) fixToastAlignment(msg); return; }
      }
    } catch(e){}

    // 3) Son çare: sadece console
    try { console.log("[AIVO SETTINGS]", msg); } catch(e){}
  }

  function defaults(st){
    st = (st && typeof st === "object") ? st : {};

    if (typeof st.notify_email_done      !== "boolean") st.notify_email_done = true;
    if (typeof st.notify_email_lowcredit !== "boolean") st.notify_email_lowcredit = true;
    if (typeof st.notify_email_weekly    !== "boolean") st.notify_email_weekly = false;
    if (typeof st.notify_email_promos    !== "boolean") st.notify_email_promos = false;

    if (!st.music_quality) st.music_quality = "high";
    if (typeof st.music_autoplay !== "boolean") st.music_autoplay = false;
    if (typeof st.music_volume   !== "number") st.music_volume = 80;

    if (!st.profile_visibility) st.profile_visibility = "private";
    if (typeof st.privacy_activity_share !== "boolean") st.privacy_activity_share = true;
    if (typeof st.privacy_analytics      !== "boolean") st.privacy_analytics = true;

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
    qsa('input[type="checkbox"][data-setting]', page).forEach(function(el){
      var k = el.getAttribute("data-setting");
      if (!k) return;
      if (k in st) el.checked = !!st[k];
    });

    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range){
      range.value = String(Math.max(0, Math.min(100, Number(st.music_volume)||0)));
      var lbl = qs('[data-settings-volume-label]', page);
      if (lbl) lbl.textContent = "%" + range.value;
    }

    var sel = qs('select[data-setting="security_session_timeout"]', page);
    if (sel && st.security_session_timeout) sel.value = st.security_session_timeout;

    qsa('input[type="radio"][name="music_quality"]', page).forEach(function(el){
      el.checked = (String(el.value) === String(st.music_quality));
    });

    qsa('input[type="radio"][name="profile_visibility"]', page).forEach(function(el){
      el.checked = (String(el.value) === String(st.profile_visibility));
    });
  }

  function collectFromDOM(page){
    var st = loadState();

    // ✅ SADECE aktif pane içinden oku (hidden pane'ler high yazdırmasın)
    var scope = qs('[data-settings-pane].is-active', page) || page;

    // Aktif pane’deki data-setting input’larını topla
    qsa('[data-setting]', scope).forEach(function(el){
      var k = el.getAttribute("data-setting");
      if (!k) return;

      var tag  = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      // ✅ RADIO (music_quality gibi)
      if (tag === "input" && type === "radio"){
        if (el.checked) st[k] = el.value;
        return;
      }

      // ✅ CHECKBOX
      if (tag === "input" && type === "checkbox"){
        st[k] = (el.checked === true);
        return;
      }

      // ✅ RANGE
      if (tag === "input" && type === "range"){
        var v = parseInt(el.value, 10);
        if (isFinite(v)) st[k] = v;
        return;
      }

      // ✅ SELECT
      if (tag === "select"){
        st[k] = el.value;
        return;
      }
    });

    // Aktif pane’de checked yakala (garanti)
    var q = qs('input[name="music_quality"]:checked', scope);
    if (q) st.music_quality = q.value;

    var pv = qs('input[name="profile_visibility"]:checked', scope);
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

    qsa('[data-settings-tab]', page).forEach(function(btn){
      var k = (btn.getAttribute("data-settings-tab")||"").toLowerCase();
      var on = (k === tab);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    qsa('[data-settings-pane]', page).forEach(function(p){
      var k = (p.getAttribute("data-settings-pane")||"").toLowerCase();
      var on = (k === tab);
      p.classList.toggle("is-active", on);
      p.style.display = on ? "" : "none";
    });

    try { localStorage.setItem(KEY_TAB, tab); } catch(e){}

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
      return (u.searchParams.get("stab") || "").trim().toLowerCase();
    } catch(e){
      return "";
    }
  }

  function bind(page){
    if (page.__aivoSettingsBoundV5) return;
    page.__aivoSettingsBoundV5 = true;

    var st = loadState();
    applyToDOM(page, st);

    var urlTab = getTabFromURL();
    var lastTab = "";
    try { lastTab = (localStorage.getItem(KEY_TAB) || "").trim().toLowerCase(); } catch(e){}
    setActiveTab(page, urlTab || lastTab || "notifications");

    qsa('[data-settings-tab]', page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var t = (btn.getAttribute("data-settings-tab") || "").trim().toLowerCase();
        if (!t) return;
        setActiveTab(page, t);
      });
    });

    qsa('[data-settings-save]', page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var now = collectFromDOM(page);
        saveState(now);
        toast("Ayarlar kaydedildi");
      });
    });

    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range && !range.__aivoVolBoundV5){
      range.__aivoVolBoundV5 = true;
      range.addEventListener("input", function(){
        var lbl = qs('[data-settings-volume-label]', page);
        if (lbl) lbl.textContent = "%" + String(range.value || "0");
      });
    }

    var b = qs('[data-settings-browser-enable]', page);
    if (b && !b.__aivoBoundV5){
      b.__aivoBoundV5 = true;
      b.addEventListener("click", function(){
        toast("Tarayıcı bildirimleri (MVP) — sonra bağlanacak.");
      });
    }
  }

  function boot(){
    var page = getPage();
    if (!page) return;
    bind(page);

    try{
      var mo = new MutationObserver(function(){
        var p = getPage();
        if (p) bind(p);
      });
      mo.observe(document.documentElement, {
        subtree:true,
        childList:true,
        attributes:true,
        attributeFilter:["class","style","data-active-page"]
      });
    } catch(e){}
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


/* =========================================================
   SETTINGS — TABS (SINGLE PANE, HARD DISPLAY CONTROL) v2 SAFE (NO-CONFLICT)
   - NOT: V5 (AIVO SETTINGS — SINGLE OWNER) varsa KENDİNİ KAPATIR.
   - Bu blok artık legacy; amaç sadece yanlışlıkla dosyada kalırsa çakışmayı engellemek.
   ========================================================= */
(function(){
  "use strict";

  var ROOT_SEL  = '.page.page-settings[data-page="settings"]';
  var LS_ACTIVE = "aivo_settings_active_tab_v1";

  // ✅ V5 varsa bu legacy tabs bloğu ÇALIŞMASIN (çakışmayı bitirir)
  // 1) global flag (senin v5 bind'inde page.__aivoSettingsBoundV5 set ediliyor)
  // 2) veya başka bir yerden __aivoSettingsBoundV5 / __aivoSettingsV5Bound gibi bir guard varsa
  try{
    var page = document.querySelector(ROOT_SEL);
    if (page && page.__aivoSettingsBoundV5) return;
    if (window.__aivoSettingsBoundV5) return; // ihtiyaten
  } catch(e){}

  // prevent double bind (legacy içinde bile)
  if (window.__aivoSettingsTabsBound) return;
  window.__aivoSettingsTabsBound = true;

  function norm(v){ return String(v || "").trim().toLowerCase(); }
  function root(){ return document.querySelector(ROOT_SEL); }

  function tabs(r){ return Array.prototype.slice.call(r.querySelectorAll('[data-settings-tab]')); }
  function panes(r){ return Array.prototype.slice.call(r.querySelectorAll('[data-settings-pane]')); }

  function showPane(p){
    if (!p) return;
    p.classList.add("is-active");
    p.style.setProperty("display", "block", "important");
    p.removeAttribute("aria-hidden");
  }

  function hidePane(p){
    if (!p) return;
    p.classList.remove("is-active");
    p.style.setProperty("display", "none", "important");
    p.setAttribute("aria-hidden", "true");
  }

  function activate(r, rawKey){
    var key = norm(rawKey);
    if (!key) return;

    var t = tabs(r);
    var p = panes(r);
    if (!t.length || !p.length) return;

    // tabs active
    t.forEach(function(btn){
      var on = norm(btn.getAttribute("data-settings-tab")) === key;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.setAttribute("tabindex", on ? "0" : "-1");
    });

    // panes show/hide
    var anyOn = false;
    p.forEach(function(pane){
      var on = norm(pane.getAttribute("data-settings-pane")) === key;
      if (on) { anyOn = true; showPane(pane); }
      else hidePane(pane);
    });

    // fallback
    if (!anyOn) {
      key = "notifications";
      p.forEach(function(pane){
        var on2 = norm(pane.getAttribute("data-settings-pane")) === key;
        if (on2) showPane(pane);
        else hidePane(pane);
      });
      t.forEach(function(btn){
        var on3 = norm(btn.getAttribute("data-settings-tab")) === key;
        btn.classList.toggle("is-active", on3);
        btn.setAttribute("aria-selected", on3 ? "true" : "false");
        btn.setAttribute("tabindex", on3 ? "0" : "-1");
      });
    }

    try { localStorage.setItem(LS_ACTIVE, key); } catch(e){}
  }

  function init(){
    var r = root();
    if (!r) return;

    // ✅ init anında tekrar V5 kontrol (sayfa sonradan bind olabilir)
    if (r.__aivoSettingsBoundV5) return;

    // click delegation (capture) — sadece tab butonlarına dokun
    r.addEventListener("click", function(ev){
      // V5 sonradan devreye girdiyse legacy tab handler çalışmasın
      if (r.__aivoSettingsBoundV5) return;

      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-settings-tab]') : null;
      if (!btn || !r.contains(btn)) return;
      ev.preventDefault();
      activate(r, btn.getAttribute("data-settings-tab"));
    }, true);

    // init: URL > saved > html-active > fallback
    var urlKey = "";
    try { urlKey = norm(new URLSearchParams(location.search).get("stab")); } catch(e){}

    var savedKey = "";
    try { savedKey = norm(localStorage.getItem(LS_ACTIVE)); } catch(e){}

    var htmlActive = "";
    var activeBtn = r.querySelector('[data-settings-tab].is-active');
    if (activeBtn) htmlActive = norm(activeBtn.getAttribute("data-settings-tab"));

    if (urlKey) { activate(r, urlKey); return; }
    if (savedKey) { activate(r, savedKey); return; }
    if (htmlActive) { activate(r, htmlActive); return; }

    activate(r, "notifications");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* =========================================================
   DATA RIGHTS — FAKE JSON EXPORT (MVP) v1
   - Button: [data-action="data-export"]
   - Format select (optional): [data-setting="data_export_format"] (expects "json")
   - Sources:
       localStorage: aivo_settings_v1, aivo_profile_stats_v1 (+ backups)
       window.AIVO_JOBS (varsa)
       window.AIVO_STORE_V1 (varsa) -> credits snapshot
   - Output: aivo-export.json (client-side download)
   ========================================================= */
(function bindAivoDataRightsExport(){
  "use strict";
  if (window.__aivoDataExportBound) return;
  window.__aivoDataExportBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function safeParse(s, fallback){
    try { return JSON.parse(String(s || "")); } catch(e){ return fallback; }
  }
  function nowISO(){ try { return new Date().toISOString(); } catch(e){ return ""; } }

  function notify(type, msg){
    if (typeof window.AIVO_TOAST === "function") return window.AIVO_TOAST(type, msg);
    if (typeof window.showToast === "function") return window.showToast(type, msg);
    if (type === "error") console.error(msg);
    else console.log(msg);
  }

  function readLS(key){
    var raw = localStorage.getItem(key);
    if (raw == null) return null;
    var parsed = safeParse(raw, null);
    return (parsed !== null ? parsed : String(raw));
  }

  function collectExportPayload(){
    var settings = readLS("aivo_settings_v1");
    var profileStats = readLS("aivo_profile_stats_v1");
    var profileStatsBk = readLS("aivo_profile_stats_bk_v1");

    var jobs = null;
    try{
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS === "object"){
        if (Array.isArray(window.AIVO_JOBS.list)) jobs = window.AIVO_JOBS.list.slice(0);
        else if (typeof window.AIVO_JOBS.getList === "function") jobs = window.AIVO_JOBS.getList();
      }
    }catch(e){ jobs = null; }

    var credits = null;
    try{
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function"){
        credits = window.AIVO_STORE_V1.getCredits();
      } else {
        var lsCredits = readLS("aivo_credits_v1") || readLS("aivo_store_v1");
        if (lsCredits != null) credits = lsCredits;
      }
    }catch(e){ credits = null; }

    var user = null;
    try{
      user = {
        name: (window.AIVO_USER && window.AIVO_USER.name) ? String(window.AIVO_USER.name) : null,
        email: (window.AIVO_USER && window.AIVO_USER.email) ? String(window.AIVO_USER.email) : null
      };
    }catch(e){ user = null; }

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

  // ✅ Safari "blob:" yeni sekme hatası için sağlam download
  function downloadJSON(obj, filename){
    filename = filename || "aivo-export.json";
    var json = JSON.stringify(obj, null, 2);

    // Safari tespiti (yaklaşık)
    var isSafari = false;
    try{
      var ua = navigator.userAgent || "";
      isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
    } catch(e){}

    // 1) Blob + ObjectURL (genel)
    try{
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

      setTimeout(function(){
        try{ URL.revokeObjectURL(url); } catch(e){}
        try{ a.remove(); } catch(e){}
      }, 400);

      return;
    } catch(e1){
      // devam
    }

    // 2) Safari fallback: data URL (MVP için stabil)
    try{
      var dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
      var a2 = document.createElement("a");
      a2.style.display = "none";
      a2.href = dataUrl;
      a2.download = filename;
      a2.rel = "noopener";
      a2.target = "_self";
      document.body.appendChild(a2);
      a2.click();
      setTimeout(function(){ try{ a2.remove(); } catch(e){} }, 200);
      return;
    } catch(e2){
      // devam
    }

    // 3) Son çare
    try{
      notify("error", "Export indirilemedi (tarayıcı kısıtı).");
    } catch(e3){}
  }

  function wire(){
    var pane = qs('[data-settings-pane="data"]') || document;

    var btn =
      qs('[data-action="data-export"]', pane) ||
      qs('[data-action="export-data"]', pane) ||
      qs('[data-action="download-export"]', pane) ||
      qs('[data-data-export]', pane);

    if (!btn) return;

    var sel = qs('[data-setting="data_export_format"]', pane);

    function refreshEnabled(){
      var fmt = sel ? String(sel.value || "").toLowerCase() : "json";
      var ok = (!fmt || fmt === "json");
      btn.disabled = !ok;
      btn.setAttribute("aria-disabled", ok ? "false" : "true");
    }

    // MVP: butonu açık tut (UI kilidi varsa override)
    refreshEnabled();
    btn.disabled = false;
    btn.removeAttribute("disabled");
    btn.setAttribute("aria-disabled", "false");
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";

    if (sel){
      sel.addEventListener("change", function(){
        refreshEnabled();
        // format JSON ise yine açık tut
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.setAttribute("aria-disabled", "false");
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
      }, { passive: true });
    }

    if (!btn.__aivoExportClickBound){
      btn.__aivoExportClickBound = true;
      btn.addEventListener("click", function(ev){
        try{
          // bazen theme/overlay click'i yutar; garanti olsun
          if (ev && typeof ev.preventDefault === "function") ev.preventDefault();

          // click anında da kilidi sök
          btn.disabled = false;
          btn.removeAttribute("disabled");
          btn.setAttribute("aria-disabled", "false");
          btn.style.pointerEvents = "auto";
          btn.style.opacity = "1";

          var payload = collectExportPayload();
          downloadJSON(payload, "aivo-export.json");
          notify("success", "Export hazır: aivo-export.json indirildi (MVP).");
        }catch(e){
          notify("error", "Export oluşturulamadı. Konsolu kontrol et.");
        }
      });
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
/* =========================================================
   AIVO — SECURITY IDLE TIMEOUT (MVP)
   + 1 DK KALA UYARI TOAST
   + DEBUG HOOK
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoIdleTimeoutBound) return;
  window.__aivoIdleTimeoutBound = true;

  var CHECK_INTERVAL = 5000;
  var WARNING_BEFORE_MS = 60 * 1000; // 1 dk
  var lastActive = now();
  var currentTimeoutMs = getTimeoutMs();
  var loggedOut = false;
  var warned = false;

  function now(){ return Date.now(); }
  function qs(sel){ try { return document.querySelector(sel); } catch(e){ return null; } }

  function toast(msg){
    try{
      if (typeof window.toast === "function") return window.toast(msg);
      if (window.AIVO_TOAST){
        if (typeof window.AIVO_TOAST.show === "function") return window.AIVO_TOAST.show(msg);
        if (typeof window.AIVO_TOAST.success === "function") return window.AIVO_TOAST.success(msg);
        if (typeof window.AIVO_TOAST.open === "function") return window.AIVO_TOAST.open(msg);
      }
    }catch(e){}
    try{ console.log("[AIVO]", msg); }catch(e){}
  }

  function getTimeoutMs(){
    try{
      var st = JSON.parse(localStorage.getItem("aivo_settings_v1") || "{}");
      var v = String(st.security_session_timeout || "").toLowerCase().trim();

      if (!v || v === "off" || v === "0") return Infinity;
      if (v.endsWith("m")) return parseInt(v,10) * 60 * 1000;
      if (v.endsWith("h")) return parseInt(v,10) * 60 * 60 * 1000;

      return Infinity;
    }catch(e){
      return Infinity;
    }
  }

  function markActive(){
    lastActive = now();
    warned = false; // aktivite varsa uyarıyı sıfırla
  }

  function doLogoutBecauseIdle(){
    if (loggedOut) return;
    loggedOut = true;

    try{
      var btn =
        qs("#btnLogoutUnified") ||
        qs('[data-action="logout"]') ||
        qs('[data-logout]');
      if (btn){
        btn.click();
        return;
      }
    }catch(e){}

    try{
      Object.keys(localStorage).forEach(function(k){
        if (/auth|token|session/i.test(k)) localStorage.removeItem(k);
      });
    }catch(e){}

    try{ location.href = "/"; }catch(e){}
  }

  // Activity listeners
  ["mousemove","mousedown","keydown","scroll","touchstart"].forEach(function(ev){
    document.addEventListener(ev, markActive, { passive:true });
  });

  document.addEventListener("visibilitychange", function(){
    if (!document.hidden) markActive();
  });

  // Main loop
  setInterval(function(){
    currentTimeoutMs = getTimeoutMs();
    if (!isFinite(currentTimeoutMs)) return;

    var idleFor = now() - lastActive;

    // 1 dk kala uyarı (tek sefer)
    if (!warned && idleFor >= (currentTimeoutMs - WARNING_BEFORE_MS)){
      warned = true;
      toast("Oturumunuz 1 dakika içinde sona erecek.");
    }

    // Timeout
    if (idleFor >= currentTimeoutMs){
      doLogoutBecauseIdle();
    }
  }, CHECK_INTERVAL);

  // DEBUG HOOK
  window.__AIVO_IDLE_DEBUG__ = {
    forceLogoutNow: function(){
      doLogoutBecauseIdle();
    },
    forceIdleMs: function(ms){
      lastActive = now() - Math.max(0, Number(ms) || 0);
    },
    ping: function(){
      return {
        lastActive: lastActive,
        timeoutMs: currentTimeoutMs,
        idleForMs: now() - lastActive,
        warned: warned
      };
    }
  };

})();

