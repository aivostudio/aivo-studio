/* =========================================================
   studio.stats.js — FINAL v12 (NO RESET ON REFRESH)
   - Fix: prevents counters/seen from being overwritten to zero on boot
   - Persist key: aivo_profile_stats_v1 (+ backup)
   - Counts on job add/create/upsert using job_id prefix music-/cover-/video-
   - Spent/Total: hooks AIVO_STORE_V1 (prefer consumeCredits(amount), else delta)
   ========================================================= */
(function(){
  "use strict";
  if (window.__AIVO_STATS_V12__) return;
  window.__AIVO_STATS_V12__ = true;

  var KEY="aivo_profile_stats_v1", BK="aivo_profile_stats_bk_v1";

  function safeParse(s,f){ try{return JSON.parse(String(s||""));}catch(e){return f;} }
  function clampInt(n){ n=Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
  function saveRaw(k,v){ try{localStorage.setItem(k,v);}catch(e){} }
  function now(){ return Date.now?Date.now():+new Date(); }

  // ---- UI root guard (only when profile stats card exists) ----
  function getRoot(){
    var el =
      document.querySelector('[data-stat="music"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="totalCredits"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }
  var ROOT = getRoot();
  if (!ROOT) return;

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{}, updatedAt:0 };
  }
  function isObj(o){ return o && typeof o==="object"; }
  function isNonZeroStats(o){
    return !!(o && (clampInt(o.music)||clampInt(o.cover)||clampInt(o.video)||clampInt(o.spent)));
  }
  function normSeen(seen){
    if (!isObj(seen)) return {};
    return seen;
  }

  // ---- load main/bk ----
  var main = safeParse(loadRaw(KEY), null);
  var bk   = safeParse(loadRaw(BK), null);

  // Prefer the "richer" one (non-zero wins); else fall back
  var base = empty();
  if (isObj(main)) base = Object.assign(base, main);
  if (!isNonZeroStats(base) && isObj(bk) && isNonZeroStats(bk)) base = Object.assign(base, bk);

  // Normalize
  base.music = clampInt(base.music);
  base.cover = clampInt(base.cover);
  base.video = clampInt(base.video);
  base.spent = clampInt(base.spent);
  base.total = (base.total==null?null:clampInt(base.total));
  base.lastCredits = (base.lastCredits==null?null:clampInt(base.lastCredits));
  base.seen = normSeen(base.seen);
  base.updatedAt = clampInt(base.updatedAt);

  // This is the only state we mutate
  var stats = base;

  // ---- merge guard: NEVER allow boot-time overwrite to lower values ----
  function mergeKeepMax(fromDisk){
    if (!isObj(fromDisk)) return;
    var d = Object.assign(empty(), fromDisk);
    d.music = clampInt(d.music); d.cover = clampInt(d.cover); d.video = clampInt(d.video);
    d.spent = clampInt(d.spent);
    d.total = (d.total==null?null:clampInt(d.total));
    d.lastCredits = (d.lastCredits==null?null:clampInt(d.lastCredits));
    d.seen = normSeen(d.seen);

    // keep max counters
    stats.music = Math.max(stats.music, d.music);
    stats.cover = Math.max(stats.cover, d.cover);
    stats.video = Math.max(stats.video, d.video);
    stats.spent = Math.max(stats.spent, d.spent);

    // keep total as latest non-null (prefer current)
    if (stats.total == null && d.total != null) stats.total = d.total;

    // lastCredits: keep current if set, else disk
    if (stats.lastCredits == null && d.lastCredits != null) stats.lastCredits = d.lastCredits;

    // seen: union (never drop)
    var s = stats.seen; var dk = d.seen;
    for (var k in dk) { if (dk.hasOwnProperty(k) && !s[k]) s[k] = dk[k]; }
    stats.seen = s;
  }

  // One more safety pass: in case some other script wrote zeros early
  mergeKeepMax(main);
  mergeKeepMax(bk);

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

  // Persist only if it does not reduce counters
  function persist(){
    // Before writing, re-read disk and keep max (prevents last-moment overwrite)
    var disk = safeParse(loadRaw(KEY), null);
    mergeKeepMax(disk);

    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
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

    // update total
    stats.total = cur;

    // delta fallback (never decrease spent)
    if (cur < prev) stats.spent = Math.max(stats.spent, stats.spent + (prev - cur));

    stats.lastCredits = cur;
    persist();
    paint();
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V12__) return;
    if (!window.AIVO_STORE_V1) return;

    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V12__ = true;

    var baseCredits = readCredits();
    if (baseCredits != null){
      stats.total = baseCredits;
      if (stats.lastCredits == null) stats.lastCredits = baseCredits;
      persist();
      paint();
    }

    function wrap(name){
      if (typeof S[name] !== "function") return;
      if (S[name].__aivo_patched_v12) return;

      var orig = S[name];
      S[name] = function(){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);

        // prefer explicit amount on consumeCredits(amount)
        if (name === "consumeCredits"){
          var amt = arguments && arguments.length ? clampInt(arguments[0]) : 0;
          if (amt > 0) stats.spent = Math.max(stats.spent, stats.spent + amt);
        }

        var res = orig.apply(this, arguments);

        var after = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S[name].__aivo_patched_v12 = true;
    }

    wrap("consumeCredits");
    wrap("setCredits");
    wrap("addCredits");

    console.log("[STATS_V12] store patched", { creditsNow: readCredits() });
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

    // seen: never reset; just add
    if (stats.seen[id]) return;

    var t = normalizeType(job);
    if (!t) return;

    if (t === "music") stats.music = Math.max(stats.music, stats.music + 1);
    else if (t === "cover") stats.cover = Math.max(stats.cover, stats.cover + 1);
    else if (t === "video") stats.video = Math.max(stats.video, stats.video + 1);
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
    if (window.__AIVO_STATS_PATCH_JOBS_V12__) return;
    if (!window.AIVO_JOBS) return;

    var J = window.AIVO_JOBS;
    window.__AIVO_STATS_PATCH_JOBS_V12__ = true;

    function wrap(name, handler){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v12) return;

      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);
        try{ handler.apply(null, arguments); }catch(e){}
        return res;
      };
      J[name].__aivo_patched_v12 = true;
    }

    wrap("add", function(a,b){
      var job = (arguments.length === 1) ? a : b;
      applyCreated(job);
    });

    wrap("create", function(a,b,c){
      if (arguments.length === 1){ applyCreated(a); return; }
      if (typeof a === "string" && (a === "music" || a === "cover" || a === "video")){
        var payload = b;
        if (payload && (payload.job_id || payload.id)) applyCreated(payload);
        return;
      }
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

    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v12){
      var _sub = J.subscribe;
      J.subscribe = function(fn){
        return _sub.call(this, function(payload){
          if (Array.isArray(payload)) scanList(payload);
          else if (payload && Array.isArray(payload.list)) scanList(payload.list);
          else if (payload && Array.isArray(payload.jobs)) scanList(payload.jobs);
          if (typeof fn === "function") fn(payload);
        });
      };
      J.subscribe.__aivo_patched_v12 = true;
    }

    if (Array.isArray(J.list)) scanList(J.list);

    console.log("[STATS_V12] jobs patched", { listLen: Array.isArray(J.list)?J.list.length:null, keys:Object.keys(J) });
  }

  function boot(){
    // First paint from disk (should show non-zero immediately)
    paint();

    patchStore();
    patchJobs();

    // Persist AFTER patches, but never reset counters
    persist();
    paint();

    if (!window.__AIVO_STATS_POLL_V12__){
      window.__AIVO_STATS_POLL_V12__ = true;
      setInterval(function(){
        try{
          if (!getRoot()) return;

          patchStore();
          patchJobs();

          // keep total updated
          var c = readCredits();
          if (c != null){
            stats.total = c;
            if (stats.lastCredits == null) stats.lastCredits = c;
            persist();
          }
          paint();
        }catch(e){}
      }, 800);
    }

    window.addEventListener("beforeunload", function(){ try{persist();}catch(e){} });
    console.log("[STATS_V12] ready", { credits: readCredits(), ls: safeParse(loadRaw(KEY), null) });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
