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
/* =========================================================
   DASHBOARD: SON ISLER (FINAL BIND)
   - Target: [data-dashboard-recent-jobs]
   - AIVO_JOBS.subscribe(fn) => fn(snapArray)
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
/* =========================================================
   studio.jobs.js — ROBUST GLOBAL STORE (AIVO_JOBS)
   - Guarantees window.AIVO_JOBS exists BEFORE app uses it
   - list + subscribe + upsert + setAll + remove
   - Safe: DOM'a basmaz, sadece store sağlar
   ========================================================= */
(function(){
  "use strict";

  if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
    console.log("[AIVO_JOBS] already ready");
    return;
  }

  function now(){ return Date.now ? Date.now() : +new Date(); }
  function asStr(x){ return String(x == null ? "" : x); }
  function idOf(job){
    job = job || {};
    return asStr(job.job_id || job.id || job.uid || job.key || "");
  }

  var state = { list: [] };
  var subs = [];

  function notify(){
    for (var i=0;i<subs.length;i++){
      try { subs[i](state); } catch(e){}
    }
  }

  function subscribe(fn){
    if (typeof fn !== "function") return function(){};
    subs.push(fn);
    try { fn(state); } catch(e){}
    return function(){
      var ix = subs.indexOf(fn);
      if (ix >= 0) subs.splice(ix, 1);
    };
  }

  function upsert(job){
    if (!job) return null;

    // normalize
    if (!job.createdAt) job.createdAt = now();
    var id = idOf(job);

    // if no id, generate one (still stable enough for session)
    if (!id){
      id = "job-" + now() + "-" + Math.random().toString(16).slice(2);
      job.job_id = id;
    }

    // merge or insert
    var list = state.list;
    var found = -1;
    for (var i=0;i<list.length;i++){
      var jid = idOf(list[i]);
      if (jid && jid === id){ found = i; break; }
    }

    if (found >= 0){
      list[found] = Object.assign({}, list[found], job);
    } else {
      list.unshift(job);
      if (list.length > 300) list.length = 300; // cap
    }

    notify();
    return id;
  }

  function setAll(list){
    if (!Array.isArray(list)) list = [];
    state.list = list.slice(0, 300);
    notify();
  }

  function remove(jobId){
    jobId = asStr(jobId);
    if (!jobId) return;
    var list = state.list;
    for (var i=list.length-1;i>=0;i--){
      if (idOf(list[i]) === jobId) list.splice(i,1);
    }
    notify();
  }

  function getState(){ return state; }

  // Expose global
  window.AIVO_JOBS = {
    getState: getState,
    subscribe: subscribe,
    upsert: upsert,
    setAll: setAll,
    remove: remove,
    list: state.list
  };

  // Optional: accept pushed jobs from anywhere
  window.AIVO_JOBS_PUSH = function(job){ return upsert(job); };

  console.log("[AIVO_JOBS] ready", Object.keys(window.AIVO_JOBS));
})();
/* =========================================================
   AIVO SETTINGS → MUSIC AUTOPLAY (A-2 FINAL BIND)
   ========================================================= */
(function(){
  "use strict";

  function getMusicAutoplay(){
    try {
      var st = JSON.parse(localStorage.getItem("aivo_settings_v1") || "{}");
      return !!st.music_autoplay;
    } catch(e){
      return false;
    }
  }

  // Güvenli play denemesi (player globali yoksa sessizce çıkar)
  function tryAutoplay(){
    if (!getMusicAutoplay()) return;

    // En son render edilen audio elementini bul
    var audio = document.querySelector('audio');
    if (!audio) return;

    try {
      audio.play().catch(function(){});
    } catch(e){}
  }

  if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.subscribe !== "function") return;

  // Job lifecycle hook
  window.AIVO_JOBS.subscribe(function(job){
    if (!job) return;

    // sadece müzik ve tamamlanmış job
    if (job.type === "music" && job.status === "done") {
      // UI render biraz gecikebilir
      setTimeout(tryAutoplay, 120);
    }
  });
})();
/* =========================================================
   AIVO SETTINGS → MUSIC AUTOPLAY (A-2 FINAL BIND)
   - Job "music" + "done" olduğunda
   - music_autoplay true ise audio.play() dener
   ========================================================= */
(function(){
  "use strict";

  function getMusicAutoplay(){
    try {
      var st = JSON.parse(localStorage.getItem("aivo_settings_v1") || "{}");
      return !!st.music_autoplay;
    } catch(e){
      return false;
    }
  }

  // Player globali yoksa: sayfadaki audio elementinden güvenli autoplay dene
  function tryAutoplay(){
    if (!getMusicAutoplay()) return;

    var audio = document.querySelector("audio");
    if (!audio) return;

    try {
      var p = audio.play();
      if (p && typeof p.catch === "function") p.catch(function(){});
    } catch(e){}
  }

  if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.subscribe !== "function") return;

  window.AIVO_JOBS.subscribe(function(job){
    if (!job) return;

    // sadece müzik tamamlanınca
    if (job.type === "music" && job.status === "done"){
      // UI/audio render gecikebilir
      setTimeout(tryAutoplay, 150);
    }
  });
})();
// ================= AIVO ARCHIVE TEST (TEMP) =================
// Motorlar yokken download akışını test etmek için.
// Console'dan: AIVO_ARCHIVE_TEST_ADD()
window.AIVO_ARCHIVE_TEST_ADD = function () {
  try {
    var jobId = "job_test_" + Date.now();
    var outId = "out_test_" + Date.now();

    var item = {
      job_id: jobId,
      output_id: outId,
      title: "TEST ÇIKTI",
      kind: "test",
      status: "done",
      createdAt: Date.now()
    };

    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
      window.AIVO_JOBS.upsert(item);
    } else if (window.AIVO_JOBS && typeof window.AIVO_JOBS.setAll === "function") {
      window.AIVO_JOBS.setAll([item]);
    }

    if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.open === "function") {
      window.AIVO_JOBS_PANEL.open();
    } else if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.render === "function") {
      window.AIVO_JOBS_PANEL.render();
    }

    if (window.toast && typeof window.toast.success === "function") {
      window.toast.success("Test çıktı eklendi: İndir aktif olmalı");
    } else {
      alert("Test çıktı eklendi: İndir aktif olmalı");
    }
  } catch (e) {
    if (window.toast && typeof window.toast.error === "function") {
      window.toast.error("Test çıktı eklenemedi");
    } else {
      alert("Test çıktı eklenemedi");
    }
  }
};

