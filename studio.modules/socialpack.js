/* =========================================================
   AIVO — SOCIAL PACK MODULE (FINAL / FAKE JOB)
   - [data-generate-sm-pack] butonuna basınca Job oluşturur
   - Tema + Platform seçimini okur
   - 1 paket çıktısı üretir (caption + hashtag + kısa plan)
   ========================================================= */
(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("[SM_PACK] AIVO_APP bulunamadı (studio.app.js yüklenmedi?)");
    return;
  }

  const COST = 5;

  function getBrief() {
    // SM Pack input’unu daha sağlam yakalayalım:
    // 1) id varsa onu al
    const byId = document.getElementById("smPackInput");
    if (byId) return (byId.value || "").trim();

    // 2) yoksa sayfa içindeki ilk input’u yakala
    const page = document.querySelector('.page[data-page="sm-pack"]');
    const input = page ? page.querySelector("input.input") : null;
    return input ? (input.value || "").trim() : "";
  }

  function getTheme() {
    const active = document.querySelector('.page[data-page="sm-pack"] .smpack-choice.is-active');
    return active ? (active.getAttribute("data-smpack-theme") || "viral") : "viral";
  }

  function getPlatform() {
    const active = document.querySelector('.page[data-page="sm-pack"] .smpack-pill.is-active');
    return active ? (active.getAttribute("data-smpack-platform") || "tiktok") : "tiktok";
  }

  function labelPlatform(p) {
    if (p === "reels") return "Instagram Reels";
    if (p === "shorts") return "YouTube Shorts";
    return "TikTok";
  }

  function buildPack(brief, theme, platform) {
    const plat = labelPlatform(platform);

    const caption =
      theme === "brand"
        ? `Yeni duyuru: ${brief}  \n${plat} için hazır. Detaylar profilde.`
        : theme === "emotional"
        ? `Bunu yaşayan anlar… ${brief}  \nDevamı için kaydet.`
        : theme === "fun"
        ? `Bunu denemeyen kaldı mı? ${brief}  \nYorumlara “DENEDİM” yaz.`
        : `Bunu bilmiyorsan geç kaldın: ${brief}  \n3 saniyede yakalar.`;

    const hashtags =
      theme === "brand"
        ? "#aivo #aivostudio #yapayzeka #startup #ürün #tanıtım #reels"
        : theme === "emotional"
        ? "#aivo #aivostudio #duygusal #hikaye #reels #shorts"
        : theme === "fun"
        ? "#aivo #aivostudio #komik #trend #tiktok #reels"
        : "#aivo #aivostudio #viral #trend #tiktok #reels #shorts";

    const shotlist = [
      `0–1sn: Büyük yazı — “${brief}”`,
      `1–2sn: Yakın plan / hızlı zoom`,
      `2–4sn: 3 madde (fayda / sonuç / çağrı)`,
      `4–6sn: CTA — “Kaydet / Paylaş”`,
    ];

    return { caption, hashtags, shotlist, plat };
  }

  // Tema seçimi
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('.page[data-page="sm-pack"] .smpack-choice');
    if (!btn) return;

    document
      .querySelectorAll('.page[data-page="sm-pack"] .smpack-choice.is-active')
      .forEach((x) => x.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  // Platform seçimi
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('.page[data-page="sm-pack"] .smpack-pill');
    if (!btn) return;

    document
      .querySelectorAll('.page[data-page="sm-pack"] .smpack-pill.is-active')
      .forEach((x) => x.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  // Generate
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-sm-pack]");
    if (!btn) return;

    const brief = getBrief();
    if (!brief) {
      alert("Lütfen 1 cümlelik Marka / Ürün / Mesaj gir.");
      return;
    }

    const theme = getTheme();
    const platform = getPlatform();

    // Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "SM_PACK",
      title: "Sosyal Medya Paketi",
      cost: COST,
    });

    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Paket oluşturuluyor…");
    }, 700);

    setTimeout(() => {
      const pack = buildPack(brief, theme, platform);

      window.AIVO_APP.completeJob(job.id, {
        title: `SM Pack (${pack.plat})`,
        items: [
          { type: "text", value: `🎯 Brief: ${brief}` },
          { type: "text", value: `🎨 Tema: ${theme}` },
          { type: "text", value: `🧩 Caption:\n${pack.caption}` },
          { type: "text", value: `# Hashtag:\n${pack.hashtags}` },
          { type: "text", value: `🎬 Shotlist:\n- ${pack.shotlist.join("\n- ")}` },
        ],
      });
    }, 1500);
  });
})();
