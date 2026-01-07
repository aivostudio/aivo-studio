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

  // ✅ SADECE aktif pane içinden oku (duplicate input overwrite fix)
  var scope =
    qs('[data-settings-pane].is-active', page) ||
    qs('[data-settings-pane][style*="display: block"]', page) ||
    page;

  qsa('[data-setting]', scope).forEach(function(el){
    var k = el.getAttribute("data-setting");
    if (!k) return;

    var tag  = (el.tagName||"").toLowerCase();
    var type = (el.getAttribute("type")||"").toLowerCase();

    // ✅ RADIO SUPPORT (music_quality için kritik)
    if (tag === "input" && type === "radio"){
      if (el.checked) st[k] = el.value;
      return;
    }

    if (tag === "input" && type === "checkbox"){
      st[k] = (el.checked === true);
      return;
    }

    if (tag === "input" && type === "range"){
      var v = parseInt(el.value, 10);
      if (isFinite(v)) st[k] = v;
      return;
    }

    if (tag === "select"){
      st[k] = el.value;
      return;
    }
  });

  // (opsiyonel ama güvenli) active scope içinde checked yakala
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
   SETTINGS — TABS (SINGLE PANE, HARD DISPLAY CONTROL) v2 SAFE
   - double bind koruması
   - sadece settings root içinden çalışır
   - click delegation: buton dışında bir şeye dokunmaz
   ========================================================= */
(function(){
  "use strict";

  var ROOT_SEL  = '.page.page-settings[data-page="settings"]';
  var LS_ACTIVE = "aivo_settings_active_tab_v1";

  // prevent double bind
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
      if (on) btn.setAttribute("tabindex","0");
      else btn.setAttribute("tabindex","-1");
    });

    // panes show/hide
    var anyOn = false;
    p.forEach(function(pane){
      var on = norm(pane.getAttribute("data-settings-pane")) === key;
      if (on) { anyOn = true; showPane(pane); }
      else hidePane(pane);
    });

    // if key yanlışsa fallback
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
        if (on3) btn.setAttribute("tabindex","0");
        else btn.setAttribute("tabindex","-1");
      });
    }

    try { localStorage.setItem(LS_ACTIVE, key); } catch(e){}
  }

  function init(){
    var r = root();
    if (!r) return;

    // click delegation (capture) — sadece tab butonlarına dokun
    r.addEventListener("click", function(ev){
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


