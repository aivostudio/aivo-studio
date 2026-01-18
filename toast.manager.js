/* toast.manager.js */
(function () {
  const DEFAULTS = {
    duration: 3200,         // tek süre
    maxToasts: 3,           // aynı anda max
    removeAfter: 220,       // animasyon payı
    position: "top-right",  // şimdilik fixed, css ile yönetiyoruz
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
    return container;
  }

  function clampActive() {
    const max = DEFAULTS.maxToasts;
    while (active.length > max) {
      // en eskiyi kapat
      const oldest = active.shift();
      if (oldest) dismiss(oldest.id, true);
    }
  }

  function dismiss(id, immediate) {
    const item = active.find(t => t.id === id);
    const el = item?.el || document.querySelector(`.aivo-toast[data-id="${id}"]`);
    if (!el) return;

    // temizle timer
    if (item?.timer) clearTimeout(item.timer);

    el.classList.remove("is-in");
    const finalize = () => {
      el.remove();
      active = active.filter(t => t.id !== id);
    };

    if (immediate) return finalize();
    setTimeout(finalize, DEFAULTS.removeAfter);
  }

  function scheduleAutoClose(item) {
    const dur = item.duration ?? DEFAULTS.duration;
    if (dur <= 0) return;

    item.timer = setTimeout(() => dismiss(item.id, false), dur);
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
    h.textContent = title || (
      variant === "success" ? "Başarılı" :
      variant === "error" ? "Hata" :
      variant === "warning" ? "Uyarı" : "Bilgi"
    );

    const p = document.createElement("p");
    p.className = "aivo-toast__msg";
    p.textContent = message || "";

    body.appendChild(h);
    if (message) body.appendChild(p);

    const x = document.createElement("button");
    x.type = "button";
    x.className = "aivo-toast__x";
    x.setAttribute("aria-label", "Kapat");
    x.textContent = "✕";
    x.addEventListener("click", () => dismiss(id, false));

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(x);

    // hover pause
    let remaining = duration ?? DEFAULTS.duration;
    let startedAt = 0;
    let paused = false;

    function startTimer() {
      if (remaining <= 0) return;
      startedAt = Date.now();
      const t = setTimeout(() => dismiss(id, false), remaining);
      return t;
    }

    function pause() {
      if (paused) return;
      paused = true;
      const now = Date.now();
      remaining = Math.max(0, remaining - (now - startedAt));
      if (item.timer) clearTimeout(item.timer);
      item.timer = null;
    }

    function resume() {
      if (!paused) return;
      paused = false;
      item.timer = startTimer();
    }

    el.addEventListener("mouseenter", pause, { passive: true });
    el.addEventListener("mouseleave", resume, { passive: true });

    // stack top
    container.prepend(el);

    const item = { id, el, duration: (duration ?? DEFAULTS.duration), timer: null };
    active.push(item);
    clampActive();

    // animate in
    requestAnimationFrame(() => el.classList.add("is-in"));

    // auto close with hover pause logic
    item.timer = startTimer();

    return { id, dismiss: () => dismiss(id, false) };
  }

  function normalizeArgs(a, b, c) {
    // toast.success("msg") OR toast.success("title","msg") OR toast.success({title,message,duration})
    if (typeof a === "object" && a) return a;
    if (typeof b === "string") return { title: a, message: b, duration: c };
    return { message: a, duration: b };
  }

  const toast = {
    success(a, b, c) { return makeToast({ variant: "success", ...normalizeArgs(a, b, c) }); },
    error(a, b, c)   { return makeToast({ variant: "error",   ...normalizeArgs(a, b, c) }); },
    info(a, b, c)    { return makeToast({ variant: "info",    ...normalizeArgs(a, b, c) }); },
    warning(a, b, c) { return makeToast({ variant: "warning", ...normalizeArgs(a, b, c) }); },

    // opsiyonel yardımcı
    fromError(err, fallbackMsg = "Bir hata oluştu. Lütfen tekrar deneyin.") {
      const msg =
        (typeof err === "string" && err) ||
        err?.message ||
        err?.error ||
        err?.data?.message ||
        fallbackMsg;
      return toast.error(msg);
    },

    clearAll() {
      active.slice().forEach(t => dismiss(t.id, true));
      active = [];
    }
  };

  window.toast = toast;
})();
