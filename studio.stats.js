/* =========================================================
   studio.stats.js (ROBUST)
   - Source: window.AIVO_JOBS store
   - Profile usage stats: music / cover / video
   - Triggers on subscribe + upsert/setAll/remove
   ========================================================= */

(function () {
  "use strict";

  function qs(sel) { return document.querySelector(sel); }

  function isThisMonth(dateLike) {
    if (!dateLike) return true; // tarih yoksa bu ay say
    var d = new Date(dateLike);
    if (isNaN(d)) return true;
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function normalizeType(job) {
    job = job || {};

    // 1) açık alanlar
    var t = String(job.type || job.kind || job.product || job.page || "").toLowerCase();
    if (t.indexOf("music") !== -1 || t.indexOf("müzik") !== -1) return "music";
    if (t.indexOf("cover") !== -1 || t.indexOf("kapak") !== -1) return "cover";
    if (t.indexOf("video") !== -1) return "video";

    // 2) job_id prefix (SENDE NET: music-....)
    var id = String(job.job_id || job.id || "").toLowerCase();
    if (id.indexOf("music-") === 0) return "music";
    if (id.indexOf("cover-") === 0) return "cover";
    if (id.indexOf("video-") === 0) return "video";

    return "";
  }

  function setStat(key, val) {
    var el = qs('[data-stat="' + key + '"]');
    if (!el) return;
    el.textContent = String(val);
  }

  function render(stats) {
    // Profil sayfası DOM'da yoksa çık
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

  function safeGetArray(store) {
    // bazı store'larda get() olabilir
    if (store && typeof store.get === "function") {
      var v = store.get();
      if (Array.isArray(v)) return v;
    }
    return null;
  }

  function bindWhenReady() {
    var store = window.AIVO_JOBS;
    if (!store || typeof store.subscribe !== "function") return false;

    var latest = null;
    var wrapped = false;

    function recalc(fromJobs) {
      var arr = Array.isArray(fromJobs) ? fromJobs : (latest || safeGetArray(store) || []);
      render(compute(arr));
    }

    // 1) subscribe ile güncelle
    store.subscribe(function (jobs) {
      if (!Array.isArray(jobs)) return;
      latest = jobs;
      recalc(jobs);
    });

    // 2) İlk render (get varsa)
    var initial = safeGetArray(store);
    if (initial) {
      latest = initial;
      recalc(initial);
    }

    // 3) upsert/setAll/remove wrap (her mutasyonda recalc)
    if (!wrapped) {
      ["upsert", "setAll", "remove"].forEach(function (fn) {
        if (typeof store[fn] !== "function") return;
        var original = store[fn];
        store[fn] = function () {
          var res = original.apply(store, arguments);
          // mutation sonrası bir tick bekle
          setTimeout(function () { recalc(); }, 0);
          return res;
        };
      });
      wrapped = true;
    }

    return true;
  }

  // SPA olduğu için DOMContentLoaded tek sefer olabilir: kısa polling ile bağla
  (function start() {
    var tries = 0;
    var maxTries = 60; // ~6sn
    var timer = setInterval(function () {
      tries++;
      if (bindWhenReady()) {
        clearInterval(timer);
      } else if (tries >= maxTries) {
        clearInterval(timer);
        console.warn("[STATS] AIVO_JOBS bulunamadı (timeout)");
      }
    }, 100);
  })();

})();
