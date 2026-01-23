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

  const FLASH_KEY = window.__AIVO_TOAST_KEY__ || "__AIVO_TOAST__";

  let container = null;
  let active = [];
  let uid = 0;

  function lockContainerStyle(c) {
    if (!c || c.__aivoStyleLock) return;
    c.__aivoStyleLock = true;

    const strip = () => {
      if (c.hasAttribute("style")) c.removeAttribute("style");
    };

    // İlk anda temizle
    strip();

    // Sonradan biri style basarsa yine temizle
    const mo = new MutationObserver(strip);
    mo.observe(c, { attributes: true, attributeFilter: ["style"] });
  }

  function ensureContainer() {
    if (container) return container;

    container = document.getElementById("aivoToasts");
    if (!container) {
      container = document.createElement("div");
      container.id = "aivoToasts";
      document.body.appendChild(container);
    }

    // CSS’in tek otorite olması için:
    container.classList.add("aivo-toasts");
    container.removeAttribute("style");      // inline style = ölüm
    lockContainerStyle(container);

    return container;
  }

  function clampActive() {
    while (active.length > DEFAULTS.maxToasts) {
      const oldest = active.shift();
      if (oldest) dismiss(oldest.id, true);
    }
  }

  function dismiss(id, immediate) {
    const item = active.find((t) => t.id === id);
    const el = item?.el || document.querySelector(`.aivo-toast[data-id="${id}"]`);
    if (!el) return;

    if (item?.timer) clearTimeout(item.timer);

    const finalize = () => {
      el.remove();
      active = active.filter((t) => t.id !== id);
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
    el.className = `aivo-toast aivo-toast--${variant || "info"}`;
    el.dataset.variant = variant || "info";
    el.dataset.id = id;

    const icon = document.createElement("div");
    icon.className = "aivo-toast__icon";
    icon.textContent = ICONS[variant] || "•";

    const body = document.createElement("div");
    body.className = "aivo-toast__body";

    const h = document.createElement("p");
    h.className = "aivo-toast__title";
    h.textContent =
      title ||
      (variant === "success"
        ? "Başarılı"
        : variant === "error"
        ? "Hata"
        : variant === "warning"
        ? "Uyarı"
        : "Bilgi");

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
    if (dur > 0) item.timer = setTimeout(() => dismiss(id, false), dur);

    return { id, dismiss: () => dismiss(id, false) };
  }

  function normalizeArgs(a, b, c) {
    if (typeof a === "object" && a) return a;
    if (typeof b === "string") return { title: a, message: b, duration: c };
    return { message: a, duration: b };
  }

  const toast = {
    success(a, b, c) {
      return makeToast({ variant: "success", ...normalizeArgs(a, b, c) });
    },
    error(a, b, c) {
      return makeToast({ variant: "error", ...normalizeArgs(a, b, c) });
    },
    info(a, b, c) {
      return makeToast({ variant: "info", ...normalizeArgs(a, b, c) });
    },
    warning(a, b, c) {
      return makeToast({ variant: "warning", ...normalizeArgs(a, b, c) });
    },
    clearAll() {
      active.slice().forEach((t) => dismiss(t.id, true));
      active = [];
    },
  };

  window.toast = toast;
  window.AIVO_TOAST = toast;

  // Redirect sonrası flash toast yaz
  window.toastFlash = (type, message) => {
    try {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
    } catch (_) {}
  };

  // Flash toast oku (tek okuyucu)
  (function bootToastFlash() {
    function tryShow() {
      let raw = null;
      try { raw = sessionStorage.getItem(FLASH_KEY); } catch (_) {}
      if (!raw) return false;

      let t = null;
      try { t = JSON.parse(raw); } catch (_) {}

      if (!t || !t.type || !t.message) {
        try { sessionStorage.removeItem(FLASH_KEY); } catch (_) {}
        return false;
      }

      const fn = window.toast && window.toast[t.type];
      if (typeof fn !== "function") return false;

      try { sessionStorage.removeItem(FLASH_KEY); } catch (_) {}
      try { fn(String(t.message)); } catch (_) {}
      return true;
    }

    if (tryShow()) return;

    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (tryShow() || n >= 12) clearInterval(iv);
    }, 80);
  })();
})();
