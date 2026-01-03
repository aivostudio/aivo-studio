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

    var isMusicQueued = (j.type === "music" && j.status === "queued");

    // --- Aggregation state (global) ---
    window.__AIVO_MUSIC_QUEUED_COUNT__ = window.__AIVO_MUSIC_QUEUED_COUNT__ || 0;

    function findAggEl() {
      // renderJob genelde job_id ile data attr basar; yoksa last-child fallback
      var byAttr =
        document.querySelector('[data-aivo-agg="music-queued"]') ||
        document.querySelector('[data-job-agg="music-queued"]');

      if (byAttr) return byAttr;

      // fallback: sağ panel içinde "music • queued" içeren ilk kart
      var root = document.getElementById("aivo-jobs") || document.querySelector("#aivo-jobs");
      if (!root) return null;

      var nodes = root.querySelectorAll("*");
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].textContent || "").trim().toLowerCase();
        if (t === "music • queued" || t.startsWith("music • queued ×")) return nodes[i];
      }
      return null;
    }

    function applyAggText(el, count) {
      if (!el) return;
      // En güvenlisi: mevcut text içinden değiştir
      try {
        var txt = (el.textContent || "");
        if (txt.toLowerCase().includes("music") && txt.toLowerCase().includes("queued")) {
          // küçük bir hack: sadece görünen label'ı güncelle
          el.textContent = "music • queued × " + count;
        }
      } catch (_) {}

      // pulse
      try {
        el.classList.remove("job--pulse");
        void el.offsetWidth;
        el.classList.add("job--pulse");
      } catch (_) {}
    }

    // =====================================================
    // MUSIC QUEUED: Tek kart mantığı
    // =====================================================
    if (isMusicQueued) {
      // 1) Eğer daha önce bir kart varsa: yeni render ETME, sadece sayacı artır
      var existing = findAggEl();
      if (existing) {
        window.__AIVO_MUSIC_QUEUED_COUNT__ += 1;
        applyAggText(existing, window.__AIVO_MUSIC_QUEUED_COUNT__);
        return;
      }

      // 2) İlk kez: normal render yap (renderJob'a dokunmuyoruz)
      window.__AIVO_MUSIC_QUEUED_COUNT__ = 1;
      _jobsMap.set(j.job_id, j);
      renderJob(j);

      // Render sonrası: kartı işaretle + sayaç yaz
      setTimeout(function () {
        var el =
          document.querySelector('[data-job-id="' + j.job_id + '"]') ||
          (function () {
            var root = document.getElementById("aivo-jobs") || document.querySelector("#aivo-jobs");
            return root ? root.lastElementChild : null;
          })();

        if (el) {
          try { el.setAttribute("data-aivo-agg", "music-queued"); } catch (_) {}
          applyAggText(el, window.__AIVO_MUSIC_QUEUED_COUNT__);
        }
      }, 0);

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
