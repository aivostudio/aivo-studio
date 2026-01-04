/* =========================================================
   studio.jobs.js — AIVO JOBS (PROD MINIMAL v4 — SINGLE CARD)
   - window.AIVO_JOBS: { add, create }
   - Job pill UI (portal) — always works
   - Music queued: SINGLE CARD + COUNTER (×N)
   - Polling disabled (backend hazır olunca açarız)
   ========================================================= */

(function () {
  "use strict";

  console.log("[AIVO_JOBS] booting...");

  var _jobsMap = new Map();

  // Single-card state for music queued
  var MUSIC_AGG_ID = "job-music-queued-agg";
  var musicQueuedCount = 0;

  function ensureContainer() {
    var el = document.getElementById("aivo-jobs");
    if (el) return el;

    el = document.createElement("div");
    el.id = "aivo-jobs";

    el.style.position = "fixed";
    el.style.top = "90px";
    el.style.right = "20px";
    el.style.zIndex = "2147483647";
    el.style.pointerEvents = "auto";

    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "10px";

    document.body.appendChild(el);
    return el;
  }

  function stylePill(el) {
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(20,20,30,.95)";
    el.style.color = "#fff";
    el.style.fontSize = "13px";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.outline = "1px solid rgba(167, 126, 255, .55)";
  }

 function pulse(el) {
  if (!el) return;
  try {
    // pulse
    el.classList.remove("job--pulse");
    void el.offsetWidth;
    el.classList.add("job--pulse");

    // shine (one-shot)
    el.classList.remove("job--shine");
    void el.offsetWidth;
    el.classList.add("job--shine");
    clearTimeout(el.__shineT);
    el.__shineT = setTimeout(function () {
      try { el.classList.remove("job--shine"); } catch (_) {}
    }, 650);
  } catch (_) {}
}


  // Minimal pulse CSS (injected once)
  function ensurePulseCSS() {
    if (document.getElementById("aivo-jobs-pulse-css")) return;
    var st = document.createElement("style");
    st.id = "aivo-jobs-pulse-css";
    st.textContent =
      ".job--pulse{animation:aivoJobPulse .22s ease-out}" +
      "@keyframes aivoJobPulse{0%{transform:scale(.98);filter:brightness(1)}100%{transform:scale(1);filter:brightness(1.05)}}";
    document.head.appendChild(st);
  }

  function renderJob(job) {
    var c = ensureContainer();
    var id = "job-" + String(job.job_id || "");

    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      stylePill(el);
      c.appendChild(el);
    }

    el.textContent = (job.type || "job") + " • " + (job.status || "queued");
    return el;
  }

 function renderMusicAgg(count) {
  ensurePulseCSS();
  var c = ensureContainer();

  var el = document.getElementById(MUSIC_AGG_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = MUSIC_AGG_ID;
    el.setAttribute("data-aivo-agg", "music-queued");
    stylePill(el);
    c.appendChild(el);
  }

  // ✅ PROFESYONEL METİN
  el.textContent = "Müzik • Kuyrukta × " + count;

  pulse(el);
  return el;
}


  async function createJob(type, payload) {
    var res = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ type: type }, (payload || {})))
    });
    return res.json();
  }

  // Polling: şimdilik kapalı
  function startPolling(_job) {
    return;
  }

  // 2) SET GLOBAL API
  window.AIVO_JOBS = {
    add: function (job) {
      var j = {
        job_id: String(job && job.job_id || ""),
        type: (job && job.type) ? job.type : "job",
        status: (job && job.status) ? job.status : "queued",
        _timer: null
      };

      if (!j.job_id) {
        console.warn("[AIVO_JOBS] add: job_id missing", job);
        return;
      }

      // SINGLE CARD LOGIC (only for music queued)
      if (j.type === "music" && j.status === "queued") {
        musicQueuedCount += 1;

        // keep a record (optional)
        _jobsMap.set(j.job_id, j);

        // render/update single aggregated pill
        renderMusicAgg(musicQueuedCount);
        return;
      }

      // default: render normal card
      _jobsMap.set(j.job_id, j);
      renderJob(j);
      startPolling(j);
    },

    create: createJob
  };

  console.log("[AIVO_JOBS] loaded OK", Object.keys(window.AIVO_JOBS));

})(); // ✅ CRITICAL: IIFE close
