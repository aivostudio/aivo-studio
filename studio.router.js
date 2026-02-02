(function(){
  const ROUTES = new Set(["music","video","cover","dashboard","recent","credits","settings"]);

  function getKeyFromHash(){
    const h = (location.hash || "").replace("#","").trim();
    if(!h) return "music";
    return ROUTES.has(h) ? h : "music";
  }

  async function loadModuleIntoHost(key){
    const host = document.getElementById("moduleHost");
    if(!host) return;

    // Üret modülleri için HTML yüklemeyi deneriz (varsa)
    const moduleMap = {
      music: "/modules/music.html",
      video: "/modules/video.html",
      cover: "/modules/cover.html",
    };

    // Panel/dash sayfaları için placeholder
    if(!moduleMap[key]){
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">${key} (placeholder)</div>
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
      btn.classList.toggle("active", k === key);
    });
  }

  async function go(key){
    if(!ROUTES.has(key)) key = "music";
    if(location.hash.replace("#","") !== key){
      location.hash = key;
      return; // hashchange tekrar çağıracak
    }

    setActiveNav(key);

    // Orta modül
    await loadModuleIntoHost(key);

    // Sağ panel
    if(window.RightPanel?.force){
      window.RightPanel.force(key);
    }
  }

  function onHashChange(){
    const key = getKeyFromHash();
    go(key);
  }

  window.StudioRouter = { go };

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", onHashChange);
})();
