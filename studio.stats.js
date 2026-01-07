/* =========================================================
   studio.stats.js — FINAL v12
   - UI: data-stat="music|cover|video|spentCredits|totalCredits|progress"
   - Persist: localStorage aivo_profile_stats_v1 (+ backup)
   - Spent/Total: hooks AIVO_STORE_V1.consumeCredits/setCredits/addCredits
   - Counters: hooks AIVO_JOBS.upsert/setAll/remove + subscribe
   - Reset: dark in-card confirm (NO window.confirm) + clearedAt flag
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
    return {
      music:0, cover:0, video:0,
      spent:0,
      total:null,
      lastCredits:null,
      seen:{},
      updatedAt:0,
      clearedAt:0 // ✅ reset bayrağı
    };
  }
  function isAllZero(o){
    return !o || (!o.music && !o.cover && !o.video && !o.spent);
  }

  // ---------- load (BK fallback ONLY if not cleared) ----------
  var main = safeParse(loadRaw(KEY), null);
  var bk   = safeParse(loadRaw(BK), null);

  var stats = empty();
  if (main && typeof main==="object") stats = Object.assign(stats, main);

  // Eğer main "tamamen 0" ise ama clearedAt VARSA bu reset'tir → BK'ya düşme
  var mainCleared = !!(main && main.clearedAt);

  if (!mainCleared && isAllZero(stats) && bk && typeof bk==="object" && !isAllZero(bk)){
    stats = Object.assign(stats, bk);
  }

  // normalize
  stats.music = clampInt(stats.music);
  stats.cover = clampInt(stats.cover);
  stats.video = clampInt(stats.video);
  stats.spent = clampInt(stats.spent);
  stats.total = (stats.total==null?null:clampInt(stats.total));
  stats.lastCredits = (stats.lastCredits==null?null:clampInt(stats.lastCredits));
  if (!stats.seen || typeof stats.seen !== "object") stats.seen = {};
  stats.updatedAt = clampInt(stats.updatedAt);
  stats.clearedAt = clampInt(stats.clearedAt);

  function persist(){
    stats.updatedAt = now();
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json); // backup aynı state’i taşısın (reset dahil)
  }

  // ---------- UI root: only inside usage card ----------
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

  // ---------- credits ----------
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

    // total her zaman store’dan
    stats.total = cur;

    // delta harcama
    if (cur < prev) stats.spent += (prev - cur);

    stats.lastCredits = cur;
    persist();
    paint();
  }

  function patchStore(){
    if (window.__AIVO_STATS_PATCH_STORE_V12__) return;
    if (!window.AIVO_STORE_V1) return;

    var S = window.AIVO_STORE_V1;
    window.__AIVO_STATS_PATCH_STORE_V12__ = true;

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
      if (S[name].__aivo_patched_v12) return;

      var orig = S[name];
      S[name] = function(){
        var before = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : (stats.lastCredits==null?0:stats.lastCredits);
        var res = orig.apply(this, arguments);
        var after  = (typeof S.getCredits==="function") ? clampInt(S.getCredits()) : before;
        onCreditsChanged(before, after);
        return res;
      };
      S[name].__aivo_patched_v12 = true;
    }

    wrap("consumeCredits");
    wrap("setCredits");
    wrap("addCredits");
  }

  // ---------- JOBS -> counters ----------
  function jobId(job){
    return String((job && (job.job_id || job.id || job.uid)) || "");
  }
  function jobStatus(job){
    return String((job && (job.status || job.state)) || "").toLowerCase();
  }
  function normalizeType(job){
    // job.type/kind/product/page/module
    var t = String((job && (job.type || job.kind || job.product || job.page || job.module)) || "").toLowerCase();

    // id prefix fallback: music- / cover- / video-
    var id = jobId(job).toLowerCase();
    if (!t && id){
      if (id.indexOf("music-")===0) t="music";
      else if (id.indexOf("cover-")===0) t="cover";
      else if (id.indexOf("video-")===0) t="video";
    }

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
    if (window.__AIVO_STATS_PATCH_JOBS_V12__) return;
    if (!window.AIVO_JOBS) return;

    var J = window.AIVO_JOBS;
    window.__AIVO_STATS_PATCH_JOBS_V12__ = true;

    function wrap(name, getListAfter){
      if (typeof J[name] !== "function") return;
      if (J[name].__aivo_patched_v12) return;

      var orig = J[name];
      J[name] = function(){
        var res = orig.apply(this, arguments);
        try{
          if (name === "upsert" || name === "add" || name === "create"){
            var job = (arguments.length===1) ? arguments[0] : arguments[1];
            applyDone(job);
          } else {
            var list = getListAfter ? getListAfter() : (Array.isArray(J.list) ? J.list : null);
            scanList(list);
          }
        }catch(e){}
        return res;
      };
      J[name].__aivo_patched_v12 = true;
    }

    wrap("upsert", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("setAll", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("remove", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("add", function(){ return Array.isArray(J.list)?J.list:null; });
    wrap("create", function(){ return Array.isArray(J.list)?J.list:null; });

    if (typeof J.subscribe === "function" && !J.subscribe.__aivo_patched_v12){
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
      J.subscribe.__aivo_patched_v12 = true;
    }

    if (Array.isArray(J.list)) scanList(J.list);
  }

  // ---------- Reset (dark in-card confirm + clearedAt) ----------
  function ensureResetUI(){
    var root = getRoot();
    if (!root) return;

    // Button: varsa yakala, yoksa oluşturmuyoruz (sen ekledin zaten)
    var btn =
      root.querySelector('[data-stats-reset]') ||
      root.querySelector('[data-action="stats-reset"]') ||
      root.querySelector('button');

    // En güvenlisi: metinden yakala (senin butonun "İstatistikleri Sıfırla")
    if (btn && !/istatistikleri\s*sıfırla/i.test(btn.textContent || "")){
      var allBtns = Array.prototype.slice.call(root.querySelectorAll("button"));
      btn = null;
      for (var i=0;i<allBtns.length;i++){
        if (/istatistikleri\s*sıfırla/i.test(allBtns[i].textContent||"")) { btn = allBtns[i]; break; }
      }
    }
    if (!btn) return;

    if (btn.__aivoStatsResetBoundV12) return;
    btn.__aivoStatsResetBoundV12 = true;

    function closeDialog(dlg){ if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg); }

    function openDialog(){
      // in-card overlay (only inside card)
      var dlg = document.createElement("div");
      dlg.setAttribute("data-aivo-stats-reset-dialog", "1");
      dlg.style.position = "absolute";
      dlg.style.inset = "16px";
      dlg.style.display = "flex";
      dlg.style.alignItems = "center";
      dlg.style.justifyContent = "center";
      dlg.style.zIndex = "50";

      // root position
      var cs = window.getComputedStyle(root);
      if (cs.position === "static") root.style.position = "relative";

      dlg.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);border-radius:16px;"></div>' +
        '<div style="position:relative;max-width:520px;width:92%;border-radius:16px;padding:16px 16px 14px;background:rgba(20,24,40,.92);border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 50px rgba(0,0,0,.45)">' +
          '<div style="font-size:15px;font-weight:700;margin-bottom:6px;color:#fff">Kullanım istatistikleri sıfırlansın mı?</div>' +
          '<div style="font-size:13px;opacity:.85;color:#d7defa;line-height:1.35;margin-bottom:12px">' +
            'Müzik / Kapak / Video + Harcanan kredi sıfırlanır. <b>Toplam kredi etkilenmez.</b>' +
          '</div>' +
          '<div style="display:flex;gap:10px;justify-content:flex-end">' +
            '<button type="button" data-cancel style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);color:#fff;cursor:pointer">Vazgeç</button>' +
            '<button type="button" data-ok style="padding:10px 14px;border-radius:12px;background:linear-gradient(90deg, rgba(124,92,255,.85), rgba(67,205,255,.75));border:1px solid rgba(255,255,255,.12);color:#0b1020;font-weight:800;cursor:pointer">Tamam</button>' +
          '</div>' +
        '</div>';

      root.appendChild(dlg);

      function toast(msg){
        // küçük in-card toast
        var t = document.createElement("div");
        t.textContent = msg;
        t.style.position = "absolute";
        t.style.right = "16px";
        t.style.bottom = "16px";
        t.style.padding = "10px 12px";
        t.style.borderRadius = "12px";
        t.style.background = "rgba(20,24,40,.92)";
        t.style.border = "1px solid rgba(255,255,255,.10)";
        t.style.color = "#fff";
        t.style.fontSize = "13px";
        t.style.zIndex = "60";
        t.style.boxShadow = "0 14px 40px rgba(0,0,0,.35)";
        root.appendChild(t);
        setTimeout(function(){ try{ root.removeChild(t); }catch(e){} }, 1600);
      }

      dlg.querySelector("[data-cancel]").addEventListener("click", function(){ closeDialog(dlg); });
      dlg.querySelector("[data-ok]").addEventListener("click", function(){
        // ✅ reset (total untouched)
        stats.music = 0;
        stats.cover = 0;
        stats.video = 0;
        stats.spent = 0;
        stats.seen = {};
        stats.clearedAt = now(); // kritik: BK fallback’ı engeller

        persist();
        paint();
        closeDialog(dlg);
        toast("İstatistikler sıfırlandı.");
      });

      // backdrop click
      dlg.addEventListener("click", function(e){
        if (e.target === dlg) closeDialog(dlg);
      });
    }

    btn.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      openDialog();
    });
  }

  // ---------- boot ----------
  function boot(){
    persist();
    paint();

    if (!window.__AIVO_STATS_POLL_V12__){
      window.__AIVO_STATS_POLL_V12__ = true;
      setInterval(function(){
        try{
          patchStore();
          patchJobs();

          // total sync (store’dan)
          var c = readCredits();
          if (c != null){
            stats.total = c;
            if (stats.lastCredits == null) stats.lastCredits = c;
            persist();
          }
          paint();
          ensureResetUI();
        }catch(e){}
      }, 600);
    }

    window.addEventListener("beforeunload", function(){ try{persist();}catch(e){} });

    // first bind
    patchStore();
    patchJobs();
    ensureResetUI();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
