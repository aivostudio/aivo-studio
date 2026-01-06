/* =========================================================
   studio.stats.js (CLEAN)
   - Source: window.AIVO_JOBS (store)
   - Profile usage stats
   ========================================================= */

(function () {
  "use strict";

  function qs(sel) { return document.querySelector(sel); }

  function isThisMonth(dateLike) {
    if (!dateLike) return false;
    var d = new Date(dateLike);
    if (isNaN(d)) return false;
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function normalizeType(job) {
    var t = String(job.type || job.kind || job.product || job.page || "").toLowerCase();
    if (t.indexOf("music") !== -1 || t.indexOf("müzik") !== -1) return "music";
    if (t.indexOf("cover") !== -1 || t.indexOf("kapak") !== -1) return "cover";
    if (t.indexOf("video") !== -1) return "video";
    return "";
  }

  function setStat(key, val) {
    var el = qs('[data-stat="' + key + '"]');
    if (!el) return;
    el.textContent = String(val);
  }

  function render(stats) {
    if (!qs('[data-page="profile"]')) return;
    setStat("music", stats.music || 0);
    setStat("cover", stats.cover || 0);
    setStat("video", (stats.video || 0) > 0 ? (stats.video || 0) : "Henüz yok");
  }

  function compute(jobs) {
    var stats = { music: 0, cover: 0, video: 0 };

    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i] || {};
      var created = job.created_at || job.createdAt || job.ts || job.time || job.date;
      if (!isThisMonth(created)) continue;

      var type = normalizeType(job);
      if (type && stats[type] !== undefined) stats[type] += 1;
    }

    return stats;
  }

  function bind() {
    var store = window.AIVO_JOBS;
    if (!store || typeof store.subscribe !== "function") {
      console.warn("[STATS] AIVO_JOBS subscribe yok");
      return;
    }

    store.subscribe(function (jobs) {
      if (!Array.isArray(jobs)) return;
      render(compute(jobs));
    });

    if (typeof store.get === "function") {
      var initial = store.get();
      if (Array.isArray(initial)) render(compute(initial));
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
