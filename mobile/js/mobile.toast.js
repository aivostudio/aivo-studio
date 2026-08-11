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

(function AIVO_IOS_FCM_WEB_BRIDGE_REGISTER(){
  if (window.__AIVO_IOS_FCM_WEB_BRIDGE_REGISTER__) return;
  window.__AIVO_IOS_FCM_WEB_BRIDGE_REGISTER__ = true;

  const STORAGE_KEY = "aivo_ios_fcm_token";
  let registerInFlight = false;
  let lastRegisteredToken = "";

  function getLang(){
    try {
      return String(
        localStorage.getItem("aivo_mobile_lang") ||
        localStorage.getItem("aivo_lang") ||
        document.documentElement.lang ||
        navigator.language ||
        "tr"
      );
    } catch (_) {
      return "tr";
    }
  }

  function getStoredToken(){
    try {
      return String(localStorage.getItem(STORAGE_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function storeToken(token){
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch (_) {}
  }

  function tokenFromEvent(event){
    const detail = event && event.detail;

    if (detail && typeof detail === "object") {
      return String(detail.token || "").trim();
    }

    if (typeof detail === "string") {
      try {
        const parsed = JSON.parse(detail);
        if (parsed && parsed.token) {
          return String(parsed.token).trim();
        }
      } catch (_) {}

      return String(detail || "").trim();
    }

    return "";
  }

  async function registerToken(token, reason){
    const value = String(token || "").trim();

    if (!value || registerInFlight || value === lastRegisteredToken) {
      return;
    }

    registerInFlight = true;

    try {
      const response = await fetch("/api/push/register", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          platform: "ios",
          device_token: value,
          permission_status: "granted",
          app: "aivo",
          lang: getLang(),
          device_id: "ios-app",
          meta: {
            source: "native_fcm_bridge",
            reason: reason || "unknown",
            registered_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        if (response.status !== 401) {
          const errorData = await response.json().catch(function(){ return null; });
          console.warn("[AIVO FCM] backend register rejected", response.status, errorData || "");
        }
        return;
      }

      lastRegisteredToken = value;
      storeToken(value);
      console.log("[AIVO FCM] FCM token registered to backend");
    } catch (err) {
      console.error("[AIVO FCM] backend register failed", err);
    } finally {
      registerInFlight = false;
    }
  }

  function retryStoredToken(reason){
    const token = getStoredToken();
    if (!token) return;
    registerToken(token, reason);
  }

  window.addEventListener("aivoFCMToken", function(event){
    const token = tokenFromEvent(event);
    if (!token) return;

    storeToken(token);
    registerToken(token, "native_event");
  });

  document.addEventListener("aivo:auth-ready", function(){
    retryStoredToken("auth_ready");
  });

  document.addEventListener("visibilitychange", function(){
    if (!document.hidden) {
      retryStoredToken("visibility");
    }
  });

  window.addEventListener("pageshow", function(){
    retryStoredToken("pageshow");
  });

  setTimeout(function(){ retryStoredToken("startup_2s"); }, 2000);
  setTimeout(function(){ retryStoredToken("startup_5s"); }, 5000);
})();
