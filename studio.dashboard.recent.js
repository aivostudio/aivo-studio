/* =========================================================
   DASHBOARD: SON İŞLER — FINAL (PAGE-AWARE + SAFE)
   - Sadece Dashboard AKTİF iken render eder
   - Page değişince otomatik yeniden render
   - AIVO_JOBS subscribe + manuel render hook
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBound) return;
  window.__aivoRecentJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isDashboardActive(){
    return document.body.getAttribute("data-active-page") === "dashboard";
  }

  function getMount(){
    return qs('[data-dashboard-recent-jobs]');
  }

  function getListEls(root){
    return {
      empty: qs('[data-recent-jobs-empty], .aivo-empty', root),
      list:  qs('[data-recent-jobs-list], .aivo-recent-list', root)
    };
  }

  function getStore(){
    var s = window.AIVO_JOBS;
    if (!s || typeof s !== "object") return null;
    if (typeof s.subscribe !== "function") return null;
    if (!Array.isArray(s.list) && typeof s.getList !== "function") return null;
    return s;
  }

  function normalizeList(store){
    var arr = Array.isArray(store.list)
      ? store.list
      : (store.getList ? store.getList() : []);
    return Array.isArray(arr) ? arr : [];
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
    type = String(type||"").toLowerCase();
    if (type.includes("music") || type.includes("müzik")) return "🎵";
    if (type.includes("video")) return "🎬";
    if (type.includes("cover") || type.includes("kapak")) return "🖼️";
    return "⚙️";
  }

  function statusLabel(st){
    st = String(st||"").toLowerCase();
    if (st === "done" || st === "success") return {t:"Tamamlandı", k:"done"};
    if (st === "error" || st === "failed")  return {t:"Hata", k:"err"};
    if (st === "queued")                    return {t:"Kuyrukta", k:"wait"};
    return {t:"Hazırlanıyor", k:"run"};
  }

  function timeText(ts){
    try{
      var d = new Date(ts || Date.now());
      var diff = Date.now() - d.getTime();
      if (diff < 60000) return "az önce";
      var m = Math.floor(diff/60000);
      if (m < 60) return m + " dk önce";
      var h = Math.floor(m/60);
      if (h < 24) return h + " sa önce";
      return Math.floor(h/24) + " gün önce";
    }catch(e){
      return "az önce";
    }
  }

  function render(){
    if (!isDashboardActive()) return;

    var root = getMount();
    if (!root) return;

    var els = getListEls(root);
    if (!els.empty || !els.list) return;

    var store = getStore();
    if (!store) return;

    var list = normalizeList(store).slice(0,5);

    if (!list.length){
      els.empty.hidden = false;
      els.list.hidden  = true;
      els.list.innerHTML = "";
      return;
    }

    els.empty.hidden = true;
    els.list.hidden  = false;

    var html = "";
    for (var i=0;i<list.length;i++){
      var j = list[i] || {};
      var st = statusLabel(j.status || j.state);
      html += (
        '<div class="aivo-recent-item is-in">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + iconFor(j.type) + '</div>' +
          '</div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(j.title || j.name || "İş") + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + st.k + '">' + st.t + '</span>' +
              '<span class="aivo-recent-time">' + timeText(j.createdAt || j.ts) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }
    els.list.innerHTML = html;
  }

  // ilk yük
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  // store update
  var store = getStore();
  if (store){
    try{
      store.subscribe(function(){
        render();
      });
    }catch(e){}
  }

  // page değişince render (CRITICAL FIX)
  document.addEventListener("aivo:page-change", function(){
    render();
  });

  // manuel debug hook
  window.__AIVO_RECENT_RENDER = render;

})();
