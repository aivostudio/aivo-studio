(function(){
  // ---------- helpers ----------
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function ensureModuleHost(){
    const host = document.getElementById("moduleHost");
    if(!host){
      console.warn("[Router] #moduleHost not found");
      return null;
    }
    return host;
  }

  function parseHash(){
    // supports:
    //   #music
    //   #music?tab=ses-kaydi
    const raw = (location.hash || "").replace(/^#/, "");
    if(!raw) return { route: "music", params: {} };

    const [routePart, queryPart] = raw.split("?");
    const route = (routePart || "music").trim();

    const params = {};
    if(queryPart){
      const sp = new URLSearchParams(queryPart);
      for (const [k,v] of sp.entries()) params[k] = v;
    }
    return { route, params };
  }

  function setHash(route, params){
    const r = (route || "music").trim();
    const sp = new URLSearchParams();
    if(params){
      Object.entries(params).forEach(([k,v])=>{
        if(v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
      });
    }
    const q = sp.toString();
    location.hash = q ? `#${r}?${q}` : `#${r}`;
  }

  function isAllowedRoute(route){
    // ✅ tek liste: iskeletin bütün sayfaları
    return [
      "music", "video", "cover",
      "atmo", "social", "hook",
      "dashboard", "library",
      "profile", "settings", "invoices"
    ].includes(route);
  }

  function renderModule(route, params){
    const host = ensureModuleHost();
    if(!host) return;

    // Burada ileride gerçek modül mount edilecek.
    // Şimdilik sağlam placeholder: route değişti mi görürüz.
    const titleMap = {
      music: "AI Müzik / Ses Kaydı",
      video: "AI Video Üret",
      cover: "AI Kapak Üret",
      atmo: "AI Atmosfer Video",
      social: "AI Sosyal Medya Paketi",
      hook: "AI Viral Hook Generator",
      dashboard: "Dashboard",
      library: "Ürettiklerim",
      profile: "Profil",
      settings: "Ayarlar",
      invoices: "Faturalarım",
    };

    const subtitle =
      (route === "music" && params && params.tab)
        ? `Sekme: ${params.tab}`
        : "Modül alanı (moduleHost)";

    host.innerHTML = `
      <div style="padding:18px;">
        <div style="font-size:18px;font-weight:900;margin-bottom:6px;">
          ${titleMap[route] || route}
        </div>
        <div style="opacity:.75">${subtitle}</div>
        <div style="margin-top:14px;opacity:.7;font-size:13px;line-height:1.6">
          Bu placeholder. Bir sonraki adımda <code>studio.modules</code> üzerinden gerçek modül mount edeceğiz.
        </div>
      </div>
    `;
  }

  function renderRightPanel(route, params){
    if(!window.RightPanel || typeof window.RightPanel.force !== "function"){
      console.warn("[Router] RightPanel not ready");
      return;
    }

    // ✅ sağ panel key’leri route ile aynı
    // music özel: tab payload gönder
    if(route === "music"){
      window.RightPanel.force("music", { tab: params && params.tab });
      return;
    }

    window.RightPanel.force(route, params);
  }

  function render(){
    const { route, params } = parseHash();

    const finalRoute = isAllowedRoute(route) ? route : "music";
    if(finalRoute !== route){
      setHash(finalRoute, params);
      return;
    }

    // 1) moduleHost
    renderModule(finalRoute, params);

    // 2) right panel (mount)
    renderRightPanel(finalRoute, params);

    // 3) active state (sol menü highlight)
    qsa(".navBtn").forEach(btn=>{
      const r = btn.dataset.route;
      const isActive = (r === finalRoute);
      btn.classList.toggle("is-active", isActive);
    });
  }

  function onNavClick(e){
    const btn = e.target.closest(".navBtn");
    if(!btn) return;

    const route = btn.dataset.route || "music";
    const tab = btn.dataset.musicTab;

    const params = {};
    if(route === "music" && tab) params.tab = tab;

    setHash(route, params);
  }

  function boot(){
    // nav binding
    const leftMenu = document.getElementById("leftMenu") || document;
    leftMenu.addEventListener("click", onNavClick);

    // initial render + changes
    window.addEventListener("hashchange", render);

    // default hash
    if(!location.hash){
      setHash("music");
      return;
    }
    render();
  }

  boot();
})();
