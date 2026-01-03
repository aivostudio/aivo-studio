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

    // --- ensure root exists (minimum) ---
    function ensureJobsRoot() {
      var root =
        document.getElementById("aivo-jobs") ||
        document.querySelector("#aivo-jobs") ||
        document.querySelector("[data-aivo-jobs]");

      if (root) return root;

      // fallback: create minimal fixed container (if jobs.js portal didn't mount)
      root = document.createElement("div");
      root.id = "aivo-jobs";
      root.style.position = "fixed";
      root.style.top = "96px";
      root.style.right = "16px";
      root.style.zIndex = "9999";
      root.style.width = "220px";
      root.style.maxHeight = "70vh";
      root.style.overflow = "auto";
      root.style.pointerEvents = "auto";
      document.body.appendChild(root);
      return root;
    }

    function findLabelElWithin(cardEl) {
      if (!cardEl) return null;
      // prefer a specific label element if exists
      return (
        cardEl.querySelector("[data-job-label]") ||
        cardEl.querySelector(".job__label") ||
        cardEl.querySelector(".aivo-job__label") ||
        cardEl
      );
    }

    function setMusicQueuedText(cardEl, count) {
      var labelEl = findLabelElWithin(cardEl);
      if (!labelEl) return;

      // if the label is not the card itself, update label text
      try {
        labelEl.textContent = "music • queued × " + count;
      } catch (_) {}

      // pulse class (optional)
      try {
        cardEl.classList.remove("job--pulse");
        void cardEl.offsetWidth;
        cardEl.classList.add("job--pulse");
      } catch (_) {}
    }

    var isMusicQueued = (j.type === "music" && j.status === "queued");

    // Aggregation counter (global)
    window.__AIVO_MUSIC_QUEUED_COUNT__ = window.__AIVO_MUSIC_QUEUED_COUNT__ || 0;

    // If we already have an aggregated card, just bump the counter (no new render)
    if (isMusicQueued) {
      var existingAgg = document.querySelector('[data-aivo-agg="music-queued"]');
      if (existingAgg) {
        window.__AIVO_MUSIC_QUEUED_COUNT__ += 1;
        setMusicQueuedText(existingAgg, window.__AIVO_MUSIC_QUEUED_COUNT__);
        return;
      }
    }

    // DEFAULT: render normally (this guarantees "it appears")
    _jobsMap.set(j.job_id, j);

    // DOM diff to detect what renderJob added
    var root = ensureJobsRoot();
    var beforeCount = root.childElementCount;

    renderJob(j);

    // after render: find the newly added element
    var afterCount = root.childElementCount;
    var newEl = null;

    if (afterCount > beforeCount) {
      // assume last element is the new card
      newEl = root.lastElementChild;
    } else {
      // fallback: if renderJob updates an inner list, search deeper
      var lists = root.querySelectorAll("*");
      for (var k = lists.length - 1; k >= 0; k--) {
        var node = lists[k];
        if (node && node.childElementCount > 0) {
          // take the last leaf that looks like a card
          newEl = node.lastElementChild;
          break;
        }
      }
    }

    // If this is music queued: tag as single-card + set counter text
    if (isMusicQueued && newEl) {
      window.__AIVO_MUSIC_QUEUED_COUNT__ = 1;
      try { newEl.setAttribute("data-aivo-agg", "music-queued"); } catch (_) {}
      setMusicQueuedText(newEl, window.__AIVO_MUSIC_QUEUED_COUNT__);
      // NOTE: single-card mode => no polling for UI job
      return;
    }

    // Other jobs: keep existing behavior
    startPolling(j);
  },

  create: createJob
};

console.log("[AIVO_JOBS] loaded OK", Object.keys(window.AIVO_JOBS));
