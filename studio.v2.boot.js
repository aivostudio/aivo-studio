// studio.v2.boot.js
(function () {

  // ---------------- AUTH GUARD ----------------
  function hasSessionCookie() {
    // HttpOnly cookie'yi JS göremez ama en azından
    // tarayıcıda auth olmayan durumda hydrate'i hiç başlatmayalım
    return document.cookie.includes("aivo_sess=") ||
           document.cookie.includes("aivo_session=");
  }

  async function isSessionValid() {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (!r.ok) return false;
      const j = await r.json().catch(() => null);
      return !!(j && j.ok === true);
    } catch {
      return false;
    }
  }

  // ---------------- YOUR EXISTING BOOT ----------------
  function wireLeftMenu() {
    document.querySelectorAll("#leftMenu [data-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-route") || "music";
        if (window.StudioRouter?.go) {
          window.StudioRouter.go(key);
          return;
        }
        location.hash = key;
      });
    });
  }

  function setFakeCredits() {
    const el = document.getElementById("creditCount");
    if (el) el.textContent = "211";
  }

  // ---------------- PLAYER ROOT ----------------
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
      document.body.appendChild(el);
    }
  }

  // ---------------- HYDRATION ----------------
  const __hydratedJobIds = new Set();

  function normalizeAppKey(key) {
    const k = String(key || "").replace(/^#/, "").trim().toLowerCase();
    if (!k) return "music";
    if (k === "atmos" || k === "atmosphere") return "atmo";
    if (k === "sm-pack") return "social";
    if (k === "viral-hook") return "hook";
    return k;
  }

  function guessTypeFromUrl(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes(".mp4")) return "video";
    if (u.match(/\.(png|jpg|jpeg|webp)/)) return "image";
    if (u.match(/\.(mp3|wav)/)) return "audio";
    return "file";
  }

  function normalizeOutputs(appKey, job) {
    const outs = Array.isArray(job.outputs) ? job.outputs : [];
    return outs.map((o, i) => {
      const url = o.url || o.src || o.video_url || o.image_url;
      if (!url) return null;
      return {
        type: o.type || guessTypeFromUrl(url),
        url,
        index: i,
        meta: { ...(o.meta || {}), app: appKey }
      };
    }).filter(Boolean);
  }

  function ppeApplyCompleted(appKey, job) {
    if (!window.PPE?.apply) return;
    const outputs = normalizeOutputs(appKey, job);
    if (!outputs.length) return;
    window.PPE.apply({
      state: "COMPLETED",
      outputs
    });
  }

  async function hydrateJobsFromDB(appKey) {

    // 🔥 AUTH YOKSA ÇALIŞMA
    if (!hasSessionCookie()) {
      console.log("[BOOT] hydrate skipped (no cookie)");
      return;
    }

    const sessionOk = await isSessionValid();
    if (!sessionOk) {
      console.log("[BOOT] hydrate skipped (invalid session)");
      return;
    }

    const key = normalizeAppKey(appKey);

    try {
      const r = await fetch(`/api/jobs/list?app=${key}`, { cache: "no-store" });

      if (r.status === 401) {
        console.log("[BOOT] hydrate stopped (401 unauthorized)");
        return; // 🚫 spam yok
      }

      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return;

      const items = Array.isArray(j.items) ? j.items : [];

      for (const it of items) {
        const jobId = it.job_id || it.id;
        if (!jobId || __hydratedJobIds.has(jobId)) continue;
        __hydratedJobIds.add(jobId);
        ppeApplyCompleted(key, it);
      }

      console.log("[BOOT] hydrate OK:", key);

    } catch (e) {
      console.warn("[BOOT] hydrate error:", e);
    }
  }

  function getCurrentRouteKey() {
    return normalizeAppKey(location.hash || "music");
  }

  function scheduleHydrateForRoute() {
    setTimeout(() => {
      hydrateJobsFromDB(getCurrentRouteKey());
    }, 200);
  }

  // ---------------- DOM READY ----------------
  window.addEventListener("DOMContentLoaded", async () => {

    wireLeftMenu();
    setFakeCredits();
    ensurePlayerRoot();

    if (!location.hash) location.hash = "music";

    // 👇 sadece auth varsa hydrate
    scheduleHydrateForRoute();

    window.addEventListener("hashchange", () => {
      scheduleHydrateForRoute();
    });

  });

})();
