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

  // ---------- TOAST FIXER ----------
  // Toast basıldıktan sonra DOM’da aynı metni taşıyan "son" elementi bulup
  // kısa metinlerde sola kaymayı bitirmek için inline ortalama uygular.
  function fixToastAlignment(msg){
    msg = String(msg == null ? "" : msg).trim();
    if (!msg) return;

    var tries = 0;
    function tick(){
      tries++;

      // Metni içeren tüm elementleri ara (toast anlık basıldığı için sonradan geliyor olabilir)
      var els = qsa("body *").filter(function(el){
        if (!el || !el.textContent) return false;
        var t = (el.textContent || "").trim();
        if (!t) return false;
        // tam eşleşme veya içinde geçsin (bazı sistemler \n ekliyor)
        return (t === msg) || (t.indexOf(msg) > -1);
      });

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
    msg = String(msg == null ? "" : msg);

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
   SETTINGS TABS — SAFE MVP (SCOPED + URL + PERSIST)
   ========================================================= */
(function () {
  "use strict";

  // Settings page root (sadece Ayarlar içinde çalış)
  var page = document.querySelector('.page[data-page="settings"], .page-settings[data-page="settings"], .page-settings');
  if (!page) return;

  function normKey(v){
    return String(v || "").trim().toLowerCase();
  }

  function getTabs(){
    return Array.prototype.slice.call(page.querySelectorAll('[data-settings-tab]'));
  }
  function getPanes(){
    return Array.prototype.slice.call(page.querySelectorAll('[data-settings-pane]'));
  }

  var LS_ACTIVE = "aivo_settings_active_tab_v1";

  function activateTab(rawKey) {
    var key = normKey(rawKey);
    var tabs = getTabs();
    var panes = getPanes();
    if (!tabs.length || !panes.length) return false;

    var hasTab  = tabs.some(function(t){ return normKey(t.getAttribute("data-settings-tab")) === key; });
    var hasPane = panes.some(function(p){ return normKey(p.getAttribute("data-settings-pane")) === key; });
    if (!hasTab || !hasPane) return false;

    tabs.forEach(function(t){
      var tKey = normKey(t.getAttribute("data-settings-tab"));
      var on = (tKey === key);
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });

    panes.forEach(function(p){
      var pKey = normKey(p.getAttribute("data-settings-pane"));
      p.classList.toggle("is-active", pKey === key);
    });

    try { localStorage.setItem(LS_ACTIVE, key); } catch(e){}
    return true;
  }

  // CLICK (delegation) — chip/button üstünden kesin yakala
  page.addEventListener("click", function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest("[data-settings-tab]") : null;
    if (!el || !page.contains(el)) return;

    ev.preventDefault();
    activateTab(el.getAttribute("data-settings-tab"));
  }, true);

  // INIT — URL (?stab=music) > localStorage > HTML aktif > fallback
  function init() {
    var tabs = getTabs();
    var panes = getPanes();
    if (!tabs.length || !panes.length) return;

    var urlKey = "";
    try { urlKey = normKey(new URLSearchParams(location.search).get("stab")); } catch(e){}

    var savedKey = "";
    try { savedKey = normKey(localStorage.getItem(LS_ACTIVE)); } catch(e){}

    var htmlActive = "";
    var activeEl = page.querySelector('[data-settings-tab].is-active');
    if (activeEl) htmlActive = normKey(activeEl.getAttribute("data-settings-tab"));

    // Öncelik sırası
    if (urlKey && activateTab(urlKey)) return;
    if (savedKey && activateTab(savedKey)) return;
    if (htmlActive && activateTab(htmlActive)) return;

    // Fallback: notifications varsa o, yoksa music, yoksa ilk tab
    if (activateTab("notifications")) return;
    if (activateTab("music")) return;
    activateTab(tabs[0].getAttribute("data-settings-tab"));
  }

  // DOM hazır değilse garantiye al
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
