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
    const data = normalize(input, type, opts);
    const mount = ensureRoot();

    closeToast();

    const toast = document.createElement("div");
    toast.className = "mobile-toast";
    toast.dataset.type = data.type;

    const title = data.title || (
      data.type === "success" ? "Başarılı" :
      data.type === "error" ? "Hata" :
      data.type === "warning" ? "Uyarı" :
      data.type === "loading" ? "İşleniyor" :
      "Bilgi"
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
    clear: closeToast
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
