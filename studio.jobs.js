/* =========================================================
   studio.jobs.js — AIVO JOBS (PROD MINIMAL v3)
   - window.AIVO_JOBS: { add, create }
   - Job pill UI (portal) — always works
   - Polling disabled (backend hazır olunca açarız)
   ========================================================= */

(function () {
  "use strict";

  // 1) HARD SET GLOBAL FIRST (fail-safe)
  // Eğer dosya içinde bir yerde hata olsa bile AIVO_JOBS least exists.
  var _jobsMap = new Map();

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

    document.documentElement.appendChild(el);
    return el;
  }

  function renderJob(job) {
    var c = ensureContainer();
    var id = "job-" + job.job_id;

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

      // ✅ yeşil outline kapalı (senin tema ile uyum)
      el.style.outline = "1px solid rgba(167, 126, 255, .55)";

      c.appendChild(el);
    }

    el.textContent = (job.type || "job") + " • " + (job.status || "queued");
  }

  async function createJob(type, payload) {
    var res = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: type, ...(payload || {}) })
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
      job_id: String(job.job_id || ""),
      type: job.type || "job",
      status: job.status || "queued",
      _timer: null
    };

    if (!j.job_id) {
      console.warn("[AIVO_JOBS] add: job_id missing", job);
      return;
    }

    // =====================================================
    // SINGLE CARD MODE (music + queued) + COUNTER
    // - music queued geldiğinde yeni kart basmak yerine:
    //   mevcut kartı "×N" ile günceller + pulse yapar.
    // =====================================================
    var isMusicQueued = (j.type === "music" && j.status === "queued");

    if (isMusicQueued) {
      // tek kart anahtarı
      var key = "__single__music_queued__";

      // daha önce tek kart oluşturulduysa sadece sayacı artır
      if (_jobsMap.has(key)) {
        var agg = _jobsMap.get(key);
        agg.count = (agg.count || 1) + 1;
        agg.last_job_id = j.job_id;

        // UI update: kartı tekrar render ederek güncelle
        // (renderJob zaten var olanı güncelliyorsa yeterli)
        renderJob(agg);

        // küçük bir "pulse" efekti (varsa element)
        try {
          var el = document.querySelector('[data-job-id="' + key + '"]');
          if (el) {
            el.classList.remove("job--pulse");
            // reflow
            void el.offsetWidth;
            el.classList.add("job--pulse");
          }
        } catch (_) {}

        return;
      }

      // ilk kez: tek kartı oluştur
      var aggJob = {
        job_id: key,            // DOM id/key
        type: "music",
        status: "queued",
        count: 1,
        last_job_id: j.job_id,
        _timer: null
      };

      _jobsMap.set(key, aggJob);
      renderJob(aggJob);        // tek kartı bas
      // NOT: single-card modunda polling başlatmıyoruz (UI job)
      return;
    }

    // =====================================================
    // DEFAULT MODE (diğer işler) — eski davranış
    // =====================================================
    _jobsMap.set(j.job_id, j);
    renderJob(j);
    startPolling(j);
  },

  create: createJob
};

console.log("[AIVO_JOBS] loaded OK", Object.keys(window.AIVO_JOBS));
