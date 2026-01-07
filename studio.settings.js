/* =========================================================
   SETTINGS (AIVO) — Tabs + LocalStorage Save (MVP) + URL stab
   - SAFE SCOPE: Sadece data-page="settings" içini yönetir
   - Kaydet: localStorage aivo_settings_v1
   - URL: ?page=settings&stab=...
   - Toast: window.AIVO_TOAST / window.toast / fallback alert
   ========================================================= */
(function(){
  "use strict";

  var KEY = "aivo_settings_v1";

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isSettingsOpen(){
    var page = qs('.page[data-page="settings"]');
    if (!page) return false;
    // Sende sayfalar genelde class ile açılıyor: .page.is-active veya style/display
    // En güvenlisi: görünür mü?
    var rect = page.getBoundingClientRect();
    var visible = !!(rect.width && rect.height);
    // Eğer sistem is-active kullanıyorsa onu da kontrol et:
    if (page.classList.contains("is-active")) return true;
    return visible;
  }

  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }

  function getState(){
    var st = safeParse(localStorage.getItem(KEY), null);
    if (!st || typeof st !== "object") st = {};
    // defaults
    if (typeof st.notify_email_done !== "boolean") st.notify_email_done = true;
    if (typeof st.notify_email_lowcredit !== "boolean") st.notify_email_lowcredit = true;
    if (typeof st.notify_email_weekly !== "boolean") st.notify_email_weekly = false;
    if (typeof st.notify_email_promos !== "boolean") st.notify_email_promos = false;

    if (typeof st.music_autoplay !== "boolean") st.music_autoplay = false;
    if (typeof st.music_volume !== "number") st.music_volume = 80;
    if (!st.music_quality) st.music_quality = "high";

    if (!st.profile_visibility) st.profile_visibility = "private";
    if (typeof st.privacy_activity_share !== "boolean") st.privacy_activity_share = true;
    if (typeof st.privacy_analytics !== "boolean") st.privacy_analytics = true;

    if (!st.security_session_timeout) st.security_session_timeout = "1h";

    return st;
  }

  function setState(st){
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e) {}
  }

  function toast(msg){
    try{
      if (window.AIVO_TOAST && typeof window.AIVO_TOAST.show === "function"){
        window.AIVO_TOAST.show(msg);
        return;
      }
      if (typeof window.toast === "function"){
        window.toast(msg);
        return;
      }
    } catch(e){}
    // fallback
    try { console.log("[AIVO] " + msg); } catch(e){}
  }

  function readFromDOM(page){
    var st = getState();

    // checkbox toggles
    qsa('[data-setting]', page).forEach(function(el){
      var key = el.getAttribute("data-setting");
      if (!key) return;

      if (el.type === "checkbox"){
        st[key] = !!el.checked;
      } else if (el.type === "range"){
        var v = parseInt(el.value, 10);
        st[key] = isFinite(v) ? v : st[key];
      } else if (el.tagName === "SELECT"){
        st[key] = el.value;
      } else if (el.type === "radio"){
        // radios handled below
      }
    });

    // radio groups (quality + visibility)
    var q = qs('input[name="music_quality"]:checked', page);
    if (q) st.music_quality = q.value;

    var pv = qs('input[name="profile_visibility"]:checked', page);
    if (pv) st.profile_visibility = pv.value;

    return st;
  }

  function writeToDOM(page, st){
    // checkboxes
    qsa('input[type="checkbox"][data-setting]', page).forEach(function(el){
      var key = el.getAttribute("data-setting");
      if (key in st) el.checked = !!st[key];
    });

    // range
    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range){
      range.value = String(st.music_volume);
      var lbl = qs("[data-settings-volume-label]", page);
      if (lbl) lbl.textContent = "%" + String(st.music_volume);
    }

    // select
    var sel = qs('select[data-setting="security_session_timeout"]', page);
    if (sel && st.security_session_timeout) sel.value = st.security_session_timeout;

    // radio: quality
    qsa('input[type="radio"][name="music_quality"]', page).forEach(function(el){
      el.checked = (el.value === st.music_quality);
    });

    // radio: visibility
    qsa('input[type="radio"][name="profile_visibility"]', page).forEach(function(el){
      el.checked = (el.value === st.profile_visibility);
    });
  }

  function setActiveTab(page, tab){
    tab = (tab || "notifications").toLowerCase();

    // chips
    qsa("[data-settings-tab]", page).forEach(function(btn){
      btn.classList.toggle("is-active", btn.getAttribute("data-settings-tab") === tab);
    });

    // panes
    qsa("[data-settings-pane]", page).forEach(function(p){
      p.classList.toggle("is-active", p.getAttribute("data-settings-pane") === tab);
    });

    // right tip
    var tip = qs("[data-settings-tip]", page);
    if (tip){
      var map = {
        notifications: "Bildirim tercihlerini ayarla. Tarayıcı bildirimleri daha sonra bağlanacak.",
        music: "Müzik varsayılan kalite, otomatik çalma ve ses seviyesi tercihlerini ayarla.",
        privacy: "Gizlilik tercihlerini belirle. (MVP: cihazına kaydedilir.)",
        security: "2FA ve oturum ayarları iskelet. Sonra API/akış bağlanacak.",
        data: "KVKK/GDPR talepleri iskelet. Sonra butonlar gerçek aksiyonlara bağlanacak."
      };
      tip.textContent = map[tab] || "Ayarlarını düzenle ve kaydet.";
    }

    // URL: page paramına dokunmadan stab güncelle
    try{
      var u = new URL(window.location.href);
      u.searchParams.set("stab", tab);
      window.history.replaceState({}, "", u.toString());
    } catch(e){}
  }

  function getTabFromURL(){
    try{
      var u = new URL(window.location.href);
      var t = (u.searchParams.get("stab") || "").trim();
      if (t) return t;
    } catch(e){}
    return "";
  }

  function bind(){
    var page = qs('.page[data-page="settings"]');
    if (!page) return;

    if (page.__aivoSettingsBound) return;
    page.__aivoSettingsBound = true;

    // init state -> DOM
    var st = getState();
    writeToDOM(page, st);

    // init tab
    var tab = getTabFromURL() || st.__last_tab || "notifications";
    setActiveTab(page, tab);

    // chip click
    qsa("[data-settings-tab]", page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var t = btn.getAttribute("data-settings-tab");
        var st2 = getState();
        st2.__last_tab = t;
        setState(st2);
        setActiveTab(page, t);
      });
    });

    // save buttons (both)
    qsa("[data-settings-save]", page).forEach(function(btn){
      btn.addEventListener("click", function(){
        var stNow = readFromDOM(page);
        // last tab persist
        var activeChip = qs("[data-settings-tab].is-active", page);
        if (activeChip) stNow.__last_tab = activeChip.getAttribute("data-settings-tab");
        setState(stNow);
        toast("Ayarlar kaydedildi.");
      });
    });

    // volume label live
    var range = qs('input[type="range"][data-setting="music_volume"]', page);
    if (range){
      range.addEventListener("input", function(){
        var v = parseInt(range.value, 10);
        var lbl = qs("[data-settings-volume-label]", page);
        if (lbl) lbl.textContent = "%" + (isFinite(v) ? v : 0);
      });
    }

    // browser enable (MVP)
    var b = qs("[data-settings-browser-enable]", page);
    if (b){
      b.addEventListener("click", function(){
        toast("Tarayıcı bildirimleri (MVP) — sonra bağlanacak.");
      });
    }
  }

  // Uygulama sayfa geçişleri class ile oluyorsa: DOM değişimini izle ve gerektiğinde bind et
  function boot(){
    bind();
    // Hafif bir observer: sayfa değişince tekrar bind gerekmiyor ama görünürlük değişimi olabilir.
    try{
      var mo = new MutationObserver(function(){
        if (isSettingsOpen()) bind();
      });
      mo.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:["class","style"]});
    } catch(e){}
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
/* =========================================================
   SETTINGS (MVP) — SAVE + LOAD + TOAST (SAFE) v1
   - Save: [data-settings-save] click -> localStorage
   - Load: on init -> applies to inputs with [data-setting]
   - Scope: only when data-page="settings" exists
   ========================================================= */
(function(){
  "use strict";

  var KEY = "aivo_settings_v1";

  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }

  // ---- page guard (SAFETY) ----
  function getSettingsPage(){
    return qs('.page[data-page="settings"]') || qs('.page-settings[data-page="settings"]') || qs('.page-settings');
  }

  function collect(page){
    var out = {};
    qsa("[data-setting]", page).forEach(function(el){
      var k = (el.getAttribute("data-setting")||"").trim();
      if (!k) return;

      var tag = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      if (tag === "input" && type === "checkbox"){
        out[k] = !!el.checked;
      } else if (tag === "input" && (type === "radio")){
        if (el.checked) out[k] = el.value || true;
      } else if (tag === "input" || tag === "select" || tag === "textarea"){
        out[k] = el.value;
      } else {
        out[k] = el.textContent;
      }
    });
    return out;
  }

  function apply(page, data){
    if (!data || typeof data !== "object") return;

    qsa("[data-setting]", page).forEach(function(el){
      var k = (el.getAttribute("data-setting")||"").trim();
      if (!k) return;
      if (!(k in data)) return;

      var v = data[k];
      var tag = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      if (tag === "input" && type === "checkbox"){
        el.checked = !!v;
      } else if (tag === "input" && type === "radio"){
        // radios: match value
        el.checked = (String(el.value) === String(v)) || (v === true && !!el.checked);
      } else if (tag === "input" || tag === "select" || tag === "textarea"){
        el.value = (v == null ? "" : String(v));
      }
    });
  }

  function toast(msg){
    // Prefer your existing toast system if present
    if (window.AIVO_TOAST && typeof window.AIVO_TOAST.show === "function"){
      window.AIVO_TOAST.show(msg);
      return;
    }
    if (typeof window.toast === "function"){
      window.toast(msg);
      return;
    }
    // fallback (last resort)
    console.log("[SETTINGS]", msg);
  }

  function init(){
    var page = getSettingsPage();
    if (!page) return;

    // load
    var saved = safeParse(localStorage.getItem(KEY), null);
    if (saved) apply(page, saved);

    // bind save
    var btn = qs("[data-settings-save]", page) || qs("[data-settings-save]");
    if (btn && !btn.__aivoBound){
      btn.__aivoBound = true;
      btn.addEventListener("click", function(){
        var data = collect(page);
        localStorage.setItem(KEY, JSON.stringify(data));
        toast("Ayarlarınız kaydedildi");
      });
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/* =========================================================
   SETTINGS (MVP) — TABS + PERSIST + SAVE/LOAD + TOAST + TIP (SAFE) v3
   - Tabs (Kategori chip):
       Chips: [data-settings-tab="notifications"] ...
       Panes: [data-settings-pane="notifications"] ...
     -> tıklayınca sadece ilgili pane görünür
     -> aktif chip/pane: .is-active + aria-selected
     -> son seçilen sekme: localStorage (aivo_settings_active_tab_v1)

   - Save/Load:
       Save buttons: [data-settings-save] (sayfada 1 veya 2 tane olabilir)
       Inputs: [data-setting] (checkbox/radio/select/input/textarea)
     -> Kaydet: localStorage (aivo_settings_v1)
     -> Yükle: init'te otomatik uygular

   - Dynamic Tip (Right Panel):
       Text target: [data-settings-tip]   (SENDE VAR)
       Optional title: [data-settings-tip-title] (istersen ekleyebilirsin)
     -> aktif sekmeye göre sağ panel ipucu metni değişir

   - Safety:
     Sadece Settings page varsa çalışır. Başka sayfalara dokunmaz.
   ========================================================= */
(function(){
  "use strict";

  var KEY_SETTINGS = "aivo_settings_v1";
  var KEY_TAB      = "aivo_settings_active_tab_v1";

  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }

  // ---- page guard (SAFETY) ----
  function getSettingsPage(){
    return qs('.page[data-page="settings"]')
      || qs('.page-settings[data-page="settings"]')
      || qs('.page-settings');
  }

  // ---- toast helper ----
  function toast(msg){
    if (window.AIVO_TOAST && typeof window.AIVO_TOAST.show === "function"){
      window.AIVO_TOAST.show(msg);
      return;
    }
    if (typeof window.toast === "function"){
      window.toast(msg);
      return;
    }
    console.log("[SETTINGS]", msg);
  }

  // =========================================================
  // TIP (RIGHT PANEL) — DYNAMIC TEXT BY ACTIVE TAB
  // - uses your existing: [data-settings-tip]
  // - optional: [data-settings-tip-title]
  // =========================================================
  function setTip(page, tabKey){
    // Hedef: sağ paneldeki ipucu metni (senin HTML'inde var)
    var tipTextEl = qs("[data-settings-tip]", page) || qs("[data-settings-tip]");
    if (!tipTextEl) return;

    // Opsiyonel başlık: eklediysen çalışır, eklemediysen sessiz geçer
    var tipTitleEl = qs("[data-settings-tip-title]", page) || qs("[data-settings-tip-title]");

    var k = String(tabKey || "").trim() || "notifications";

    // NOT: Eğer senin data-settings-tab değerlerin Türkçe ise (örn: "muzik"),
    // burada key'leri onunla eşleştirmen yeterli.
    var TIP_MAP = {
      notifications: {
        title: "İpucu",
        text: "Bildirim tercihlerini ayarla. Tarayıcı bildirimleri daha sonra bağlanacak."
      },
      music: {
        title: "İpucu",
        text: "Müzik üretim varsayılanlarını belirle: kalite, format, normalizasyon ve otomatik etiketleme gibi seçenekler."
      },
      privacy: {
        title: "İpucu",
        text: "Gizlilik kontrolleri: içerik görünürlüğü, veri paylaşımı ve kişisel tercihler. Kaydedince geçerli olur."
      },
      security: {
        title: "İpucu",
        text: "Hesap & güvenlik: oturumlar, cihazlar ve şifre politikası. Gerekirse tüm oturumları kapat."
      },
      data: {
        title: "İpucu",
        text: "Veri hakları: verini indirme/silme talepleri. Bu alan MVP’de bilgilendirme amaçlıdır."
      }
    };

    var tip = TIP_MAP[k] || TIP_MAP.notifications;

    if (tipTitleEl) tipTitleEl.textContent = tip.title;
    tipTextEl.textContent = tip.text;
  }

  // ---- collect/apply settings ----
  function collect(page){
    var out = {};
    qsa("[data-setting]", page).forEach(function(el){
      var k = (el.getAttribute("data-setting")||"").trim();
      if (!k) return;

      var tag  = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      if (tag === "input" && type === "checkbox"){
        out[k] = !!el.checked;
      } else if (tag === "input" && type === "radio"){
        if (el.checked) out[k] = el.value || true;
      } else if (tag === "input" || tag === "select" || tag === "textarea"){
        out[k] = el.value;
      }
    });
    return out;
  }

  function apply(page, data){
    if (!data || typeof data !== "object") return;

    qsa("[data-setting]", page).forEach(function(el){
      var k = (el.getAttribute("data-setting")||"").trim();
      if (!k) return;
      if (!(k in data)) return;

      var v    = data[k];
      var tag  = (el.tagName||"").toLowerCase();
      var type = (el.getAttribute("type")||"").toLowerCase();

      if (tag === "input" && type === "checkbox"){
        el.checked = !!v;
      } else if (tag === "input" && type === "radio"){
        el.checked = (String(el.value) === String(v));
      } else if (tag === "input" || tag === "select" || tag === "textarea"){
        el.value = (v == null ? "" : String(v));
      }
    });
  }

  // ---- tabs (category chips) ----
  function setActiveTab(page, tabKey){
    tabKey = String(tabKey||"").trim();
    if (!tabKey) tabKey = "notifications";

    var chips = qsa("[data-settings-tab]", page);
    var panes = qsa("[data-settings-pane]", page);

    // chip states
    chips.forEach(function(btn){
      var k = (btn.getAttribute("data-settings-tab")||"").trim();
      var on = (k === tabKey);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    // pane states
    panes.forEach(function(p){
      var k = (p.getAttribute("data-settings-pane")||"").trim();
      var on = (k === tabKey);
      p.classList.toggle("is-active", on);
      // görünürlük: CSS'in yoksa bile güvenli olsun diye inline yönetiyoruz
      p.style.display = on ? "" : "none";
    });

    try { localStorage.setItem(KEY_TAB, tabKey); } catch(e){}

    // ✅ NEW: sağ panel ipucunu sekmeye göre güncelle
    setTip(page, tabKey);
  }

  function bindTabs(page){
    var chips = qsa("[data-settings-tab]", page);
    if (!chips.length) return;

    chips.forEach(function(btn){
      if (btn.__aivoBound) return;
      btn.__aivoBound = true;

      btn.setAttribute("role", "tab");
      btn.addEventListener("click", function(){
        var key = (btn.getAttribute("data-settings-tab")||"").trim();
        if (!key) return;
        setActiveTab(page, key);
      });
    });
  }

  // ---- save buttons ----
  function bindSave(page){
    var buttons = qsa("[data-settings-save]", page);
    if (!buttons.length) return;

    buttons.forEach(function(btn){
      if (btn.__aivoBound) return;
      btn.__aivoBound = true;

      btn.addEventListener("click", function(){
        var data = collect(page);
        try {
          localStorage.setItem(KEY_SETTINGS, JSON.stringify(data));
          toast("Ayarlarınız kaydedildi");
        } catch(e){
          toast("Kaydetme başarısız (localStorage erişimi yok)");
        }
      });
    });
  }

  function init(){
    var page = getSettingsPage();
    if (!page) return;

    // 1) load settings
    var saved = safeParse(localStorage.getItem(KEY_SETTINGS), null);
    if (saved) apply(page, saved);

    // 2) bind tabs + restore last tab
    bindTabs(page);
    var lastTab = (localStorage.getItem(KEY_TAB) || "").trim();
    setActiveTab(page, lastTab || "notifications");

    // 3) bind save
    bindSave(page);

    // 4) (fail-safe) eğer hiç tab yoksa bile default ipucu yaz
    // (pane/chip yapın her zaman var ama güvenlik için)
    setTip(page, (localStorage.getItem(KEY_TAB) || "").trim() || "notifications");
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


