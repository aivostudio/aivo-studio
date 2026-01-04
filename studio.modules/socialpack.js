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

  const COST = 5;

  function getBrief() {
    const el =
      document.getElementById("smPackInput") ||
      document.querySelector(".page-sm-pack .input") ||
      document.querySelector('[data-page="sm-pack"] .input');
    return el ? String(el.value || "").trim() : "";
  }

  function getTheme() {
    const active =
      document.querySelector(".page-sm-pack [data-smpack-theme].is-active") ||
      document.querySelector(".page-sm-pack .smpack-choice.is-active");
    return active ? (active.getAttribute("data-smpack-theme") || "viral") : "viral";
  }

  function getPlatform() {
    const active =
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
    const t = themeLabel(theme);
    const p = platformLabel(platform);

    return [
      { type: "text", value: `🎯 Tema: ${t} | Platform: ${p}` },
      { type: "text", value: `🧠 Brief: ${brief}` },
      { type: "text", value: `🎬 Hook: “Dur ve dinle: ${brief}”` },
      { type: "text", value: `📝 Caption: ${brief} — 10 saniyede anlat!` },
      { type: "text", value: `#️⃣ Hashtag: #aivo #viral #ai #keşfet` },
      { type: "text", value: "🖼️ Kapak: (yakında) konsept + başlık" },
      { type: "text", value: "🎵 Müzik: (yakında
