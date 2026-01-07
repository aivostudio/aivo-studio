/* =========================================================
   studio.stats.js — FINAL v14
   - Fix: total/lastCredits merge uses MAX so "total=0" can’t freeze forever
   - Persist lock remains (prevents reset)
   - Adds optional "İstatistikleri Sıfırla" button (confirm, does NOT touch total credits)
   ========================================================= */
(function(){
  "use strict";
  if (window.__AIVO_STATS_V14__) return;
  window.__AIVO_STATS_V14__ = true;

  var KEY="aivo_profile_stats_v1";
  var BK ="aivo_profile_stats_bk_v1";

  function safeParse(s,f){ try{return JSON.parse(String(s||""));}catch(e){return f;} }
  function clampInt(n){ n=Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function now(){ return Date.now?Date.now():+new Date(); }
  function isObj(o){ return o && typeof o==="object"; }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:0, lastCredits:0, seen:{}, updatedAt:0 };
  }
  function norm(o){
    o = Object.assign(empty(), isObj(o)?o:{});
    o.music = clampInt(o.music); o.cover = clampInt(o.cover); o.video = clampInt(o.video);
    o.spent = clampInt(o.spent);
    o.total = clampInt(o.total);
    o.lastCredits = clampInt(o.lastCredits);
    if (!isObj(o.seen)) o.seen = {};
    o.updatedAt = clampInt(o.updatedAt);
    return o;
  }
  function mergeMax(a,b){
    a = norm(a); b = norm(b);
    a.music = Math.max(a.music, b.music);
    a.cover = Math.max(a.cover, b.cover);
    a.video = Math.max(a.video, b.video);
    a.spent = Math.max(a.spent, b.spent);

    // ✅ critical: total & lastCredits are also MAX (prevents "0 freeze")
    a.total = Math.max(a.total, b.total);
    a.lastCredits = Math.max(a.lastCredits, b.lastCredits);

    for (var k in b.seen){
      if (b.seen.hasOwnProperty(k) && !a.seen[k]) a.seen[k]=b.seen[k];
    }
    return a;
  }
  function looksLikeReset(newObj, oldObj){
    newObj = norm(newObj); oldObj = norm(oldObj);
    var oldHas = (oldObj.music||oldObj.cover||oldObj.video);
    var newZero = (!newObj.music && !newObj.cover && !newObj.video);
    return !!(oldHas && newZero);
  }

  // ---- UI root guard (only profile stats card) ----
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

  function paint(st){
    ROOT = getRoot();
    if(!ROOT) return;

    var m = ROOT.querySelector('[data-stat="music"]');
    var c = ROOT.querySelector('[data-stat="cover"]');
    var v = ROOT.querySelector('[data-stat="video"]');
    var s = ROOT.querySelector('[data-stat="spentCredits"]');
    var t = ROOT.querySelector('[data-stat="totalCredits"]');
    var p = ROOT.querySelector('[data-stat="progress"]');

    if (m) m.textContent = String(st.music);
    if (c) c.textContent = String(st.cover);
    if (v) v.textContent = (st.video > 0 ? String(st.video) : "Henüz yok");
    if (s) s.textContent = String(st.spent);

    // ✅ total: show store credits if available, else st.total
    var liveTotal = readCredits();
    var shownTotal = (liveTotal != null && liveTotal > 0) ? liveTotal : st.total;
    if (t) t.textContent = String(clampInt(shownTotal));

    if (p){
      var denom = (shownTotal>0?shownTotal:0);
      var pct = 0;
      if (denom > 0) pct = Math.min(100, Math.round((st.spent / denom) * 100));
      p.style.width = pct + "%";
    }
  }

  // ---- Credits (store) ----
  function readCredits(){
    try{
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function"){
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    }catch(e){}
    return null;
  }

  // ---- Load initial ----
  var diskMain = safeParse(localStorage.getItem(KEY), null);
  var diskBk   = safeParse(localStorage.getItem(BK), null);
  var stats = mergeMax(diskMain, diskBk);

  // seed with live credits if present
  var live = readCredits();
  if (live != null && live > 0){
    stats.total = Math.max(stats.total, live);
    stats.lastCredits = Math.max(stats.lastCredits, live);
  }

  stats.updatedAt = now();
  localStorage.setItem(KEY, JSON.stringify(stats));
  localStorage.setItem(BK,  JSON.stringify(stats));
  paint(stats);

  // ---- HARD LOCK: intercept setItem/removeItem for our KEY ----
  (function lockStorage(){
    if (window.__AIVO_STATS_LOCKED_V14__) return;
    window.__AIVO_STATS_LOCKED_V14__ = true;

    var _set = Storage.prototype.setItem;
    var _rem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function(k, v){
      try{
        if (k === KEY || k === BK){
          var incoming = safeParse(v, null);
          var current  = safeParse(localStorage.getItem(KEY), null);

          if (incoming){
            if (looksLikeReset(incoming, current) && !window.__AIVO_STATS_RESET_TRACE_DONE_V14__){
              window.__AIVO_STATS_RESET_TRACE_DONE_V14__ = true;
              console.warn("[STATS_V14] BLOCKED RESET for", k, "incoming=", incoming, "current=", current);
              console.trace("[STATS_V14] Reset attempt stack trace");
            }

            var merged = mergeMax(current, incoming);

            // also merge live credits (prevents total=0)
            var lc = readCredits();
            if (lc != null && lc > 0){
              merged.total = Math.max(merged.total, lc);
              merged.lastCredits = Math.max(merged.lastCredits, lc);
            }

            merged.updatedAt = now();
            return _set.call(this, k, JSON.stringify(merged));
          }
        }
      }catch(e){}
      return _set.call(this, k, v);
    };

    Storage.prototype.removeItem = function(k){
      try{
        if ((k === KEY || k === BK) && !window.__AIVO_STATS_RESET_TRACE_DONE_V14__){
          window.__AIVO_STATS_RESET_TRACE_DONE_V14__ = true;
          console.warn("[STATS_V14] BLOCKED removeItem for", k);
          console.trace("[STATS_V14] removeItem stack trace");
        }
        if (k === KEY || k === BK) return;
      }catch(e){}
      return _rem.call(this, k);
    };

    console.log("[STATS_V14] storage lock active");
  })();

  function persist(){
    var cur = safeParse(localStorage.getItem(KEY), null);
    stats = mergeMax(cur, stats);

    // always bring live credits in
    var lc = readCredits();
    if (lc != null && lc > 0){
      stats.total = Math.max(stats.total, lc);
      stats.lastCredits = Math.max(stats.lastCredits, lc);
    }

    stats.updatedAt = now();
    localStorage.setItem(KEY, JSON.stringify(stats));
    localStorage.setItem(BK,  JSON.stringify(stats));
    paint(stats);
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V14__) return;
    if (!window.AIVO_STORE_V1) return;
    window.__AIVO_STATS_PATCH_STORE_V14__ = true;

    var S = window.AIVO_STORE_V1;

    function wrap(name){
      if (typeof S[name] !== "function") return;
      if (S[name].__aivo_patched_v14) return;

      var orig = S[name];
      S[name] = function(){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : stats.lastCredits;

        // prefer "consumeCredits(amount)" if used
        if (name === "consumeCredits"){
          var amt = arguments && arguments.length ? clampInt(arguments[0]) : 0;
          if (amt > 0) stats.spent += amt;
        }

        var res = orig.apply(this, arguments);

        var after = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        stats.total = Math.max(stats.total, after);
        stats.lastCredits = Math.max(stats.lastCredits, after);

        // fallback delta (if store decreases)
        if (after < before) stats.spent += (before - after);

        persist();
        return res;
      };
      S[name].__aivo_patched_v14 = true;
    }

    wrap("consumeCredits");
    wrap("setCredits");
    wrap("addCredits");

    var c = readCredits();
    if (c != null && c > 0){
      stats.total = Math.max(stats.total, c);
      stats.lastCredits = Math.max(stats.lastCredits, c);
      persist();
    }

    console.log("[STATS_V14] store patched", { creditsNow: readCredits() });
  }

  // ---- Jobs counters ----
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
  function applyCreated(job){
    var id = jobId(job);
    if (!id) return;
    if (stats.seen[id]) return;

    var t = typeFromId(id);
    if (!t) return;

    if (t === "music") stats.music++;
    else if (t === "cover") stats.cover++;
    else if (t === "video") stats.video++;

    stats.seen[id] = now();
    persist();
  }
  function scanList(list){
    if (!Array.isArray(list)) return;
    for (var i=0;i<list.length;i++) applyCreated(list[i]);
  }

  function patchJobs(){
    if (window.__AIVO_STATS_PATCH_JOBS_V14__) return;
    if (!window.AIVO_JOBS) return;
    window.__AIVO_STATS_PATCH_JOBS_V14__ = true;

    var J = window.AIVO_JOBS;

    function wrap(name, handler){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v14) return;
      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);
        try{ handler.apply(null, arguments); }catch(e){}
        return res;
      };
      J[name].__aivo_patched_v14 = true;
    }

    wrap("add", function(a,b){
      var job = (arguments.length === 1) ? a : b;
      applyCreated(job);
    });

    wrap("create", function(a,b){
      if (arguments.length === 1){ applyCreated(a); return; }
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

    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v14){
      var _sub = J.subscribe;
      J.subscribe = function(fn){
        return _sub.call(this, function(payload){
          if (Array.isArray(payload)) scanList(payload);
          else if (payload && Array.isArray(payload.list)) scanList(payload.list);
          else if (payload && Array.isArray(payload.jobs)) scanList(payload.jobs);
          if (typeof fn === "function") fn(payload);
        });
      };
      J.subscribe.__aivo_patched_v14 = true;
    }

    if (Array.isArray(J.list)) scanList(J.list);

    console.log("[STATS_V14] jobs patched", { listLen: Array.isArray(J.list)?J.list.length:null });
  }

  // ---- Reset button (optional) ----
  function ensureResetButton(){
    ROOT = getRoot();
    if(!ROOT) return;

    if (ROOT.querySelector("[data-stats-reset-btn]")) return;

    // place near header if possible, else at bottom
    var header = ROOT.querySelector(".card-header") || ROOT.querySelector(".card-head") || ROOT.querySelector(".aivo-dash-block-head");
    var host = header || ROOT;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-stats-reset-btn", "1");
    btn.className = "chip-btn"; // mevcut stilinle uyumlu
    btn.textContent = "İstatistikleri Sıfırla";

    // minimal spacing if header is flex
    btn.style.marginLeft = "12px";

    btn.addEventListener("click", function(){
      var ok = confirm("Kullanım istatistikleri sıfırlansın mı? (Müzik/Kapak/Video + Harcanan kredi)\nToplam kredi etkilenmez.");
      if (!ok) return;

      stats.music = 0;
      stats.cover = 0;
      stats.video = 0;
      stats.spent = 0;
      stats.seen = {};

      // keep total/lastCredits alive from store
      var lc = readCredits();
      if (lc != null && lc > 0){
        stats.total = Math.max(stats.total, lc);
        stats.lastCredits = Math.max(stats.lastCredits, lc);
      }

      persist();
    });

    // attach
    try{
      if (header) header.appendChild(btn);
      else ROOT.appendChild(btn);
    }catch(e){}
  }

  function boot(){
    patchStore();
    patchJobs();
    ensureResetButton();
    persist();

    if (!window.__AIVO_STATS_POLL_V14__){
      window.__AIVO_STATS_POLL_V14__ = true;
      setInterval(function(){
        try{
          if (!getRoot()) return;
          patchStore();
          patchJobs();
          ensureResetButton();
          persist();
        }catch(e){}
      }, 1200);
    }

    console.log("[STATS_V14] ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
