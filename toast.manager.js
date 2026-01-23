/* toast.manager.js */
(function () {
  const DEFAULTS = {
    duration: 3200,
    maxToasts: 3,
  };

  const ICONS = {
    success: "✓",
    error: "!",
    info: "i",
    warning: "⚠",
  };

  let container = null;
  let active = [];
  let uid = 0;

  function ensureContainer() {
    if (container) return container;

    container = document.getElementById("aivoToasts");
    if (!container) {
      container = document.createElement("div");
      container.id = "aivoToasts";
      document.body.appendChild(container);
    }

    // ✅ FIX: Başka yerden basılan inline style (pembe gradient) her seferinde temizlensin
    // Inline style CSS'i eziyordu, bu yüzden toast pembe kalıyordu.
    container.removeAttribute("style");

    return container;
  }

  function clampActive() {
    while (active.length > DEFAULTS.maxToasts) {
      const oldest = active.shift();
      if (oldest) dismiss(oldest.id, true);
    }
  }

  function dismiss(id, immediate) {
    const item = active.find(t => t.id === id);
    const el = item?.el || document.querySelector(`.aivo-toast[data-id="${id}"]`);
    if (!el) return;

    if (item?.timer) clearTimeout(item.timer);

    const finalize = () => {
      el.remove();
      active = active.filter(t => t.id !== id);
    };

    if (immediate) return finalize();

    el.classList.remove("is-in");
    el.classList.add("is-out");
    setTimeout(finalize, 320);
  }

  function makeToast({ variant, title, message, duration }) {
    ensureContainer();

    const id = String(++uid);
    const el = document.createElement("div");
    el.className = "aivo-toast";
    el.dataset.variant = variant;
    el.dataset.id = id;

    const icon = document.createElement("div");
    icon.className = "aivo-toast__icon";
    icon.textContent = ICONS[variant] || "•";

    const body = document.createElement("div");

    const h = document.createElement("p");
    h.className = "aivo-toast__title";
    h.textContent =
      title ||
      (variant === "success" ? "Başarılı" :
       variant === "error" ? "Hata" :
       variant === "warning" ? "Uyarı" : "Bilgi");

    const p = document.createElement("p");
    p.className = "aivo-toast__msg";
    p.textContent = message || "";

    body.appendChild(h);
    if (message) body.appendChild(p);

    const x = document.createElement("button");
    x.type = "button";
    x.className = "aivo-toast__x";
    x.textContent = "✕";
    x.addEventListener("click", () => dismiss(id, false));

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(x);

    container.prepend(el);

    const item = { id, el, timer: null };
    active.push(item);
    clampActive();

    requestAnimationFrame(() => el.classList.add("is-in"));

    const dur = duration ?? DEFAULTS.duration;
    if (dur > 0) {
      item.timer = setTimeout(() => dismiss(id, false), dur);
    }

    return { id, dismiss: () => dismiss(id, false) };
  }

  function normalizeArgs(a, b, c) {
    if (typeof a === "object" && a) return a;
    if (typeof b === "string") return { title: a, message: b, duration: c };
    return { message: a, duration: b };
  }

  const toast = {
    success(a, b, c) { return makeToast({ variant: "success", ...normalizeArgs(a, b, c) }); },
    error(a, b, c)   { return makeToast({ variant: "error",   ...normalizeArgs(a, b, c) }); },
    info(a, b, c)    { return makeToast({ variant: "info",    ...normalizeArgs(a, b, c) }); },
    warning(a, b, c) { return makeToast({ variant: "warning", ...normalizeArgs(a, b, c) }); },
    clearAll() {
      active.slice().forEach(t => dismiss(t.id, true));
      active = [];
    }
  };

  window.toast = toast;
  window.AIVO_TOAST = window.toast;

  // Redirect sonrası toast göstermek için (flash toast)
  window.toastFlash = (type, message) => {
    try {
      sessionStorage.setItem("__AIVO_TOAST__", JSON.stringify({ type, message }));
    } catch (_) {}
  };

  // Sayfa açılışında varsa göster ve sil
  try {
    const raw = sessionStorage.getItem("__AIVO_TOAST__");
    if (raw) {
      const { type, message } = JSON.parse(raw);
      sessionStorage.removeItem("__AIVO_TOAST__");
      window.toast?.[type || "info"]?.(message);
    }
  } catch (_) {}
})();

// =========================================================
// AIVO TOAST FLASH — GLOBAL READER (index/studio/her sayfa)
// =========================================================
(function bootToastFlash() {
  const KEY = window.__AIVO_TOAST_KEY__ || "__AIVO_TOAST__";

  function tryShow() {
    let raw = null;
    try { raw = sessionStorage.getItem(KEY); } catch (_) {}
    if (!raw) return false;

    let t = null;
    try { t = JSON.parse(raw); } catch (_) {}

    // geçersizse temizle ve çık
    if (!t || !t.type || !t.message) {
      try { sessionStorage.removeItem(KEY); } catch (_) {}
      return false;
    }

    // toast henüz hazır değilse bekle
    const fn = window.toast && window.toast[t.type];
    if (typeof fn !== "function") return false;

    // hazırsa: önce sil, sonra göster
    try { sessionStorage.removeItem(KEY); } catch (_) {}
    try { fn(String(t.message)); } catch (_) {}

    return true;
  }

  // hemen dene
  if (tryShow()) return;

  // değilse 12 kez dene (≈ 12*80=960ms)
  let n = 0;
  const iv = setInterval(() => {
    n++;
    if (tryShow() || n >= 12) clearInterval(iv);
  }, 80);
})();
