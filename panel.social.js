(function () {
  if (!window.RightPanel) return;

  const safeStr = (v) => String(v == null ? "" : v).trim();
  const low = (v) => safeStr(v).toLowerCase();

  function attachPPEBridge(host) {
    if (!window.PPE) return;

    const slots = {
      a: host.querySelector('[data-slot="a"]'),
      b: host.querySelector('[data-slot="b"]'),
      c: host.querySelector('[data-slot="c"]'),
      d: host.querySelector('[data-slot="d"]'),
    };

    function setImg(slotEl, url) {
      if (!slotEl || !url) return;
      slotEl.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" />
      `;
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

    function isSocial(job, out) {
      // social motoru kurulu değilken bile çalışsın diye toleranslı:
      const app = low(out?.meta?.app || job?.app || job?.routeKey || job?.module || "");
      const t = low(out?.type);

      // net: type social
      if (t.includes("social")) return true;

      // genelde socialpack çıktıları image olur, app/metada social görünür
      if (t === "image" || t === "png" || t === "jpg" || t.includes("img")) {
        if (app.includes("social") || app.includes("pack") || app.includes("sm-pack")) return true;
      }

      return false;
    }

    // prev handler zincirleme
    const prev = PPE.onOutput;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}

      if (!out) return;
      if (!isSocial(job, out)) return;

      const url = pickUrl(out);
      if (!url) return;

      // slot seçimi: out.slot / out.index / out.variant'e göre bas
      const slotKey =
        low(out?.slot) ||
        (out?.index === 0 ? "a" : out?.index === 1 ? "b" : out?.index === 2 ? "c" : out?.index === 3 ? "d" : "");

      if (slotKey && slots[slotKey]) {
        setImg(slots[slotKey], url);
        return;
      }

      // fallback: ilk boş slota koy
      const order = ["a", "b", "c", "d"];
      for (const k of order) {
        if (!slots[k]) continue;
        if (!slots[k].querySelector("img")) {
          setImg(slots[k], url);
          return;
        }
      }

      // hepsi doluysa A'yı overwrite
      setImg(slots.a, url);
    };

    // cleanup
    return () => {
      PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("social", {
    mount(host) {
      host.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-weight:800;font-size:14px;">Sosyal Medya Paketi</div>
            <div style="opacity:.7;font-size:12px;">Hazır</div>
          </div>

          <div style="opacity:.75;font-size:13px;">
            PPE social output gelince burada otomatik görselleri basacağım.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div data-slot="a" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot A</div>
            <div data-slot="b" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot B</div>
            <div data-slot="c" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot C</div>
            <div data-slot="d" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot D</div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
