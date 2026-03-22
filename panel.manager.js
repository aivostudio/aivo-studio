// panel.manager.js
(function(){
  const registry = new Map();
  const panelCache = new Map(); // key -> { wrapEl, mounted, unmount, impl, visible }

  let currentKey = null;
  let currentUnmount = null;

  // shell refs (manager-owned)
  let shell = null;
  let headerEl = null;
  let titleEl = null;
  let metaEl = null;
  let searchEl = null;
  let bodyEl = null;
  let contentEl = null;

  let lastQuery = "";

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

  function renderFallback(key){
    if(!contentEl) return;
    contentEl.innerHTML = `
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

  function ensureShell(host){
    if(shell && shell.isConnected && contentEl) return;

    host.innerHTML = `
      <div class="rpShell" data-rp="1">
        <div class="rpHeader">
          <div class="rpHeaderTop">
            <div class="rpTitle">Panel</div>
            <div class="rpMeta"></div>
          </div>
          <div class="rpHeaderBottom">
            <input class="rpSearch" type="search" placeholder="Ara..." autocomplete="off" />
          </div>
        </div>

        <div class="rpBody">
          <div class="rpContent"></div>
        </div>
      </div>
    `;

    shell     = host.querySelector(".rpShell");
    headerEl  = host.querySelector(".rpHeader");
    titleEl   = host.querySelector(".rpTitle");
    metaEl    = host.querySelector(".rpMeta");
    searchEl  = host.querySelector(".rpSearch");
    bodyEl    = host.querySelector(".rpBody");
    contentEl = host.querySelector(".rpContent");

    if(searchEl){
      searchEl.addEventListener("input", () => {
        lastQuery = String(searchEl.value || "");
        const impl = registry.get(currentKey);
        if(impl && typeof impl.onSearch === "function"){
          safeCall(impl.onSearch, lastQuery);
        }
      });
    }
  }

  function setHeader(opts){
    opts = opts || {};
    if(titleEl && (opts.title != null)) titleEl.textContent = String(opts.title);
    if(metaEl && (opts.meta != null)) metaEl.textContent = String(opts.meta);

    if(searchEl){
      const enabled = (opts.searchEnabled !== false);
      searchEl.style.display = enabled ? "" : "none";

      if(opts.searchPlaceholder != null){
        searchEl.placeholder = String(opts.searchPlaceholder);
      }

      if(opts.resetSearch){
        lastQuery = "";
        searchEl.value = "";
      }else{
        searchEl.value = lastQuery || "";
      }
    }
  }

  function ensurePanelWrap(key){
    if(!contentEl) return null;

    let cached = panelCache.get(key);
    if(cached && cached.wrapEl && cached.wrapEl.isConnected){
      return cached.wrapEl;
    }

    const wrap = document.createElement("div");
    wrap.className = "rpPanelWrap";
    wrap.dataset.panelKey = String(key || "");
    wrap.style.display = "none";
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    contentEl.appendChild(wrap);

    if(!cached){
      cached = {
        wrapEl: wrap,
        mounted: false,
        unmount: null,
        impl: null,
        visible: false
      };
      panelCache.set(key, cached);
    }else{
      cached.wrapEl = wrap;
    }

    return wrap;
  }

  function callPanelHide(key){
    const cached = panelCache.get(key);
    if(!cached || !cached.impl || !cached.visible) return;

    cached.visible = false;
    if(cached.wrapEl) cached.wrapEl.style.display = "none";

    if(typeof cached.impl.onHide === "function"){
      safeCall(cached.impl.onHide, {
        key,
        wrapEl: cached.wrapEl
      });
    }
  }

  function callPanelShow(key, payload){
    const cached = panelCache.get(key);
    if(!cached || !cached.impl) return;

    cached.visible = true;
    if(cached.wrapEl) cached.wrapEl.style.display = "";

    if(typeof cached.impl.onShow === "function"){
      safeCall(cached.impl.onShow, payload, {
        key,
        wrapEl: cached.wrapEl,
        setHeader,
        getQuery: () => lastQuery
      });
    }
  }

  function hideAllPanelsExcept(nextKey){
    for(const [key] of panelCache){
      if(key !== nextKey){
        callPanelHide(key);
      }
    }
  }

  const api = {
    _keys(){ return Array.from(registry.keys()); },
    _has(key){ return registry.has(key); },

    register(key, impl){
      if(!key || !impl || typeof impl.mount !== "function"){
        console.warn("[RightPanel] invalid register:", key, impl);
        return;
      }

      if(registry.has(key)){
     console.warn("[RightPanel] duplicate register for key:", key);
     console.log("[RightPanel duplicate impl]", impl);
     console.trace("[RightPanel duplicate trace]");
     }
     if (key === "atmo" && !registry.has(key)) {
  console.log("[RightPanel first atmo register]");
  console.trace("[RightPanel first atmo trace]");
}
      registry.set(key, impl);

      const cached = panelCache.get(key);
      if(cached){
        cached.impl = impl;
      }
    },

    force(key, payload){
      const host = ensureHost();
      if(!host) return;

      ensureShell(host);

      const prevKey = currentKey;
      currentKey = key;

      const impl = registry.get(key);
      if(!impl){
        hideAllPanelsExcept(null);
        if(contentEl) contentEl.innerHTML = "";
        setHeader({
          title: "Panel",
          meta: "",
          searchEnabled: false,
          resetSearch: true
        });
        renderFallback(key);
        return;
      }

      let hdr = null;
      if(typeof impl.getHeader === "function"){
        hdr = safeCall(impl.getHeader, payload);
      }else if(impl.header && typeof impl.header === "object"){
        hdr = impl.header;
      }

      const fallbackTitle = String(key || "Panel");
      setHeader({
        title: (hdr && hdr.title != null) ? hdr.title : fallbackTitle,
        meta: (hdr && hdr.meta != null) ? hdr.meta : "",
        searchEnabled: (hdr && hdr.searchEnabled === false) ? false : true,
        searchPlaceholder: (hdr && hdr.searchPlaceholder != null) ? hdr.searchPlaceholder : "Ara...",
        resetSearch: (hdr && hdr.resetSearch === true) ? true : false
      });

      if(prevKey && prevKey !== key){
        callPanelHide(prevKey);
      }
      hideAllPanelsExcept(key);

      const wrapEl = ensurePanelWrap(key);
      if(!wrapEl){
        renderFallback(key);
        return;
      }

      let cached = panelCache.get(key);
      if(!cached){
        cached = {
          wrapEl,
          mounted: false,
          unmount: null,
          impl,
          visible: false
        };
        panelCache.set(key, cached);
      }else{
        cached.wrapEl = wrapEl;
        cached.impl = impl;
      }

      if(!cached.mounted){
        const unmount = safeCall(impl.mount, wrapEl, payload, {
          key,
          setHeader,
          getQuery: () => lastQuery
        });

        cached.unmount = (typeof unmount === "function") ? unmount : null;
        cached.mounted = true;
      }

      callPanelShow(key, payload);

      currentUnmount = cached.unmount || null;

      if(lastQuery && typeof impl.onSearch === "function"){
        safeCall(impl.onSearch, lastQuery);
      }
    },

    getCurrentKey(){
      return currentKey;
    },

    setHeader,

    setSearchQuery(q){
      lastQuery = String(q || "");
      if(searchEl) searchEl.value = lastQuery;

      const impl = registry.get(currentKey);
      if(impl && typeof impl.onSearch === "function"){
        safeCall(impl.onSearch, lastQuery);
      }
    },

    clearSearch(){
      api.setSearchQuery("");
    },

    destroyPanel(key){
      const cached = panelCache.get(key);
      if(!cached) return;

      try {
        if(cached.impl && typeof cached.impl.onHide === "function" && cached.visible){
          safeCall(cached.impl.onHide, {
            key,
            wrapEl: cached.wrapEl
          });
        }
      } catch(e){}

      try {
        if(cached.unmount) safeCall(cached.unmount);
      } catch(e){}

      if(cached.wrapEl && cached.wrapEl.parentNode){
        cached.wrapEl.parentNode.removeChild(cached.wrapEl);
      }

      panelCache.delete(key);

      if(currentKey === key){
        currentKey = null;
        currentUnmount = null;
      }
    },

    destroyAll(){
      for(const key of Array.from(panelCache.keys())){
        api.destroyPanel(key);
      }
    }
  };

  window.RightPanel = api;
  window.RightPanelRef = api;
  try { window.RightPanelGlobal = api; } catch(e) {}
})();
