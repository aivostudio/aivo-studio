(function(){
  // ✅ SADECE GERÇEK VE KULLANILAN ROUTE’LAR
  // Menü + moduleMap + gerçek sayfalarla birebir uyumlu
  const ROUTES = new Set([
    // ÜRET MODÜLLERİ
    "music",
    "video",
    "cover",
    "atmo",
    "social",
    "hook",

    // PANELLER
    "dashboard",
    "library",
    "invoices",
    "profile",
    "settings"
  ]);

  // ✅ moduleMap’i her load’da yeniden yaratma — tek yerde tut
  const moduleMap = {
    // üret modülleri
    music: "/modules/music.html",
    video: "/modules/video.html",
    cover: "/modules/cover.html",
    atmo:  "/modules/atmosphere.html",
    social:"/modules/sm-pack.html",
    hook:  "/modules/viral-hook.html",

    // paneller
    dashboard: "/modules/dashboard.html",
    library:   "/modules/library.html",
    invoices:  "/modules/invoices.html",
    profile:   "/modules/profile.html",
    settings:  "/modules/settings.html",
  };

// ✅ (EK) Route’a göre modül CSS’i dinamik yükle
// Dosya isim standardı: /css/mod.<route>.css  (örn: /css/mod.music.css)
function ensureModuleCSS(routeKey){
  const id = "studio-module-css";
  const href = `/css/mod.${routeKey}.css?v=${Date.now()}`;

  let link = document.getElementById(id);
  if(!link){
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";

    // ✅ 404 olursa app bozulmasın
    link.onerror = () =>
      console.warn("[module-css] missing:", href);

    document.head.appendChild(link);
  }

  if(link.getAttribute("href") !== href){
    link.setAttribute("href", href);
  }
}


  function parseHash(){
    // supports:
    //   #music
    //   #music?tab=ses-kaydi
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if(!raw) return { key: "music", params: {} };

    const [keyPart, queryPart] = raw.split("?");
    let key = (keyPart || "music").trim();

    if(!ROUTES.has(key)) key = "music";

    const params = {};
    if(queryPart){
      const sp = new URLSearchParams(queryPart);
      for (const [k,v] of sp.entries()) params[k] = v;
    }
    return { key, params };
  }

  function setHash(key, params){
    if(!ROUTES.has(key)) key = "music";

    const sp = new URLSearchParams();
    if(params){
      Object.entries(params).forEach(([k,v])=>{
        if(v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
      });
    }
    const q = sp.toString();
    location.hash = q ? `#${key}?${q}` : `#${key}`;
  }

  async function loadModuleIntoHost(key, params){
    const host = document.getElementById("moduleHost");
    if(!host) return;

    // ✅ music içinde tab varsa, html yüklendikten sonra bir state bırakabiliriz
    // (module html içindeki JS bunu okuyabilir)
    if(key === "music" && params && params.tab){
      window.__AIVO_MUSIC_TAB__ = params.tab;
    }else if(key === "music"){
      window.__AIVO_MUSIC_TAB__ = null;
    }

    // route moduleMap’te yoksa placeholder
    if(!moduleMap[key]){
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">${escapeHtml(key)} (placeholder)</div>
          <div class="ph-sub">Bu route için module HTML henüz bağlanmadı.</div>
        </div>
      `;
      return;
    }

    const url = moduleMap[key];

    try{
      const res = await fetch(url, { cache: "no-store" });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      host.innerHTML = html;
    }catch(e){
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">Modül yüklenemedi</div>
          <div class="ph-sub">
            <code>${escapeHtml(url)}</code> bulunamadı / hata.
          </div>
        </div>
      `;
    }
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function setActiveNav(key){
    document.querySelectorAll(".navBtn[data-route]").forEach(btn=>{
      const k = btn.getAttribute("data-route");
      const on = (k === key);
      btn.classList.toggle("active", on);
      btn.classList.toggle("is-active", on); // bazı css’lerde bu kullanılıyor olabilir
    });
  }

  async function go(key, params){
    if(!ROUTES.has(key)) key = "music";

    // hash zaten aynıysa direkt render, değilse hashchange ile render
    const current = parseHash();
    const sameKey = (current.key === key);
    const sameTab = ((current.params && current.params.tab) || "") === ((params && params.tab) || "");

    if(!sameKey || !sameTab){
      setHash(key, params);
      return;
    }

    setActiveNav(key);

    // ✅ (EK) Route’a özel CSS’i yükle (module yüklemeden hemen önce)
    ensureModuleCSS(key);

    // ✅ Orta modül HTML’leri
    await loadModuleIntoHost(key, params);

    // ✅ Sağ panel: music tab payload + diğerleri düz force
    if(window.RightPanel && typeof window.RightPanel.force === "function"){
      if(key === "music"){
        window.RightPanel.force("music", { tab: params && params.tab });
      }else{
        window.RightPanel.force(key, params);
      }
    }
  }

  function onHashChange(){
    const { key, params } = parseHash();
    go(key, params);
  }

  // ✅ nav click -> hash’e çevir (music tab dahil)
  function onNavClick(e){
    const btn = e.target.closest(".navBtn");
    if(!btn) return;

    const key = btn.dataset.route || "music";
    const tab = btn.dataset.musicTab;

    const params = {};
    if(key === "music" && tab) params.tab = tab;

    go(key, params);
  }

  // expose
  window.StudioRouter = { go };

  // bind
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", function(){
    // sol menü root’un varsa oraya bağla, yoksa document
    const leftMenu = document.getElementById("leftMenu") || document;
    leftMenu.addEventListener("click", onNavClick);

    // ✅ RightPanel stub butonlarının gönderdiği navigate event’lerini route’a bağla
    window.addEventListener("studio:navigate", (e) => {
      const to = e && e.detail && e.detail.to;

      const map = {
        "go-library": "library",
        "go-invoices": "invoices",
        "go-profile": "profile",
        "go-settings": "settings",
        "go-dashboard": "dashboard",
        "go-music": "music",
        "go-video": "video",
      };

      if(map[to]) window.StudioRouter.go(map[to]);
    });

    // initial
    onHashChange();
  });
})();
