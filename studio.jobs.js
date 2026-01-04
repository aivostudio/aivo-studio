/* =========================================================
   studio.jobs.js — AIVO JOBS (PROD MINIMAL v3.1)
   - window.AIVO_JOBS: { add, create }
   - Job pill UI (portal) — always works
   - Polling disabled (backend hazır olunca açarız)
   ========================================================= */

(function () {
  "use strict";

  console.log("[AIVO_JOBS] booting...");

  var _jobsMap = new Map();

  function ensureContainer() {
    var el = document.getElementById("aivo-jobs");
    if (el) return el;

    el = document.createElement("div");
    el.id = "aivo-jobs";

    // Container style (always visible)
    el.style.position = "fixed";
    el.style.top = "90px";
    el.style.right = "20px";
    el.style.zIndex = "2147483647";
    el.style.pointerEvents = "auto";

    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "10px";

    // body en güvenlisi (documentElement yerine)
    document.body.appendChild(el);

    return el;
  }

  function renderJob(job) {
    var c = ensureContainer();
    var id = "job-" + String(job.job_id || "");

    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;

      el.style.padding = "10px 12px";
      el.style.borderRadius = "12px";
      el.style.background = "rgba(20,20,30,.95)";
      el.style.color = "#fff";
      el.style.fontSize = "13px";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
      el.style.outline = "1px solid rgba(167, 126, 255, .55)";

      c.appendChild(el);
    }

    el.textContent = (job.type || "job") + " • " + (job.status || "queued");
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

  // 2) SET GLOBAL API (WORKING)
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

      _jobsMap.set(j.job_id, j);
      renderJob(j);
      startPolling(j);

      console.log("[AIVO_JOBS] add OK", j.job_id);
    },

    create: createJob
  };

  console.log("[AIVO_JOBS] loaded OK", Object.keys(window.AIVO_JOBS));

})(); // ✅ KRİTİK: IIFE KAPANIŞI
