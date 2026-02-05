// studio.v2.boot.js
(function () {
  // ---------- YOUR EXISTING BOOT ----------
  function wireLeftMenu() {
    document.querySelectorAll("#leftMenu [data-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-route") || "music";

        // ✅ Router varsa onu kullan (CSS + module + panel akışı)
        if (window.StudioRouter && typeof window.StudioRouter.go === "function") {
          window.StudioRouter.go(key);
          return;
        }

        // fallback
        location.hash = key;
      });
    });
  }

  function tryMountTopbarPartial() {
    return;
  }

  function setFakeCredits() {
    const el = document.getElementById("creditCount");
    if (el) el.textContent = "211";
  }

  // ---------- FIX: PLAYER ROOT GUARANTEE ----------
  function ensurePlayerRoot() {
    const id = "aivoPlayerRoot";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.left = "16px";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.height = "72px";
      el.style.zIndex = "999999";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      console.log("[BOOT] player root injected:", "#" + id);
    }
    return el;
  }

  // ---------- FIX: TOAST ROOT + FALLBACK ----------
  function ensureToastRoot() {
    const id = "toastRoot";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.top = "16px";
      el.style.right = "16px";
      el.style.zIndex = "1000000";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.gap = "10px";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      console.log("[BOOT] toast root injected:", "#" + id);
    }
    return el;
  }

  function installToastFallback() {
    const root = ensureToastRoot();

    function pushToast(type, msg) {
      const t = document.createElement("div");
      t.className = "toast";
      t.style.pointerEvents = "auto";
      t.style.padding = "10px 12px";
      t.style.borderRadius = "12px";
      t.style.border = "1px solid rgba(255,255,255,.12)";
      t.style.background = "rgba(20,20,30,.85)";
      t.style.backdropFilter = "blur(10px)";
      t.style.color = "white";
      t.style.fontSize = "13px";
      t.style.maxWidth = "360px";
      t.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";
      t.textContent = (type ? `[${type}] ` : "") + msg;

      root.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    const g = window.toast;
    if (g && typeof g === "object") {
      const wrap = (fn, type) => (msg) => {
        try {
          fn(msg);
        } catch {}
        // toast dom yoksa fallback bas
        if (!document.getElementById("toastRoot")?.children?.length) {
          pushToast(type, msg);
        } else {
          // bazı toast implementasyonları DOM'a farklı node basar; garanti olsun
          // (yine de bir tane fallback basmak istersen kaldırabilirsin)
          pushToast(type, msg);
        }
      };

      if (typeof g.success === "function") g.success = wrap(g.success, "success");
      if (typeof g.error === "function") g.error = wrap(g.error, "error");
      if (typeof g.info === "function") g.info = wrap(g.info, "info");

      console.log("[BOOT] toast wrapped with DOM fallback");
    } else {
      window.toast = {
        success: (m) => pushToast("success", m),
        error: (m) => pushToast("error", m),
        info: (m) => pushToast("info", m),
      };
      console.log("[BOOT] toast fallback installed");
    }
  }

  // ---------- SINGLE DOM READY ----------
  window.addEventListener("DOMContentLoaded", () => {
    tryMountTopbarPartial();
    wireLeftMenu();
    setFakeCredits();

    // Fixler
    ensurePlayerRoot();
    installToastFallback();

    // sanity
    console.log("[BOOT] AIVO_PLAYER:", window.AIVO_PLAYER);
    if (window.toast?.success) window.toast.success("Boot OK ✅");

    if (!location.hash) location.hash = "music";
  });
})();
