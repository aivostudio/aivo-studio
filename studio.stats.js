/* =========================================================
   studio.stats.js
   - Profil > Kullanım İstatistikleri
   - Kaynak: window.AIVO_JOBS
   - Bu ay üretilen job'ları sayar
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
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth();
  }

  function getJobs() {
    return Array.isArray(window.AIVO_JOBS) ? window.AIVO_JOBS : [];
  }

  function normalizeType(job) {
    var t = String(job.type || job.kind || job.product || "").toLowerCase();
    if (t.includes("music") || t.includes("müzik")) return "music";
    if (t.includes("cover") || t.includes("kapak")) return "cover";
    if (t.includes("video")) return "video";
    return "";
  }

  function render(stats) {
    var root = qs('[data-page="profile"]');
    if (!root) return;

    function set(key, val) {
      var el = qs('[data-stat="' + key + '"]');
      if (el) el.textContent = val;
    }

    set("music", stats.music);
    set("cover", stats.cover);
    set("video", stats.video > 0 ? stats.video : "Henüz yok");
  }

  function computeAndRender() {
    var jobs = getJobs();

    var stats = {
      music: 0,
      cover: 0,
      video: 0
    };

    jobs.forEach(function (job) {
      var created = job.created_at || job.createdAt || job.date;
      if (!isThisMonth(created)) return;

      var type = normalizeType(job);
      if (type && stats[type] !== undefined) {
        stats[type]++;
      }
    });

    render(stats);
  }

  // İlk yükleme
  document.addEventListener("DOMContentLoaded", computeAndRender);

  // Jobs güncellenirse tekrar hesapla
  window.addEventListener("aivo:jobs_updated", computeAndRender);

})();
