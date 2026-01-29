/* =========================================================
   studio.stats.js — FINAL v14 (NO RESET, FAST COUNT)
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

        // ❗️BURADA ARTIK UI ZORLAMA YOK
        // syncCreditsUI varsa bile sadece store içindir, topbar yazmaz
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

  function boot(){
    persist(); paint();

    if (!window.__AIVO_STATS_POLL_V14__){
      window.__AIVO_STATS_POLL_V14__ = true;
      setInterval(function(){
        try{
          patchStore();
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
