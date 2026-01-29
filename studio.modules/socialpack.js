/* =========================================================
   AIVO — SOCIAL MEDIA PACK (FINAL)
   - Prompt boşsa: tek warning toast, kredi düşmez
   - Prompt doluysa: kredi düşer, tek success toast
   - AIVO_APP / createJob kullanılmaz (şimdilik)
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

  async function handleGenerate(btn) {
    const prompt = getPrompt();
    if (!prompt) {
      toastWarn("Prompt Boş Sosyal Medya video için kısa bir açıklama yaz");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    btn.disabled = true;

    const r = await consumeCredits(COST, { theme, platform, promptLen: prompt.length });

    btn.disabled = false;

    if (!r.ok) {
      toastErr("Yetersiz kredi. Kredi satın alman gerekiyor.");
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit";
      return;
    }

    toastOk(`Başarılı Üretim Başladı ${COST} Kredi düştü`);
  }

  document.addEventListener("click", function (e) {
    const btn = e.target?.closest?.("[data-generate-sm-pack]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    handleGenerate(btn);
  }, true);

  console.log("[SM_PACK] FINAL_MIN loaded (credits+toast only)");
})();
