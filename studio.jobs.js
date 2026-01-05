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
/* ========================= START: DASHBOARD RECENT JOBS BIND =========================
   - AIVO_JOBS.subscribe ile Dashboard "Son İşler" listesini doldurur
   - Sadece [data-dashboard-recent-jobs] içine yazar, DOM'u bozmaz
   - Empty state'i JS üretir (HTML'de demo satırları yok)
===================================================================================== */
(function bindDashboardRecentJobs(){
  "use strict";

  if (window.__aivoDashRecentBound) return;
  window.__aivoDashRecentBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function toMs(v){
    if (!v) return 0;
    if (typeof v === "number") return v;
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  function fmtTime(ts){
    var ms = toMs(ts);
    if (!ms) return "";
    try{
      var d = new Date(ms);
      // TR saat formatı (dakika net)
      return d.toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
    }catch(e){
      return "";
    }
  }

  function normStatus(job){
    var s = (job && (job.status || job.state)) || "";
    s = String(s).toLowerCase();
    if (!s) return "queued";
    return s;
  }

  function statusLabel(status){
    if (status === "done" || status === "completed" || status === "success") return "Tamamlandı";
    if (status === "running" || status === "processing") return "Üretiliyor";
    if (status === "failed" || status === "error") return "Hata";
    return "Kuyrukta";
  }

  function typeIcon(job){
    var t = String((job && (job.type || job.kind || job.product)) || "").toLowerCase();
    if (t.indexOf("video") >= 0) return "🎬";
    if (t.indexOf("cover") >= 0 || t.indexOf("kapak") >= 0) return "🖼️";
    if (t.indexOf("hook") >= 0) return "🪝";
    if (t.indexOf("sm") >= 0 || t.indexOf("pack") >= 0 || t.indexOf("sosyal") >= 0) return "📦";
    return "🎵"; // default: music
  }

  function titleText(job){
    // mümkün olduğunca esnek: title/name/prompt fallback
    var t = job && (job.title || job.name);
    if (t) return String(t);
    var kind = (job && (job.type || job.kind || job.product)) || "Müzik";
    return String(kind);
  }

  function subText(job){
    // kısa açıklama (prompt/summary/id)
    var p = job && (job.summary || job.prompt);
    if (p) return String(p);
    var id = job && (job.id || job.job_id);
    if (id) return "İş ID: " + String(id);
    return "";
  }

  function pickCreatedAt(job){
    return job && (job.created_at || job.createdAt || job.ts || job.created || job.time);
  }

  function getJobsSnapshot(){
    // AIVO_JOBS içinde jobs array’i ya da getState() olabilir
    try{
      if (!window.AIVO_JOBS) return [];
      if (typeof window.AIVO_JOBS.getState === "function"){
        var st = window.AIVO_JOBS.getState() || {};
        if (Array.isArray(st.jobs)) return st.jobs.slice();
        if (Array.isArray(st.items)) return st.items.slice();
      }
      if (Array.isArray(window.AIVO_JOBS.jobs)) return window.AIVO_JOBS.jobs.slice();
      if (Array.isArray(window.AIVO_JOBS.items)) return window.AIVO_JOBS.items.slice();
    }catch(e){}
    return [];
  }

  function render(container, jobs){
    if (!container) return;

    var listWrap = container.closest(".aivo-activity-list");
    if (listWrap) listWrap.classList.add("is-compact");

    var arr = Array.isArray(jobs) ? jobs.slice() : [];
    // newest first
    arr.sort(function(a,b){
      return (toMs(pickCreatedAt(b)) - toMs(pickCreatedAt(a)));
    });

    var top = arr.slice(0, 5);

    if (!top.length){
      container.innerHTML =
        '<div class="aivo-recent-empty">' +
          '<div class="aivo-recent-ico">✨</div>' +
          '<div>' +
            '<div class="aivo-recent-title">Henüz iş yok</div>' +
            '<div class="aivo-recent-sub">Üretime başladığında son işler burada görünecek.</div>' +
          '</div>' +
        '</div>';
      return;
    }

    var html = "";
    for (var i=0;i<top.length;i++){
      var j = top[i] || {};
      var st = normStatus(j);
      var when = fmtTime(pickCreatedAt(j));
      var badge = statusLabel(st);

      html +=
        '<div class="aivo-recent-row" data-job-row="' + esc(j.id || j.job_id || ("row-"+i)) + '">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + esc(typeIcon(j)) + '</div>' +
            '<div style="min-width:0;">' +
              '<div class="aivo-recent-title">' + esc(titleText(j)) + '</div>' +
              (subText(j) ? '<div class="aivo-recent-sub">' + esc(subText(j)) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="aivo-recent-right">' +
            '<span class="aivo-recent-badge" data-status="' + esc(st) + '">' + esc(badge) + '</span>' +
            (when ? '<span class="aivo-recent-time">' + esc(when) + '</span>' : '') +
          '</div>' +
        '</div>';
    }

    container.innerHTML = html;
  }

  function boot(){
    var host = qs('[data-dashboard-recent-jobs]');
    if (!host) return;

    // İlk render (sayfa açılır açılmaz eldeki snapshot)
    render(host, getJobsSnapshot());

    // Subscribe (store değiştikçe render)
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function(stateOrJobs){
        // Bazı store’lar direkt jobs array dönebilir; bazıları state döner
        var jobs = stateOrJobs;
        if (stateOrJobs && !Array.isArray(stateOrJobs)){
          if (Array.isArray(stateOrJobs.jobs)) jobs = stateOrJobs.jobs;
          else if (Array.isArray(stateOrJobs.items)) jobs = stateOrJobs.items;
          else jobs = getJobsSnapshot();
        }
        render(host, jobs);
      });
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
/* ========================== END: DASHBOARD RECENT JOBS BIND ========================== */
