/* =========================================================
   AIVO — SM PACK MODULE (FINAL / FAKE JOB)
   - Tema + platform okur
   - Job oluşturur
   - 4 adım status akışı
   - Sağ panelde placeholder çıktılar basar
   ========================================================= */

(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("[SM_PACK] AIVO_APP bulunamadı");
    return;
  }

  const COST = 8;

  // ---- Helpers ----
  function q(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function getTheme() {
    const active = q('.page-sm-pack .smpack-choice.is-active[data-smpack-theme]');
    return active ? active.getAttribute("data-smpack-theme") : "viral";
  }

  function getPlatform() {
    const active = q('.page-sm-pack .smpack-pill.is-active[data-smpack-platform]');
    return active ? active.getAttribute("data-smpack-platform") : "tiktok";
  }

  function prettyTheme(t) {
    switch (t) {
      case "viral": return "Viral";
      case "fun": return "Eğlenceli";
      case "emotional": return "Duygusal";
      case "brand": return "Marka / Tanıtım";
      default: return String(t || "");
    }
  }

  function prettyPlatform(p) {
    switch (p) {
      case "tiktok": return "TikTok";
      case "reels": return "Instagram Reels";
      case "shorts": return "YouTube Shorts";
      default: return String(p || "");
    }
  }

  function fakeOutputs(theme, platform) {
    const T = prettyTheme(theme);
    const P = prettyPlatform(platform);

    const caption =
      `(${T} • ${P}) Bugün sadece 10 saniye ayır: AIVO ile tek tıkla içerik üret. ` +
      `Kaydet, paylaş, akışa gir.`;

    const hashtags = [
      "#aivo", "#aivostudio", "#icerikuret", "#viral", "#reels", "#tiktok", "#shorts"
    ];

    return {
      caption,
      hashtags: hashtags.join(" "),
      cover: `Kapak: ${T} — ${P} (placeholder)`,
      loop: `Video Loop: 6–8 sn ritmik loop (placeholder)`,
    };
  }

  // ---- Theme selection (UI state) ----
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('.page-sm-pack .smpack-choice[data-smpack-theme]');
    if (!btn) return;

    qa('.page-sm-pack .smpack-choice.is-active').forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  // ---- Platform selection (UI state) ----
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('.page-sm-pack .smpack-pill[data-smpack-platform]');
    if (!btn) return;

    qa('.page-sm-pack .smpack-pill.is-active').forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  // ---- Generate button ----
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('[data-generate-sm-pack]');
    if (!btn) return;

    // Sayfa açık değilken yanlışlıkla tetiklenmesin (SPA-like)
    const page = q('.page-sm-pack[data-page="sm-pack"]');
    if (page && page.style && page.style.display === "none") {
      // bazı layoutlarda sayfa gizliyken display none olur
      // yine de güvenli dönüş
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    // 1) Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "SM_PACK",
      title: "Sosyal Medya Paketi",
      cost: COST,
      meta: {
        theme: theme,
        platform: platform,
      },
    });

    // 2) Status akışı (4 adım)
    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "İçerik üretiliyor…");
    }, 800);

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Formatlanıyor…");
    }, 1600);

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Tamamlandı");
      const out = fakeOutputs(theme, platform);

      // 3) Sağ panele çıktılar
      window.AIVO_APP.completeJob(job.id, {
        title: "Sosyal Medya Paketi Çıktıları",
        items: [
          { type: "label", value: `Tema: ${prettyTheme(theme)}` },
          { type: "label", value: `Platform: ${prettyPlatform(platform)}` },
          { type: "text", value: `Caption:\n${out.caption}` },
          { type: "text", value: `Hashtag:\n${out.hashtags}` },
          { type: "text", value: out.cover },
          { type: "text", value: out.loop },
        ],
      });
    }, 2400);
  });
})();
