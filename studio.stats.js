/* =========================================================
   studio.stats.js
   - Profile "Kullanım İstatistikleri" render
   - Source of truth: window.AIVO_JOBS (fallback: [])
   - Month-based aggregation (this month)
   ========================================================= */

(function () {
  "use strict";

  // -------- helpers
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toInt(v, fallback) {
    var n = parseInt(String(v == null ? "" : v).replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function safeDate(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    return isNaN(+x) ? null : x;
  }

  function isInThisMonth(dateLike) {
    var d = safeDate(dateLike);
    if (!d) return false;
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function normalizeJobType(job) {
    // job.type / job.kind / job.product gibi alanlara göre uyarlayacağız
    var t = String(job.type || job.kind || job.product || job.page || "").toLowerCase();

    // geniş eşleştirme
    if (t.includes("music") || t.includes("müzik")) return "music";
    if (t.includes("cover") || t.includes("kapak")) return "cover";
    if (t.includes("video")) return "video";
    if (t.includes("social") || t.includes("sm-pack") || t.includes("sosyal")) return "socialpack";
    if (t.includes("hook") || t.includes("viral")) return "hook";

    return ""; // bilinmiyor
  }

  function getJobs() {
    var arr = window.AIVO_JOBS;
    if (Array.isArray(arr)) return arr;
    // alternatif store varsa buraya eklenebilir
    if (window.AIVO_STORE && Array.isArray(window.AIVO_STORE.jobs)) return window.AIVO_STORE.jobs;
    return [];
  }

  function computeStatsFromJobs(jobs) {
    var stats = {
      music: 0,
      cover: 0,
      video: 0,
      socialpack: 0,
      hook: 0,
      spentCredits: 0
    };

    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i] || {};
      var createdAt = j.created_at || j.createdAt || j.ts || j.time || j.date;
      if (!isInThisMonth(createdAt)) continue;

      var type = normalizeJobType(j);
      if (type && stats[type] != null) stats[type] += 1;

      // harcanan kredi: job üzerinde cost varsa topla
      if (j.credit_cost != null) stats.spentCredits += toInt(j.credit_cost, 0);
      else if (j.credits_spent != null) stats.spentCredits += toInt(j.credits_spent, 0);
    }

    return stats;
  }

  function readPersisted() {
    try {
      var raw = localStorage.getItem("aivo_profile_stats_v1");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function persist(stats) {
    try {
      localStorage.setItem("aivo_profile_stats_v1", JSON.stringify(stats));
    } catch (e) {}
  }

  function renderProfileStats(stats) {
    // Profil sayfasında değilsek sessiz çık (dashboard vs.)
    if (!qs('[data-page="profile"]')) return;

    function setStat(key, value) {
      var el = qs('[data-stat="' + key + '"]');
      if (!el) return;

      // string placeholder destekle
      if (typeof value === "string") el.textContent = value;
      else el.textContent = String(value);
    }

    setStat("music", stats.music || 0);
    setStat("cover", stats.cover || 0);

    // Video için "Henüz yok" istiyorsan:
    setStat("video", (stats.video || 0) > 0 ? (stats.video || 0) : "Henüz yok");

    setStat("spentCredits", stats.spentCredits || 0);

    // totalCredits: senin kredi UI store’undan okunabilir
    // Örn: window.AIVO_CREDITS?.current gibi bir alan varsa ona bağlanır.
    // Şimdilik varsa çekelim, yoksa 0 kalsın:
    var total = 0;
    if (window.AIVO_CREDITS && window.AIVO_CREDITS.current != null) total = toInt(window.AIVO_CREDITS.current, 0);
    else if (window.AIVO_STORE && window.AIVO_STORE.credits != null) total = toInt(window.AIVO_STORE.credits, 0);
    setStat("totalCredits", total);

    setStat("periodLabel", "Bu ay");
    setStat("statusLabel", "Özet");
  }

  // ---- public-ish hook: başka yerlerden tetiklemek için
  window.AIVO_STATS = window.AIVO_STATS || {};
  window.AIVO_STATS.recomputeAndRender = function () {
    var jobs = getJobs();
    var stats = computeStatsFromJobs(jobs);

    // Eğer local persisted varsa ve spentCredits hesaplanmıyorsa, birleştir
    var persisted = readPersisted();
    if (persisted && (!stats.spentCredits || stats.spentCredits === 0) && persisted.spentCredits) {
      stats.spentCredits = persisted.spentCredits;
    }

    persist(stats);
    renderProfileStats(stats);
    return stats;
  };

  // İlk yüklemede 1 kez dene
  document.addEventListener("DOMContentLoaded", function () {
    window.AIVO_STATS.recomputeAndRender();
  });

  // Eğer jobs sonradan geliyorsa (polling), arada tekrar dene:
  window.addEventListener("aivo:jobs_updated", function () {
    window.AIVO_STATS.recomputeAndRender();
  });

})();
