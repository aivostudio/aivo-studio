/* =========================================================
   DASHBOARD: SON İŞLER (MVP) — AIVO_JOBS -> UI
   - Sadece [data-dashboard-recent-jobs] içinde render eder
   - Empty state / liste otomatik geçiş
   - Yeni job gelince mini animasyon (abartısız)
   - AIVO_JOBS yoksa veya format uymuyorsa hiçbir şey yapmaz
   ========================================================= */
(function(){
  "use strict";

  // tek kez bağlan
  if (window.__aivoRecentJobsBound) return;
  window.__aivoRecentJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function getStore(){
    var s = window.AIVO_JOBS;
    if (!s) return null;
    if (typeof s !== "object") return null;
    // desteklenen iki olası API:
    // 1) { list: [], subscribe(fn) }
    // 2) { getList():[], subscribe(fn) }
    var hasList = Array.isArray(s.list);
    var hasGet  = (typeof s.getList === "function");
    var hasSub  = (typeof s.subscribe === "function");
    if (!hasSub) return null;
    if (!hasList && !hasGet) return null;
    return s;
  }

  function normalizeList(store){
    var arr = Array.isArray(store.list) ? store.list : (store.getList ? store.getList() : []);
    if (!Array.isArray(arr)) arr = [];
    return arr;
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
    // ts: Date | number(ms) | iso string | null
    try {
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

  function render(){
    var root = qs('[data-dashboard-recent-jobs]');
    if (!root) return;

    var emptyEl = qs('[data-recent-jobs-empty]', root);
    var listEl  = qs('[data-recent-jobs-list]', root);

    if (!emptyEl || !listEl) return;

    var store = getStore();
    if (!store) return;

    var list = normalizeList(store);

    // son 5
    var max = 5;
    var slice = list.slice(0, clamp(max, 1, 10));

    if (!slice.length){
      emptyEl.hidden = false;
      listEl.hidden  = true;
      listEl.innerHTML = "";
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden  = false;

    // basit, stabil HTML (innerHTML güvenli alan)
    var html = "";
    for (var i=0; i<slice.length; i++){
      var j = slice[i] || {};
      var type = j.type || j.kind || j.product || j.module || "job";
      var title = j.title || j.name || (String(type).toUpperCase());
      var st = statusLabel(j.status || j.state);
      var when = timeText(j.createdAt || j.ts || j.time || j.updatedAt);

      html += (
        '<div class="aivo-recent-item" data-ani="new">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico" aria-hidden="true">' + iconFor(type) + '</div>' +
          '</div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(title) + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + st.k + '">' + esc(st.t) + '</span>' +
              '<span class="aivo-recent-time">' + esc(when) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }
    listEl.innerHTML = html;

    // mini animasyon: ilk frame’de class ekle, sonra kaldır
    // (CSS yoksa bile sorun çıkarmaz)
    var items = listEl.querySelectorAll('.aivo-recent-item[data-ani="new"]');
    if (items && items.length){
      requestAnimationFrame(function(){
        for (var k=0; k<items.length; k++){
          items[k].classList.add("is-in");
        }
        // data-ani temizle
        setTimeout(function(){
          for (var k2=0; k2<items.length; k2++){
            items[k2].removeAttribute("data-ani");
          }
        }, 260);
      });
    }
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

  // ilk render
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  // store subscribe
  var store = getStore();
  if (store){
    try{
      store.subscribe(function(){
        render();
      });
    } catch(e){
      // subscribe arızalıysa sessiz kal
    }
  }

})();
