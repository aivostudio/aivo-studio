/* =========================================================
   studio.stats.js — FINAL v8 (PATCH AIVO_APP + PATCH STORE)
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Spent: hooks AIVO_STORE_V1.consumeCredits/setCredits (ground truth)
   - Counters: hooks AIVO_APP generate* functions (ground truth)
   - SAFE: only writes inside stats card (data-stat root)
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
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, updatedAt:0 };
  }
  function isAllZero(o){
    if(!o) return true;
    return !o.music && !o.cover && !o.video && !o.spent;
  }

  // ---- load (main + backup restore)
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
  stats.updatedAt = clampInt(stats.updatedAt);

  function persist(){
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // ---- root by data-stat
  function getRoot(){
    var el =
      document.querySelector('[data-stat="totalCredits"]') ||
      document.querySelector('[data-stat="spentCredits"]') ||
      document.querySelector('[data-stat="music"]');
    if (!el) return null;
    return el.closest(".card") || el.closest(".profile-card") || el.closest(".usage-wrap") || el.parentElement || null;
  }

  // ---- UI paint
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

  // ---- credits helpers
  function readCredits(){
    try{
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function"){
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    }catch(e){}
    return null;
  }

  function setTotalFromStore(){
    var cur = readCredits();
    if (cur == null) return;
    stats.total = cur;
    if (stats.lastCredits == null) stats.lastCredits = cur; // initialize baseline
    persist();
  }

  // ---- spent update from absolute credits change (safe)
  function onCreditsChanged(prev, cur){
    prev = clampInt(prev);
    cur  = clampInt(cur);
    stats.total = cur;

    if (cur < prev){
      stats.spent += (prev - cur);
    }
    stats.lastCredits = cur;
    persist();
    paint();
  }

  // ---- PATCH STORE: consumeCredits + setCredits
  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V8__) return;
    if (!window.AIVO_STORE_V1) return;

    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V8__ = true;

    // baseline
    setTotalFromStore();
    paint();

    // wrap consumeCredits(amount, meta?)
    if (typeof S.consumeCredits === "function" && !S.consumeCredits.__aivo_patched_v8){
      var _consume = S.consumeCredits;
      S.consumeCredits = function(amount){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
        var res = _consume.apply(this, arguments);
        var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S.consumeCredits.__aivo_patched_v8 = true;
    }

    // wrap setCredits(next)
    if (typeof S.setCredits === "function" && !S.setCredits.__aivo_patched_v8){
      var _set = S.setCredits;
      S.setCredits = function(next){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
        var res = _set.apply(this, arguments);
        var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : clampInt(next);
        onCreditsChanged(before, after);
        return res;
      };
      S.setCredits.__aivo_patched_v8 = true;
    }

    // wrap addCredits (total changes)
    if (typeof S.addCredits === "function" && !S.addCredits.__aivo_patched_v8){
      var _add = S.addCredits;
      S.addCredits = function(delta){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
        var res = _add.apply(this, arguments);
        var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S.addCredits.__aivo_patched_v8 = true;
    }

    console.log("[STATS_V8] store patched", {
      creditsNow: (typeof S.getCredits==="function") ? S.getCredits() : null
    });
  }

  // ---- PATCH APP: generate* / createJob
  function inc(kind){
    if (kind === "music") stats.music++;
    else if (kind === "cover") stats.cover++;
    else if (kind === "video") stats.video++;
    else return;
    persist();
    paint();
  }

  function wrapFn(obj, name, kind){
    if (!obj || typeof obj[name] !== "function") return false;
    if (obj[name].__aivo_patched_v8) return true;

    var orig = obj[name];
    obj[name] = function(){
      // increment on call (attempt); credit delta will validate spend anyway
      inc(kind);
      return orig.apply(this, arguments);
    };
    obj[name].__aivo_patched_v8 = true;
    console.log("[STATS_V8] patched", name, "=>", kind);
    return true;
  }

  function patchApp(){
    if (!window.AIVO_APP) return;

    var A = window.AIVO_APP;

    // common names we used previously
    wrapFn(A, "generateMusic", "music");
    wrapFn(A, "generateCover", "cover");
    wrapFn(A, "generateVideo", "video");

    // alternative: nested namespaces
    if (A.music) wrapFn(A.music, "generate", "music");
    if (A.cover) wrapFn(A.cover, "generate", "cover");
    if (A.video) wrapFn(A.video, "generate", "video");
  }

  // ---- BOOT
  function boot(){
    window.__AIVO_STATS_V8__ = true;

    persist();
    paint();

    // poll: app/store may appear later
    if (!window.__AIVO_STATS_POLL_V8__){
      window.__AIVO_STATS_POLL_V8__ = true;

      setInterval(function(){
        try{
          patchStore();
          patchApp();
          // keep UI in sync even if something overwrites DOM
          setTotalFromStore();
          paint();
        }catch(e){}
      }, 600);
    }

    window.addEventListener("beforeunload", function(){ try{persist();}catch(e){} });

    console.log("[STATS_V8] ready", {
      ls: safeParse(loadRaw(KEY), null),
      storeCredits: readCredits()
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
