/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL / FAKE JOB) — SINGLE AUTH (CREDITS + TOAST)
   - Prompt alanını otomatik bulur (ID yanlış/eksik olsa bile)
   - Prompt yoksa: kredi düşmez, tek warning toast
   - Prompt varsa: /api/credits/consume ile kredi düşer
   - Başladı + kredi düştü toast (tek)
   - Sonra fake job output basar
   ========================================================= */

(function AIVO_APP_SM_PACK_SINGLE_AUTH() {
  "use strict";

  // Çifte bind’i engelle
  if (window.__AIVO_APP_SM_PACK_WIRED__) return;
  window.__AIVO_APP_SM_PACK_WIRED__ = true;

  const COST = 5;

  /* -------------------- Toast helpers -------------------- */
  function tError(msg) {
    (window.toast && window.toast.error) ? window.toast.error(msg) : console.warn("[toast.error]", msg);
  }
  function tWarn(msg) {
    (window.toast && window.toast.warning) ? window.toast.warning(msg) : console.warn("[toast.warning]", msg);
  }
  function tOk(msg) {
    (window.toast && window.toast.success) ? window.toast.success(msg) : console.log("[toast.success]", msg);
  }

  /* -------------------- Page helpers -------------------- */
  function getActiveSmPackPage() {
    return (
      document.querySelector('.page[data-page="sm-pack"].is-active') ||
      document.querySelector('.page[data-page="sm-pack"][aria-hidden="false"]') ||
      document.querySelector('.page[data-page="sm-pack"]') ||
      document
    );
  }

  function isVisible(el) {
    if (!el || el === document) return true;
    const cs = window.getComputedStyle(el);
    if (!cs) return true;
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    if (el.offsetParent === null && cs.position !== "fixed") return false;
    return true;
  }

  function scorePromptCandidate(el) {
    if (!el) return -999;
    if (!isVisible(el)) return -50;

    let score = 0;
    const tag = (el.tagName || "").toLowerCase();

    if (tag === "textarea") score += 50;
    if (tag === "input") score += 35;
    if (el.isContentEditable) score += 25;

    if (tag === "input") {
      const t = String(el.getAttribute("type") || "").toLowerCase();
      if (!t || t === "text" || t === "search") score += 15;
      else score -= 20;
    }

    const hay = [
      el.id,
      el.name,
      el.className,
      el.getAttribute && el.getAttribute("placeholder"),
      el.getAttribute && el.getAttribute("aria-label"),
      el.getAttribute && el.getAttribute("data-label"),
      el.getAttribute && el.getAttribute("data-name"),
    ].filter(Boolean).join(" ").toLowerCase();

    if (hay.includes("smpack")) score += 10;
    if (hay.includes("prompt")) score += 15;
    if (hay.includes("message") || hay.includes("mesaj")) score += 15;
    if (hay.includes("marka") || hay.includes("ürün") || hay.includes("urun")) score += 10;

    if (String((el.getAttribute && el.getAttribute("maxlength")) || "") !== "") score += 3;

    return score;
  }

  function findPromptElement() {
    const page = getActiveSmPackPage();

    let el = page.querySelector && page.querySelector("#smPackInput");
    if (el && isVisible(el)) return el;

    el = page.querySelector && page.querySelector("[data-sm-pack-prompt]");
    if (el && isVisible(el)) return el;

    const candidates = [];
    if (page.querySelectorAll) {
      page.querySelectorAll("textarea, input, [contenteditable='true']")
        .forEach((node) => candidates.push(node));
    }

    if (!candidates.length && document.querySelectorAll) {
      document.querySelectorAll(
        ".page[data-page='sm-pack'] textarea, .page[data-page='sm-pack'] input, .page[data-page='sm-pack'] [contenteditable='true']"
      ).forEach((node) => candidates.push(node));
    }

    if (!candidates.length) return null;

    let best = null;
    let bestScore = -999;
    for (let i = 0; i < candidates.length; i++) {
      const s = scorePromptCandidate(candidates[i]);
      if (s > bestScore) { bestScore = s; best = candidates[i]; }
    }
    return best;
  }

  function readValue(el) {
    if (!el) return "";
    if (el.matches && el.matches("input, textarea")) return String(el.value || "").trim();
    return String(el.textContent || "").trim();
  }

  function getPrompt() {
    const el = findPromptElement();
    if (!el) return "";
    try { if (!el.id) el.id = "smPackInput"; } catch (_) {}
    return readValue(el);
  }

  function getSelectedTheme() {
    const page = getActiveSmPackPage();
    const active = page.querySelector && page.querySelector(".smpack-choice.is-active");
    return active ? active.dataset.smpackTheme : "viral";
  }

  function getSelectedPlatform() {
    const page = getActiveSmPackPage();
    const active = page.querySelector && page.querySelector(".smpack-pill.is-active");
    return active ? active.dataset.smpackPlatform : "tiktok";
  }

  function generatePack(prompt, theme, platform) {
    return [
      `🎯 ${prompt}`,
      `📌 Tema: ${String(theme || "").toUpperCase()}`,
      `📱 Platform: ${platform}`,
      `🔥 Paylaşılmaya hazır sosyal medya içeriği.`,
    ];
  }

  /* -------------------- Credits helpers (VIDEO ile aynı) -------------------- */
  function setTopCreditsUI(nextCredits) {
    const nodes = [
      document.querySelector("#topCreditCount"),
      document.querySelector("#topCreditsCount"),
      document.querySelector("[data-credit-count]"),
      document.querySelector("[data-credits]"),
    ].filter(Boolean);

    nodes.forEach(n => {
      if ("value" in n) n.value = String(nextCredits);
      else n.textContent = String(nextCredits);
    });
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

    if (!res.ok) return { ok: false, status: res.status, data };

    const credits =
      (data && (data.credits ?? data.remainingCredits ?? data.balance)) ??
      null;

    return { ok: true, status: res.status, data, credits };
  }

  function goPricingInsufficient() {
    const to = encodeURIComponent(location.pathname + location.search + location.hash);
    location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
  }

  /* -------------------- Theme select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-choice");
    if (!btn) return;

    const page = getActiveSmPackPage();
    page.querySelectorAll && page.querySelectorAll(".smpack-choice.is-active")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Platform select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-pill");
    if (!btn) return;

    const page = getActiveSmPackPage();
    page.querySelectorAll && page.querySelectorAll(".smpack-pill.is-active")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Generate (TEK OTORİTE) -------------------- */
  async function handleGenerate(btn) {
    const app = window.AIVO_APP;
    if (!app || typeof app.createJob !== "function") {
      tError("Sistem hazır değil. Sayfayı yenileyip tekrar dene.");
      return;
    }

    const prompt = getPrompt();
    if (!prompt) {
      // kredi düşme yok
      tWarn("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");
      return;
    }

    const theme = getSelectedTheme();
    const platform = getSelectedPlatform();

    btn.disabled = true;
    btn.dataset.loading = "1";

    // 1) kredi düş
    const r = await consumeCredits(COST, {
      theme,
      platform,
      promptLen: prompt.length
    });

    if (!r.ok) {
      btn.disabled = false;
      btn.dataset.loading = "0";
      tError("Yetersiz kredi. Kredi satın alman gerekiyor.");
      goPricingInsufficient();
      return;
    }

    // 2) UI kredi + tek toast
    if (typeof r.credits === "number") setTopCreditsUI(r.credits);
    tOk(`Üretim başladı. ${COST} kredi düşüldü.`);

    // 3) fake job
    const job = app.createJob({
      type: "SM_PACK",
      title: "AI Sosyal Medya Paketi",
      cost: COST,
    });

    app.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => app.updateJobStatus(job.id, "Formatlar oluşturuluyor…"), 700);

    setTimeout(() => {
      const items = generatePack(prompt, theme, platform);
      app.completeJob(job.id, {
        title: "Sosyal Medya Paketi Çıktıları",
        items: items.map((text) => ({ type: "text", value: text })),
      });
    }, 1500);

    btn.disabled = false;
    btn.dataset.loading = "0";
  }

  document.addEventListener("click", function (e) {
    const btn = e.target?.closest?.("[data-generate-sm-pack]");
    if (!btn) return;

    // video gibi tek otorite: başka handler’lar bulaşmasın
    e.preventDefault();
    e.stopPropagation();

    handleGenerate(btn);
  }, true); // capture=true (kritik)

  console.log("[SM_PACK] module loaded OK (single-auth credits+toast)");
})();
