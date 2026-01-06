/* =========================================================
   studio.stats.js — SINGLE SOURCE OF TRUTH (v4)
   - Guarantees load log
   - Total/Spent: robust credit read (AIVO_STORE_V1 / AIVO_STORE / DOM)
   - Counters: fetch + XHR hooks (JSON + FormData + URLSearchParams)
   - SAFE UI: only touches "Kullanım istatistikleri" card
   ========================================================= */
(function(){
  "use strict";

  console.log("[STATS_V4] studio.stats.js loaded", new Date().toISOString());

  var KEY = "aivo_profile_stats_v1";
  var BK  = "aivo_profile_stats_bk_v1";

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

  // ---- load + restore ----
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

  // ---- SAFE ROOT ----
  function getStatsCardRoot(){
    var nodes = document.querySelectorAll("h1,h2,h3,h4,div,span");
    for (var i=0;i<nodes.length;i++){
      var el = nodes[i];
      if (!el || !el.textContent) continue;
      var t = el.textContent.trim().toLowerCase();
      if (t === "kullanım istatistikleri" || t.indexOf("kullanım istatistikleri") !== -1) {
        return el.closest(".card, section, .panel, .aivo-card, .profile-card") || null;
      }
    }
    return null;
  }

  function qs(sel, root){ try { return (root||document).querySelector(sel); } catch(e){ return null; } }
  function qsa(sel, root){ try { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); } catch(e){ return []; } }

  function paintByLabel(root, label, value){
    label = String(label||"").toLowerCase();
    var rows = qsa("button, .row, .stat-row, .usage-row, .line, .item, .pill, .chip-btn, .stat-pill", root);
    for (var i=0;i<rows.length;i++){
      var row = rows[i];
      var text = (row.textContent||"").toLowerCase();
      if (text.indexOf(label) === -1) continue;

      var val =
        qs("[data-value]", row) ||
        qs(".value", row) ||
        qs(".stat-value", row) ||
        qs("strong", row) ||
        (function(){
          var spans = row.querySelectorAll("span, div");
          return spans && spans.length ? spans[spans.length-1] : null;
        })();

      if (val) { val.textContent = String(value); return true; }
    }
    return false;
  }

  // ---- CREDIT READ (robust) ----
  function readCreditsFromStoreV1(){
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    } catch(e){}
    return null;
  }

  function readCreditsFromAivoStore(){
    try {
      if (window.AIVO_STORE && typeof window.AIVO_STORE.getState === "function") {
        var st = window.AIVO_STORE.getState();
        var v = st && (st.credits || st.credit || st.balance || (st.user && st.user.credits));
        if (v != null) return clampInt(v);
      }
    } catch(e){}
    return null;
  }

  function readCreditsFromDOM(){
    // Topbar “Kredi 2575” gibi
    var candidates = qsa("button,div,span");
    for (var i=0;i<candidates.length;i++){
      var el = candidates[i];
      var txt = (el && el.textContent) ? el.textContent.trim() : "";
      if (!txt) continue;
      // Türkçe UI: “Kredi 2575”
      if (txt.toLowerCase().indexOf("kredi") === -1) continue;
      var n = txt.replace(/[^\d]/g,"");
      if (n && n.length >= 2) return clampInt(n);
    }
    return null;
  }

  function readTotalCredits(){
    return readCreditsFromStoreV1() || readCreditsFromAivoStore() || readCreditsFromDOM() || (stats.total==null?null:clampInt(stats.total));
  }

  function syncSpentFromCredits(){
    var now = readTotalCredits();
    if (now == null) return;

    stats.total = now;

    if (stats.lastCredits == null) {
      stats.lastCredits = now;
      persist();
      return;
    }

    var prev = clampInt(stats.lastCredits);
    if (now < prev) stats.spent += (prev - now);
    stats.lastCredits = now;
    persist();
  }

  // ---- COUNTERS: kind inference ----
  function kindFromObject(obj){
    if (!obj || typeof obj !== "object") return "";
    var k = String(obj.kind || obj.type || obj.module || obj.product || "").toLowerCase();
    if (k === "music" || k === "müzik") return "music";
    if (k === "cover" || k === "kapak") return "cover";
    if (k === "video") return "video";
    return "";
  }

  function kindFromBody(body){
    try{
      if (!body) return "";

      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return kindFromObject({ kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product") });
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        return kindFromObject({ kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product") });
      }
      if (typeof body === "string") {
        var obj = safeParse(body, null);
        if (obj) return kindFromObject(obj);
      }
      if (typeof body === "object") return kindFromObject(body);

      return "";
    } catch(e){ return ""; }
  }

  function kindFromUrl(url){
    url = String(url||"").toLowerCase();
    if (url.indexOf("/api/music") !== -1) return "music";
    if (url.indexOf("/api/cover") !== -1) return "cover";
    if (url.indexOf("/api/video") !== -1) return "video";
    // bazı projelerde generate endpoint farklı olabilir, gene de body'den yakalarız
    return "";
  }

  function seen(jobId){
    jobId = String(jobId||"");
    if (!jobId) return false;
    if (stats.seen[jobId]) return true;
    stats.seen[jobId] = Date.now();
    return false;
  }

  function inc(kind, jobId){
    if (jobId && seen(jobId)) return;

    if (kind === "music") stats.music++;
    else if (kind === "cover") stats.cover++;
    else if (kind === "video") stats.video++;
    else return;

    persist();
    paint();
  }

  // ---- UI paint ----
  function paint(){
    var root = getStatsCardRoot();
    if (!root) return;

    syncSpentFromCredits();

    var m = qs("[data-profile-stat-music]", root);
    var c = qs("[data-profile-stat-cover]", root);
    var v = qs("[data-profile-stat-video]", root);
    var s = qs("[data-profile-stat-spent]", root);
    var t = qs("[data-profile-stat-total]", root);

    if (m) m.textContent = String(stats.music); else paintByLabel(root, "müzik", stats.music);
    if (c) c.textContent = String(stats.cover); else paintByLabel(root, "kapak", stats.cover);
    if (v) v.textContent = String(stats.video); else paintByLabel(root, "video", stats.video);

    if (s) s.textContent = String(stats.spent); else paintByLabel(root, "harcanan", stats.spent);

    var totalText = (stats.total == null ? "0" : String(stats.total));
    if (t) t.textContent = totalText; else paintByLabel(root, "toplam", totalText);
  }

  // ---- hook fetch ----
  function hookFetch(){
    if (window.__AIVO_STATS_FETCH_HOOK_V4__) return;
    window.__AIVO_STATS_FETCH_HOOK_V4__ = true;
    if (typeof window.fetch !== "function") return;

    var _fetch = window.fetch;
    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      var body = init && init.body;

      var kind = kindFromBody(body) || kindFromUrl(url);

      return _fetch.apply(this, arguments).then(function(res){
        try{
          // yalnızca music/cover/video çağrıları için
          if (!(kind === "music" || kind === "cover" || kind === "video")) return res;

          var clone = res.clone();
          clone.json().then(function(data){
            var jobId = data && (data.job_id || data.id || (data.job && (data.job.job_id || data.job.id)));
            inc(kind, jobId || null);
          }).catch(function(){
            inc(kind, null);
          });
        } catch(e){}
        return res;
      });
    };
  }

  // ---- hook XHR ----
  function hookXHR(){
    if (window.__AIVO_STATS_XHR_HOOK_V4__) return;
    window.__AIVO_STATS_XHR_HOOK_V4__ = true;
    if (!window.XMLHttpRequest) return;

    var XHR = window.XMLHttpRequest;
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      this.__aivo_url = url;
      return open.apply(this, arguments);
    };

    XHR.prototype.send = function(body){
      var xhr = this;
      var url = xhr.__aivo_url || "";
      var kind = kindFromBody(body) || kindFromUrl(url);

      function onLoad(){
        try{
          if (!(kind === "music" || kind === "cover" || kind === "video")) return;

          var text = "";
          try { text = xhr.responseText || ""; } catch(e){}
          var data = safeParse(text, null);
          var jobId = data && (data.job_id || data.id || (data.job && (data.job.job_id || data.job.id)));
          inc(kind, jobId || null);
        } catch(e){}
      }

      xhr.addEventListener("load", onLoad);
      return send.apply(this, arguments);
    };
  }

  function boot(){
    persist();
    paint();

    hookFetch();
    hookXHR();

    // store geç doluyor olabilir
    if (!window.__AIVO_STATS_POLL_V4__) {
      window.__AIVO_STATS_POLL_V4__ = true;
      setInterval(paint, 1200);
    }

    window.addEventListener("beforeunload", function(){ try { persist(); } catch(e){} });

    // Debug snapshot (yüksek değer)
    console.log("[STATS_V4] snapshot", {
      music:stats.music, cover:stats.cover, video:stats.video,
      spent:stats.spent, total:stats.total, lastCredits:stats.lastCredits,
      hasStoreV1: !!window.AIVO_STORE_V1, hasAivoStore: !!window.AIVO_STORE
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
