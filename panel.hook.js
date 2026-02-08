(function () {
  if (!window.RightPanel) return;

  const safeStr = (v) => String(v == null ? "" : v).trim();
  const low = (v) => safeStr(v).toLowerCase();

  function attachPPEBridge(host) {
    if (!window.PPE) return;

    const slots = [
      host.querySelector('[data-slot="0"]'),
      host.querySelector('[data-slot="1"]'),
      host.querySelector('[data-slot="2"]'),
      host.querySelector('[data-slot="3"]'),
    ];

    function setText(slotEl, text) {
      if (!slotEl) return;
      slotEl.innerHTML = `
        <div style="font-size:13px;line-height:1.35;white-space:pre-wrap;">
          ${text}
        </div>
      `;
    }

    function setImg(slotEl, url) {
      if (!slotEl || !url) return;
      slotEl.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" />
      `;
    }

    function pickText(out) {
      return (
        out?.text ||
        out?.content ||
        out?.hook ||
        out?.caption ||
        (Array.isArray(out?.lines) ? out.lines.join("\n") : null) ||
        null
      );
    }

    function pickUrl(out) {
      return (
        out?.url ||
        out?.src ||
        out?.image_url ||
        out?.image?.url ||
        (Array.isArray(out?.images) ? out.images?.[0]?.url : null) ||
        null
      );
    }

    function isHook(job, out) {
      const app = low(out?.meta?.app || job?.app || job?.routeKey || job?.module || "");
      const t = low(out?.type);

      // direkt hook output
      if (t.includes("hook")) return true;

      // text output ama hook app'ten gelmiş
      if (t === "text" || t === "script" || t.includes("caption")) {
        if (app.includes("hook") || app.includes("viral")) return true;
      }

      // image output ama hook meta varsa (thumbnail vs)
      if (t === "image" || t.includes("img")) {
        if (app.includes("hook") || app.includes("viral")) return true;
      }

      return false;
    }

    const prev = PPE.onOutput;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}

      if (!out) return;
      if (!isHook(job, out)) return;

      const idx = Number(out?.index);
      const slotIndex = Number.isFinite(idx) ? idx : null;

      const text = pickText(out);
      const url = pickUrl(out);

      // hedef slot varsa oraya bas
      if (slotIndex != null && slots[slotIndex]) {
        if (text) return setText(slots[slotIndex], text);
        if (url) return setImg(slots[slotIndex], url);
      }

      // yoksa ilk boş slota bas
      for (let i = 0; i < slots.length; i++) {
        const el = slots[i];
        if (!el) continue;

        const hasContent = el.querySelector("img") || el.textContent.trim().length > 0;
        if (!hasContent) {
          if (text) return setText(el, text);
          if (url) return setImg(el, url);
        }
      }

      // hepsi doluysa ilk slot overwrite
      if (slots[0]) {
        if (text) return setText(slots[0], text);
        if (url) return setImg(slots[0], url);
      }
    };

    return () => {
      PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("hook", {
    mount(host) {
      host.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-weight:800;font-size:14px;">Viral Hook</div>
            <div style="opacity:.7;font-size:12px;">Hazır</div>
          </div>

          <div style="opacity:.75;font-size:13px;">
            PPE hook output gelince burada otomatik text'leri basacağım.
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div data-slot="0" style="min-height:60px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.8;font-size:12px;">
              Hook #1
            </div>
            <div data-slot="1" style="min-height:60px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.8;font-size:12px;">
              Hook #2
            </div>
            <div data-slot="2" style="min-height:60px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.8;font-size:12px;">
              Hook #3
            </div>
            <div data-slot="3" style="min-height:60px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.8;font-size:12px;">
              Hook #4
            </div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
