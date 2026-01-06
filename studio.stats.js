/* =========================================================
   studio.stats.js — FINAL (SINGLE SOURCE OF TRUTH)
   - UI binding: Profile "Kullanım İstatistikleri" card (data-stat=*)
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Credits: AIVO_STORE_V1.getCredits() delta => spent + total (refresh-proof)
   - Counters: fetch + XHR hooks (JSON + FormData + URLSearchParams)
   - SAFE: Only updates inside the stats card root (no sidebar corruption)
   ========================================================= */
(function(){
  "use strict";

  // -------------------- CONFIG --------------------
  var KEY = "aivo_profile_stats_v1";
  var BK  = "aivo_profile_stats_bk_v1";

  // -------------------- HELPERS --------------------
  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }
  function clampInt(n){ n = Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function saveRaw(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{} };
  }
  function isAllZero(obj){
    if(!obj) return true;
    return !obj.music && !obj.cover && !obj.video && !obj.spent &&
      (!obj.seen || !Object.keys(obj.seen).length);
  }

  function now(){ return Date.now ? Date.now() : +new Date(); }

  // -------------------- LOAD + RESTORE --------------------
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

  function persist(){
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // -------------------- ROOT (ONLY STATS CARD) --------------------
  function getStatsCardRoot(){
    // Fast path: if card-title exists
    var titles = document.querySelectorAll(".card-title");
    for (var i=0;i<titles.length;i++){
      var el = titles[i];
      var t = (el.textContent || "").trim().toLowerCase();
      if (t === "kullanım istatistikleri") return el.closest(".card") || null;
    }
    // Fallback: search text
    var nodes = document.querySelectorAll("h1,h2,h3,h4,div,span");
    for (var j=0;j<nodes.length;j++){
      var n = nodes[j];
      if (!n || !n.textContent) continue;
      var s = n.textContent.trim().toLowerCase();
      if (s === "kullanım istatistikleri" || s.indexOf("kullanım istatistikleri") !== -1) {
        return n.closest(".card") || n.closest("section") || null;
      }
    }
    return null;
  }

  // -------------------- CREDITS READ (AIVO_STORE_V1) --------------------
  function readCreditsFromStoreV1(){
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    } catch(e){}
    return null;
  }

  function readCreditsFromDOM(){
    // Last resort: parse from a visible "Kredi 2575" element
    try {
      var els = document.querySelectorAll("button,span,div");
      for (var i=0;i<els.length;i++){
        var txt = (els[i].textContent||"").trim();
        if (!txt) continue;
        if (txt.toLowerCase().indexOf("kredi") === -1) continue;
        var digits = txt.replace(/[^\d]/g,"");
        if (digits && digits.length >= 2) return clampInt(digits);
      }
    } catch(e){}
    return null;
  }

  function readTotalCredits(){
    return readCreditsFromStoreV1() || readCreditsFromDOM() || (stats.total==null?null:clampInt(stats.total));
  }

  // spent delta sync (prev -> now)
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

  // -------------------- UI PAINT (data-stat=*) --------------------
  function paint(){
    var root = getStatsCardRoot();
    if (!root) return;

    // Update total/spent from store
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

  // -------------------- COUNTERS (FETCH + XHR HOOKS) --------------------
  function seen(id){
    id = String(id||"");
    if (!id) return false;
    if (stats.seen[id]) return true;
    stats.seen[id] = now();
    return false;
  }

  function kindFromUrl(url){
    url = String(url||"").toLowerCase();

    // ✅ Senin repo yapına göre olası endpointler:
    // /api/music/generate.js => /api/music/generate
    // cover/video için senin projede endpoint adı farklı olabilir.
    if (url.indexOf("/api/music/") !== -1) return "music";
    if (url.indexOf("/api/cover/") !== -1) return "cover";
    if (url.indexOf("/api/video/") !== -1) return "video";

    // Jobs create da olabilir: /api/jobs/create
    // body içinden kind yakalamaya çalışırız.
    return "";
  }

  function kindFromObject(obj){
    if (!obj || typeof obj !== "object") return "";
    var k = String(obj.kind || obj.type || obj.module || obj.product || obj.page || "").toLowerCase();
    if (k === "music" || k === "müzik") return "music";
    if (k === "cover" || k === "kapak") return "cover";
    if (k === "video") return "video";
    return "";
  }

  function kindFromBody(body){
    try{
      if (!body) return "";

      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return kindFromObject({
          kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product") || body.get("page")
        });
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        return kindFromObject({
          kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product") || body.get("page")
        });
      }
      if (typeof body === "string") {
        var o = safeParse(body, null);
        if (o) return kindFromObject(o);
      }
      if (typeof body === "object") return kindFromObject(body);
    } catch(e){}
    return "";
  }

  function extractJobId(data){
    if (!data) return "";
    return String(
      data.job_id ||
      data.id ||
      (data.job && (data.job.job_id || data.job.id)) ||
      ""
    );
  }

  function inc(kind, jobId){
    if (!(kind === "music" || kind === "cover" || kind === "video")) return;

    if (jobId && seen(jobId)) return;

    if (kind === "music") stats.music++;
    if (kind === "cover") stats.cover++;
    if (kind === "video") stats.video++;

    persist();
    paint();
  }

  function hookFetch(){
    if (window.__AIVO_STATS_FETCH_HOOK__) return;
    window.__AIVO_STATS_FETCH_HOOK__ = true;
    if (typeof window.fetch !== "function") return;

    var _fetch = window.fetch;
    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      var body = init && init.body;

      var kind = kindFromBody(body) || kindFromUrl(url);

      return _fetch.apply(this, arguments).then(function(res){
        try{
          if (!(kind === "music" || kind === "cover" || kind === "video")) return res;

          var clone = res.clone();
          clone.json().then(function(data){
            inc(kind, extractJobId(data) || null);
          }).catch(function(){
            // JSON değilse yine de say
            inc(kind, null);
          });
        } catch(e){}
        return res;
      });
    };
  }

  function hookXHR(){
    if (window.__AIVO_STATS_XHR_HOOK__) return;
    window.__AIVO_STATS_XHR_HOOK__ = true;
    if (!window.XMLHttpRequest) return;

    var XHR = window.XMLHttpRequest;
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      this.__aivo_stats_url = url;
      return open.apply(this, arguments);
    };

    XHR.prototype.send = function(body){
      var xhr = this;
      var url = xhr.__aivo_stats_url || "";
      var kind = kindFromBody(body) || kindFromUrl(url);

      function onLoad(){
        try{
          if (!(kind === "music" || kind === "cover" || kind === "video")) return;

          var text = "";
          try { text = xhr.responseText || ""; } catch(e){}
          var data = safeParse(text, null);
          inc(kind, extractJobId(data) || null);
        } catch(e){}
      }

      xhr.addEventListener("load", onLoad);
      return send.apply(this, arguments);
    };
  }

  // -------------------- BOOT --------------------
  function boot(){
    persist();
    paint();

    hookFetch();
    hookXHR();

    // store/UI geç yükleniyorsa yakalamak için
    if (!window.__AIVO_STATS_POLL__) {
      window.__AIVO_STATS_POLL__ = true;
      setInterval(paint, 1200);
    }

    window.addEventListener("beforeunload", function(){ try { persist(); } catch(e){} });

    console.log("[STATS_FINAL] snapshot", {
      music: stats.music, cover: stats.cover, video: stats.video,
      spent: stats.spent, total: stats.total, lastCredits: stats.lastCredits,
      hasStoreV1: !!window.AIVO_STORE_V1
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
