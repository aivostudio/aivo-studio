/* =========================================================
   DASHBOARD: SON İŞLER (MVP) — AIVO_JOBS -> UI (HARDENED)
   - Sadece Dashboard aktifken çalışır
   - [data-dashboard-recent-jobs] bulur
   - [data-recent-jobs-list] / empty yoksa kendisi oluşturur
   - AIVO_JOBS subscribe + MutationObserver ile “geç gelen DOM”u yakalar
   - Dış DOM’u bozmaz, yalnızca kendi mount içine yazar
   - Global debug: window.__AIVO_RECENT_RENDER()
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBoundV2) return;
  window.__aivoRecentJobsBoundV2 = true;

  var MAX_ITEMS = 5;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  function isDashboardActive(){
    // senin mimaride body[data-active-page] kullanılıyor
    var p = (document.body && document.body.getAttribute("data-active-page")) || "";
    return String(p).toLowerCase() === "dashboard";
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function safeParseDate(ts){
    try{
      if (ts instanceof Date) return ts;
      if (typeof ts === "number") return new Date(ts);
      if (typeof ts === "string") return new Date(ts);
    }catch(e){}
    return null;
  }

  function timeText(ts){
    var d = safeParseDate(ts);
    if (!d || isNaN(d.getTime())) return "az önce";
    var diff = now() - d.getTime();
    if (diff < 60*1000) return "az önce";
    var min = Math.floor(diff/60000);
    if (min < 60) return min + " dk önce";
    var hr = Math.floor(min/60);
    if (hr < 24) return hr + " sa önce";
    var day = Math.floor(hr/24);
    return day + " gün önce";
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

  // Mount ve hedef elemanları bul/yarat
  function resolveMount(){
    // 1) net hedef
    var mount = qs('[data-dashboard-recent-jobs]');
    if (!mount) return null;

    // Empty/list elementleri (farklı olasılıkları da destekle)
    var emptyEl = qs('[data-recent-jobs-empty]', mount) || qs('.aivo-empty', mount);
    var listEl  = qs('[data-recent-jobs-list]', mount) || qs('.aivo-recent-list', mount);

    // Eğer list yoksa: oluştur
    if (!listEl){
      listEl = document.createElement("div");
      listEl.className = "aivo-recent-list";
      listEl.setAttribute("data-recent-jobs-list", "");
      listEl.hidden = true;

      // tercihen kart içine ekle
      var card = qs('.aivo-dash-activity-card', mount) || mount;
      card.appendChild(listEl);
    }

    // Eğer empty yoksa: minimal empty oluştur (tasarım bozmadan)
    if (!emptyEl){
      emptyEl = document.createElement("div");
      emptyEl.className = "aivo-empty";
      emptyEl.setAttribute("data-recent-jobs-empty", "");
      emptyEl.innerHTML =
        '<div class="aivo-empty-text">' +
          '<div class="aivo-empty-title">Henüz bir iş yok</div>' +
          '<div class="aivo-empty-sub">İlk üretimini başlattığında burada görünecek.</div>' +
        '</div>';

      var card2 = qs('.aivo-dash-activity-card', mount) || mount;
      card2.insertBefore(emptyEl, card2.firstChild);
    }

    return { mount: mount, emptyEl: emptyEl, listEl: listEl };
  }

  function render(){
    if (!isDashboardActive()) return;

    var ui = resolveMount();
    if (!ui) return;

    var store = getStore();
    if (!store) return;

    var list = normalizeList(store);
    var slice = list.slice(0, clamp(MAX_ITEMS, 1, 10));

    if (!slice.length){
      ui.emptyEl.hidden = false;
      ui.listEl.hidden = true;
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
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico" aria-hidden="true">' + iconFor(type) + '</div>' +
          '</div>' +
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

    // mini animasyon (CSS olsa da olmasa da sorun çıkarmaz)
    var items = ui.listEl.querySelectorAll('.aivo-recent-item[data-ani="new"]');
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

  // Global debug / manuel tetik
  window.__AIVO_RECENT_RENDER = function(){
    try { render(); } catch(e) {}
  };

  // İlk render (dashboard’a geç gelinse bile)
  function scheduleRender(){
    try { render(); } catch(e) {}
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", scheduleRender);
  } else {
    scheduleRender();
  }

  // Store subscribe
  var store = getStore();
  if (store){
    try{
      store.subscribe(function(){
        scheduleRender();
      });
    } catch(e){}
  }

  // DOM geç geliyorsa yakala (SPA / dinamik render)
  var mo = null;
  try{
    mo = new MutationObserver(function(){
      if (!isDashboardActive()) return;
      // mount/list oluştuysa render et
      if (qs('[data-dashboard-recent-jobs]')) scheduleRender();
    });
    mo.observe(document.documentElement || document.body, { childList:true, subtree:true });
  } catch(e){}

  // Page değişimlerini de yakala (data-active-page attribute)
  try{
    var mo2 = new MutationObserver(function(){
      if (isDashboardActive()) scheduleRender();
    });
    mo2.observe(document.body, { attributes:true, attributeFilter:["data-active-page"] });
  } catch(e){}

})();
