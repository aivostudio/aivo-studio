(() => {
  const V = 123; // her deploy’da artır (cache/debug için)
  console.log(`[panel.music] LOADED v=${V}`);

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function pairHTML({ title = "Processing", jobId = null } = {}) {
    const jid = jobId ? `<div class="muted">job: ${esc(jobId)}</div>` : `<div class="muted">job: (pending)</div>`;
    return `
      <div class="aivo-card" style="border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px; margin:10px 0;">
        <div style="font-weight:600; margin-bottom:6px;">${esc(title)}</div>
        ${jid}
        <div style="margin-top:8px; display:flex; gap:10px; flex-direction:column;">
          <div>
            <div class="muted" style="font-size:12px; opacity:.75; margin-bottom:4px;">Original (v1)</div>
            <audio controls preload="none" style="width:100%"></audio>
          </div>
          <div>
            <div class="muted" style="font-size:12px; opacity:.75; margin-bottom:4px;">Revize (v2)</div>
            <audio controls preload="none" style="width:100%"></audio>
          </div>
        </div>
      </div>
    `;
  }

  function ensureRoot(host) {
    host.innerHTML = `
      <div class="panel-music-root" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:700;">Müzik</div>
          <div class="muted" style="font-size:12px; opacity:.7;">v${V}</div>
        </div>
        <div id="panelMusicList"></div>
      </div>
    `;
    return host.querySelector("#panelMusicList");
  }

  const api = {
    _host: null,
    _listEl: null,

    mount(hostEl) {
      console.log("[panel.music] mount()", hostEl);
      this._host = hostEl;
      this._listEl = ensureRoot(hostEl);

      // ✅ GARANTİ: panel mount olur olmaz 1 çift bas
      this.addPair({ title: "Placeholder (auto)" });
    },

    destroy() {
      console.log("[panel.music] destroy()");
      if (this._host) this._host.innerHTML = "";
      this._host = null;
      this._listEl = null;
    },

    // ✅ dışarıdan çağrılacak sağlam yol
    addPair({ title = "Placeholder", jobId = null } = {}) {
      if (!this._listEl) {
        console.warn("[panel.music] addPair() called but list not ready yet");
        return;
      }
      this._listEl.insertAdjacentHTML("beforeend", pairHTML({ title, jobId }));
      console.log("[panel.music] addPair()", { title, jobId });
    },
  };

  // ✅ Kayıt (defansif): RightPanel API nasıl olursa olsun paneli yakala
  const RP = window.RightPanel || (window.RightPanel = {});
  RP.panels = RP.panels || {};
  RP.panels.music = api;

  if (typeof RP.register === "function") {
    try { RP.register("music", api); } catch (e) { console.warn("[panel.music] RP.register failed", e); }
  }

  // ✅ debug için global export
  window.AIVO_PANEL_MUSIC = api;
})();
