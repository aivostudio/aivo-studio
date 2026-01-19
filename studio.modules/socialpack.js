/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL / FAKE JOB) — HARD FIX
   - SM Pack prompt alanını otomatik bulur (ID yanlış/eksik olsa bile)
   - input/textarea => value, contenteditable/div => textContent
   - Bulduğu alana runtime’da id="smPackInput" atar
   - Delegated click ile job oluşturur + fake çıktı basar
   ========================================================= */

(function () {
  "use strict";

  // Çifte bind’i engelle
  if (window.__aivoSmPackBound) return;
  window.__aivoSmPackBound = true;

  const COST = 5;

  /* -------------------- Helpers -------------------- */

  function getActiveSmPackPage() {
    return (
      document.querySelector('.page[data-page="sm-pack"].is-active') ||
      document.querySelector('.page[data-page="sm-pack"][aria-hidden="false"]') ||
      document.querySelector('.page[data-page="sm-pack"]') ||
      document // en kötü fallback
    );
  }

  function isVisible(el) {
    if (!el || el === document) return true;
    const cs = window.getComputedStyle(el);
    if (!cs) return true;
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    // offsetParent bazı durumlarda false positive olabilir ama pratikte iş görür
    if (el.offsetParent === null && cs.position !== "fixed") return false;
    return true;
  }

  function scorePromptCandidate(el) {
    if (!el) return -999;

    // görünür değilse ele
    if (!isVisible(el)) return -50;

    let score = 0;
    const tag = (el.tagName || "").toLowerCase();

    // en iyi adaylar
    if (tag === "textarea") score += 50;
    if (tag === "input") score += 35;
    if (el.isContentEditable) score += 25;

    // type=text benzeri
    if (tag === "input") {
      const t = String(el.getAttribute("type") || "").toLowerCase();
      if (!t || t === "text" || t === "search") score += 15;
      else score -= 20; // checkbox vs olmasın
    }

    // isimler / label ipuçları
    const hay = [
      el.id,
      el.name,
      el.className,
      el.getAttribute && el.getAttribute("placeholder"),
      el.getAttribute && el.getAttribute("aria-label"),
      el.getAttribute && el.getAttribute("data-label"),
      el.getAttribute && el.getAttribute("data-name"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (hay.includes("smpack")) score += 10;
    if (hay.includes("prompt")) score += 15;
    if (hay.includes("message") || hay.includes("mesaj")) score += 15;
    if (hay.includes("marka") || hay.includes("ürün") || hay.includes("urun")) score += 10;

    // max length (1 cümle) gibi bir hint varsa
    if (String(el.getAttribute && el.getAttribute("maxlength") || "") !== "") score += 3;

    return score;
  }

  function findPromptElement() {
    const page = getActiveSmPackPage();

    // 1) Önce ID ile
    let el = page.querySelector && page.querySelector("#smPackInput");
    if (el && isVisible(el)) return el;

    // 2) data hook varsa
    el = page.querySelector && page.querySelector("[data-sm-pack-prompt]");
    if (el && isVisible(el)) return el;

    // 3) textarea/input/contenteditable adaylarını tara ve skorla
    const candidates = [];
    if (page.querySelectorAll) {
      page
        .querySelectorAll("textarea, input, [contenteditable='true']")
        .forEach((node) => candidates.push(node));
    }

    // 4) Eğer sayfada hiç yoksa (bazı render’larda wrapper farklı olabiliyor) tüm dokümanda tara
    if (!candidates.length && document.querySelectorAll) {
      document
        .querySelectorAll(".page[data-page='sm-pack'] textarea, .page[data-page='sm-pack'] input, .page[data-page='sm-pack'] [contenteditable='true']")
        .forEach((node) => candidates.push(node));
    }

    if (!candidates.length) return null;

    // skorla ve en iyiyi seç
    let best = null;
    let bestScore = -999;
    for (let i = 0; i < candidates.length; i++) {
      const s = scorePromptCandidate(candidates[i]);
      if (s > bestScore) {
        bestScore = s;
        best = candidates[i];
      }
    }

    return best;
  }

  function readValue(el) {
    if (!el) return "";
    // input/textarea
    if (el.matches && el.matches("input, textarea")) return String(el.value || "").trim();
    // contenteditable / div
    return String(el.textContent || "").trim();
  }

  function getPrompt() {
    const el = findPromptElement();
    if (!el) return "";

    // Bulduğumuz gerçek prompt alanına runtime id at (debug + selector stabilitesi)
    try {
      if (!el.id) el.id = "smPackInput";
    } catch (_) {}

    const v = readValue(el);
    return v;
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

  /* -------------------- Theme select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-choice");
    if (!btn) return;

    const page = getActiveSmPackPage();
    page.querySelectorAll && page.querySelectorAll(".smpack-choice.is-active").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Platform select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-pill");
    if (!btn) return;

    const page = getActiveSmPackPage();
    page.querySelectorAll && page.querySelectorAll(".smpack-pill.is-active").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Generate button -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-sm-pack]");
    if (!btn) return;

    const app = window.AIVO_APP;
    if (!app || typeof app.createJob !== "function") {
      console.warn("[SM_PACK] AIVO_APP hazır değil veya createJob yok", app);
     window.toast.error("Sistem hazır değil. Sayfayı yenileyip tekrar dene.");

      return;
    }

    const page = getActiveSmPackPage();
    const promptEl = findPromptElement();
    const prompt = getPrompt();
    const theme = getSelectedTheme();
    const platform = getSelectedPlatform();

    console.log("[SM_PACK] click", {
      pageFound: !!page,
      promptEl: promptEl ? (promptEl.tagName + (promptEl.id ? "#" + promptEl.id : "") + (promptEl.className ? "." + String(promptEl.className).split(" ").join(".") : "")) : null,
      promptPreview: prompt ? prompt.slice(0, 80) : "",
      theme,
      platform,
      inputCountInPage: page.querySelectorAll ? page.querySelectorAll("#smPackInput").length : null,
    });

    if (!prompt) {
      window.toast.warning("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");

      return;
    }

    // 1) Job oluştur
    const job = app.createJob({
      type: "SM_PACK",
      title: "AI Sosyal Medya Paketi",
      cost: COST,
    });

    // 2) Status akışı
    app.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      app.updateJobStatus(job.id, "Formatlar oluşturuluyor…");
    }, 700);

    setTimeout(() => {
      const items = generatePack(prompt, theme, platform);

      app.completeJob(job.id, {
        title: "Sosyal Medya Paketi Çıktıları",
        items: items.map((text) => ({ type: "text", value: text })),
      });
    }, 1500);
  });

  console.log("[SM_PACK] module loaded OK (hard-fix)");
})();
