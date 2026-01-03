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
  el.style.position = "fixed";
  el.style.right = "20px";
  el.style.top = "90px"; // ⬅️ ÖNEMLİ
  el.style.zIndex = "99999";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.gap = "10px";

const mount =
  document.querySelector(".page-studio") ||
  document.querySelector("main") ||
  document.body;

mount.appendChild(el);

  return el;
}


  function renderJob(job) {
    const c = ensureContainer();
    let el = document.getElementById("job-" + job.job_id);

    if (!el) {
      el = document.createElement("div");
      el.id = "job-" + job.job_id;
      el.style.padding = "10px 12px";
      el.style.borderRadius = "12px";
      el.style.background = "rgba(20,20,30,.9)";
      el.style.color = "#fff";
      el.style.fontSize = "13px";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
      c.appendChild(el);
    }

    el.textContent = `${job.type} • ${job.status}`;
  }

  /* -------------------------------
     POLLING
  -------------------------------- */

  function startPolling(job) {
    if (job._timer) return;

    job._timer = setInterval(async () => {
      try {
        const data = await fetchJobStatus(job.job_id);
        if (!data || !data.status) return;

        job.status = data.status;
        renderJob(job);

        if (data.status === "done" || data.status === "error") {
          clearInterval(job._timer);
          job._timer = null;
        }
      } catch (_) {}
    }, JOB_POLL_INTERVAL);
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
