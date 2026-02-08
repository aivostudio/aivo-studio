(function(){
  if(!window.RightPanel) return;

  function attachPPEBridge(host){
    const slots = Array.from(host.querySelectorAll("[data-slot]"));

    if (!window.PPE || !slots.length) return;

    const prev = PPE.onOutput;

    function setSlot(idx, url){
      const el = slots[idx];
      if (!el) return;

      el.dataset.url = url;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.border = "1px solid rgba(255,255,255,0.10)";
    }

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}

      if (!out || out.type !== "image" || !out.url) return;

      // ilk boş slotu doldur, doluysa 0'ı overwrite et (MVP)
      const emptyIdx = slots.findIndex(s => !s.dataset.url);
      const idx = emptyIdx >= 0 ? emptyIdx : 0;
      setSlot(idx, out.url);
    };

    // slot click: görüntüyü aç
    function onClick(e){
      const box = e.target.closest("[data-slot]");
      if (!box) return;
      const url = box.dataset.url;
      if (url) window.open(url, "_blank", "noopener");
    }
    host.addEventListener("click", onClick, true);

    return () => {
      try { host.removeEventListener("click", onClick, true); } catch {}
      if (PPE.onOutput) PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("cover", {
    mount(host){
      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Kapak Outputs</div>
          <div style="opacity:.75; font-size:13px;">Şimdilik stub panel. PPE image output gelince kutulara basar.</div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div data-slot="0" style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);"></div>
            <div data-slot="1" style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);"></div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
