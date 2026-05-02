// panel.lipsync.js
(function () {
  if (!window.RightPanel) return;

  function createLipSyncPanel(host) {
    host.innerHTML = `
      <div style="
        padding:16px;
        height:100%;
        box-sizing:border-box;
      ">
        <div style="
          display:flex;
          flex-direction:column;
          gap:14px;
        ">
          <div style="
            padding:18px;
            border-radius:18px;
            background:rgba(255,255,255,0.035);
            border:1px solid rgba(255,255,255,0.07);
          ">
            <div style="
              font-weight:800;
              font-size:15px;
              margin-bottom:8px;
            ">
              Henüz lipsync video yok
            </div>

            <div style="
              opacity:.72;
              font-size:13px;
              line-height:1.5;
            ">
              Bu bölüm hazırlanıyor. Yakında video + ses yükleyerek dudak senkron video oluşturabileceksin.
            </div>
          </div>
        </div>
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
          resetSearch: true,
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
