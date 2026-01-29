/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL)
   SINGLE AUTH • SINGLE CREDIT SOURCE • NO UI CREDIT WRITE
   - Prompt yoksa: "Prompt Boş..." (kredi düşmez)
   - Prompt varsa: "Başarılı..." (kredi düşer) + (varsa) mock job
   - AIVO_APP yoksa: createJob ÇAĞRILMAZ (sadece warn)
   ========================================================= */

(function AIVO_SM_PACK_FINAL() {
  "use strict";

  // Çifte bind engeli
  if (window.__AIVO_SM_PACK_FINAL__) return;
  window.__AIVO_SM_PACK_FINAL__ = true;

  const COST = 4;

  /* -------------------- Toast helpers -------------------- */
  const toastErr  = (m) => (window.toast?.error   ? window.toast.error(m)   : console.warn("[toast.error missing]", m));
  const toastWarn = (m) => (window.toast?.warning ? window.toast.warning(m) : console.warn("[toast.warning missing]", m));
  const toastOk   = (m) => (window.toast?.success ? window.toast.success(m) : console.log("[toast.success missing]", m));

  /* -------------------- Page / Prompt helpers -------------------- */
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

    // Önce bilinen hedefler
    let el =
      page.querySelector?.("#smPackInput") ||
      page.querySelector?.("[data-sm-pack-prompt]");

    if (el) return el;

    // Sonra sayfa içi en olası alanlar
    el = page.querySelector?.("textarea");
    if (el) return el;

    el = page.querySelector?.('input[type="text"], input:not([type])');
    if (el) return el;

    // En kötü fallback
    return null;
  }

  function getPrompt() {
    const el = findPromptEl();
    if (!el) return "";
    // input/textarea
    if ("value" in el) return String(el.value || "").trim();
    // contenteditable / div
    return String(el.textContent || "").trim();
  }

  function getTheme() {
    const page = getPage();
    const a = page.querySelector?.(".smpack-choice.is-active");
    return a?.dataset?.smpackTheme || "viral";
  }

  function getPlatform() {
    const page = getPage();
    const a = page.querySelector?.(".smpack-pill.is-active");
    return a?.dataset?.smpackPlatform || "tiktok";
  }

  /* -------------------- Credits (TEK OTORİTE) -------------------- */
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

    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  }

  function goPricing() {
    location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit";
  }

  /* -------------------- Mock output (şimdilik) -------------------- */
  function addMockOutput({ prompt, theme, platform }) {
    const app = window.AIVO_APP;

    // AIVO_APP yoksa: KESİNLİKLE createJob deneme
    if (!app || typeof app.createJob !== "function") {
      console.warn("[SM-PACK] AIVO_APP missing (ignored - mock mode)");
      return;
    }

    const job = app.createJob({
      type: "SM_PACK",
      title: "AI Sosyal Medya Paketi",
      cost: COST
    });

    app.updateJobStatus(job.id, "Hazırlanıyor…");
    setTimeout(() => app.updateJobStatus(job.id, "Video oluşturuluyor…"), 700);
    setTimeout(() => {
      app.completeJob(job.id, {
        title: "Sosyal Medya Paketi",
        items: [
          { type: "text", value: `🎯 ${prompt}` },
          { type: "text", value: `📌 Tema: ${theme}` },
          { type: "text", value: `📱 Platform: ${platform}` }
        ]
      });
    }, 1400);
  }

  /* -------------------- Generate (TEK HANDLER) -------------------- */
  async function handleGenerate(btn) {
    const prompt = getPrompt();

    // 1) Prompt yoksa: TEK TOAST + KREDİ DÜŞME YOK
    if (!prompt) {
      toastWarn("Prompt Boş Sosyal Medya video için kısa bir açıklama yaz");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    btn.disabled = true;
    btn.dataset.loading = "1";

    // 2) Kredi düş (TEK YER)
    const r = await consumeCredits(COST, { theme, platform, promptLen: prompt.length });
    if (!r.ok) {
      btn.disabled = false;
      btn.dataset.loading = "0";
      toastErr("Yetersiz kredi. Kredi satın alman gerekiyor.");
      goPricing();
      return;
    }

    // 3) Prompt varsa: TEK BAŞARI TOAST
    toastOk(`Başarılı Üretim Başladı ${COST} Kredi düştü`);

    // 4) Mock output (AIVO_APP varsa)
    addMockOutput({ prompt, theme, platform });

    btn.disabled = false;
    btn.dataset.loading = "0";
  }

  /* -------------------- Click binding (capture) -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target?.closest?.("[data-generate-sm-pack]");
    if (!btn) return;

    // Tek otorite
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    handleGenerate(btn);
  }, true);

  console.log("[SM_PACK] FINAL module loaded ✅");
})();
