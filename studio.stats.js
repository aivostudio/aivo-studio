/* =========================================================
   studio.stats.js (STORE UYUMLU)
   - Kaynak: window.AIVO_JOBS (store)
   - Profil > Kullanım İstatistikleri
   ========================================================= */

(function () {
  "use strict";

  function qs(sel) {
    return document.querySelector(sel);
  }

  function isThisMonth(dateLike) {
    if (!dateLike) return false;
    var d = new Date(dateLike);
    if (isNaN(d)) return false;
    var now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }

  function normalizeType(job) {
    var t = String(job.type || job.kind || job.product || "").toLowerCase();
    if (t.includes("music") || t.includes("müzik")) return "music";
    if (t.includes("cover") || t.includes("kapak")) return "cover";
    if (t.includes("video")) return "video";
    return "";
  }

  function render(stats) {
    if (!qs('[data-page="profile"]')) return;

    function set(key, val) {
      var el = qs('[data-stat="' + key + '"]');
      if (el) el.textContent = val;
    }

    set("music", stats.music);
    set("cover", stats.cover);
    set("video", stats.video > 0 ? stats.video : "Henüz yok");
  }

  function computeAndRender(jobs) {
    var stats = {
      music: 0,
      cover: 0,
      video: 0
    };

    jobs.forEach(function (job) {
      var created =
        job.created_at ||
        job.createdAt ||
        job.ts → ||
        job.date;

      if (!isThisMonth(created)) return;

      var type = normalizeType(job);
      if (type && stats[type] !== undefined) {
        stats[type]++;
      }
    });

    render(stats);
  }

  // ---- STORE BAĞLANTISI ----
  function bindStore() {
    if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.subscribe !== "function") {
      console.warn("[STATS] AIVO_JOBS store yok");
      return;
    }

    window.AIVO_JOBS.subscribe(function (jobs) {
      if (!Array.isArray(jobs)) return;
      computeAndRender(jobs);
    });
  }

  document.addEventListener("DOMContentLoaded", bindStore);
})();
