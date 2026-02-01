// music.panel.js  (TEK DOSYA: guard + music hook)
(function () {
  "use strict";

  function pageKey() {
    const b = document.body;
    const fromBody = b?.getAttribute("data-page") || b?.dataset?.page || b?.id || "";
    let fromUrl = "";
    try {
      const u = new URL(location.href);
      fromUrl = u.searchParams.get("to") || u.searchParams.get("page") || u.searchParams.get("tab") || "";
    } catch {}
    return String(fromUrl || fromBody || "").toLowerCase();
  }

  function isMusicPage() {
    const k = pageKey();
    return (
      k.includes("muzik") ||
      k.includes("müzik") ||
      k.includes("music") ||
      k.includes("ses") ||
      k.includes("audio") ||
      k.includes("kayit") ||
      k.includes("kayıt")
    );
  }

  function isMusicGenerateButton(el) {
    const btn = el?.closest?.("button,a,[role='button'],input[type='button'],input[type='submit']");
    if (!btn) return false;

    const t = (btn.textContent || btn.value || "").toLowerCase();
    // buton yazısı
    if (t.includes("müzik üret") || t.includes("muzik uret")) return true;

    // olası id/class/data
    if (btn.id && btn.id.toLowerCase().includes("music")) return true;
    if (btn.className && String(btn.className).toLowerCase().includes("music")) return true;
    if (btn.dataset && (btn.dataset.action === "music-generate" || btn.dataset.kind === "audio")) return true;

    return false;
  }

  // ✅ Public API (buraya gerçek create’i bağlayacağız)
  window.AIVO_MUSIC = window.AIVO_MUSIC || {};
  window.AIVO_MUSIC.create = window.AIVO_MUSIC.create || function () {
    console.log("[AIVO_MUSIC.create] çağrıldı (şimdilik placeholder)");
    alert("MÜZİK CREATE YAKALANDI ✅ (şimdi gerçek endpoint'i bağlayacağız)");
  };

  // ✅ GUARD: music sayfasında “Müzik Üret” click’ini capture’da yakala, legacy’yi boğ
  document.addEventListener(
    "click",
    function (e) {
      if (!isMusicPage()) return;
      if (!isMusicGenerateButton(e.target)) return;

      // kritik: alttaki handler’lar (studio.js vs.) artık çalışamaz
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      try {
        window.AIVO_MUSIC.create();
      } catch (err) {
        console.warn("AIVO_MUSIC.create hata:", err);
      }
    },
    true // CAPTURE !!!
  );

  console.log("[music.panel.js] loaded. isMusicPage=", isMusicPage(), "pageKey=", pageKey());
})();
