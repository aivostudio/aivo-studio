/* =========================================================
   studio.stats.js — FINAL v14 (NO RESET, FAST COUNT)
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Spent/Total: hooks AIVO_STORE_V1.consumeCredits/setCredits/addCredits
   - Counters: hooks AIVO_JOBS.* (+ GEN_BRIDGE fallback) -> count on FIRST SEEN job id
   ========================================================= */
(function(){
  "use strict";

  function safeParse(s,f){ try{return JSON.parse(String(s||""));}catch(e){return f;} }
  function clampInt(n){ n=Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
  function saveRaw(k,v){ try{localStorage.setItem(k,v);}catch(e){} }
  function now(){ return Date.now?Date.now():+new Date(); }

  function readAuth(){
    try { return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}"); }
    catch(e){ return {}; }
  }

  function getUserScope(){
    var auth = readAuth();
    var email = String((auth && auth.email) || "").trim().toLowerCase();
    if (!email) return "guest";
    return email.replace(/[^a-z0-9@._-]/g, "_");
  }

  function getKeys(){
    var scope = getUserScope();
    return {
      KEY: "aivo_profile_stats_v1:" + scope,
      BK:  "aivo_profile_stats_bk_v1:" + scope
    };
  }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{}, updatedAt:0 };
  }
  function isAllZero(o){ return !o || (!o.music && !o.cover && !o.video && !o.spent); }

  function loadStats(){
    var keys = getKeys();
    var main = safeParse(loadRaw(keys.KEY), null);
    var bk   = safeParse(loadRaw(keys.BK), null);

    var s = empty();
    if (main && typeof main==="object") s = Object.assign(s, main);
    if (isAllZero(s) && bk && typeof bk==="object" && !isAllZero(bk)) s = Object.assign(s, bk);

    s.music = clampInt(s.music);
    s.cover = clampInt(s.cover);
    s.video = clampInt(s.video);
    s.spent = clampInt(s.spent);
    s.total = (s.total==null?null:clampInt(s.total));
    s.lastCredits = (s.lastCredits==null?null:clampInt(s.lastCredits));
    if (!s.seen || typeof s.seen !== "object") s.seen = {};
    s.updatedAt = clampInt(s.updatedAt);

    return s;
  }

  var stats = loadStats();

  function persist(){
    var keys = getKeys();
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(keys.KEY, json);
    saveRaw(keys.BK,  json);
  }
  window.addEventListener("aivo:profile-stats-updated", function(ev){
    try{
      var detail = (ev && ev.detail) || {};
      var auth = readAuth();
      var currentEmail = String((auth && auth.email) || "").trim().toLowerCase();
      var incomingEmail = String(detail.email || "").trim().toLowerCase();

      if (!currentEmail || !incomingEmail) return;
      if (currentEmail !== incomingEmail) return;

      var incoming = detail.stats;
      if (!incoming || typeof incoming !== "object") return;

      stats.music = clampInt(incoming.music);
      stats.cover = clampInt(incoming.cover);
      stats.video = clampInt(incoming.video);
      stats.spent = clampInt(incoming.spent);
      stats.total = (incoming.total == null ? stats.total : clampInt(incoming.total));
      stats.lastCredits = (incoming.lastCredits == null ? stats.lastCredits : clampInt(incoming.lastCredits));
      stats.seen = (incoming.seen && typeof incoming.seen === "object") ? incoming.seen : (stats.seen || {});
      stats.updatedAt = clampInt(incoming.updatedAt || now());

      persist();
      paint();
    }catch(e){}
  });
  // UI root (only inside usage card)
  function getRoot(){
    var el =
      document.querySelector('[data-stat="music"]') ||
      document.querySelector('[data-stat="cover"]') ||
      document.querySelector('[data-stat="video"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="totalCredits"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.parentElement || null;
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

  // credits (spent/total)
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
    persist(); paint();
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V14__) return;
    if (!window.AIVO_STORE_V1) return;
    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V14__ = true;

    var base = readCredits();
    if (base != null){
      stats.total = base;
      if (stats.lastCredits == null) stats.lastCredits = base;
      persist(); paint();
    }

function wrap(name){
  if (typeof S[name] !== "function") return;
  if (S[name].__aivo_patched_v14) return;
  var orig = S[name];
  S[name] = function(){
    var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
    var res = orig.apply(this, arguments);
    var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;

    onCreditsChanged(before, after);

    if (window.AIVO_STORE_V1 && typeof AIVO_STORE_V1.syncCreditsUI === "function") {
      AIVO_STORE_V1.syncCreditsUI();
    }

   return res;
};
S[name].__aivo_patched_v14 = true;
}
wrap("consumeCredits");
wrap("setCredits");
wrap("addCredits");
}



  // -------- counters: count on first seen job id (NO DONE wait)
  function jobId(job){
    return String((job && (job.job_id || job.id || job.uid)) || "");
  }
  function normalizeTypeFromIdOrJob(job){
    var id = jobId(job).toLowerCase();
    var t  = String((job && (job.type || job.kind || job.product || job.page || job.module)) || "").toLowerCase();

    if (id.indexOf("music-")===0) return "music";
    if (id.indexOf("cover-")===0) return "cover";
    if (id.indexOf("video-")===0) return "video";

    if (t === "music" || t.indexOf("muzik")>=0) return "music";
    if (t === "cover" || t.indexOf("kapak")>=0) return "cover";
    if (t === "video") return "video";
    return "";
  }

  function applyJob(job){
    if (!job) return;
    var id = jobId(job);
    if (!id) return;
    if (stats.seen[id]) return;

    var type = normalizeTypeFromIdOrJob(job);
    if (!type) return;

    if (type === "music") stats.music++;
    else if (type === "cover") stats.cover++;
    else if (type === "video") stats.video++;

    stats.seen[id] = now();
    persist(); paint();
  }

  function scanList(list){
    if (!Array.isArray(list)) return;
    for (var i=0;i<list.length;i++) applyJob(list[i]);
  }
     function bindDirectJobEvents(){
    if (window.__AIVO_STATS_DIRECT_EVENTS_V14__) return;
    window.__AIVO_STATS_DIRECT_EVENTS_V14__ = true;

    window.addEventListener("aivo:job", function(ev){
      try{
        var job = (ev && ev.detail) || null;
        if (!job) return;
        applyJob(job);
      }catch(e){}
    });

    window.addEventListener("aivo:cover:job_created", function(ev){
      try{
        var detail = (ev && ev.detail) || null;
        if (!detail) return;

        applyJob({
          id: detail.job_id || detail.id || "",
          job_id: detail.job_id || detail.id || "",
          type: "cover",
          kind: "cover"
        });
      }catch(e){}
    });
  }
  function patchJobs(){
    if (window.__AIVO_STATS_PATCH_JOBS_V14__) return;
    if (!window.AIVO_JOBS) return;

    var J = window.AIVO_JOBS;
    window.__AIVO_STATS_PATCH_JOBS_V14__ = true;

    function wrap(name){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v14) return;

      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);
        try{
          // upsert(job) OR upsert(id, job) OR add(job)/create(job)
          if (name === "upsert" || name === "add" || name === "create"){
            var job = (arguments.length===1) ? arguments[0] : arguments[1];
            applyJob(job);
          } else {
            if (Array.isArray(J.list)) scanList(J.list);
          }
        }catch(e){}
        return res;
      };
      J[name].__aivo_patched_v14 = true;
    }

    wrap("upsert");
    wrap("add");
    wrap("create");
    wrap("setAll");
    wrap("remove");

    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v14){
      var _sub = J.subscribe;
      J.subscribe = function(fn){
        return _sub.call(this, function(payload){
          try{
            if (Array.isArray(payload)) scanList(payload);
            else if (payload && Array.isArray(payload.list)) scanList(payload.list);
            else if (payload && Array.isArray(payload.jobs)) scanList(payload.jobs);
          }catch(e){}
          if (typeof fn === "function") fn(payload);
        });
      };
      J.subscribe.__aivo_patched_v14 = true;
    }

    if (Array.isArray(J.list)) scanList(J.list);
  }

  // GEN_BRIDGE fallback (senin loglarda vardı)
  function patchGenBridge(){
    if (window.__AIVO_STATS_PATCH_GENBRIDGE_V14__) return;
    if (!window.GEN_BRIDGE) return;

    window.__AIVO_STATS_PATCH_GENBRIDGE_V14__ = true;
    try{
      var GB = window.GEN_BRIDGE;

      // yaygın pattern: GEN_BRIDGE.write(type, job) / GEN_BRIDGE.emit(...)
      ["write","emit","push","add"].forEach(function(fn){
        if (typeof GB[fn] !== "function") return;
        if (GB[fn].__aivo_patched_v14) return;

        var orig = GB[fn];
        GB[fn] = function(){
          var res = orig.apply(this, arguments);
          try{
            // args: (type, jobId) OR (type, jobObj) OR (jobObj)
            var a0 = arguments[0], a1 = arguments[1];
            if (a1 && typeof a1 === "object") applyJob(a1);
            else if (typeof a1 === "string") applyJob({ id: a1, type: String(a0||"") });
            else if (a0 && typeof a0 === "object") applyJob(a0);
          }catch(e){}
          return res;
        };
        GB[fn].__aivo_patched_v14 = true;
      });
    }catch(e){}
  }

  function boot(){
    persist(); paint();

    if (!window.__AIVO_STATS_POLL_V14__){
      window.__AIVO_STATS_POLL_V14__ = true;
      setInterval(function(){
        try{
          patchStore();
          patchJobs();
          patchGenBridge();

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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
