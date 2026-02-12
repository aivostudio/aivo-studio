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
        try { fn(msg); } catch {}
        // garanti olsun diye bir tane de fallback basalım
        pushToast(type, msg);
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

  // ---------- NEW: JOB LIST HYDRATION (DB -> PPE.apply) ----------
  const __hydratedJobIds = new Set();

  function normalizeAppKey(key) {
    const k = String(key || "").replace(/^#/, "").trim().toLowerCase();
    if (!k) return "music";
    if (k === "atmos" || k === "atmosphere") return "atmo";
    if (k === "sm-pack") return "social";
    if (k === "viral-hook") return "hook";
    return k;
  }

  function safeJson(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function normalizeOutputs(appKey, job) {
    // DB’den outputs jsonb gelebilir: [] ya da [{type,url,...}]
    const outs = Array.isArray(job.outputs) ? job.outputs : (safeJson(job.outputs) || []);
    const outArr = Array.isArray(outs) ? outs : [];

    // minimum normalize: {type,url,index,meta:{app}}
    const normalized = outArr
      .map((o, i) => {
        if (!o) return null;

        // bazı providerlar string url döndürebilir
        if (typeof o === "string") {
          return { type: guessTypeFromUrl(o), url: o, index: i, meta: { app: appKey } };
        }

        const url = o.url || o.src || o.href || o.video_url || o.image_url;
        if (!url) return null;

        const type = o.type || guessTypeFromUrl(url);
        const meta = Object.assign({}, o.meta || {}, { app: (o?.meta?.app || appKey) });

        return {
          type,
          url,
          index: (typeof o.index === "number" ? o.index : i),
          thumb: o.thumb || o.thumbnail || null,
          meta
        };
      })
      .filter(Boolean);

    return normalized;
  }

  function guessTypeFromUrl(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes(".mp4") || u.includes("video")) return "video";
    if (u.includes(".png") || u.includes(".jpg") || u.includes(".jpeg") || u.includes(".webp")) return "image";
    if (u.includes(".mp3") || u.includes(".wav") || u.includes("audio")) return "audio";
    return "file";
  }

  function ppeApplyCompleted(appKey, job) {
    const PPE = window.PPE;
    if (!PPE || typeof PPE.apply !== "function") {
      console.warn("[BOOT] PPE.apply missing; hydration skipped");
      return;
    }

    const outputs = normalizeOutputs(appKey, job);
    if (!outputs.length) return;

    // app filtresi panel tarafında meta.app üzerinden çalışıyor diye varsayıyoruz
    PPE.apply({
      state: "COMPLETED",
      outputs
    });
  }

  async function hydrateJobsFromDB(appKey) {
    const key = normalizeAppKey(appKey);
    const url = `/api/jobs/list?app=${encodeURIComponent(key)}`;

    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j || j.ok !== true) {
        console.warn("[BOOT] hydrate list failed:", r.status, j);
        return;
      }

      const items = Array.isArray(j.items) ? j.items : [];
      if (!items.length) {
        console.log("[BOOT] hydrate: empty", key);
        return;
      }

      let applied = 0;
      for (const it of items) {
        const jobId = it.job_id || it.id;
        if (!jobId) continue;
        if (__hydratedJobIds.has(jobId)) continue;

        __hydratedJobIds.add(jobId);

        // queued/running ise şimdilik basmayalım (outputs yoksa zaten no-op)
        ppeApplyCompleted(key, it);
        applied++;
      }

      console.log(`[BOOT] hydrate OK: app=${key} items=${items.length} applied=${applied}`);
    } catch (e) {
      console.warn("[BOOT] hydrate error:", e);
    }
  }

  function getCurrentRouteKey() {
    const h = (location.hash || "").replace(/^#/, "");
    return normalizeAppKey(h || "music");
  }

  function scheduleHydrateForRoute() {
    const routeKey = getCurrentRouteKey();

    // Panel/router init ile çakışmasın diye küçük delay
    setTimeout(() => {
      hydrateJobsFromDB(routeKey);
    }, 250);
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

    // ✅ initial hydrate
    scheduleHydrateForRoute();

    // ✅ hash route değişince hydrate
    window.addEventListener("hashchange", () => {
      scheduleHydrateForRoute();
    });

    // ✅ Router varsa ve event veriyorsa (opsiyonel)
    if (window.StudioRouter && typeof window.StudioRouter.onChange === "function") {
      window.StudioRouter.onChange((key) => {
        scheduleHydrateForRoute(normalizeAppKey(key));
      });
    }
  });
})();
