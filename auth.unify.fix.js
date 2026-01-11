/* =========================================================
   AUTH UNIFY FIX (BRIDGE) — aivo_auth_unified_v1 (REVIZE)
   Amaç:
   - Gerçek state: aivo_logged_in + aivo_user_email
   - Opsiyonel legacy: aivo_auth / aivo_user / vb.
   - Tek bir unified obje üret + topbar UI'yi güvenli güncelle
   Not:
   - index.auth.js'ten sonra yüklenmesi idealdir (ama bağımsız da çalışır).
   ========================================================= */
(function () {
  "use strict";

  var UNIFIED_KEY = "aivo_auth_unified_v1";

  // Senin sistemde kanıtlanmış gerçek key’ler
  var KEY_LOGGED_IN = "aivo_logged_in";      // "1" / null
  var KEY_USER_EMAIL = "aivo_user_email";    // "mail@..."
  // Pricing tarafında gördüğümüz olası key
  var KEY_AUTH = "aivo_auth";                // "1" / null

  function safeParse(s) {
    try { return JSON.parse(String(s || "")); } catch (e) { return null; }
  }

  function readState() {
    var li = localStorage.getItem(KEY_LOGGED_IN);
    var email = localStorage.getItem(KEY_USER_EMAIL);

    // fallback: bazı sayfalarda "aivo_auth" kullanılmış olabilir
    var auth = localStorage.getItem(KEY_AUTH);

    var loggedIn = (li === "1") || (auth === "1");
    var em = String(email || "").trim();

    // Eğer login var ama email boşsa: unified yine login saysın, email "Hesap"
    return { loggedIn: loggedIn, email: em };
  }

  function writeUnify(state) {
    var unified = {
      loggedIn: !!state.loggedIn,
      email: String(state.email || ""),
      ts: Date.now()
    };
    try { localStorage.setItem(UNIFIED_KEY, JSON.stringify(unified)); } catch (e) {}
    return unified;
  }

  function readUnify() {
    var u = safeParse(localStorage.getItem(UNIFIED_KEY));
    return (u && typeof u === "object") ? u : null;
  }

  // İstersen key’leri de standardize edelim (çok işe yarar):
  // - aivo_logged_in varsa aivo_auth'u da 1 yap
  // - logout olunca ikisini de temizle
  function syncCanonicalKeys(state) {
    try {
      if (state.loggedIn) {
        if (localStorage.getItem(KEY_LOGGED_IN) !== "1") localStorage.setItem(KEY_LOGGED_IN, "1");
        if (localStorage.getItem(KEY_AUTH) !== "1") localStorage.setItem(KEY_AUTH, "1");
        if (state.email && localStorage.getItem(KEY_USER_EMAIL) !== state.email) {
          localStorage.setItem(KEY_USER_EMAIL, state.email);
        }
      } else {
        localStorage.removeItem(KEY_LOGGED_IN);
        localStorage.removeItem(KEY_AUTH);
        // email'i istersen tut, istersen temizle. Ben temizlemeyi öneriyorum:
        localStorage.removeItem(KEY_USER_EMAIL);
      }
    } catch (e) {}
  }

  function qs(id) { return document.getElementById(id); }

  function setVisible(el, on) {
    if (!el) return;
    // hem hidden hem display’i yönet (bazı sayfalarda biri kullanılıyor)
    if (on) {
      el.hidden = false;
      el.style.display = "";
    } else {
      el.hidden = true;
      el.style.display = "none";
    }
  }

  function updateTopbarUI() {
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Bu iki ID yoksa: sayfanın topbar markup'ı uyumsuz → hiçbir şeye dokunma
    if (!guest || !user) return;

    var state = readState();
    syncCanonicalKeys(state);
    var unified = writeUnify(state);

    setVisible(guest, !unified.loggedIn);
    setVisible(user, unified.loggedIn);

    // Email yazılacak alanlar (hangi sayfada hangisi varsa hepsini besle)
    var email1 = qs("topUserEmail");   // index.auth.js’in beklediği ID
    var email2 = qs("topMenuEmail");   // senin menü içindeki ID
    var umEmail = qs("umEmail");       // pricing varyantı
    var val = unified.email || "Hesap";

    if (email1) email1.textContent = val;
    if (email2) email2.textContent = val;
    if (umEmail) umEmail.textContent = val;
  }

  // Logout butonlarını yakala (farklı sayfalarda farklı ID kullanıyorsun)
  function bindLogout() {
    var ids = ["btnLogoutTop", "btnLogoutUnified"];
    for (var i = 0; i < ids.length; i++) {
      (function(id){
        var b = qs(id);
        if (!b || b.__aivoBound) return;
        b.__aivoBound = true;
        b.addEventListener("click", function (e) {
          e.preventDefault();
          // canonical logout
          syncCanonicalKeys({ loggedIn: false, email: "" });
          try { localStorage.removeItem(UNIFIED_KEY); } catch (e) {}
          updateTopbarUI();
          // redirect opsiyonel: istersen ana sayfaya
          // location.href = "/";
        });
      })(ids[i]);
    }
  }

  function boot() {
    updateTopbarUI();
    bindLogout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Başka tab/sayfa localStorage değiştirince (login/logout) UI güncellensin
  window.addEventListener("storage", function (ev) {
    if (!ev) return;
    var k = String(ev.key || "");
    if (
      k === UNIFIED_KEY ||
      k === KEY_LOGGED_IN ||
      k === KEY_USER_EMAIL ||
      k === KEY_AUTH
    ) {
      updateTopbarUI();
    }
  });
})();
/* =========================================================
   FORCE PLAN ROW FULL WIDTH (Basic) — selector bağımsız
   /auth.unify.fix.js en altına ekle
   ========================================================= */
(function forcePlanRowFullWidth(){
  function apply(){
    const panel =
      document.querySelector("#userMenuPanel") ||
      document.querySelector("#userMenu") ||
      document.querySelector('[data-user-menu-panel]') ||
      document.querySelector(".user-menu-panel") ||
      document.querySelector(".um-panel");

    if (!panel) return;

    // Panel içindeki olası satırlar
    const rows = panel.querySelectorAll("a, button, div");
    let target = null;

    for (const el of rows) {
      const t = (el.textContent || "").trim().toLowerCase();
      // “basic” yazan satırı bul (plan satırı genelde tek)
      if (t === "basic" || t.includes("basic")) {
        // Menü item’ı olma ihtimali yüksek olanları tercih et
        const cls = (el.className || "").toString();
        if (cls.includes("plan") || cls.includes("badge") || cls.includes("um-") || cls.includes("row")) {
          target = el;
          break;
        }
        // class yakalayamazsa yine de aday olsun
        if (!target) target = el;
      }
    }

    if (!target) return;

    // Full-width zorla
    target.style.display = "flex";
    target.style.alignItems = "center";
    target.style.justifyContent = "center";
    target.style.width = "100%";
    target.style.maxWidth = "100%";
    target.style.boxSizing = "border-box";

    // Eğer parent daraltıyorsa parent’ı da aç
    const p = target.parentElement;
    if (p) {
      p.style.width = "100%";
      p.style.maxWidth = "100%";
      p.style.boxSizing = "border-box";
    }
  }

  // İlk yük
  document.addEventListener("DOMContentLoaded", () => setTimeout(apply, 50));

  // Menü açılınca tekrar uygula (tıklama sonrası DOM basılıyor olabilir)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btnUserMenuTop, .user-menu-btn, [data-open-user-menu]");
    if (btn) setTimeout(apply, 60);
  });

  // Güvenlik: kısa süre sonra bir daha (async render ihtimali)
  setTimeout(apply, 250);
  setTimeout(apply, 800);
})();
