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

    function setVideo(slotEl, url) {
      if (!slotEl || !url) return;
      slotEl.innerHTML = `
        <video controls playsinline style="width:100%;border-radius:12px;background:#000;display:block;">
          <source src="${url}" type="video/mp4" />
        </video>
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
        out?.video_url ||
        out?.image_url ||
        out?.image?.url ||
        out?.video?.url ||
        (Array.isArray(out?.videos) ? out.videos?.[0]?.url : null) ||
        (Array.isArray(out?.images) ? out.images?.[0]?.url : null) ||
        null
      );
    }

    function isHook(job, out) {
      const app = low(out?.meta?.app || job?.app || job?.routeKey || job?.module || "");
      const t = low(out?.type);

      // direkt hook type
      if (t.includes("hook")) return true;

      // video output ama hook app'ten gelmiş
      if (t === "video" || t.includes("mp4")) {
        if (app.includes("hook") || app.includes("viral")) return true;
      }

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

    const myHandler = (job, out) => {
      try { prev && prev(job, out); } catch {}

      if (!out) return;
      if (!isHook(job, out)) return;

      const idx = Number(out?.index);
      const slotIndex = Number.isFinite(idx) ? idx : null;

      const text = pickText(out);
      const url = pickUrl(out);
      const type = low(out?.type);

      function applyToSlot(el) {
        if (!el) return false;

        if ((type === "video" || url?.endsWith(".mp4")) && url) {
          setVideo(el, url);
          return true;
        }

        if (text) {
          setText(el, text);
          return true;
        }

        if (url) {
          setImg(el, url);
          return true;
        }

        return false;
      }

      // hedef slot varsa oraya bas
      if (slotIndex != null && slots[slotIndex]) {
        if (applyToSlot(slots[slotIndex])) return;
      }

      // yoksa ilk boş slota bas
      for (let i = 0; i < slots.length; i++) {
        const el = slots[i];
        if (!el) continue;

        const hasVideo = el.querySelector("video");
        const hasImg = el.querySelector("img");
        const hasText = el.textContent.trim().length > 0;

        if (!hasVideo && !hasImg && !hasText) {
          if (applyToSlot(el)) return;
        }
      }

      // hepsi doluysa ilk slot overwrite
      if (slots[0]) {
        applyToSlot(slots[0]);
      }
    };

    PPE.onOutput = myHandler;

    return () => {
      // sadece biz set ettiysek geri al (race protection)
      if (PPE.onOutput === myHandler) PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("hook", {
    mount(host) {
      host.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-weight:800;font-size:14px;">Viral Hook</div>
            <div style="opacity:.7;font-size:12px;">Video Hook</div>
          </div>

          <div style="opacity:.75;font-size:13px;">
            PPE hook video output gelince burada otomatik 4 slot doldurulur.
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div data-slot="0" style="min-height:90px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.9;font-size:12px;">
              Hook Video #1
            </div>
            <div data-slot="1" style="min-height:90px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.9;font-size:12px;">
              Hook Video #2
            </div>
            <div data-slot="2" style="min-height:90px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.9;font-size:12px;">
              Hook Video #3
            </div>
            <div data-slot="3" style="min-height:90px;padding:10px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);opacity:.9;font-size:12px;">
              Hook Video #4
            </div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
