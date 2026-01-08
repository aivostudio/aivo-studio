/* =========================================================
   JOBS PANEL (MVP) — RIGHT PANEL RENDER (SAFE) v2
   - Sağ panel host'unu bulur ve içine basar
   - Host yoksa DOM'a dokunmaz
   - "aivo:jobs:open" event'i gelince render eder
   ========================================================= */
(function(){
  "use strict";
  if (window.__aivoJobsPanelBound) return;
  window.__aivoJobsPanelBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  // Sağ panel için en olası host: .right-panel (sende var)
  // Eğer farklıysa: data-jobs-panel ekleyerek netleştirebilirsin.
  function findHost(){
    return (
      qs('[data-jobs-panel]') ||
      qs('.right-panel') ||
      qs('.card.right-card') ||
      qs('.right-card') ||
      qs('[data-right-panel]') ||
      null
    );
  }

  function ensureJobsRoot(host){
    // Host'un içine bizim kökümüzü koyalım (müziklerim içeriğini ezmeden)
    var root = qs('.aivo-jobs-panel-root', host);
    if (!root){
      root = document.createElement("div");
      root.className = "aivo-jobs-panel-root";
      // sağ panelde içerik yapısı farklı olabilir; en güvenlisi sona eklemek
      host.appendChild(root);
    }
    return root;
  }

  function getJobs(){
    var list = (window.AIVO_JOBS && Array.isArray(window.AIVO_JOBS.list)) ? window.AIVO_JOBS.list : [];
    return list.slice().reverse(); // en yeni üstte
  }

  function render(){
    var host = findHost();
    if (!host) return;

    var root = ensureJobsRoot(host);
    var jobs = getJobs();

    if (!jobs.length){
      root.innerHTML =
        '<div style="padding:14px 14px 10px; opacity:.95;">' +
          '<div style="font-weight:700; font-size:14px; margin-bottom:6px;">Jobs / Çıktılar</div>' +
          '<div style="opacity:.75; font-size:12px;">Henüz çıktı yok. Yeni bir üretim başlatınca burada görünecek.</div>' +
        '</div>';
      return;
    }

    var items = jobs.slice(0, 20).map(function(j){
      var type = esc(j.type || j.kind || "job");
      var status = esc(j.status || "unknown");
      var title = esc(j.title || j.name || "");
      var when = esc(j.createdAt || j.created_at || "");
      return (
        '<div style="padding:10px 14px; border-top:1px solid rgba(255,255,255,.06);">' +
          '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">' +
            '<div style="font-weight:650; font-size:13px;">' + (title || type) + '</div>' +
            '<div style="opacity:.75; font-size:12px;">' + status + '</div>' +
          '</div>' +
          (when ? '<div style="opacity:.55; font-size:11px; margin-top:4px;">' + when + '</div>' : '') +
        '</div>'
      );
    }).join("");

    root.innerHTML =
      '<div style="padding:14px 14px 10px; opacity:.95;">' +
        '<div style="font-weight:700; font-size:14px;">Jobs / Çıktılar</div>' +
        '<div style="opacity:.65; font-size:12px; margin-top:4px;">Son 20 job</div>' +
      '</div>' +
      '<div>' + items + '</div>';
  }

  // Açılınca render
  window.addEventListener("aivo:jobs:open", render);

  // Jobs store varsa subscribe ile de güncelle
  try{
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function(){ render(); });
    }
  }catch(e){}

  // İlk yükte bir kez dene (host varsa empty state basar)
  render();
})();
/* =========================================================
   JOBS PANEL — OPEN BUTTON BIND (MVP)
   - data-action="open-jobs" tıklamasını yakalar
   - switchPage'e düşmez
   - Sağ paneli Jobs moduna alır
========================================================= */
(function(){
  "use strict";

  function onOpenJobs(e){
    var btn = e.target.closest('[data-action="open-jobs"]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var panel = document.querySelector('[data-jobs-panel]');
    if (!panel) {
      console.warn('[AIVO][JOBS] panel bulunamadı');
      return;
    }

    //içerik kontrolünü Jobs tarafına aldığımızı göstermek için:
    panel.classList.add('is-jobs-open');

    // DEBUG (şimdilik bırakıyoruz)
    console.log('[AIVO][JOBS] Jobs panel açıldı');
  }

  document.addEventListener('click', onOpenJobs, true);
})();
