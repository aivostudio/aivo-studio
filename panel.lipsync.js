// panel.lipsync.js
(function () {
  if (!window.RightPanel) return;

  function createLipSyncPanel(host) {
    host.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        height:100%;
        font-size:14px;
        opacity:.7;
      ">
        Lipsync panel hazırlanıyor...
      </div>
    `;

    return {
      destroy() {
        try {
          host.innerHTML = "";
        } catch {}
      },
    };
  }

  try {
    console.log("[PANEL.LIPSYNC] register run");

    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register("lipsync", {
        header: {
          title: "AI Dudak Senkron Video",
          meta: "Hazırlanıyor",
          searchEnabled: false,
        },

        mount(host) {
          const api = createLipSyncPanel(host);
          return () => {
            try {
              api?.destroy?.();
            } catch {}
          };
        },
      });
    } else {
      console.warn("[LIPSYNC PANEL] RightPanel.register yok.");
    }
  } catch (e) {
    console.warn("[LIPSYNC PANEL] register failed", e);
  }
})();
