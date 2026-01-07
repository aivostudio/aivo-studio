/* =========================================================
   studio.stats.js — FINAL v7 (CREDITS OK + COUNTERS)
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Credits: AIVO_STORE_V1.getCredits() delta => spent + total
   - Counters:
     A) Detect generation via fetch/XHR URL/body
     B) Fallback: if credits decrease, attribute to last clicked generator type
   - Debug: short-lived request logger (10s) to discover real endpoints
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
    return {
      music:0, cover:0, video:0,
      spent:0, total:null, lastCredits:null,
      seen:{}, updatedAt:0,
      lastAction:null, lastActionAt:0
    };
  }
  function isAllZero(obj){
    if(!obj) return true;
    return !obj.music && !obj.cover && !obj.video && !obj.spent &&
      (!obj.seen || !Object.keys(obj.seen).length);
  }

  // ---------- LOAD ----------
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
  stats.lastAction = stats.lastAction ? String(stats.lastAction) : null;
  stats.lastActionAt = clampInt(stats.lastActionAt);

  function persist(){
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // ---------- ROOT ----------
  function getStatsRoot(){
    var el =
      document.querySelector('[data-stat="totalCredits"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="music"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }

  // ---------- CREDITS ----------
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
    var v = readCreditsFromStoreV1();
    if (v != null) return v;
    return (stats.total == null ? null : clampInt(stats.total));
  }

  // ----- last action (fallback attribution) -----
  function setLastAction(kind){
    if (kind !== "music" && kind !== "cover" && kind !== "video") return;
    stats.lastAction = kind;
    stats.lastActionAt = now();
    persist();
  }

  // Heuristic: if credit decreases within 20s after a generator click, count it
  function maybeAttributeSpentToLastAction(deltaSpent){
    if (!deltaSpent || deltaSpent <= 0) return;
    var k = stats.lastAction;
    if (k !== "music" && k !== "cover" && k !== "video") return;

    var age = now() - (stats.lastActionAt || 0);
    if (age > 20000) return; // 20s window

    // Count 1 unit output per spend event (business rule)
    if (k === "music") stats.music++;
    if (k === "cover") stats.cover++;
    if (k === "video") stats.video++;

    persist();
    paint();
  }

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
    if (cur < prev) {
      var d = (prev - cur);
      stats.spent += d;
      // fallback attribution
      maybeAttributeSpentToLastAction(d);
    }
    stats.lastCredits = cur;
    persist();
  }

  // ---------- UI ----------
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

  // ---------- COUNTERS: request-based detection ----------
  function seen(id){
    id = String(id||"");
    if (!id) return false;
    if (stats.seen[id]) return true;
    stats.seen[id] = now();
    return false;
  }

  function kindFromUrl(url){
    url = String(url||"").toLowerCase();

    // Your repo paths
    if (url.indexOf("/api/music/") !== -1) return "music";
    if (url.indexOf("/api/cover/") !== -1) return "cover";
    if (url.indexOf("/api/video/") !== -1) return "video";

    // Sometimes generation is via /api/jobs/create with kind in body
    if (url.indexOf("/api/jobs/") !== -1) return "";

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

  function inc(kind, id){
    if (kind !== "music" && kind !== "cover" && kind !== "video") return;
    if (id && seen(id)) return;

    if (kind === "music") stats.music++;
    if (kind === "cover") stats.cover++;
    if (kind === "video") stats.video++;

    persist();
    paint();
  }

  // ---------- DEBUG: log requests for 10s ----------
  function shortDebugLogger(tag, url, body){
    try{
      if (!window.__AIVO_STATS_DEBUG_UNTIL__) return;
      if (now() > window.__AIVO_STATS_DEBUG_UNTIL__) return;
      console.log("[STATS_REQ]", tag, url, body && typeof body === "object" ? body : (body ? String(body).slice(0,200) : ""));
    } catch(e){}
  }

  function hookFetch(){
    if (window.__AIVO_STATS_FETCH_HOOK_V7__) return;
    window.__AIVO_STATS_FETCH_HOOK_V7__ = true;
    if (typeof window.fetch !== "function") return;

    var _fetch = window.fetch;
    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      var body = init && init.body;

      shortDebugLogger("fetch", url, body);

      var kind = kindFromBody(body) || kindFromUrl(url);

      return _fetch.apply(this, arguments).then(function(res){
        try{
          if (kind === "music" || kind === "cover" || kind === "video") {
            // optimistic count when request is made (then dedupe with id if possible)
            var clone = res.clone();
            clone.json().then(function(data){
              inc(kind, extractJobId(data) || null);
            }).catch(function(){
              inc(kind, null);
            });
          } else {
            // If this is jobs/create, try to parse response for kind
            var u = String(url||"").toLowerCase();
            if (u.indexOf("/api/jobs/") !== -1) {
              var c2 = res.clone();
              c2.json().then(function(data){
                var k2 = kindFromObject(data) || kindFromObject(data && data.job);
                if (k2) inc(k2, extractJobId(data) || null);
              }).catch(function(){});
            }
          }
        } catch(e){}
        return res;
      });
    };
  }

  function hookXHR(){
    if (window.__AIVO_STATS_XHR_HOOK_V7__) return;
    window.__AIVO_STATS_XHR_HOOK_V7__ = true;
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

      shortDebugLogger("xhr", url, body);

      var kind = kindFromBody(body) || kindFromUrl(url);

      xhr.addEventListener("load", function(){
        try{
          if (kind === "music" || kind === "cover" || kind === "video") {
            var data = safeParse(xhr.responseText || "", null);
            inc(kind, extractJobId(data) || null);
            return;
          }

          var u = String(url||"").toLowerCase();
          if (u.indexOf("/api/jobs/") !== -1) {
            var d2 = safeParse(xhr.responseText || "", null);
            var k2 = kindFromObject(d2) || kindFromObject(d2 && d2.job);
            if (k2) inc(k2, extractJobId(d2) || null);
          }
        } catch(e){}
      });

      return send.apply(this, arguments);
    };
  }

  // ---------- CLICK INTENT (fallback attribution) ----------
  function hookClicks(){
    if (window.__AIVO_STATS_CLICK_HOOK_V7__) return;
    window.__AIVO_STATS_CLICK_HOOK_V7__ = true;

    document.addEventListener("click", function(e){
      try{
        var t = e.target;
        if (!t) return;
        var btn = t.closest && t.closest("button,[role='button'],a");
        if (!btn) return;

        // detect generator intent by data-page-link or visible text
        var dp = (btn.getAttribute && btn.getAttribute("data-page-link")) ? String(btn.getAttribute("data-page-link")).toLowerCase() : "";
        var tx = String(btn.textContent || "").toLowerCase();

        // page-link based
        if (dp === "music") setLastAction("music");
        else if (dp === "cover") setLastAction("cover");
        else if (dp === "video") setLastAction("video");

        // text based fallback
        else if (tx.indexOf("müzik") !== -1) setLastAction("music");
        else if (tx.indexOf("kapak") !== -1) setLastAction("cover");
        else if (tx.indexOf("video") !== -1) setLastAction("video");
      } catch(err){}
    }, true);
  }

  // ---------- BOOT ----------
  function boot(){
    window.__AIVO_STATS_V7__ = true;

    // enable request debug for 10 seconds
    window.__AIVO_STATS_DEBUG_UNTIL__ = now() + 10000;

    persist();
    paint();

    hookFetch();
    hookXHR();
    hookClicks();

    if (!window.__AIVO_STATS_POLL_V7__) {
      window.__AIVO_STATS_POLL_V7__ = true;
      setInterval(paint, 800);
    }

    window.addEventListener("beforeunload", function(){ try { persist(); } catch(e){} });

    console.log("[STATS_V7] ready", {
      totalLS: stats.total,
      spentLS: stats.spent,
      storeCredits: (window.AIVO_STORE_V1 && window.AIVO_STORE_V1.getCredits) ? window.AIVO_STORE_V1.getCredits() : null,
      lastAction: stats.lastAction
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
