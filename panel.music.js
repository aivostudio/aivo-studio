/* =========================================================
   AIVO DEBUG BLOCK — MUSIC PANEL
   (temporary, safe, standalone)
   ========================================================= */
(() => {
  const TAG = "[AIVO-MUSIC-DBG]";
  const t0 = Date.now();

  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err  = (...a) => console.error(TAG, ...a);

  // 1) Script gerçekten çalışıyor mu?
  log("loaded", { href: location.href, ts: new Date().toISOString() });

  // 2) RightPanel host var mı?
  const getHost = () => document.getElementById("rightPanelHost");
  const hostInfo = () => {
    const h = getHost();
    if (!h) return { exists: false };
    const r = h.getBoundingClientRect();
    return {
      exists: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      htmlLen: (h.innerHTML || "").length
    };
  };
  log("host", hostInfo());

  // host değişimini izle
  const mo = new MutationObserver(() => {
    const hi = hostInfo();
    if (hi.exists) log("host mutated", hi);
  });
  const startMO = () => {
    const h = getHost();
    if (h) mo.observe(h, { childList: true, subtree: true });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", startMO, { once: true });
  else
    startMO();

  // 3) Player objesi tespiti
  const getPlayer = () =>
    window.AIVO_PLAYER ||
    window.AIVO_PLAYER_V1 ||
    window.__AIVO_PLAYER_V1__ ||
    window.Player ||
    window.AivoPlayer;

  const playerShape = () => {
    const p = getPlayer();
    if (!p) return { exists: false };
    return {
      exists: true,
      name:
        window.AIVO_PLAYER ? "AIVO_PLAYER" :
        window.AIVO_PLAYER_V1 ? "AIVO_PLAYER_V1" :
        window.__AIVO_PLAYER_V1__ ? "__AIVO_PLAYER_V1__" :
        window.Player ? "Player" :
        window.AivoPlayer ? "AivoPlayer" : "unknown",
      hasLoad: typeof p.load === "function",
      hasPlay: typeof p.play === "function",
      hasSetSrc: typeof p.setSrc === "function",
      keys: Object.keys(p || {}).slice(0, 30)
    };
  };
  log("player", playerShape());

  // 4) Job event’leri dinle
  const seen = new Set();
  const normalizeId = (j) => j?.job_id || j?.id || j?.jobId || j?.job?.id;

  const pickSrc = (job) => {
    const c = [
      job?.output_url,
      job?.play_url,
      job?.audio_url,
      job?.outputs?.[0]?.url,
      job?.outputs?.[0]?.play_url,
      job?.files?.[0]?.url,
      job?.result?.url,
    ].filter(Boolean);
    return c[0] || "";
  };

  async function probeStatus(job_id) {
    const url = `/api/jobs/status?job_id=${encodeURIComponent(job_id)}`;
    log("status fetch →", url);
    try {
      const res = await fetch(url, { credentials: "include" });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { _raw: text }; }
      log("status resp", { ok: res.ok, status: res.status, json });
      return json;
    } catch (e) {
      err("status fetch error", e);
      return null;
    }
  }

  async function probeSrc(src) {
    if (!src) return warn("probeSrc: empty");
    log("src probe →", src);
    try {
      const r = await fetch(src, { method: "GET" });
      log("src resp", {
        ok: r.ok,
        status: r.status,
        ct: r.headers.get("content-type")
      });
    } catch (e) {
      err("src fetch error", e);
    }
  }

  function tryPlay(src, title) {
    const p = getPlayer();
    log("tryPlay", { src, title, player: playerShape() });
    if (!p) return warn("no player on window");
    try {
      if (typeof p.load === "function") p.load({ src, title: title || "AIVO Music" });
      else if (typeof p.setSrc === "function") p.setSrc(src);
      if (typeof p.play === "function") p.play();
    } catch (e) {
      err("player call error", e);
    }
  }

  const events = ["aivo:job", "aivo:jobs:upsert", "AIVO:JOB", "job:created"];
  events.forEach((ev) => {
    window.addEventListener(ev, async (e) => {
      log("EVENT", ev, e?.detail);
      const jobLike = e?.detail?.job || e?.detail || {};
      const job_id = normalizeId(jobLike);
      if (!job_id) return warn("event has no job_id", e?.detail);
      if (seen.has(job_id)) return;
      seen.add(job_id);

      const st = await probeStatus(job_id);
      const job = st?.job || st?.data?.job || st?.result?.job || st || {};
      const src = pickSrc(job);

      log("JOB", { job_id, status: job?.status || st?.status, src, raw: job });

      if (!src) warn("SRC EMPTY");
      await probeSrc(src);
      tryPlay(src, job?.title || job?.name || `job:${job_id}`);
    }, true);
  });

  // 5) Heartbeat
  setInterval(() => {
    log("heartbeat", {
      dt: ((Date.now() - t0) / 1000).toFixed(1) + "s",
      host: hostInfo(),
      player: playerShape()
    });
  }, 5000);
})();
