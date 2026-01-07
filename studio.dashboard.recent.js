/* =========================================================
   DASHBOARD: SON İŞLER — FINAL v3 (SELF-HEALING DOM)
   - SPA timing sorununu çözer: mount gelene kadar bekler
   - List/Empty container yoksa kendisi oluşturur
   - window.__AIVO_RECENT_RENDER() her zaman çalışır
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBound) return;
  window.__aivoRecentJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }

  function getStore(){
    var s = window.AIVO_JOBS;
    if (!s || typeof s !== "object") return null;
    if (!Array.isArray(s.list)) return null;
    return s;
  }

  function esc(s){
    return String(s ?? "")
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
    if (st === "done" || st === "success" || st.includes("tamam")) return {t:"Tamamlandı", k:"done"};
    if (st === "error" || st === "failed"  || st.includes("hata"))  return {t:"Hata", k:"err"};
    if (st === "queued" || st.includes("kuyruk"))                   return {t:"Kuyrukta", k:"wait"};
    return {t:"Hazırlanıyor", k:"run"};
  }

  function timeText(ts){
    try{
      var d = new Date(ts || Date.now());
      if (isNaN(d.getTime())) return "az önce";
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

  function ensureDom(root){
    // list hedefi: önce mevcut seçiciler
    var listEl  = qs('[data-recent-jobs-list], .aivo-recent-list', root);
    var emptyEl = qs('[data-recent-jobs-empty], .aivo-empty', root);

    // yoksa kendimiz oluşturacağız (layout bozmayacak minimum)
    if (!listEl || !emptyEl){
      // root içinde bir "card" var mı? varsa onun içine koy
      var host = qs('.card', root) || root;

      if (!emptyEl){
        emptyEl = document.createElement("div");
        emptyEl.className = "aivo-empty";
        emptyEl.setAttribute("data-recent-jobs-empty","");

        emptyEl.innerHTML =
          '<div class="aivo-empty-text">' +
            '<div class="aivo-empty-title">Henüz bir iş yok</div>' +
            '<div class="aivo-empty-sub">İlk üretimden sonra burada görünecek.</div>' +
          '</div>';

        host.appendChild(emptyEl);
      }

      if (!listEl){
        listEl = document.createElement("div");
        listEl.className = "aivo-recent-list";
        listEl.setAttribute("data-recent-jobs-list","");
        listEl.hidden = true;
        host.appendChild(listEl);
      }
    }

    return { empty: emptyEl, list: listEl };
  }

  function getMount(){
    // asıl hedef: dashboard recent jobs section
    var m = qs('[data-dashboard-recent-jobs]');
    if (m) return m;

    // fallback: bazı revizelerde id/class değişmiş olabilir
    // Son İşler başlığı içeren bir blok varsa yakala
    var h = qs('.aivo-dash-block-title');
    if (h && /son işler/i.test(h.textContent || "")){
      // en yakın section/card
      var p = h.closest('section, .card, .aivo-dash-activity') || h.parentElement;
      return p || null;
    }
    return null;
  }

  function render(){
    var store = getStore();
    if (!store) return;

    var root = getMount();
    if (!root) return;

    var els = ensureDom(root);

    var list = store.list.slice(0, 5);

    if (!list.length){
      els.empty.hidden = false;
      els.list.hidden  = true;
      els.list.innerHTML = "";
      return;
    }

    els.empty.hidden = true;
    els.list.hidden  = false;

    var html = "";
    for (var i=0; i<list.length; i++){
      var j = list[i] || {};
      var st = statusLabel(j.status || j.state);
      html +=
        '<div class="aivo-recent-item is-in">' +
          '<div class="aivo-recent-left">' +
            '<div class="aivo-recent-ico">' + iconFor(j.type || j.kind || j.module) + '</div>' +
          '</div>' +
          '<div class="aivo-recent-mid">' +
            '<div class="aivo-recent-title">' + esc(j.title || j.name || "İş") + '</div>' +
            '<div class="aivo-recent-meta">' +
              '<span class="aivo-badge aivo-badge--' + esc(st.k) + '">' + esc(st.t) + '</span>' +
              '<span class="aivo-recent-time">' + esc(timeText(j.createdAt || j.ts || j.time || j.updatedAt)) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    els.list.innerHTML = html;
  }

  // dışarıdan tetik (debug)
  window.__AIVO_RECENT_RENDER = render;

  // 1) DOM hazır olunca dene
  function boot(){
    render();

    // 2) SPA’da sonradan mount gelirse yakala
    try{
      var mo = new MutationObserver(function(){
        render();
      });
      mo.observe(document.documentElement, { childList:true, subtree:true });
    }catch(e){}

    // 3) kısa süreli poll (Safari/SPA gecikmelerinde garanti)
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      render();
      if (getMount() && tries > 5) { clearInterval(t); }
      if (tries > 40) clearInterval(t);
    }, 250);

    // 4) store subscribe varsa bağla
    var store = getStore();
    if (store && typeof store.subscribe === "function"){
      try{ store.subscribe(function(){ render(); }); }catch(e){}
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
