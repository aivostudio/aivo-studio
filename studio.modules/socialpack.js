/* =========================================================
   AIVO — SOCIAL MEDIA PACK (FINAL)
   - Prompt boşsa: tek warning toast, kredi düşmez
   - Prompt doluysa: kredi düşer, tek success toast
   - Fal create (app=social) 4x çağrılır -> 4 image output -> PPE.apply ile basılır
   ========================================================= */

(function AIVO_SM_PACK_FINAL_MIN() {
  "use strict";

  if (window.__AIVO_SM_PACK_FINAL_MIN__) return;
  window.__AIVO_SM_PACK_FINAL_MIN__ = true;

  const COST = 4;

  const toastErr  = (m) => window.toast?.error?.(m);
  const toastWarn = (m) => window.toast?.warning?.(m);
  const toastOk   = (m) => window.toast?.success?.(m);

  function getPage() {
    return (
      document.querySelector('.page[data-page="sm-pack"].is-active') ||
      document.querySelector('.page[data-page="sm-pack"][aria-hidden="false"]') ||
      document.querySelector('.page[data-page="sm-pack"]') ||
      document
    );
  }

  function findPromptEl() {
    const page = getPage();
    return (
      page.querySelector("#smPackInput") ||
      page.querySelector("[data-sm-pack-prompt]") ||
      page.querySelector("textarea") ||
      page.querySelector('input[type="text"]') ||
      page.querySelector("input")
    );
  }

  function getPrompt() {
    const el = findPromptEl();
    if (!el) return "";
    const v = ("value" in el) ? el.value : el.textContent;
    return String(v || "").trim();
  }

  function getTheme() {
    const page = getPage();
    const a = page.querySelector(".smpack-choice.is-active");
    return a?.dataset?.smpackTheme || "viral";
  }

  function getPlatform() {
    const page = getPage();
    const a = page.querySelector(".smpack-pill.is-active");
    return a?.dataset?.smpackPlatform || "tiktok";
  }

  async function consumeCredits(cost, meta) {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "studio_sm_pack_generate",
        meta: meta || {}
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  // create çağrısı — backend "missing_prompt" yemesin diye prompt'u 3 yerde de yolluyoruz
  async function createSocialImage({ prompt, theme, platform }) {
    const body = {
      prompt,
      input: { prompt },
      text: prompt,
      theme,
      platform,
      // backend destekliyorsa okur; desteklemiyorsa ignore eder
      num_outputs: 1
    };

    const res = await fetch("/api/providers/fal/predictions/create?app=social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    // beklenen: { ok:true, status:"succeeded", output:"https://...jpg" }
    const url = String(data?.output || data?.url || data?.image || "").trim();

    if (!res.ok || !data?.ok || !url) {
      const err = String(data?.error || data?.message || "create_failed").trim();
      throw new Error(err || "create_failed");
    }

    return url;
  }

  async function handleGenerate(btn) {
    const prompt = getPrompt();
    if (!prompt) {
      toastWarn("Prompt Boş Sosyal Medya video için kısa bir açıklama yaz");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    // 1) kredi düşür
    btn.disabled = true;
    const r = await consumeCredits(COST, { theme, platform, promptLen: prompt.length });
    if (!r.ok) {
      btn.disabled = false;
      toastErr("Yetersiz kredi. Kredi satın alman gerekiyor.");
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit";
      return;
    }

    toastOk(`Başarılı Üretim Başladı ${COST} Kredi düştü`);

    // 2) paneli aç (kullanıcı anında görsün)
    try { window.RightPanel?.force?.("social"); } catch (_) {}

    // 3) 4x create -> 4 url
    // Not: btn disabled üretim boyunca kalsın
    try {
      const urls = [];
      for (let i = 0; i < 4; i++) {
        // seri çalıştırıyoruz (rate-limit yememek için)
        const u = await createSocialImage({ prompt, theme, platform });
        urls.push(u);
      }

      // 4) PPE.apply ile bas (panel.social slotları buradan doluyor)
      if (window.PPE && typeof window.PPE.apply === "function") {
        window.PPE.apply({
          outputs: urls.map((u, idx) => ({
            type: "image",
            url: u,
            meta: { app: "social", index: idx }
          })),
          meta: { app: "social" }
        });
      } else {
        // PPE yoksa en azından console'a basalım
        console.log("[SM_PACK] outputs:", urls);
      }
    } catch (e) {
      toastErr("Social üretim hata verdi: " + (e?.message || "unknown"));
      return;
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("click", function (e) {
    const btn = e.target?.closest?.("[data-generate-sm-pack]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    handleGenerate(btn);
  }, true);

  console.log("[SM_PACK] FINAL_MIN loaded (credits+toast+fal create x4)");
})();
