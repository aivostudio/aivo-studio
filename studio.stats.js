/* =========================================================
   studio.stats.js — FINAL v11 (PATCH STORE + PATCH JOBS add/create)
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Spent/Total: hooks AIVO_STORE_V1.consumeCredits/setCredits/addCredits
   - Counters: hooks AIVO_JOBS.add/create/upsert/setAll/remove/subscribe
   - Counts on CREATE (job added) using job_id prefix: music-/cover-/video-
   ========================================================= */
(function(){
  "use strict";
  if (window.__AIVO_STATS_V11__) return;
  window.__AIVO_STATS_V11__ = true;

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

  // ---- UI root guard (PROFILE card exists) ----
  function getRoot(){
    var el =
      document.querySelector('[data-stat="music"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="totalCredits"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }
  var ROOT = getRoot();
  if (!ROOT) return; // ✅ only run when profile stats card exists

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

  function paint(){
    ROOT = getRoot();
    if(!ROOT) return;

    var m = ROOT.querySelector('[data-stat="music"]');
    var c = ROOT.querySelector('[data-stat="cover"]');
    var v = ROOT.querySelector('[data-stat="video"]');
    var s = ROOT.querySelector('[data-stat="spentCredits"]');
    var t = ROOT.querySelector('[data-stat="totalCredits"]');
    var p = ROOT.querySelector('[data-stat="progress"]');

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

  // ---- credits ----
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
    if (cur < prev) stats.spent += (prev - cur); // delta fallback
    stats.lastCredits = cur;
    persist();
    paint();
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V11__) return;
    if (!window.AIVO_STORE_V1) return;

    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V11__ = true;

    var base = readCredits();
    if (base != null){
      stats.total = base;
      if (stats.lastCredits == null) stats.lastCredits = base;
      persist();
      paint();
    }

    function wrap(name){
      if (typeof S[name] !== "function") return;
      if (S[name].__aivo_patched_v11) return;

      var orig = S[name];
      S[name] = function(){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);

        // prefer explicit amount if consumeCredits(amount)
        if (name === "consumeCredits"){
          var amt = arguments && arguments.length ? clampInt(arguments[0]) : 0;
          if (amt > 0) stats.spent += amt;
        }

        var res = orig.apply(this, arguments);
        var after = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S[name].__aivo_patched_v11 = true;
    }

    wrap("consumeCredits");
    wrap("setCredits");
    wrap("addCredits");

    console.log("[STATS_V11] store patched", { creditsNow: readCredits() });
  }

  // ---- JOBS -> counters (COUNT ON CREATE/ADD) ----
  function jobId(job){
    if (!job) return "";
    if (typeof job === "string") return job;
    return String(job.job_id || job.id || job.uid || "");
  }

  function typeFromId(id){
    id = String(id||"").toLowerCase();
    if (id.indexOf("music-") === 0) return "music";
    if (id.indexOf("cover-") === 0) return "cover";
    if (id.indexOf("video-") === 0) return "video";
    return "";
  }

  function normalizeType(job){
    // prefer id prefix (senin loglarda bu net)
    var id = jobId(job);
    var byId = typeFromId(id);
    if (byId) return byId;

    var t = String((job && (job.type || job.kind || job.product || job.page || job.module)) || "").toLowerCase();
    if (t === "music" || t.indexOf("muzik") >= 0) return "music";
    if (t === "cover" || t.indexOf("kapak") >= 0 || t.indexOf("image") >= 0) return "cover";
    if (t === "video") return "video";
    return "";
  }

  function applyCreated(job){
    if (!job) return;

    var id = jobId(job);
    if (!id) return;
    if (stats.seen[id]) return;

    var t = normalizeType(job);
    if (!t) return;

    if (t === "music") stats.music++;
    else if (t === "cover") stats.cover++;
    else if (t === "video") stats.video++;
    else return;

    stats.seen[id] = now();
    persist();
    paint();
  }

  function scanList(list){
    if (!Array.isArray(list)) return;
    for (var i=0;i<list.length;i++) applyCreated(list[i]);
  }

  function patchJobs(){
    if (window.__AIVO_STATS_PATCH_JOBS_V11__) return;
    if (!window.AIVO_JOBS) return;

    var J = window.AIVO_JOBS;
    window.__AIVO_STATS_PATCH_JOBS_V11__ = true;

    function wrap(name, handler){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v11) return;

      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);
        try{ handler.apply(null, arguments); }catch(e){}
        return res;
      };
      J[name].__aivo_patched_v11 = true;
    }

    // ✅ your flow: add(job) / create(type,payload) / upsert(job)
    wrap("add", function(a,b){
      // add(job) or add(id, job)
      var job = (arguments.length === 1) ? a : b;
      applyCreated(job);
    });

    wrap("create", function(a,b,c){
      // patterns vary: create(job) / create(type, payload) / create(id, job)
      // If first arg is string "music/cover/video", synthesize an id if payload has it.
      if (arguments.length === 1){
        applyCreated(a);
        return;
      }
      if (typeof a === "string" && (a === "music" || a === "cover" || a === "video")){
        // payload might include id/job_id
        var payload = b;
        if (payload && (payload.job_id || payload.id)) applyCreated(payload);
        return;
      }
      // fallback: (id, job)
      if (typeof a === "string" && b && typeof b === "object") applyCreated(b);
    });

    wrap("upsert", function(a,b){
      var job = (arguments.length === 1) ? a : b;
      applyCreated(job);
    });

    wrap("setAll", function(list){
      if (Array.isArray(list)) scanList(list);
      else if (Array.isArray(J.list)) scanList(J.list);
    });

    wrap("remove", function(){
      if (Array.isArray(J.list)) scanList(J.list);
    });

    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v11){
      var _sub = J.subscribe;
      J.subscribe = function(fn){
        return _sub.call(this, function(payload){
          if (Array.isArray(payload)) scanList(payload);
          else if (payload && Array.isArray(payload.list)) scanList(payload.list);
          else if (payload && Array.isArray(payload.jobs)) scanList(payload.jobs);
          if (typeof fn === "function") fn(payload);
        });
      };
      J.subscribe.__aivo_patched_v11 = true;
    }

    if (Array.isArray(J.list)) scanList(J.list);

    console.log("[STATS_V11] jobs patched", { listLen: Array.isArray(J.list)?J.list.length:null, keys:Object.keys(J) });
  }

  function boot(){
    persist();
    paint();

    patchStore();
    patchJobs();

    if (!window.__AIVO_STATS_POLL_V11__){
      window.__AIVO_STATS_POLL_V11__ = true;
      setInterval(function(){
        try{
          if (!getRoot()) return;

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
      }, 700);
    }

    window.addEventListener("beforeunload", function(){ try{persist();}catch(e){} });
    console.log("[STATS_V11] ready", { credits: readCredits(), ls: safeParse(loadRaw(KEY), null) });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
