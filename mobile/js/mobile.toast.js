(function AIVO_MOBILE_FAST_AUTH_REVEAL(){
  try {
    if (!/\/studio\.mobile\.html$/i.test(String(location.pathname || ""))) return;

    var unified = {};
    try {
      unified = JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}");
    } catch (_) {
      unified = {};
    }

    var loggedIn = localStorage.getItem("aivo_logged_in") === "1";
    var unifiedLoggedIn = unified && unified.loggedIn === true;
    var email = String(
      (unified && unified.email) ||
      localStorage.getItem("aivo_user_email") ||
      ""
    ).trim().toLowerCase();

    if ((!loggedIn && !unifiedLoggedIn) || !email || email.indexOf("@") === -1) {
      return;
    }

    var gateStyle = document.getElementById("aivo-auth-gate-style");
    if (gateStyle) gateStyle.remove();

    document.documentElement.style.visibility = "visible";
  } catch (_) {}
})();

(function AIVO_MOBILE_REFRESH_ROUTE_PREBOOT(){
  try {
    if (!/\/studio\.mobile\.html$/i.test(String(location.pathname || ""))) return;

    var hash = String(location.hash || "#home").toLowerCase();
    var map = {
      "#home": "mobileHomeMount",
      "#music": "mobileMusicMount",
      "#cover": "mobileCoverMount",
      "#atmo": "mobileAtmoMount",
      "#cartoon": "mobileCartoonMount",
      "#photofx": "mobilePhotoFxMount",
      "#video": "mobileVideoMount",
      "#lipsync": "mobileLipsyncMount",
      "#adfilm": "mobileAdFilmMount",
      "#credits": "mobileCreditsMount",
      "#tools": "mobileToolsMount",
      "#account": "mobileAccountMount"
    };

    var targetId = map[hash];
    if (!targetId) return;

    var mountIds = [
      "mobileHomeMount",
      "mobileMusicMount",
      "mobileCoverMount",
      "mobileAtmoMount",
      "mobileCartoonMount",
      "mobilePhotoFxMount",
      "mobileVideoMount",
      "mobileLipsyncMount",
      "mobileAdFilmMount",
      "mobileCreditsMount",
      "mobileToolsMount",
      "mobileAccountMount",
      "mobilePolicyMount"
    ];

    mountIds.forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.hidden = id !== targetId;
    });

    var nav = document.querySelector('.bottom-nav a[href="' + hash + '"]');
    if (nav) {
      document.querySelectorAll(".bottom-nav a").forEach(function(item){
        item.classList.toggle("active", item === nav);
      });
    }

    document.documentElement.classList.remove("aivo-hash-routing-pending");
  } catch (_) {}
})();

(function AIVO_MOBILE_WEB_I18N_BOOT(){
  try {
    if (!/\.mobile\.html$/i.test(String(location.pathname || ""))) return;
    if (window.__AIVO_MOBILE_WEB_I18N_BOOT__) return;
    window.__AIVO_MOBILE_WEB_I18N_BOOT__ = true;

    var script = document.createElement("script");
    script.src = "/mobile/js/mobile.web-i18n.js?v=1";
    script.defer = true;
    document.head.appendChild(script);
  } catch (_) {}
})();

(function AIVO_PLAY_CARTOON_CHARACTER_ACTIONS(){
  try {
    if (!/\/studio\.play\.html$/i.test(String(location.pathname || ""))) return;
    if (window.__AIVO_PLAY_CARTOON_CHARACTER_ACTIONS__) return;
    window.__AIVO_PLAY_CARTOON_CHARACTER_ACTIONS__ = true;

    function escapeAttribute(value){
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function openCharacterPreview(imageUrl){
      var existing = document.getElementById("aivoPlayCartoonCharacterPreview");
      if (existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "aivoPlayCartoonCharacterPreview";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.style.cssText = "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(5,7,16,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);";
      overlay.innerHTML = '<button type="button" data-cartoon-preview-close aria-label="Kapat" style="position:absolute;top:max(18px,env(safe-area-inset-top));right:18px;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(20,22,36,.88);color:#fff;font-size:28px;line-height:1;">×</button>' +
        '<img src="' + escapeAttribute(imageUrl) + '" alt="Karakter önizleme" style="display:block;max-width:94vw;max-height:82vh;width:auto;height:auto;object-fit:contain;border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.5);">';

      function closePreview(){
        overlay.remove();
      }

      overlay.addEventListener("click", function(event){
        var closeButton = event.target && event.target.closest
          ? event.target.closest("[data-cartoon-preview-close]")
          : null;
        if (event.target === overlay || closeButton) closePreview();
      });

      document.body.appendChild(overlay);
    }

    function downloadCharacter(imageUrl){
      var filename = "aivo-cizgifilm-karakter.jpg";
      var proxyUrl =
        "/api/media/proxy?url=" +
        encodeURIComponent(String(imageUrl || "")) +
        "&filename=" +
        encodeURIComponent(filename);

      var link = document.createElement("a");
      link.href = proxyUrl;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(function(){
        try { link.remove(); } catch (_) {}
      }, 1500);
    }

    document.addEventListener("click", function(event){
      var button = event.target && event.target.closest
        ? event.target.closest("[data-mobile-cartoon-character-act]")
        : null;
      if (!button) return;

      var action = String(button.getAttribute("data-mobile-cartoon-character-act") || "").trim();
      if (action !== "preview" && action !== "download") return;

      var imageUrl = String(button.getAttribute("data-character-url") || "").trim();
      if (!imageUrl) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (action === "preview") {
        openCharacterPreview(imageUrl);
        return;
      }

      downloadCharacter(imageUrl);
    }, true);
  } catch (_) {}
})();

(function(){
  if (window.__AIVO_MOBILE_TOAST__) return;
  window.__AIVO_MOBILE_TOAST__ = true;

  const ICONS = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "i",
    loading: "..."
  };
    function tt(key, fallback){
    try {
      if (typeof window.t === "function") {
        return window.t(key);
      }
    } catch (_) {}

    return fallback;
  }

  let root = null;
  let activeToast = null;
  let activeTimer = null;

  function ensureRoot(){
    root = document.getElementById("mobileToastRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "mobileToastRoot";
      root.setAttribute("aria-live", "polite");
      root.setAttribute("aria-atomic", "true");
      document.body.appendChild(root);
    }

    return root;
  }

  function normalize(input, type, opts){
    if (input && typeof input === "object") {
      return {
        type: input.type || type || "info",
        title: input.title || "",
        message: input.message || input.msg || "",
        duration: typeof input.duration === "number" ? input.duration : 3200
      };
    }

    return {
      type: type || "info",
      title: "",
      message: String(input || ""),
      duration: opts && typeof opts.duration === "number" ? opts.duration : 3200
    };
  }

  function closeToast(){
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }

    if (!activeToast) return;

    const toast = activeToast;
    activeToast = null;

    toast.classList.remove("is-in");
    toast.classList.add("is-out");

    setTimeout(function(){
      toast.remove();
    }, 260);
  }

  function show(input, type, opts){
   const CREDIT_FLOW_RE = /(kredi|yetersiz|satın al|satınalma|kredi al|paket|fiyatlandırma|yönlendir|redirect)/i;

    if (type === "error" && CREDIT_FLOW_RE.test(String(input || ""))) {
      type = "warning";
    }
    const data = normalize(input, type, opts);
    const mount = ensureRoot();

    closeToast();

    const toast = document.createElement("div");
    toast.className = "mobile-toast";
    toast.dataset.type = data.type;

       const title = data.title || (
      data.type === "success" ? tt("toast.title.success", "Başarılı") :
      data.type === "error" ? tt("toast.title.error", "Hata") :
      data.type === "warning" ? tt("toast.title.warning", "Uyarı") :
      data.type === "loading" ? tt("toast.title.loading", "İşleniyor") :
      tt("toast.title.info", "Bilgi")
    );

    toast.innerHTML = `
      <div class="mobile-toast-icon">${ICONS[data.type] || "i"}</div>

      <div class="mobile-toast-body">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(data.message || "")}</span>
      </div>

      <button class="mobile-toast-close" type="button" aria-label="Kapat">×</button>
    `;

    toast.querySelector(".mobile-toast-close")?.addEventListener("click", function(){
      closeToast();
    });

    mount.innerHTML = "";
    mount.appendChild(toast);

    activeToast = toast;

    requestAnimationFrame(function(){
      toast.classList.add("is-in");
    });

    if (data.duration > 0 && data.type !== "loading") {
      activeTimer = setTimeout(closeToast, data.duration);
    }

    return {
      close: closeToast
    };
  }

  function escapeHtml(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.mobileToast = {
    show,
    success: function(message, opts){ return show(message, "success", opts); },
    error: function(message, opts){ return show(message, "error", opts); },
    warning: function(message, opts){ return show(message, "warning", opts); },
    info: function(message, opts){ return show(message, "info", opts); },
    loading: function(message, opts){ return show(message, "loading", { duration: 0, ...(opts || {}) }); },
    clear: closeToast,
    dismiss: closeToast,
    remove: closeToast
  };

  window.toast = window.mobileToast;
  window.Toast = {
  show: function(message, type){
    return window.mobileToast.show(message, type || "info");
  }
};

window.toastSafe = function(message, type){
  return window.mobileToast.show(message, type || "info");
};

window.legacyToast = function(message, type){
  return window.mobileToast.show(message, type || "info");
};

window.showToast = function(message, type){
  return window.mobileToast.show(message, type || "info");
};

window.toastMsg = function(message, type){
  return window.mobileToast.show(message, type || "info");
};
  window.AIVO_TOAST = window.mobileToast;
})();

(function AIVO_IOS_MUSIC_PUSH_DEEPLINK(){
  if (window.__AIVO_IOS_MUSIC_PUSH_DEEPLINK__) return;
  window.__AIVO_IOS_MUSIC_PUSH_DEEPLINK__ = true;

  var bound = false;

  function getPushPlugin(){
    try {
      return window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.PushNotifications
        ? window.Capacitor.Plugins.PushNotifications
        : null;
    } catch (_) {
      return null;
    }
  }

  function getNotificationData(action){
    try {
      var notification = action && action.notification;
      var data =
        (notification && notification.data) ||
        (action && action.data) ||
        {};

      return data && typeof data === "object" ? data : {};
    } catch (_) {
      return {};
    }
  }

  function openMusicProductions(attempt){
    var tries = Number(attempt || 0);
    var musicTool = document.querySelector('[data-mobile-tool="music"]');
    var productionsNav = document.querySelector('.bottom-nav a[href="#productions"]');

    if (!musicTool || !productionsNav) {
      if (tries < 40) {
        setTimeout(function(){
          openMusicProductions(tries + 1);
        }, 250);
      }
      return;
    }

    musicTool.click();

    setTimeout(function(){
      var nav = document.querySelector('.bottom-nav a[href="#productions"]');
      if (nav) nav.click();
    }, 120);
  }

  function handlePushAction(action){
    var data = getNotificationData(action);
    var source = String(data.source || "").trim().toLowerCase();
    var app = String(data.app || "").trim().toLowerCase();

    if (source !== "aivo_generation_complete" || app !== "music") return;

    openMusicProductions(0);
  }

  function bind(){
    if (bound) return;

    var PushNotifications = getPushPlugin();
    if (!PushNotifications || typeof PushNotifications.addListener !== "function") {
      setTimeout(bind, 400);
      return;
    }

    bound = true;

    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      handlePushAction
    );
  }

  document.addEventListener("deviceready", bind, false);
  document.addEventListener("DOMContentLoaded", bind, false);
  bind();
})();