// panel.manager.js
(function(){
  const registry = new Map();
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

    shell    = host.querySelector(".rpShell");
    headerEl = host.querySelector(".rpHeader");
    titleEl  = host.querySelector(".rpTitle");
    metaEl   = host.querySelector(".rpMeta");
    searchEl = host.querySelector(".rpSearch");
    bodyEl   = host.querySelector(".rpBody");
    contentEl= host.querySelector(".rpContent");

    // search -> active panel
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
      if(opts.searchPlaceholder != null) searchEl.placeholder = String(opts.searchPlaceholder);
      // keep last query unless explicitly reset
      if(opts.resetSearch){
        lastQuery = "";
        searchEl.value = "";
      }else{
        // preserve query across force calls
        searchEl.value = lastQuery || "";
      }
    }
  }

  const api = {
    // debug
    _keys(){ return Array.from(registry.keys()); },
    _has(key){ return registry.has(key); },

    register(key, impl){
      if(!key || !impl || typeof impl.mount !== "function"){
        console.warn("[RightPanel] invalid register:", key, impl);
        return;
      }
      if(registry.has(key)){
        console.warn("[RightPanel] duplicate register for key:", key);
      }
      registry.set(key, impl);
    },

    force(key, payload){
      const host = ensureHost();
      if(!host) return;

      ensureShell(host);

      // unmount old
      if(currentUnmount){
        safeCall(currentUnmount);
        currentUnmount = null;
      }

      currentKey = key;

      const impl = registry.get(key);
      if(!impl){
        setHeader({ title: "Panel", meta: "", searchEnabled: false, resetSearch: true });
        renderFallback(key);
        return;
      }

      // header defaults (panel can override via impl.header or impl.getHeader)
      let hdr = null;
      if(typeof impl.getHeader === "function"){
        hdr = safeCall(impl.getHeader, payload);
      }else if(impl.header && typeof impl.header === "object"){
        hdr = impl.header;
      }

      const fallbackTitle = String(key || "Panel");
      setHeader({
        title: (hdr && hdr.title != null) ? hdr.title : fallbackTitle,
        meta:  (hdr && hdr.meta != null)  ? hdr.meta  : "",
        searchEnabled: (hdr && hdr.searchEnabled === false) ? false : true,
        searchPlaceholder: (hdr && hdr.searchPlaceholder != null) ? hdr.searchPlaceholder : "Ara...",
        // keep query by default
        resetSearch: (hdr && hdr.resetSearch === true) ? true : false
      });

      // clear content only (header stays)
      if(contentEl) contentEl.innerHTML = "";

      // mount into manager-owned content area
      const unmount = safeCall(impl.mount, contentEl, payload, {
        key,
        setHeader,               // panel may update title/meta later
        getQuery: () => lastQuery
      });

      currentUnmount = (typeof unmount === "function") ? unmount : null;

      // if there was an existing query, re-apply it on new panel
      if(lastQuery && impl && typeof impl.onSearch === "function"){
        safeCall(impl.onSearch, lastQuery);
      }
    },

    getCurrentKey(){ return currentKey; },

    // optional: let panels update header after mount
    setHeader,

    // optional: allow external setting/clearing query
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
    }
  };

  window.RightPanel = api;
  window.RightPanelRef = api;
  try { window.RightPanelGlobal = api; } catch(e) {}
})();
