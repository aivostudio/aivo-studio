/* =========================================================
   DASHBOARD: SON İŞLER (MVP) — AIVO_JOBS -> UI (REVIZE / SAFE)
   - Mount: [data-dashboard-recent-jobs] (section veya container)
   - İçerik hedefleri:
       Prefer: [data-recent-jobs-empty] + [data-recent-jobs-list]
       Fallback: .aivo-empty + .aivo-recent-list
   - Store:
       Prefer: window.AIVO_JOBS { list:[], subscribe(fn) } veya { getList():[], subscribe(fn) }
       Store yoksa: empty state gösterir, sessizce çıkar
   - Render:
       Tek noktaya basar, DOM'u bozmaz
   - Debug:
       window.__AIVO_RECENT_RENDER() ile manuel render
   - Stabil:
       Tek bind guard + subscribe + hafif poll (subscribe yoksa da günceller)
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBound) return;
  window.__aivoRecentJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function getMount(){
    // dashboard section/container
    return qs('[data-dashboard-recent-jobs]');
  }

  function getTargets(mount){
    // Prefer data-attr
    var emptyEl = qs('[data-recent-jobs-empty]', mount);
    var listEl  = qs('[data-recent-jobs-list]', mount);

    // Fallback class
    if (!emptyEl) emptyEl = qs('.aivo-empty', mount);
    if (!listEl)  listEl  = qs('.aivo-recent-list', mount);

    return { emptyEl: emptyEl, listEl: listEl };
  }

  function getStore(){
    var s = window.AIVO_JOBS;
    if (!s || typeof s !== "object") return null;

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

  var __lastSig = "";

  function signature(list){
    // hafif değişim imzası (ilk 5 item)
    try{
      var s = "";
      for (var i=0; i<Math.min(5, list.length); i++){
        var j = list[i] || {};
        s += [
          j.id || j._id || "",
          j.status || j.state || "",
          j.updatedAt || j.createdAt || j.ts || ""
        ].join("|") + ";";
      }
      return s;
    } catch(e){
      return String(list.length);
    }
  }

  function render(){
    var mount = getMount();
    if (!mount) return;

    var t = getTargets(mount);
    var emptyEl = t.emptyEl;
    var listEl  = t.listEl;

    // hedef yoksa DOM'a dokunma (ama debug için sinyal bas)
    if (!emptyEl || !listEl) return;

    var store = getStore();
    if (!store){
      // store yoksa: empty state göster
      emptyEl.hidden = false;
      listEl.hidden  = true;
      listEl.innerHTML = "";
      return;
    }

    var list = normalizeList(store);
    var sig = signature(list);
    if (sig === __lastSig && !listEl.hidden) {
      // aynı data -> gereksiz DOM basma
      return;
    }
    __lastSig = sig;

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

    var html = "";
    for (var i=0; i<slice.length; i++){
      var j = slice[i] || {};
      var type  = j.type || j.kind || j.product || j.module || "job";
      var title = j.title || j.name || (String(type).toUpperCase());
      var st    = statusLabel(j.status || j.state);
      var when  = timeText(j.createdAt || j.ts || j.time || j.updatedAt);

      html += (
        '<div class="aivo-recent-item" data-ani="new">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico" aria-hidden="true">' + esc(iconFor(type)) + '</div>' +
          '</div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(title) + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + esc(st.k) + '">' + esc(st.t) + '</span>' +
              '<span class="aivo-recent-time">' + esc(when) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    listEl.innerHTML = html;

    // mini animasyon
    var items = listEl.querySelectorAll('.aivo-recent-item[data-ani="new"]');
    if (items && items.length){
      requestAnimationFrame(function(){
        for (var k=0; k<items.length; k++){
          items[k].classList.add("is-in");
        }
        setTimeout(function(){
          for (var k2=0; k2<items.length; k2++){
            items[k2].removeAttribute("data-ani");
          }
        }, 260);
      });
    }
  }

  // dışarıdan manuel render (debug)
  window.__AIVO_RECENT_RENDER = render;

  // ilk render
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  // subscribe (varsa)
  var store = getStore();
  if (store){
    try{
      store.subscribe(function(){
        render();
      });
    } catch(e){
      // sessiz
    }
  }

  // subscribe çalışmazsa diye hafif poll (2 sn)
  // (Dashboard "yaşıyor" hissine de katkı: data gelince kendiliğinden günceller)
  setInterval(function(){
    try{ render(); } catch(e){}
  }, 2000);

})();
