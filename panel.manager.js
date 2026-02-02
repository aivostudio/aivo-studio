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

  const api = {
    // ✅ debug yardımcıları
    _keys(){
      return Array.from(registry.keys());
    },
    _has(key){
      return registry.has(key);
    },

    register(key, impl){
      if(!key || !impl || typeof impl.mount !== "function"){
        console.warn("[RightPanel] invalid register:", key, impl);
        return;
      }
      registry.set(key, impl);
      // debug: register gerçekleşti mi gör
      // console.log("[RightPanel] registered:", key);
    },

    force(key, payload){
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

    getCurrentKey(){ return currentKey; }
  };

  // ✅ En kritik: global alias’lar (panel dosyaları "RightPanel.register" diye çağırsa bile çalışsın)
  window.RightPanel = api;
  window.RightPanelRef = api;

  // Bazı tarayıcı/ortamlarda global isim çözümlemesi için:
  // (window.RightPanel var ama "RightPanel" identifier yoksa)
  // Bu satır çoğu yerde otomatik olur, ama garanti değil.
  try { window.RightPanelGlobal = api; } catch(e) {}
})();
