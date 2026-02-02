(function(){
  const registry = new Map();
  let currentKey = null;
  let currentUnmount = null;

  function ensureHost(){
    const host = document.getElementById("rightPanelHost");
    if(!host){
      console.warn("[RightPanel] #rightPanelHost not found");
      return null;
    }
    return host;
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

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  const RightPanel = {
    register(key, impl){
      if(!key || !impl || typeof impl.mount !== "function"){
        console.warn("[RightPanel] invalid register:", key, impl);
        return;
      }
      registry.set(key, impl);
    },

    force(key, payload){
      const host = ensureHost();
      if(!host) return;

      if(currentUnmount){
        try{ currentUnmount(); }catch(e){ console.warn("[RightPanel] unmount error", e); }
        currentUnmount = null;
      }

      currentKey = key;

      const impl = registry.get(key);
      if(!impl){
        renderFallback(host, key);
        return;
      }

      host.innerHTML = "";
      try{
        currentUnmount = impl.mount(host, payload) || null;
      }catch(e){
        console.warn("[RightPanel] mount error", e);
        renderFallback(host, key);
      }
    },

    getCurrentKey(){ return currentKey; }
  };

  window.RightPanel = RightPanel;
})();
