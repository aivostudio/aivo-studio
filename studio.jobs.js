/* =========================================================
   studio.jobs.js — AIVO JOBS (FINAL — STORE + UI MERGED)
   - SINGLE SOURCE OF TRUTH: window.AIVO_JOBS
   - Job pill UI (portal)
   - Music queued: SINGLE CARD + COUNTER (×N)
   - Dashboard-ready (subscribe)
   - Polling disabled
   ========================================================= */
(function () {
  "use strict";

  console.log("[AIVO_JOBS] booting (FINAL)...");

  /* =========================================================
     1) STORE (SOURCE OF TRUTH)
     ========================================================= */
  var _items = [];
  var _subs = [];

  function clone() {
    return _items.slice();
  }

  function notify() {
    var snap = clone();
    _subs.forEach(function (fn) {
      try { fn(snap); } catch (_) {}
    });
  }

  function sortDefault() {
    _items.sort(function (a, b) {
      return (b.created_at || 0) - (a.created_at || 0);
    });
  }

  /* =========================================================
     2) JOB UI (SENİN MEVCUT MANTIK — BOZULMADI)
     ========================================================= */
  var _jobsMap = new Map();

  var MUSIC_AGG_ID = "job-music-queued-agg";
  var musicQueuedCount = 0;

  function ensureContainer() {
    var el = document.getElementById("aivo-jobs");
    if (el) return el;

    el = document.createElement("div");
    el.id = "aivo-jobs";
    el.style.position = "fixed";
    el.style.top = "90px";
    el.style.right = "20px";
    el.style.zIndex = "2147483647";
    el.style.pointerEvents = "auto";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "10px";
    document.body.appendChild(el);
    return el;
  }

  function stylePill(el) {
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(20,20,30,.95)";
    el.style.color = "#fff";
    el.style.fontSize = "13px";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.outline = "1px solid rgba(167,126,255,.55)";
  }

  function ensurePulseCSS() {
    if (document.getElementById("aivo-jobs-pulse-css")) return;
    var st = document.createElement("style");
    st.id = "aivo-jobs-pulse-css";
    st.textContent =
      ".job--pulse{animation:aivoJobPulse .22s ease-out}" +
      "@keyframes aivoJobPulse{0%{transform:scale(.98)}100%{transform:scale(1)}}";
    document.head.appendChild(st);
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove("job--pulse");
    void el.offsetWidth;
    el.classList.add("job--pulse");
  }

  function renderMusicAgg(count) {
    ensurePulseCSS();
    var c = ensureContainer();

    var el = document.getElementById(MUSIC_AGG_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = MUSIC_AGG_ID;
      stylePill(el);
      c.appendChild(el);
    }

    el.textContent = "Müzik • Kuyrukta × " + count;
    pulse(el);
  }

  function renderJob(job) {
    var c = ensureContainer();
    var id = "job-" + job.id;

    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      stylePill(el);
      c.appendChild(el);
    }

    el.textContent = job.kind + " • " + job.status;
    pulse(el);
  }

  /* =========================================================
     3) PUBLIC API — window.AIVO_JOBS
     ========================================================= */
  window.AIVO_JOBS = {
    /* ---------- STORE ---------- */
    get list() {
      return clone();
    },

    setAll: function (arr) {
      _items = Array.isArray(arr) ? arr.slice() : [];
      sortDefault();
      notify();
    },

    upsert: function (job) {
      if (!job || !job.id) return;

      var idx = _items.findIndex(function (j) {
        return j.id === job.id;
      });

      if (idx === -1) {
        _items.unshift(job);
      } else {
        _items[idx] = Object.assign({}, _items[idx], job);
      }

      sortDefault();
      notify();
    },

    remove: function (id) {
      _items = _items.filter(function (j) {
        return j.id !== id;
      });
      notify();
    },

    subscribe: function (fn) {
      if (typeof fn !== "function") return;
      _subs.push(fn);
      fn(clone());
    },

    /* ---------- JOB UI ENTRY POINT ---------- */
    add: function (job) {
      var j = {
        id: String(job && job.job_id || ""),
        kind: job && job.type || "job",
        status: job && job.status || "queued",
        created_at: Date.now()
      };

      if (!j.id) return;

      // 🎵 MUSIC — SINGLE AGG CARD
      if (j.kind === "music" && j.status === "queued") {
        musicQueuedCount += 1;
        renderMusicAgg(musicQueuedCount);

        window.AIVO_JOBS.upsert({
          id: "music-queued",
          kind: "music",
          title: "Müzik Üretimi",
          status: "queued",
          created_at: Date.now()
        });
        return;
      }

      // Default job card
      renderJob(j);
      window.AIVO_JOBS.upsert(j);
    },

    /* ---------- BACKEND CREATE ---------- */
    create: async function (type, payload) {
      var res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ type: type }, payload || {}))
      });
      return res.json();
    }
  };

  console.log("[AIVO_JOBS] FINAL loaded OK");
})();
/* ================== START: AIVO_JOBS COMPAT + DASHBOARD RECENT (FINAL) ==================
   Problem: AIVO_JOBS.add var ama AIVO_JOBS.jobs/items/getState yok -> Dashboard okuyamıyor.
   Çözüm: AIVO_JOBS'a standart jobs[] + subscribe() + notify ekle, add() sonrası jobs'a yaz.
   Ayrıca Dashboard [data-dashboard-recent-jobs] içine son 5 işi bas.
========================================================================================= */
(function () {
  "use strict";

  if (window.__AIVO_JOBS_DASH_FINAL_BOUND) return;
  window.__AIVO_JOBS_DASH_FINAL_BOUND = true;

  function qs(sel){ return document.querySelector(sel); }
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function ensureJobShape(job){
    var j = job && typeof job === "object" ? job : {};
    if (!j.created_at) j.created_at = Date.now();
    if (!j.id && !j.job_id){
      j.id = "job_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    }
    if (!j.status) j.status = "queued";
    if (!j.type) j.type = "music";
    return j;
  }

  function iconFor(job){
    var t = String((job && job.type) || "").toLowerCase();
    if (t.indexOf("video") >= 0) return "🎬";
    if (t.indexOf("cover") >= 0 || t.indexOf("kapak") >= 0) return "🖼️";
    if (t.indexOf("hook") >= 0) return "🪝";
    if (t.indexOf("sm") >= 0 || t.indexOf("pack") >= 0 || t.indexOf("sosyal") >= 0) return "📦";
    return "🎵";
  }

  function renderDashboardRecent(){
    var host = qs('[data-dashboard-recent-jobs]');
    if (!host) return;

    var S = window.AIVO_JOBS;
    var jobs = (S && Array.isArray(S.jobs)) ? S.jobs : [];

    if (!jobs.length){
      host.innerHTML =
        '<div class="aivo-recent-empty">' +
          '<div class="aivo-recent-ico">✨</div>' +
          '<div>' +
            '<div class="aivo-recent-title">Henüz yok</div>' +
            '<div class="aivo-recent-sub">Üretim yaptıkça son işler burada görünecek.</div>' +
          '</div>' +
        '</div>';
      return;
    }

    // newest first, last 5
    var top = jobs.slice(-5).reverse();

    var html = "";
    for (var i=0;i<top.length;i++){
      var j = top[i] || {};
      var title = j.title || j.name || (j.type || "İş");
      var sub = j.prompt || j.summary || "";
      var st = j.status || "queued";

      html +=
        '<div class="aivo-recent-row">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + esc(iconFor(j)) + '</div>' +
            '<div style="min-width:0;">' +
              '<div class="aivo-recent-title">' + esc(title) + '</div>' +
              (sub ? '<div class="aivo-recent-sub">' + esc(sub) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="aivo-recent-right">' +
            '<span class="aivo-recent-badge">' + esc(st) + '</span>' +
          '</div>' +
        '</div>';
    }

    host.innerHTML = html;
  }

  function boot(){
    var S = window.AIVO_JOBS;
    if (!S || typeof S.add !== "function") return;

    // 1) Standart jobs listesi
    if (!Array.isArray(S.jobs)) S.jobs = [];

    // 2) subscribe/notify katmanı (yoksa ekle)
    if (!Array.isArray(S.__subs)) S.__subs = [];

    if (typeof S.subscribe !== "function"){
      S.subscribe = function (fn){
        if (typeof fn === "function") S.__subs.push(fn);
        // ilk anda da render etsin diye state döndür
        try{ fn({ jobs: S.jobs }); }catch(e){}
        return function(){
          try{
            var idx = S.__subs.indexOf(fn);
            if (idx >= 0) S.__subs.splice(idx, 1);
          }catch(e){}
        };
      };
    }

    function notify(){
      for (var i=0;i<S.__subs.length;i++){
        try{ S.__subs[i]({ jobs: S.jobs }); }catch(e){}
      }
    }

    // 3) add() wrap: orijinali çalıştır, sonra jobs'a yaz + notify + dashboard render
    if (!S.__dashWrapAdd){
      S.__dashWrapAdd = true;
      var _add = S.add;

      S.add = function(job){
        // önce orijinal add (portal pill vb. ne yapıyorsa bozulmasın)
        var ret = _add.apply(this, arguments);

        // sonra dashboard için standard jobs listesine ekle
        try{
          var j = ensureJobShape(job);
          S.jobs.push(j);
        }catch(e){}

        try{ notify(); }catch(e){}
        try{ renderDashboardRecent(); }catch(e){}

        return ret;
      };
    }

    // İlk render
    renderDashboardRecent();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
/* =================== END: AIVO_JOBS COMPAT + DASHBOARD RECENT (FINAL) =================== */

