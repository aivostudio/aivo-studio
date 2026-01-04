/* =========================================================
   AIVO — SM PACK MODULE (FINAL / FAKE JOB)
   - HTML selectors birebir:
     #smPackInput
     [data-smpack-theme]
     [data-smpack-platform]
     [data-generate-sm-pack]
   - Job oluşturur + status akışı + fake çıktılar üretir
   ========================================================= */

(function () {
  "use strict";

  // AIVO_APP yoksa çık
  if (!window.AIVO_APP) {
    console.warn("[SM_PACK] AIVO_APP bulunamadı");
    return;
  }

  const COST = 5;

  // ---------- Helpers ----------
  function getBrief() {
    const el = document.getElementById("smPackInput");
    return el ? el.value.trim() : "";
  }

  function getTheme() {
    const active =
      document.querySelector(".page-sm-pack .smpack-choice.is-active") ||
      document.querySelector(".page-sm-pack [data-smpack-theme].is-active");
    return active ? (active.getAttribute("data-smpack-theme") || "viral") : "viral";
  }

  function getPlatform() {
    const active =
      document.querySelector(".page-sm-pack .smpack-pill.is-active") ||
      document.querySelector(".page-sm-pack [data-smpack-platform].is-active");
    return active ? (active.getAttribute("data-smpack-platform") || "tiktok") : "tiktok";
  }

  function platformLabel(p) {
    if (p === "reels") return "Instagram Reels";
    if (p === "shorts") return "YouTube Shorts";
    return "TikTok";
  }

  function themeLabel(t) {
    if (t === "fun") return "Eğlenceli";
    if (t === "emotional") return "Duygusal";
    if (t === "brand") return "Marka / Tanıtım";
    return "Viral";
  }

  function buildPackOutputs(brief, theme, platform) {
    const t = themeLabel(theme);
    const p = platformLabel(platform);

    // “paket” çıktısı: hook + caption + hashtag + video/cap/cover placeholder
    const hook = `Dur ve dinle: ${brief}`;
    const caption = `${t} içerik fikri (${p}): ${brief} — bunu 10 saniyede anlat!`;
    const hashtags =
      platform === "tiktok"
        ? "#fyp #keşfet #viral #aivo #ai"
        : platform === "reels"
        ? "#reels #keşfet #viral #aivo #ai"
        : "#shorts #keşfet #viral #aivo #ai";

    return [
      { type: "text", value: `🎯 Tema: ${t} | Platform: ${p}` },
      { type: "text", value: `🎬 Hook: ${hook}` },
      { type: "text", value: `📝 Caption: ${caption}` },
      { type: "text", value: `#️⃣ Hashtag: ${hashtags}` },
      { type: "text", value: "🖼️ Kapak: (yakında) — kısa başlık + görsel konsept" },
      { type: "text", value: "🎵 Müzik: (yakında) — 10–15 sn loop önerisi" },
      { type: "text", value: "🎞️ Video Loop: (yakında) — 6–10 sn sahne önerisi" },
    ];
  }

  // ---------- UI: Tema seçimi ----------
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".page-sm-pack [data-smpack-theme]");
    if (!btn) return;

    document
      .querySelectorAll(".page-sm-pack [data-smpack-theme].is-active")
      .forEach((x) => x.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  // ---------- UI: Platform seçimi ----------
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".page-sm-pack [data-smpack-platform]");
    if (!btn) return;

    document
      .querySelectorAll(".page-sm-pack [data-smpack-platform].is-active")
      .forEach((x) => x.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  // ---------- Generate ----------
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".page-sm-pack [data-generate-sm-pack]");
    if (!btn) return;

    const brief = getBrief();
    if (!brief) {
      alert("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    // 1) Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "SM_PACK",
      title: "Sosyal Medya Paketi",
      cost: COST,
    });

    // 2) Status akışı
    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Paket oluşturuluyor…");
    }, 650);

    setTimeout(() => {
      const items = buildPackOutputs(brief, theme, platform);

      window.AIVO_APP.completeJob(job.id, {
        title: "SM Pack Çıktıları",
        items,
      });
    }, 1400);
  });
})();
