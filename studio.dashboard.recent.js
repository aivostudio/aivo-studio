/* =========================================================
   DASHBOARD: SON İŞLER (MVP) — AIVO_JOBS -> UI (FIX v4)
   - Öncelik: getList() (çoğu store burada gerçek referans döndürür)
   - Fallback: list (varsa)
   - subscribe(cb) cb’ye list verirse onu kullanır
   - window.__AIVO_RECENT_RENDER() ile manuel tetik
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBoundV4) return;
  window.__aivoRecentJobsBoundV4 = true;

  var MAX_ITEMS = 5;
  var _lastList = null;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  function isDashboardActive(){
    var p = (document.body && document.body.getAttribute("data-active-page")) || "";
    return String(p).toLowerCase() === "dashboard";
  }

  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function iconFor(type){
    type = String(type || "").toLowerCase();
    if (type.indexOf("music") > -1 || type.indexOf("müzik") > -1) return "🎵";
    if (type.indexOf("cover") > -1 || type.indexOf("kapak") > -1) return "🖼️";
    if (type.indexOf("video") > -1) return "🎬";
    return "⚙️";
  }

  function statusLabel(st){
    st = String(st || "").toLowerCase();
    if (st === "done" || st === "success" || st.indexOf("tamam") > -1) return {t:"Tamamlandı", k:"done"};
    if (st === "error" || st === "failed" || st.indexOf("hata") > -1) return {t:"Hata", k:"err"};
    if (st === "queued" || st.indexOf("kuyruk") > -1) return {t:"Kuyrukta", k:"wait"};
    return {t:"Hazırlanıyor", k:"run"};
  }

  function timeText(ts){
    try{
      var d = null;
      if (ts instanceof Date) d = ts;
      else if (typeof ts === "number") d = new Date(ts);
      else if (typeof ts === "string") d = new Date(ts);
      if (!d || isNaN(d.getTime())) return "az önce";
      var diff = Date.now() - d.getTime();
      if (diff < 60*1000) return "az önce";
      var min = Math.floor(diff/60000);
      if (min < 60) return min + " dk önce";
      var hr = Math.floor(min/60);
      if (hr < 24) return hr + " sa önce";
      var day = Math.floor(hr/24);
      return day + " gün önce";
    } catch(e){
      return "az önce";
    }
  }

  function getStore(){
    var s = window.AIVO_JOBS;
    if (!s || typeof s !== "object") return null;
    if (typeof s.subscribe !== "function") return null;
    if (typeof s.getList !== "function" && !Array.isArray(s.list)) return null;
    return s;
  }

  function readList(store){
    // ✅ 1) subscribe callback’i bir liste yolladıysa onu kullan
    if (Array.isArray(_lastList)) return _lastList;

    // ✅ 2) getList öncelikli
    if (typeof store.getList === "function"){
      var a = store.getList();
      if (Array.isArray(a)) return a;
    }

    // ✅ 3) fallback list
    if (Array.isArray(store.list)) return store.list;

    return [];
  }

  function resolveUI(){
    var mount = qs('[data-dashboard-recent-jobs]');
    if (!mount) return null;

    var emptyEl = qs('[data-recent-jobs-empty]', mount) || qs('.aivo-empty', mount);
    var listEl  = qs('[data-recent-jobs-list]', mount) || qs('.aivo-recent-list', mount);

    if (!listEl) return null; // senin HTML’in varsa burası zaten var olmalı
    if (!emptyEl) return null;

    return { mount: mount, emptyEl: emptyEl, listEl: listEl };
  }

  function render(){
    if (!isDashboardActive()) return;

    var ui = resolveUI();
    if (!ui) return;

    var store = getStore();
    if (!store) return;

    var list = readList(store);
    var slice = list.slice(0, clamp(MAX_ITEMS, 1, 10));

    if (!slice.length){
      ui.emptyEl.hidden = false;
      ui.listEl.hidden  = true;
      ui.listEl.innerHTML = "";
      return;
    }

    ui.emptyEl.hidden = true;
    ui.listEl.hidden  = false;

    var html = "";
    for (var i=0; i<slice.length; i++){
      var j = slice[i] || {};
      var type  = j.type || j.kind || j.product || j.module || "job";
      var title = j.title || j.name || (String(type).toUpperCase());
      var st    = statusLabel(j.status || j.state);
      var when  = timeText(j.createdAt || j.ts || j.time || j.updatedAt);

      html +=
        '<div class="aivo-recent-item" data-ani="new">' +
          '<div class="aivo-recent-left"><div class="aivo-recent-ico" aria-hidden="true">' + iconFor(type) + '</div></div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(title) + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + esc(st.k) + '">' + esc(st.t) + '</span>' +
              '<span class="aivo-recent-time">' + esc(when) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    ui.listEl.innerHTML = html;
  }

  window.__AIVO_RECENT_RENDER = function(){ try{ render(); } catch(e){} };

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  var store = getStore();
  if (store){
    try{
      store.subscribe(function(payload){
        // payload list ise yakala
        if (Array.isArray(payload)) _lastList = payload;
        else if (payload && Array.isArray(payload.list)) _lastList = payload.list;
        render();
      });
    } catch(e){}
  }

})();
