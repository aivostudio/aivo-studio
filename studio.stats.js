/* =========================================================
   studio.stats.js — FINAL v6 (ROOT = data-stat)
   - UI binding: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Credits: AIVO_STORE_V1.getCredits() delta => spent + total (refresh-proof)
   - SAFE: Only writes inside the stats card root found via data-stat
   ========================================================= */
(function(){
  "use strict";

  var KEY = "aivo_profile_stats_v1";
  var BK  = "aivo_profile_stats_bk_v1";

  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }
  function clampInt(n){ n = Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function saveRaw(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  function now(){ return Date.now ? Date.now() : +new Date(); }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{}, updatedAt:0 };
  }
  function isAllZero(obj){
    if(!obj) return true;
    return !obj.music && !obj.cover && !obj.video && !obj.spent &&
      (!obj.seen || !Object.keys(obj.seen).length);
  }

  // ---------- LOAD (main + backup restore) ----------
  var main = safeParse(loadRaw(KEY), null);
  var bk   = safeParse(loadRaw(BK), null);
  var stats = empty();

  if (main && typeof main === "object") stats = Object.assign(stats, main);
  if (isAllZero(stats) && bk && typeof bk === "object" && !isAllZero(bk)) {
    stats = Object.assign(stats, bk);
    saveRaw(KEY, JSON.stringify(stats));
  }

  stats.music = clampInt(stats.music);
  stats.cover = clampInt(stats.cover);
  stats.video = clampInt(stats.video);
  stats.spent = clampInt(stats.spent);
  if (stats.total != null) stats.total = clampInt(stats.total);
  if (stats.lastCredits != null) stats.lastCredits = clampInt(stats.lastCredits);
  if (!stats.seen || typeof stats.seen !== "object") stats.seen = {};
  stats.updatedAt = clampInt(stats.updatedAt);

  function persist(){
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // ---------- ROOT: find via data-stat (NOT card-title) ----------
  function getStatsRoot(){
    // First pick any known data-stat node on the page
    var el =
      document.querySelector('[data-stat="totalCredits"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="music"]');

    if (!el) return null;

    // Walk up to the card container
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }

  // ---------- CREDITS SOURCE ----------
  function readCreditsFromStoreV1(){
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    } catch(e){}
    return null;
  }

  function readTotalCredits(){
    // Prefer store v1
    var v = readCreditsFromStoreV1();
    if (v != null) return v;
    // Fallback to saved
    return (stats.total == null ? null : clampInt(stats.total));
  }

  // spent delta sync (prev -> cur)
  function syncSpentFromCredits(){
    var cur = readTotalCredits();
    if (cur == null) return;

    stats.total = cur;

    if (stats.lastCredits == null) {
      stats.lastCredits = cur;
      persist();
      return;
    }

    var prev = clampInt(stats.lastCredits);
    if (cur < prev) stats.spent += (prev - cur);
    stats.lastCredits = cur;
    persist();
  }

  // ---------- UI PAINT ----------
  function paint(){
    var root = getStatsRoot();
    if (!root) return;

    syncSpentFromCredits();

    var elMusic = root.querySelector('[data-stat="music"]');
    var elCover = root.querySelector('[data-stat="cover"]');
    var elVideo = root.querySelector('[data-stat="video"]');
    var elSpent = root.querySelector('[data-stat="spentCredits"]');
    var elTotal = root.querySelector('[data-stat="totalCredits"]');
    var elProg  = root.querySelector('[data-stat="progress"]');

    if (elMusic) elMusic.textContent = String(stats.music);
    if (elCover) elCover.textContent = String(stats.cover);
    if (elVideo) elVideo.textContent = (stats.video > 0 ? String(stats.video) : "Henüz yok");

    if (elSpent) elSpent.textContent = String(stats.spent);
    if (elTotal) elTotal.textContent = (stats.total == null ? "0" : String(stats.total));

    if (elProg) {
      var pct = 0;
      if (stats.total && stats.total > 0) pct = Math.min(100, Math.round((stats.spent / stats.total) * 100));
      elProg.style.width = pct + "%";
    }
  }

  // ---------- BOOT ----------
  function boot(){
    // expose debug flag
    window.__AIVO_STATS_V6__ = true;

    persist();
    paint();

    if (!window.__AIVO_STATS_POLL_V6__) {
      window.__AIVO_STATS_POLL_V6__ = true;
      setInterval(paint, 800);
    }

    window.addEventListener("beforeunload", function(){ try { persist(); } catch(e){} });

    console.log("[STATS_V6] ready", {
      totalLS: stats.total,
      spentLS: stats.spent,
      storeCredits: (window.AIVO_STORE_V1 && window.AIVO_STORE_V1.getCredits) ? window.AIVO_STORE_V1.getCredits() : null,
      hasRoot: !!getStatsRoot()
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
