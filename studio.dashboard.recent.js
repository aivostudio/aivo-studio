/* =========================================================
   DASHBOARD: SON İŞLER — FINAL v2 (ACTIVE-PAGE ROBUST + SAFE)
   - data-active-page bozuk kalsa bile .page.is-active üzerinden anlar
   - Sadece Dashboard aktifken render eder
   - AIVO_JOBS subscribe + manuel render hook
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBound) return;
  window.__aivoRecentJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }

  function getActivePage(){
    // 1) En güvenilir: .page.is-active
    var active = qs('.page.is-active[data-page]');
    if (active) return active.getAttribute("data-page") || "";
    // 2) Fallback: body attr
    return document.body.getAttribute("data-active-page") || "";
  }

  function isDashboardActive(){
    var p = String(getActivePage() || "").toLowerCase();
    if (p === "dashboard") return true;

    // 3) Son fallback: dashboard mount görünür mü?
    // (SPA’da bazen active class geç gelir)
    var mount = qs('[data-dashboard-recent-jobs]');
    if (!mount) return false;

    // Eğer dashboard page'i display:none değilse kabul et
    var dashPage = mount.closest('.page[data-page="dashboard"]');
    if (dashPage){
      var cs = window.getComputedStyle(dashPage);
      if (cs && cs.display !== "none" && cs.visibility !== "hidden") return true;
    }
    return false;
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
    if (type.indexOf("music") > -1 || type.indexOf("müzik") > -1) return "🎵";
    if (type.indexOf("video") > -1) return "🎬";
    if (type.indexOf("cover") > -1 || type.indexOf("kapak") > -1) return "🖼️";
    return "⚙️";
  }

  function statusLabel(st){
    st = String(st||"").toLowerCase();
    if (st === "done" || st === "success" || st.indexOf("tamam") > -1) return {t:"Tamamlandı", k:"done"};
    if (st === "error" || st === "failed" || st.indexOf("hata") > -1)  return {t:"Hata", k:"err"};
    if (st === "queued" || st.indexOf("kuyruk") > -1)                    return {t:"Kuyrukta", k:"wait"};
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

    var list = normalizeList(store).slice(0, 5);

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
      var title = j.title || j.name || "İş";
      html += (
        '<div class="aivo-recent-item is-in">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + iconFor(j.type || j.kind) + '</div>' +
          '</div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(title) + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + st.k + '">' + esc(st.t) + '</span>' +
              '<span class="aivo-recent-time">' + esc(timeText(j.createdAt || j.ts || j.time || j.updatedAt)) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }
    els.list.innerHTML = html;
  }

  // ilk render
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ render(); });
  } else {
    render();
  }

  // store subscribe
  var store = getStore();
  if (store){
    try{
      store.subscribe(function(){ render(); });
    }catch(e){}
  }

  // manuel debug hook
  window.__AIVO_RECENT_RENDER = render;

})();
