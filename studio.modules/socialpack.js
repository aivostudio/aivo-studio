/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL / FAKE JOB) — FIXED
   - Aktif SM Pack sayfasından input okur (scope’lu)
   - input/textarea => value, değilse textContent (contenteditable uyumlu)
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
    // Sizde sayfa sistemi var: aktif sayfayı mümkün olduğunca dar scope’la yakala
    return (
      document.querySelector('.page[data-page="sm-pack"].is-active') ||
      document.querySelector('.page[data-page="sm-pack"][aria-hidden="false"]') ||
      document.querySelector('.page[data-page="sm-pack"]')
    );
  }

  function getPrompt() {
    const page = getActiveSmPackPage();
    const el = page ? page.querySelector("#smPackInput") : document.getElementById("smPackInput");
    if (!el) return "";

    // input/textarea
    if (el.matches && el.matches("input, textarea")) {
      return String(el.value || "").trim();
    }

    // contenteditable / div / custom
    const txt = (el.textContent || "").trim();
    if (txt) return txt;

    // bazı custom inputlar data-value kullanabilir (fallback)
    const dv = (el.getAttribute && el.getAttribute("data-value")) || "";
    return String(dv).trim();
  }

  function getSelectedTheme() {
    const page = getActiveSmPackPage() || document;
    const active = page.querySelector(".smpack-choice.is-active");
    return active ? active.dataset.smpackTheme : "viral";
  }

  function getSelectedPlatform() {
    const page = getActiveSmPackPage() || document;
    const active = page.querySelector(".smpack-pill.is-active");
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

    const page = getActiveSmPackPage() || document;

    page.querySelectorAll(".smpack-choice.is-active").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Platform select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-pill");
    if (!btn) return;

    const page = getActiveSmPackPage() || document;

    page.querySelectorAll(".smpack-pill.is-active").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  /* -------------------- Generate button -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-sm-pack]");
    if (!btn) return;

    const app = window.AIVO_APP;
    if (!app || typeof app.createJob !== "function") {
      console.warn("[SM_PACK] AIVO_APP hazır değil veya createJob yok", app);
      alert("Sistem hazır değil (AIVO_APP yok). Sayfayı yenileyip tekrar dene.");
      return;
    }

    const prompt = getPrompt();
    const theme = getSelectedTheme();
    const platform = getSelectedPlatform();

    console.log("[SM_PACK] click", {
      inputCount: (getActiveSmPackPage() || document).querySelectorAll("#smPackInput").length,
      value: prompt,
      theme,
      platform,
    });

    if (!prompt) {
      alert("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");
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

  console.log("[SM_PACK] module loaded OK (fixed)");
})();
