/* =========================================================
   AIVO — SM PACK MODULE (ROBUST / FAKE JOB)
   - HTML değişse bile çalışsın diye esnek selector
   ========================================================= */

(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("[SM_PACK] AIVO_APP yok. (studio.app.js çalışmıyor olabilir)");
    return;
  }

  var COST = 5;

  function getBrief() {
    var el =
      document.getElementById("smPackInput") ||
      document.querySelector(".page-sm-pack .input") ||
      document.querySelector('[data-page="sm-pack"] .input');
    return el ? String(el.value || "").trim() : "";
  }

  function getTheme() {
    var active =
      document.querySelector(".page-sm-pack [data-smpack-theme].is-active") ||
      document.querySelector(".page-sm-pack .smpack-choice.is-active");
    return active ? (active.getAttribute("data-smpack-theme") || "viral") : "viral";
  }

  function getPlatform() {
    var active =
      document.querySelector(".page-sm-pack [data-smpack-platform].is-active") ||
      document.querySelector(".page-sm-pack .smpack-pill.is-active");
    return active ? (active.getAttribute("data-smpack-platform") || "tiktok") : "tiktok";
  }

  function themeLabel(t) {
    if (t === "fun") return "Eğlenceli";
    if (t === "emotional") return "Duygusal";
    if (t === "brand") return "Marka / Tanıtım";
    return "Viral";
  }

  function platformLabel(p) {
    if (p === "reels") return "Instagram Reels";
    if (p === "shorts") return "YouTube Shorts";
    return "TikTok";
  }

  function buildItems(brief, theme, platform) {
    var t = themeLabel(theme);
    var p = platformLabel(platform);

    return [
      { type: "text", value: "🎯 Tema: " + t + " | Platform: " + p },
      { type: "text", value: "🧠 Brief: " + brief },
      { type: "text", value: "🎬 Hook: “Dur ve dinle: " + brief + "”" },
      { type: "text", value: "📝 Caption: " + brief + " — 10 saniyede anlat!" },
      { type: "text", value: "#️⃣ Hashtag: #aivo #viral #ai #kesfet" },
      { type: "text", value: "🖼️ Kapak: (yakında) konsept + başlık" },
      { type: "text", value: "🎵 Müzik: (yakında) 10–15 sn loop" },
      { type: "text", value: "🎞️ Video Loop: (yakında) 6–10 sn sahne" }
    ];
  }

  // Tema seçimi
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".page-sm-pack [data-smpack-theme], .page-sm-pack .smpack-choice");
    if (!btn) return;

    document
      .querySelectorAll(".page-sm-pack [data-smpack-theme].is-active, .page-sm-pack .smpack-choice.is-active")
      .forEach(function (x) { x.classList.remove("is-active"); });

    btn.classList.add("is-active");
  });

  // Platform seçimi
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".page-sm-pack [data-smpack-platform], .page-sm-pack .smpack-pill");
    if (!btn) return;

    document
      .querySelectorAll(".page-sm-pack [data-smpack-platform].is-active, .page-sm-pack .smpack-pill.is-active")
      .forEach(function (x) { x.classList.remove("is-active"); });

    btn.classList.add("is-active");
  });

  // Generate
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".page-sm-pack [data-generate-sm-pack], .page-sm-pack .smpack-generate");
    if (!btn) return;

    var brief = getBrief();
    if (!brief) {
      alert("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");
      return;
    }

    var theme = getTheme();
    var platform = getPlatform();

    var job = window.AIVO_APP.createJob({
      type: "SM_PACK",
      title: "Sosyal Medya Paketi",
      cost: COST
    });

    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(function () {
      window.AIVO_APP.updateJobStatus(job.id, "Paket oluşturuluyor…");
    }, 650);

    setTimeout(function () {
      window.AIVO_APP.completeJob(job.id, {
        title: "SM Pack Çıktıları",
        items: buildItems(brief, theme, platform)
      });
    }, 1400);
  });

  console.log("[SM_PACK] module loaded OK");
})();
