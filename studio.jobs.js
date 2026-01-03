/* =========================================================
   AIVO JOBS (PROD - MINIMAL)
   - Job UI
   - Status polling
   ========================================================= */

(function () {
  "use strict";

  const JOB_POLL_INTERVAL = 3000; // 3 sn
  const jobs = new Map();

  /* -------------------------------
     API
  -------------------------------- */

  async function createJob(type, payload = {}) {
    const res = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload })
    });
    return res.json();
  }

  async function fetchJobStatus(job_id) {
    const res = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`);
    return res.json();
  }

  /* -------------------------------
     UI
  -------------------------------- */

function ensureContainer() {
  let el = document.getElementById("aivo-jobs");
  if (el) return el;

  el = document.createElement("div");
  el.id = "aivo-jobs";

  /* 🚨 PORTAL FIX — layout’tan tamamen bağımsız */
  el.style.position = "fixed";
  el.style.top = "90px";
  el.style.right = "20px";
  el.style.zIndex = "2147483647"; // MAX
  el.style.pointerEvents = "auto";

  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.gap = "10px";

  /* ⛔ body / page / studio YOK
     ✅ html (documentElement) */
  document.documentElement.appendChild(el);

  return el;
}



function renderJob(job) {
  const c =
    document.querySelector("#aivo-jobs") ||
    ensureContainer();

  let el = document.querySelector("#job-" + job.job_id);

  if (!el) {
    el = document.createElement("div");
    el.id = "job-" + job.job_id;
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(20,20,30,.95)";
    el.style.color = "#fff";
    el.style.fontSize = "13px";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.outline = "2px solid lime";
    c.appendChild(el);
  }

  el.textContent = `${job.type} • ${job.status}`;
}


/* -------------------------------
   POLLING (GEÇİCİ KAPALI)
   - Backend /api/jobs/status henüz yok → 404 spam olmasın
-------------------------------- */

function startPolling(job) {
  // ⛔ polling kapalı (şimdilik)
  return;
}


  /* -------------------------------
     PUBLIC API
  -------------------------------- */

  window.AIVO_JOBS = {
    add(job) {
      const j = {
        job_id: job.job_id,
        type: job.type || "job",
        status: job.status || "queued",
        _timer: null
      };

      jobs.set(j.job_id, j);
      renderJob(j);
      startPolling(j);
    },

    create: createJob
  };

})();
