// panel.manager.js  (REVIZE — SERT KURAL / PANEL LOCK + ALLOWLIST)
(function(){
  const registry = new Map();
  let currentKey = null;
  let currentUnmount = null;

  // ✅ Sert kural: aktif route/panel kilidi
  let activeRoute = null;     // örn: "video"
  let lockedKey = null;       // örn: "video" (RightPanel sadece bunu basabilir)

  // ✅ 6 bölüm: paneller birbirine karışmayacak (route -> izinli panel key’leri)
  // Not: Buradaki key’ler senin register ettiğin panel key’leri ile birebir aynı olmalı.
  const ROUTE_ALLOWLIST = {
    music:  new Set(["music"]),
    video:  new Set(["video"]),
    cover:  new Set(["cover"]),
    atmo:   new Set(["atmo", "atmos", "atmosphere"]), // isim farkı varsa yakala
    social: new Set(["social", "socialpack", "sm-pack"]),
    hook:   new Set(["hook", "viral-hook"]),
  };

  function ensureHost(){
    const host = document.getElementById("rightPanelHost");
    if(!host){
      console.warn("[RightPanel] #rightPanelHost not found");
      return null;
    }
    return host;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function renderFallback(host, key){
    host.innerHTML = `
      <div style="padding:10px 0;">
        <div style="font-weight:700; font-size:14px; margin-bottom:6px;">Panel hazır değil</div>
        <div style="opacity:.75; font-size:13px;">
          <code>${escapeHtml(key)}</code> paneli henüz register edilmedi.
        </div>
      </div>
    `;
  }

  function safeCall(fn, ...args){
    try { return fn(...args); }
    catch(e){ console.warn("[RightPanel] error", e); return null; }
  }

  function isAllowed(key){
    // 1) Kilit varsa: SADECE lockedKey basılabilir (sert kural)
    if (lockedKey) return key === lockedKey;

    // 2) Kilit yok ama route varsa: route allowlist’i uygula
    if (activeRoute && ROUTE_ALLOWLIST[activeRoute]){
      return ROUTE_ALLOWLIST[activeRoute].has(key);
    }

    // 3) Hiç context yoksa: serbest (fallback)
    return true;
  }

  const api = {
    // ✅ debug yardımcıları
    _keys(){ return Array.from(registry.keys()); },
    _has(key){ return registry.has(key); },
    getCurrentKey(){ return currentKey; },

    // ✅ Sert kural kontrol (gözlem için)
    getActiveRoute(){ return activeRoute; },
    getLockedKey(){ return lockedKey; },

    // ✅ Router/boot bunu çağırmalı:
    // - Video sayfasına girince: RightPanel.setContext("video")
    // - Music sayfasına girince: RightPanel.setContext("music")
    // Bu çağrı paneli de otomatik force ETMEZ; sadece kuralları set eder.
    setContext(routeKey){
      activeRoute = routeKey || null;
      lockedKey = null; // context değişince eski kilidi sıfırla
    },

    // ✅ Daha sert: paneli kilitle (route içindeyken panel değişmesin)
    // Örn: video route açılınca router: RightPanel.lock("video"); RightPanel.force("video");
    lock(key){
      lockedKey = key || null;
    },
    unlock(){
      lockedKey = null;
    },

    register(key, impl){
      if(!key || !impl || typeof impl.mount !== "function"){
        console.warn("[RightPanel] invalid register:", key, impl);
        return;
      }
      registry.set(key, impl);
    },

    force(key, payload){
      // ✅ Sert kural uygulama noktası
      if(!isAllowed(key)){
        console.warn(
          `[RightPanel] BLOCKED force("${key}") (activeRoute=${activeRoute || "null"}, lockedKey=${lockedKey || "null"})`
        );
        return;
      }

      const host = ensureHost();
      if(!host) return;

      // unmount old
      if(currentUnmount){
        safeCall(currentUnmount);
        currentUnmount = null;
      }

      currentKey = key;

      const impl = registry.get(key);
      if(!impl){
        renderFallback(host, key);
        return;
      }

      host.innerHTML = "";
      const unmount = safeCall(impl.mount, host, payload);
      currentUnmount = (typeof unmount === "function") ? unmount : null;
    },
  };

  // ✅ Global alias’lar (panel dosyaları "RightPanel.register" diye çağırsa bile çalışsın)
  window.RightPanel = api;
  window.RightPanelRef = api;
  try { window.RightPanelGlobal = api; } catch(e) {}
})();
