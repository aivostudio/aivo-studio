/* =========================================================
   JOBS PANEL (MVP) — EMPTY STATE + BASIC LIST (SAFE) v1
   - AIVO_JOBS.list = Array beklenir
   - Container bulunamazsa DOM'a dokunmaz
   - Double bind yok
   - Empty state: "Henüz çıktı yok" + CTA
   ========================================================= */
(function(){
  "use strict";
  if (window.__aivoJobsPanelBound) return;
  window.__aivoJobsPanelBound = true;

  // ---------- helpers ----------
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
   

  // ---------- find jobs panel container ----------
  // Senin HTML'de hangisi varsa yakalar (sağ panel / card / section)
  var host =
    qs('[data-jobs-panel]') ||
    qs('[data-panel="jobs"]') ||
    qs('[data-right-panel="jobs"]') ||
    qs('[data-jobs]') ||
    qs('[data-page="jobs"] [data-panel-body]');

  if (!host) return; // SAFE: container yoksa çık

  // ---------- styles (inline, SAFE scope) ----------
  function ensureStyle(){
    if (document.getElementById("aivo-jobs-panel-style")) return;
    var css =
      ".aivo-jobs-empty{padding:18px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}" +
      ".aivo-jobs-empty__title{font-size:15px;font-weight:700;letter-spacing:.2px}" +
      ".aivo-jobs-empty__sub{margin-top:6px;font-size:12.5px;opacity:.8;line-height:1.35}" +
      ".aivo-jobs-empty__cta{margin-top:12px;display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;" +
        "background:rgba(160,120,255,.22);border:1px solid rgba(160,120,255,.35);color:#fff;font-weight:700;font-size:12.5px;cursor:pointer}" +
      ".aivo-jobs-empty__cta:hover{filter:brightness(1.06)}" +
      ".aivo-jobs-list{display:flex;flex-direction:column;gap:10px}" +
      ".aivo-jobs-item{padding:12px 12px;border-radius:14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08)}" +
      ".aivo-jobs-item__top{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
      ".aivo-jobs-item__title{font-size:13px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".aivo-jobs-item__meta{margin-top:6px;font-size:12px;opacity:.8;display:flex;gap:10px;flex-wrap:wrap}" +
      ".aivo-jobs-badge{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06)}" +
      ".aivo-jobs-actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}" +
      ".aivo-jobs-btn{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;font-weight:700;font-size:12px;cursor:pointer}" +
      ".aivo-jobs-btn[disabled]{opacity:.45;cursor:not-allowed}";
    var st = document.createElement("style");
    st.id = "aivo-jobs-panel-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- toast (safe) ----------
  function toast(msg){
    // senin global toast sistemin varsa onu kullan (varsa)
    if (window.AIVO_TOAST && typeof window.AIVO_TOAST.show === "function") {
      window.AIVO_TOAST.show(String(msg || ""));
      return;
    }
    // fallback: kısa, sessiz
    console.log("[JOBS]", msg);
  }

  // ---------- job helpers ----------
  function getJobs(){
    if (!window.AIVO_JOBS) return [];
    var arr = window.AIVO_JOBS.list;
    return Array.isArray(arr) ? arr : [];
  }
  function pickUrl(j){
    if (!j) return "";
    return j.downloadUrl || j.download_url || j.fileUrl || j.file_url || j.url || j.outputUrl || j.output_url || "";
  }
  function pickTitle(j){
    if (!j) return "Çıktı";
    return j.title || j.name || j.promptTitle || j.type || ("Job " + (j.id || ""));
  }
  function pickStatus(j){
    if (!j) return "queued";
    return (j.status || j.state || "queued");
  }
  function pickType(j){
    if (!j) return "";
    return (j.type || j.kind || "");
  }

  // ---------- render ----------
  function render(){
    ensureStyle();

    var jobs = getJobs();
    // host tamamen bizim alanımız değilse, içine "root" ekleyelim
    var root = qs(".aivo-jobs-panel-root", host);
    if (!root){
      root = document.createElement("div");
      root.className = "aivo-jobs-panel-root";
      host.appendChild(root);
    }

    if (!jobs.length){
      root.innerHTML =
        '<div class="aivo-jobs-empty">' +
          '<div class="aivo-jobs-empty__title">Henüz çıktı yok</div>' +
          '<div class="aivo-jobs-empty__sub">AI Üret\'ten bir üretim başlattığında, sonuçlar burada görünecek.</div>' +
          '<button class="aivo-jobs-empty__cta" type="button" data-action="go-ai-create">AI Üret\'e Git</button>' +
        '</div>';
      return;
    }

    var html = '<div class="aivo-jobs-list">';
    for (var i=0; i<Math.min(jobs.length, 20); i++){
      var j = jobs[i];
      var title = esc(pickTitle(j));
      var status = esc(pickStatus(j));
      var type = esc(pickType(j));
      var url = pickUrl(j);
      var hasUrl = !!url;

      html +=
        '<div class="aivo-jobs-item" data-job-idx="'+i+'">' +
          '<div class="aivo-jobs-item__top">' +
            '<div class="aivo-jobs-item__title" title="'+title+'">'+title+'</div>' +
            '<span class="aivo-jobs-badge">'+status+'</span>' +
          '</div>' +
          '<div class="aivo-jobs-item__meta">' +
            (type ? ('<span>Tür: <b>'+type+'</b></span>') : '') +
            (j.createdAt ? ('<span>Tarih: <b>'+esc(j.createdAt)+'</b></span>') : '') +
          '</div>' +
          '<div class="aivo-jobs-actions">' +
            '<button class="aivo-jobs-btn" type="button" data-action="open" '+(hasUrl?'':'disabled')+'>Aç</button>' +
            '<button class="aivo-jobs-btn" type="button" data-action="download" '+(hasUrl?'':'disabled')+'>İndir</button>' +
            '<button class="aivo-jobs-btn" type="button" data-action="copy" '+(hasUrl?'':'disabled')+'>Link Kopyala</button>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
    root.innerHTML = html;
  }

  // ---------- actions (delegation) ----------
  host.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
    if (!btn) return;

    var act = btn.getAttribute("data-action");

    if (act === "go-ai-create"){
      // Senin sistemde sayfa geçişi data-page-link ile çalışıyorsa:
      var link = document.querySelector('[data-page-link="music"]');
      if (link) link.click();
      else toast("AI Üret sayfasına geçiş için music link bulunamadı.");
      return;
    }

    var item = btn.closest(".aivo-jobs-item");
    if (!item) return;
    var idx = parseInt(item.getAttribute("data-job-idx"), 10);
    var jobs = getJobs();
    var j = jobs[idx];
    var url = pickUrl(j);
    if (!url) { toast("Henüz hazır değil."); return; }

    if (act === "open"){
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (act === "download"){
      var a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    if (act === "copy"){
      var txt = String(url);
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(function(){
          toast("Link kopyalandı.");
        }).catch(function(){
          toast("Kopyalama engellendi.");
        });
      } else {
        // fallback
        try {
          var ta = document.createElement("textarea");
          ta.value = txt;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          toast("Link kopyalandı.");
        } catch(err){
          toast("Kopyalama yapılamadı.");
        }
      }
      return;
    }
  });

  // ---------- live updates ----------
  // Subscribe varsa kullan; yoksa hafif polling (MVP)
  if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
    window.AIVO_JOBS.subscribe(function(){ render(); });
  } else {
    setInterval(render, 1500);
  }

  // initial
  render();
})();
/* =========================================================
   ACTION: open-jobs (MVP) — GLOBAL DELEGATE (SAFE) v1
   - data-action="open-jobs" butonunu kesin çalıştırır
   - AIVO_JOBS panel/page hangi sistemdeyse güvenli fallback ile açar
   ========================================================= */
(function(){
  "use strict";
  if (window.__aivoOpenJobsBound) return;
  window.__aivoOpenJobsBound = true;

  function tryClick(sel){
    var el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  }

  function openJobs(){
    // 1) Eğer sağ panelde hazır bir "Jobs" sekmesi / butonu varsa
    if (tryClick('[data-action="open-jobs-panel"]')) return true;
    if (tryClick('[data-action="jobs"]')) return true;

    // 2) Eğer sistem page-link ile jobs sayfasına gidiyorsa
    if (tryClick('[data-page-link="jobs"]')) return true;

    // 3) Eğer global bir fonksiyon varsa (bazı build’lerde oluyor)
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.open === "function") {
      window.AIVO_JOBS.open();
      return true;
    }

    // 4) Son çare: Jobs sayfası DOM’da varsa görünür yap
    var page = document.querySelector('[data-page="jobs"]');
    if (page) {
      // Senin sistemin switchPage kullanıyorsa, görünürlük class’larını o yönetiyor olabilir
      page.style.display = "";
      page.classList.add("is-active");
      return true;
    }

    console.log("[open-jobs] target not found");
    return false;
  }

  document.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="open-jobs"]') : null;
    if (!btn) return;
    e.preventDefault();
    openJobs();
  }, true);
})();
/* =========================================================
   OPEN JOBS — PANEL MODE (MVP) v1
   - "jobs" diye page yok → switchPage uyarısı normal
   - Çözüm: data-action="open-jobs" tıklanınca legacy page switch'i durdur
   - Sağ panelde Jobs/Çıktılar alanını görünür yap + panel scriptine host sağla
   ========================================================= */
(function(){
  "use strict";
  if (window.__aivoOpenJobsBound) return;
  window.__aivoOpenJobsBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function show(el){
    if (!el) return false;
    // yaygın gizleme yöntemleri
    el.hidden = false;
    el.style.display = "";
    el.style.visibility = "";
    el.style.opacity = "";
    // bazı paneller class ile açılıyor
    el.classList.add("is-open","is-active","open");
    return true;
  }

  function openJobsPanel(){
    // 1) Eğer özel bir jobs panel host'u varsa onu aç
    var host =
      qs('[data-jobs-panel]') ||
      qs('[data-panel="jobs"]') ||
      qs('[data-right-panel="jobs"]') ||
      qs('[data-jobs]') ||
      qs('[data-page="jobs"]'); // varsa (şimdilik yok)

    if (host && show(host)) return true;

    // 2) Sağ panel wrapper'ını açmayı dene (projede farklı isimler olabilir)
    var right =
      qs('[data-right-panel]') ||
      qs('.right-panel') ||
      qs('.studio-right') ||
      qs('.panel-right');

    if (right && show(right)) {
      // right panel açıldıysa, içeride jobs container'ı tekrar ara
      host =
        qs('[data-jobs-panel]', right) ||
        qs('[data-panel="jobs"]', right) ||
        qs('[data-right-panel="jobs"]', right) ||
        qs('[data-jobs]', right);
      if (host) show(host);
      return true;
    }

    console.log("[open-jobs] Panel host bulunamadı");
    return false;
  }

  // ✅ capture phase: legacy handlerlardan önce yakala
  document.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="open-jobs"]') : null;
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    openJobsPanel();
  }, true);
})();
/* =========================================================
   OPEN-JOBS — RIGHT PANEL HOST (FINAL) v2
   - Legacy switchPage("jobs") uyarısını susturur
   - Sağ paneli açar: .right-panel
   - İçeride anchor oluşturur: [data-jobs-panel] (right-list içine)
   ========================================================= */
(function(){
  "use strict";
  if (window.__aivoOpenJobsBound_V2) return;
  window.__aivoOpenJobsBound_V2 = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }

  function ensureJobsHost(){
    var right = qs(".right-panel");
    if (!right) { console.log("[open-jobs] .right-panel yok"); return null; }

    // sağ panel görünür olsun
    right.hidden = false;
    right.style.display = "";
    right.style.visibility = "";
    right.classList.add("is-open","is-active","open");

    // jobs list container'ı hedefle
    var list = qs(".right-list", right) || qs(".card.right-card", right) || right;

    // anchor yoksa oluştur
    var host = qs("[data-jobs-panel]", list);
    if (!host) {
      host = document.createElement("div");
      host.setAttribute("data-jobs-panel", "");
      // panel scriptlerinin bulması için ayırt edici class da ekleyelim
      host.className = "aivo-jobs-panel-root";
      // en üste koy (liste üstü)
      list.insertBefore(host, list.firstChild);
    }
    return host;
  }

  function openJobs(){
    var host = ensureJobsHost();
    if (!host) return false;

    // Panel scripti zaten host bulup render ediyorsa yeter.
    // Yine de tetiklemek için küçük bir event yayınlayalım (zararsız)
    try { window.dispatchEvent(new Event("aivo:jobs:open")); } catch(e){}

    return true;
  }

  // CAPTURE phase: legacy handlerlardan önce yakala ve öldür
  document.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest('button.sidebar-link[data-action="open-jobs"]') : null;
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    openJobs();
  }, true);
})();
