/* =========================================================
   studio.jobs.js — AIVO JOBS (FINAL — STORE + UI MERGED) — SINGLE
   - SINGLE SOURCE OF TRUTH: window.AIVO_JOBS
   - Job pill UI (portal)
   - Music queued: SINGLE CARD + COUNTER (×N)
   - Dashboard-ready (subscribe) + Dashboard recent render bind
   - Polling disabled
   - FIX: add() artık job_id zorunlu değil; id üretir + title/prompt store'a girer
   ========================================================= */
(function () {
  "use strict";

  console.log("[AIVO_JOBS] booting (FINAL/SINGLE)...");

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

  function makeId(prefix) {
    return String(prefix || "job") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  /* =========================================================
     2) JOB UI (SENİN MEVCUT MANTIK — BOZULMADI)
     ========================================================= */
  var _jobsMap = new Map(); // (şimdilik dokunmuyoruz)

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

    el.textContent = (job.kind || "job") + " • " + (job.status || "queued");
    pulse(el);
  }

  /* =========================================================
     3) PUBLIC API — window.AIVO_JOBS  (SINGLE)
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
      try { fn(clone()); } catch (_) {}
    },

    /* ---------- JOB UI ENTRY POINT ---------- */
    add: function (job) {
      // ✅ FIX: id artık job_id zorunlu değil
      var id =
        (job && (job.job_id || job.id)) ?
          String(job.job_id || job.id) :
          makeId((job && job.type) || "job");

      var j = {
        id: id,
        kind: (job && job.type) || "job",
        title: (job && job.title) || "",
        prompt: (job && job.prompt) || "",
        status: (job && job.status) || "queued",
        created_at: Date.now()
      };

      // 🎵 MUSIC — SINGLE AGG CARD (yalnız queued)
      if (j.kind === "music" && j.status === "queued") {
        musicQueuedCount += 1;
        renderMusicAgg(musicQueuedCount);

        window.AIVO_JOBS.upsert({
          id: "music-queued",
          kind: "music",
          title: "Müzik Üretimi",
          prompt: "",
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

  console.log("[AIVO_JOBS] FINAL/SINGLE loaded OK");
})();

/* =========================================================
   DASHBOARD: SON ISLER (FINAL BIND - STORE ALIGNED)
   - AIVO_JOBS.subscribe(fn) => fn(snapArray)
   - Target: [data-dashboard-recent-jobs]
   - Renders last 5
   ========================================================= */
(function () {
  if (window.__AIVO_DASH_RECENT_BOUND) return;
  window.__AIVO_DASH_RECENT_BOUND = true;

  function qs(sel){ return document.querySelector(sel); }
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function ico(kind){
    kind = String(kind||"").toLowerCase();
    if (kind.indexOf("video") >= 0) return "🎬";
    if (kind.indexOf("cover") >= 0 || kind.indexOf("kapak") >= 0) return "🖼️";
    if (kind.indexOf("hook") >= 0) return "🪝";
    if (kind.indexOf("sm") >= 0 || kind.indexOf("pack") >= 0 || kind.indexOf("sosyal") >= 0) return "📦";
    return "🎵";
  }

  function render(list){
    var host = qs('[data-dashboard-recent-jobs]');
    if (!host) return;

    var arr = Array.isArray(list) ? list.slice() : [];
    arr.sort(function(a,b){ return (b.created_at||0) - (a.created_at||0); });
    var top = arr.slice(0,5);

    if (!top.length){
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

    var html = "";
    for (var i=0;i<top.length;i++){
      var j = top[i] || {};
      var kind = j.kind || j.type || "job";
      var title = j.title || (kind === "music" ? "Müzik Üret" : kind);
      var sub = j.prompt || "";
      var st = j.status || "queued";

      html +=
        '<div class="aivo-recent-row">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + esc(ico(kind)) + '</div>' +
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
    if (!window.AIVO_JOBS) return;

    // ilk render
    try { render(window.AIVO_JOBS.list || []); } catch (_) {}

    // subscribe: store fn(snapArray) veriyor
    if (typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function (snap) {
        render(snap);
      });
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
