/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL)
   SINGLE AUTH • SINGLE CREDIT SOURCE • NO UI CREDIT WRITE
   ========================================================= */

(function AIVO_SM_PACK_FINAL() {
  "use strict";

  // Çifte bind engeli
  if (window.__AIVO_SM_PACK_FINAL__) return;
  window.__AIVO_SM_PACK_FINAL__ = true;

  const COST = 4;

  /* -------------------- Toast helpers -------------------- */
  const toastErr = (m) => window.toast?.error?.(m);
  const toastWarn = (m) => window.toast?.warning?.(m);
  const toastOk = (m) => window.toast?.success?.(m);

  /* -------------------- Page / Prompt helpers -------------------- */
  function getPage() {
    return (
      document.querySelector('.page[data-page="sm-pack"].is-active') ||
      document.querySelector('.page[data-page="sm-pack"]') ||
      document
    );
  }

  function findPromptEl() {
    const page = getPage();
    return (
      page.querySelector('#smPackInput') ||
      page.querySelector('[data-sm-pack-prompt]') ||
      page.querySelector('textarea') ||
      page.querySelector('input[type="text"]')
    );
  }

  function getPrompt() {
    const el = findPromptEl();
    return el ? String(el.value || el.textContent || "").trim() : "";
  }

  function getTheme() {
    const page = getPage();
    const a = page.querySelector('.smpack-choice.is-active');
    return a?.dataset?.smpackTheme || "viral";
  }

  function getPlatform() {
    const page = getPage();
    const a = page.querySelector('.smpack-pill.is-active');
    return a?.dataset?.smpackPlatform || "tiktok";
  }

  /* -------------------- Credits (TEK OTORİTE) -------------------- */
  async function consumeCredits(cost, meta) {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cost, meta })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  }

  /* -------------------- Fake output (şimdilik) -------------------- */
  function addMockOutput({ prompt, theme, platform }) {
    // Burada sadece job paneline mock ekleniyor;
    // video/gerçek çıktı SONRA bağlanacak.
    const app = window.AIVO_APP;
    if (!app || typeof app.createJob !== "function") return;

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
    if (!prompt) {
      toastWarn("Prompt Boş Sosyal Medya video için kısa bir açıklama yaz");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    // AIVO_APP yoksa: mock mod, sessizce devam
    const hasApp = !!(window.AIVO_APP && typeof window.AIVO_APP.createJob === "function");
    if (!hasApp) console.warn("[SM_PACK] AIVO_APP missing (ignored - mock mode)");

    btn.disabled = true;

    // 1) Kredi düş (TEK YER)
    const r = await consumeCredits(COST, { theme, platform, promptLen: prompt.length });
    if (!r.ok) {
      btn.disabled = false;
      toastErr("Yetersiz kredi. Kredi satın alman gerekiyor.");
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit";
      return;
    }

    // 2) Tek başarı toast
    toastOk(`Başarılı Üretim Başladı ${COST} Kredi düştü`);

    // 3) Mock output
    addMockOutput({ prompt, theme, platform });

    btn.disabled = false;
  }

  /* -------------------- Click binding (capture) -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target?.closest?.("[data-generate-sm-pack]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    handleGenerate(btn);
  }, true);

  console.log("[SM_PACK] FINAL module loaded (single credit source, no UI write)");
})();
