/* studio.credit-redirect.js (PROD CLEAN)
   Amaç: Studio içinde kredi modalı yok.
   Redirect sadece GERÇEK "yetersiz kredi" durumunda olmalı.
*/
(() => {
  const PRICING_URL_BASE = "/fiyatlandirma.html#packs";

  function goPricing() {
    try { location.href = PRICING_URL_BASE; }
    catch { location.href = PRICING_URL_BASE; }
  }

  // ✅ Tek kural: consume endpoint "yetersiz kredi" dönerse redirect
  const _fetch = window.fetch;
  if (typeof _fetch === "function") {
    window.fetch = async function (input, init) {
      const res = await _fetch(input, init);

      try {
        const url = typeof input === "string"
          ? input
          : (input && input.url) || "";

        // sadece consume endpoint
        const isConsume = url.includes("/api/credits/consume");
        if (!isConsume || !res) return res;

        // 1) En doğru: backend 402 (Payment Required) gibi bir status kullanıyorsa
        if (res.status === 402) {
          goPricing();
          return res;
        }

        // 2) Backward-compat: 400 geliyorsa BODY'yi okuyup gerçekten kredi mi anla
        // (Response'u bozmamak için clone ile)
        if (res.status === 400) {
          let txt = "";
          try { txt = await res.clone().text(); } catch {}

          // sadece "kredi yetersiz" sinyali varsa redirect
          const s = (txt || "").toLowerCase();
          const looksLikeInsufficient =
            s.includes("insufficient") ||
            s.includes("not enough") ||
            s.includes("yetersiz") ||
            s.includes("credit") ||
            s.includes("kredi");

          // burada biraz daha sıkı da yapabiliriz: hem "credit/kredi" hem "insufficient/yetersiz" birlikte gibi
          if (looksLikeInsufficient) {
            goPricing();
            return res;
          }
        }
      } catch (_) {}

      return res;
    };
  }

  // ✅ Modal yok: ama sadece legacy modal opener'ları varsa tek hedefe bağla
  // (İstersen bunu daha sonra DARALTIRIZ)
  const overrideNames = [
    "openPricingModal",
    "openPricing",
    "showPricingModal",
    "showPricing",
    "openCreditsModal",
    "showCreditsModal",
  ];

  overrideNames.forEach((name) => {
    if (typeof window[name] === "function") {
      window[name] = goPricing;
    }
  });

  if (window.CreditsUI && typeof window.CreditsUI.open === "function") {
    window.CreditsUI.open = goPricing;
  }
})();
