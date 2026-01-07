/* =========================================================
   studio.stats.js — FINAL v9 (PATCH STORE + PATCH JOBS MUTATIONS)
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Spent/Total: hooks AIVO_STORE_V1.consumeCredits/setCredits/addCredits
   - Counters: hooks AIVO_JOBS.upsert/setAll/remove + (optional) subscribe
   ========================================================= */
(function(){
  "use strict";

  var KEY="aivo_profile_stats_v1", BK="aivo_profile_stats_bk_v1";

  function safeParse(s,f){ try{return JSON.parse(String(s||""));}catch(e){return f;} }
  function clampInt(n){ n=Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
  function saveRaw(k,v){ try{localStorage.setItem(k,v);}catch(e){} }
  function now(){ return Date.now?Date.now():+new Date(); }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{}, updatedAt:0 };
  }
  function isAllZero(o){ return !o || (!o.music && !o.cover && !o.video && !o.spent); }

  // load
  var main = safeParse(loadRaw(KEY), null);
  var bk   = safeParse(loadRaw(BK), null);
  var stats = empty();
  if (main && typeof main==="object") stats = Object.assign(stats, main);
  if (isAllZero(stats) && bk && typeof bk==="object" && !isAllZero(bk)) stats = Object.assign(stats, bk);

  stats.music = clampInt(stats.music);
  stats.cover = clampInt(stats.cover);
  stats.video = clampInt(stats.video);
  stats.spent = clampInt(stats.spent);
  stats.total = (stats.total==null?null:clampInt(stats.total));
  stats.lastCredits = (stats.lastCredits==null?null:clampInt(stats.lastCredits));
  if (!stats.seen || typeof stats.seen !== "object") stats.seen = {};
  stats.updatedAt = clampInt(stats.updatedAt);

  function persist(){
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // UI root
  function getRoot(){
    var el =
      document.querySelector('[data-stat="totalCredits"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="music"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }

  function paint(){
    var root = getRoot();
    if(!root) return;

    var m = root.querySelector('[data-stat="music"]');
    var c = root.querySelector('[data-stat="cover"]');
    var v = root.querySelector('[data-stat="video"]');
    var s = root.querySelector('[data-stat="spentCredits"]');
    var t = root.querySelector('[data-stat="totalCredits"]');
    var p = root.querySelector('[data-stat="progress"]');

    if (m) m.textContent = String(stats.music);
    if (c) c.textContent = String(stats.cover);
    if (v) v.textContent = (stats.video > 0 ? String(stats.video) : "Henüz yok");
    if (s) s.textContent = String(stats.spent);
    if (t) t.textContent = (stats.total == null ? "0" : String(stats.total));

    if (p){
      var pct = 0;
      if (stats.total && stats.total > 0) pct = Math.min(100, Math.round((stats.spent / stats.total) * 100));
      p.style.width = pct + "%";
    }
  }

  // credits
  function readCredits(){
    try{
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function"){
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    }catch(e){}
    return null;
  }

  function onCreditsChanged(prev, cur){
    prev = clampInt(prev);
    cur  = clampInt(cur);
    stats.total = cur;
    if (cur < prev) stats.spent += (prev - cur);
    stats.lastCredits = cur;
    persist();
    paint();
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V9__) return;
    if (!window.AIVO_STORE_V1) return;

    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V9__ = true;

    // baseline
    var base = readCredits();
    if (base != null){
      stats.total = base;
      if (stats.lastCredits == null) stats.lastCredits = base;
      persist();
      paint();
    }

    function wrap(name){
      if (typeof S[name] !== "function") return;
      if (S[name].__aivo_patched_v9) return;

      var orig = S[name];
      S[name] = function(){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
        var res = orig.apply(this, arguments);
        var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S[name].__aivo_patched_v9 = true;
    }

    wrap("consumeCredits");
    wrap("setCredits");
    wrap("addCredits");

    console.log("[STATS_V9] store patched", { creditsNow: readCredits() });
  }

  // ---- JOBS -> counters (no subscribe required)
  function jobId(job){
    return String((job && (job.job_id || job.id || job.uid)) || "");
  }
  function jobStatus(job){
    return String((job && (job.status || job.state)) || "").toLowerCase();
  }
  function normalizeType(job){
    var t = String((job && (job.type || job.kind || job.product || job.page || job.module)) || "").toLowerCase();
    if (t === "music" || t.indexOf("muzik") >= 0) return "music";
    if (t === "cover" || t.indexOf("kapak") >= 0) return "cover";
    if (t === "video") return "video";
    return t || "job";
  }
  function isDone(job){
    var st = jobStatus(job);
    return (st === "done" || st === "completed" || st === "success");
  }

  function applyDone(job){
    if (!job) return;
    if (!isDone(job)) return;

    var id = jobId(job);
    if (!id) return;
    if (stats.seen[id]) return;

    var t = normalizeType(job);
    if (t === "music") stats.music++;
    else if (t === "cover") stats.cover++;
    else if (t === "video") stats.video++;

    stats.seen[id] = now();
    persist();
    paint();
  }

  function scanList(list){
    if (!Array.isArray(list)) return;
    for (var i=0;i<list.length;i++) applyDone(list[i]);
  }

  function patchJobs(){
    if (window.__AIVO_STATS_PATCH_JOBS_V9__) return;
    if (!window.AIVO_JOBS) return;

    var J = window.AIVO_JOBS;
    window.__AIVO_STATS_PATCH_JOBS_V9__ = true;

    function wrap(name, getListAfter){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v9) return;

      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);

        try{
          // try arguments first (common patterns)
          if (name === "upsert"){
            // upsert(job) or upsert(id, job)
            var job = arguments.length===1 ? arguments[0] : arguments[1];
            applyDone(job);
          } else {
            var list = getListAfter ? getListAfter() : (Array.isArray(J.list) ? J.list : null);
            scanList(list);
          }
        }catch(e){}

        return res;
      };
      J[name].__aivo_patched_v9 = true;
    }

    wrap("upsert", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("setAll", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("remove", function(){ return Array.isArray(J.list)?J.list:null; });

    // if subscribe exists, also hook it
    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v9){
      var _sub = J.subscribe;
      J.subscribe = function(fn){
        return _sub.call(this, function(payload){
          // payload might be list or state object
          if (Array.isArray(payload)) scanList(payload);
          else if (payload && Array.isArray(payload.list)) scanList(payload.list);
          else if (payload && Array.isArray(payload.jobs)) scanList(payload.jobs);
          if (typeof fn === "function") fn(payload);
        });
      };
      J.subscribe.__aivo_patched_v9 = true;
    }

    // initial scan
    if (Array.isArray(J.list)) scanList(J.list);

    console.log("[STATS_V9] jobs patched", { listLen: Array.isArray(J.list)?J.list.length:null, keys:Object.keys(J) });
  }

  function boot(){
    persist();
    paint();

    if (!window.__AIVO_STATS_POLL_V9__){
      window.__AIVO_STATS_POLL_V9__ = true;
      setInterval(function(){
        try{
          patchStore();
          patchJobs();
          var c = readCredits();
          if (c != null){
            stats.total = c;
            if (stats.lastCredits == null) stats.lastCredits = c;
            persist();
          }
          paint();
        }catch(e){}
      }, 600);
    }

    window.addEventListener("beforeunload", function(){ try{persist();}catch(e){} });

    console.log("[STATS_V9] ready", { credits: readCredits(), ls: safeParse(loadRaw(KEY), null) });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
