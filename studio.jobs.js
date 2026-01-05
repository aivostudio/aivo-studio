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
/* ====================== START: DASHBOARD RECENT JOBS (BULLETPROOF) ======================
   - host: [data-dashboard-recent-jobs]
   - jobs kaynağı: AIVO_JOBS.getState().jobs | AIVO_JOBS.jobs | AIVO_JOBS.items | state.items
   - subscribe varsa dinler, yoksa add() wrap ile her eklemede render eder
   ===================================================================================== */
(function () {
  if (window.__AIVO_DASH_RECENT_BOUND) return;
  window.__AIVO_DASH_RECENT_BOUND = true;

  function qs(sel){ return document.querySelector(sel); }

  function getJobsSnapshot(){
    try{
      var S = window.AIVO_JOBS;
      if (!S) return [];

      if (typeof S.getState === "function"){
        var st = S.getState() || {};
        if (Array.isArray(st.jobs)) return st.jobs.slice();
        if (Array.isArray(st.items)) return st.items.slice();
      }

      if (Array.isArray(S.jobs)) return S.jobs.slice();
      if (Array.isArray(S.items)) return S.items.slice();
    }catch(e){}
    return [];
  }

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function render(){
    var host = qs('[data-dashboard-recent-jobs]');
    if (!host) return;

    var jobs = getJobsSnapshot();

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

    // son 5 (yeniden eskiye)
    var top = jobs.slice(-5).reverse();

    var html = "";
    for (var i=0;i<top.length;i++){
      var j = top[i] || {};
      var type = String(j.type || j.kind || j.product || "music").toLowerCase();
      var ico = (type.indexOf("video") >= 0) ? "🎬"
              : (type.indexOf("cover") >= 0 || type.indexOf("kapak") >= 0) ? "🖼️"
              : (type.indexOf("hook") >= 0) ? "🪝"
              : (type.indexOf("sm") >= 0 || type.indexOf("pack") >= 0) ? "📦"
              : "🎵";

      var title = j.title || j.name || j.type || "İş";
      var sub = j.prompt || j.summary || "";
      var status = j.status || j.state || "queued";

      html +=
        '<div class="aivo-recent-row">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + esc(ico) + '</div>' +
            '<div style="min-width:0;">' +
              '<div class="aivo-recent-title">' + esc(title) + '</div>' +
              (sub ? '<div class="aivo-recent-sub">' + esc(sub) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="aivo-recent-right">' +
            '<span class="aivo-recent-badge">' + esc(status) + '</span>' +
          '</div>' +
        '</div>';
    }

    host.innerHTML = html;
  }

  function boot(){
    if (!window.AIVO_JOBS) return;

    // ilk render
    render();

    // subscribe varsa bağla
    if (typeof window.AIVO_JOBS.subscribe === "function"){
      try{
        window.AIVO_JOBS.subscribe(function(){ render(); });
      }catch(e){}
    }

    // GARANTİ: subscribe çalışmasa bile add sonrası render
    if (typeof window.AIVO_JOBS.add === "function" && !window.AIVO_JOBS.__dashWrapAdd){
      window.AIVO_JOBS.__dashWrapAdd = true;
      var _add = window.AIVO_JOBS.add;
      window.AIVO_JOBS.add = function(){
        var r = _add.apply(this, arguments);
        try{ render(); }catch(e){}
        return r;
      };
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
/* ======================= END: DASHBOARD RECENT JOBS (BULLETPROOF) ======================= */
